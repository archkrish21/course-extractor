import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  users,
  studentProfiles,
  fourYearPlans,
  planCourses,
  gradeEntries,
  courses,
  courseCatalogVersions,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";
import { rateLimit } from "@/lib/api/rate-limit";
import { ALL_GRADES } from "@/config/grade-scale";

const courseCompletedSchema = z.object({
  code: z.string().min(1),
  grade: z.enum(ALL_GRADES),
  academic_year: z.string().min(1),
  semester: z.number().int().min(1).max(2),
});

const collegeTargetSchema = z.object({
  reach: z.string().optional(),
  match: z.string().optional(),
  safety: z.string().optional(),
});

const onboardingSchema = z.object({
  grade_level: z.number().int().min(9).max(12),
  graduation_year: z.number().int().min(2025).max(2035),
  courses_completed: z.array(courseCompletedSchema).optional(),
  template_id: z.string().uuid().optional(),
  gpa_goal: z.number().min(0).max(4.0).optional(),
  college_targets: collegeTargetSchema.optional(),
  career_goals: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await requireAuth();
    if (authResult instanceof Response) return authResult;
    const user = authResult;

    // Rate limit: 10 requests/minute per user
    const rateLimitResult = await rateLimit(`auth:onboarding:${user.id}`, 10, 60);
    if (!rateLimitResult.success) {
      return errorResponse(
        "RATE_LIMITED",
        `Rate limit exceeded. Try again in ${rateLimitResult.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
        429,
        { retry_after: rateLimitResult.resetAt - Math.floor(Date.now() / 1000) }
      );
    }

    // Parse body
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        400
      );
    }

    const {
      grade_level,
      graduation_year,
      courses_completed,
      template_id,
      gpa_goal,
      college_targets,
      career_goals,
    } = parsed.data;

    // Verify user is a student
    const userRecord = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!userRecord || userRecord.role !== "student") {
      return errorResponse(
        "FORBIDDEN",
        "Only student accounts can complete onboarding.",
        403
      );
    }

    // Update student profile
    await db
      .update(studentProfiles)
      .set({
        currentGradeLevel: grade_level,
        graduationYear: graduation_year,
        ...(gpa_goal !== undefined && { gpaGoal: gpa_goal.toFixed(2) }),
        ...(college_targets && { collegeTargets: college_targets }),
        ...(career_goals && { careerGoals: { interests: career_goals } }),
      })
      .where(eq(studentProfiles.userId, user.id));

    // Get latest catalog version
    const latestVersion = await db
      .select({ id: courseCatalogVersions.id, schoolYear: courseCatalogVersions.schoolYear })
      .from(courseCatalogVersions)
      .orderBy(desc(courseCatalogVersions.loadedAt))
      .limit(1)
      .then((rows) => rows[0]);

    // Process completed courses (grade entries)
    let gradesCreated = 0;
    if (courses_completed && courses_completed.length > 0 && latestVersion) {
      // Build code-to-id lookup for completed courses
      const allCourses = await db
        .select({ id: courses.id, code: courses.code, creditValue: courses.creditValue })
        .from(courses)
        .where(
          and(
            eq(courses.catalogVersionId, latestVersion.id),
            eq(courses.isActive, true)
          )
        );

      const codeToId = new Map<string, { id: string; creditValue: string }>();
      for (const c of allCourses) {
        codeToId.set(c.code, { id: c.id, creditValue: c.creditValue });
      }

      for (const entry of courses_completed) {
        const courseInfo = codeToId.get(entry.code);
        if (!courseInfo) continue;

        await db
          .insert(gradeEntries)
          .values({
            studentId: user.id,
            courseId: courseInfo.id,
            academicYear: entry.academic_year,
            semester: entry.semester,
            gradeType: "letter",
            finalGrade: entry.grade,
            creditEarned: courseInfo.creditValue,
          })
          .onConflictDoNothing();

        gradesCreated++;
      }
    }

    // Create plan from template
    let planId: string | null = null;
    if (template_id && latestVersion) {
      // Verify template exists
      const template = await db
        .select({
          id: fourYearPlans.id,
          name: fourYearPlans.name,
          schoolYear: fourYearPlans.schoolYear,
          catalogVersionId: fourYearPlans.catalogVersionId,
        })
        .from(fourYearPlans)
        .where(
          and(
            eq(fourYearPlans.id, template_id),
            eq(fourYearPlans.isTemplate, true)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!template) {
        return errorResponse("NOT_FOUND", "Plan template not found.", 404);
      }

      // Create new plan from template
      const now = new Date();
      const [newPlan] = await db
        .insert(fourYearPlans)
        .values({
          studentId: user.id,
          name: `My ${template.name} Plan`,
          schoolYear: template.schoolYear,
          catalogVersionId: template.catalogVersionId,
          createdFromTemplateId: template.id,
          isTemplate: false,
          status: "active",
          isPrimary: true,
          activatedAt: now,
        })
        .returning({ id: fourYearPlans.id });

      planId = newPlan.id;

      // Copy template courses into the new plan
      const templateCourses = await db
        .select({
          courseId: planCourses.courseId,
          gradeLevel: planCourses.gradeLevel,
          semester: planCourses.semester,
          displayOrder: planCourses.displayOrder,
        })
        .from(planCourses)
        .where(eq(planCourses.planId, template.id));

      for (const tc of templateCourses) {
        await db
          .insert(planCourses)
          .values({
            planId: newPlan.id,
            courseId: tc.courseId,
            gradeLevel: tc.gradeLevel,
            semester: tc.semester,
            status: "planned",
            displayOrder: tc.displayOrder,
          })
          .onConflictDoNothing();
      }
    }

    return successResponse(
      {
        success: true,
        plan_id: planId,
        grades_created: gradesCreated,
      },
      undefined,
      200
    );
  } catch (error) {
    console.error("[onboarding] Unexpected error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
