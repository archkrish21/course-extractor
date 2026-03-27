import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  subscriptionPlans,
  divisions,
  departments,
  fourYearPlans,
  planCourses,
  courses,
  courseCatalogVersions,
  users,
  accounts,
  accountMembers,
  subscriptions,
} from "../lib/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { SUBSCRIPTION_PLANS } from "../config/subscription-plans";
import { PLAN_TEMPLATES } from "../config/seeds/plan-templates";
import { logger } from "../lib/logger";

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  });
  const db = drizzle(pool);

  logger.info("Starting database seed...");

  // ─── Seed subscription plans ────────────────────────────────────────────
  logger.info("Seeding subscription plans...");
  for (const plan of SUBSCRIPTION_PLANS) {
    await db
      .insert(subscriptionPlans)
      .values({
        name: plan.name,
        displayName: plan.displayName,
        priceMonthly: plan.priceMonthly?.toString() ?? null,
        priceAnnual: plan.priceAnnual?.toString() ?? null,
        maxPlans: plan.maxPlans,
        features: plan.features,
      })
      .onConflictDoUpdate({
        target: subscriptionPlans.name,
        set: {
          displayName: plan.displayName,
          priceMonthly: plan.priceMonthly?.toString() ?? null,
          priceAnnual: plan.priceAnnual?.toString() ?? null,
          maxPlans: plan.maxPlans,
          features: plan.features,
        },
      });
  }
  logger.info(`Seeded ${SUBSCRIPTION_PLANS.length} subscription plans`);

  // ─── Seed divisions and departments ─────────────────────────────────────
  logger.info("Seeding divisions and departments...");

  const divisionData: {
    name: string;
    code: string;
    displayOrder: number;
    departments: string[];
  }[] = [
    {
      name: "English",
      code: "ENG",
      displayOrder: 1,
      departments: [
        "English Language Arts",
        "Creative Writing",
        "Journalism",
      ],
    },
    {
      name: "Mathematics",
      code: "MATH",
      displayOrder: 2,
      departments: [
        "Core Mathematics",
        "Applied Mathematics",
        "Computer Science",
      ],
    },
    {
      name: "Science",
      code: "SCI",
      displayOrder: 3,
      departments: [
        "Life Sciences",
        "Physical Sciences",
        "Earth & Environmental Science",
      ],
    },
    {
      name: "Social Studies",
      code: "SS",
      displayOrder: 4,
      departments: [
        "History",
        "Government & Economics",
        "Psychology & Sociology",
      ],
    },
    {
      name: "World Languages",
      code: "WL",
      displayOrder: 5,
      departments: ["Spanish", "French", "German", "Chinese", "Latin"],
    },
    {
      name: "Fine Arts",
      code: "FA",
      displayOrder: 6,
      departments: [
        "Visual Arts",
        "Music",
        "Theatre",
        "Dance",
      ],
    },
    {
      name: "Applied Technology",
      code: "AT",
      displayOrder: 7,
      departments: [
        "Engineering & Technology",
        "Information Technology",
        "Family & Consumer Sciences",
      ],
    },
    {
      name: "Physical Education",
      code: "PE",
      displayOrder: 8,
      departments: ["Physical Education", "Health", "Driver Education"],
    },
    {
      name: "Business Education",
      code: "BUS",
      displayOrder: 9,
      departments: [
        "Business & Marketing",
        "Accounting & Finance",
      ],
    },
    {
      name: "Special Education",
      code: "SPED",
      displayOrder: 10,
      departments: [
        "Resource Services",
        "Transition Services",
      ],
    },
  ];

  for (const div of divisionData) {
    // Upsert division
    const [insertedDiv] = await db
      .insert(divisions)
      .values({
        name: div.name,
        code: div.code,
        displayOrder: div.displayOrder,
      })
      .onConflictDoUpdate({
        target: divisions.name,
        set: {
          code: div.code,
          displayOrder: div.displayOrder,
        },
      })
      .returning({ id: divisions.id });

    // Upsert departments
    for (const [idx, deptName] of div.departments.entries()) {
      await db
        .insert(departments)
        .values({
          divisionId: insertedDiv.id,
          name: deptName,
          displayOrder: idx + 1,
        })
        .onConflictDoUpdate({
          target: [departments.divisionId, departments.name],
          set: {
            displayOrder: idx + 1,
          },
        });
    }
  }

  const totalDepts = divisionData.reduce(
    (sum, d) => sum + d.departments.length,
    0
  );
  logger.info(
    `Seeded ${divisionData.length} divisions and ${totalDepts} departments`
  );

  // ─── Seed plan templates ───────────────────────────────────────────────
  logger.info("Seeding plan templates...");

  // Get the latest catalog version — templates are tied to a catalog version
  const latestCatalogVersion = await db
    .select({ id: courseCatalogVersions.id, schoolYear: courseCatalogVersions.schoolYear })
    .from(courseCatalogVersions)
    .orderBy(desc(courseCatalogVersions.loadedAt))
    .limit(1)
    .then((rows) => rows[0]);

  if (!latestCatalogVersion) {
    logger.warn("No catalog version found — skipping plan template seeding. Load courses first.");
  } else {
    // Build a lookup map: course code → course ID for the latest catalog version
    const allCourses = await db
      .select({ id: courses.id, code: courses.code })
      .from(courses)
      .where(
        and(
          eq(courses.catalogVersionId, latestCatalogVersion.id),
          eq(courses.isActive, true)
        )
      );

    const courseCodeToId = new Map<string, string>();
    for (const c of allCourses) {
      courseCodeToId.set(c.code, c.id);
    }

    let templatesSeeded = 0;
    let templateCoursesSeeded = 0;

    for (const template of PLAN_TEMPLATES) {
      // Check if this template already exists (by name + is_template)
      const existing = await db
        .select({ id: fourYearPlans.id })
        .from(fourYearPlans)
        .where(
          and(
            eq(fourYearPlans.name, template.name),
            eq(fourYearPlans.isTemplate, true)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      let templatePlanId: string;

      if (existing) {
        templatePlanId = existing.id;
        // Update the existing template name (in case description changed, etc.)
        // Note: description is not a column on fourYearPlans — it is stored
        // as part of the template metadata. For now we just reuse the ID.
        logger.info(`Template "${template.name}" already exists (${templatePlanId}), updating courses...`);

        // Delete existing plan_courses for this template so we can re-insert
        await db
          .delete(planCourses)
          .where(eq(planCourses.planId, templatePlanId));
      } else {
        // Insert the plan as a template (studentId = null, isTemplate = true)
        const [insertedPlan] = await db
          .insert(fourYearPlans)
          .values({
            name: template.name,
            schoolYear: latestCatalogVersion.schoolYear,
            catalogVersionId: latestCatalogVersion.id,
            isTemplate: true,
            status: "active",
            isPrimary: false,
          })
          .returning({ id: fourYearPlans.id });

        templatePlanId = insertedPlan.id;
      }

      // Insert plan_courses for each course in the template
      let coursesInserted = 0;
      const missingCodes: string[] = [];

      for (const tc of template.courses) {
        const courseId = courseCodeToId.get(tc.code);
        if (!courseId) {
          missingCodes.push(tc.code);
          continue;
        }

        // Full-year courses (semester: null) are stored as two rows (sem 1 + sem 2)
        const semesters = tc.semester === null ? [1, 2] : [tc.semester];

        for (const sem of semesters) {
          await db
            .insert(planCourses)
            .values({
              planId: templatePlanId,
              courseId,
              gradeLevel: tc.grade_level,
              semester: sem,
              status: "planned",
              displayOrder: coursesInserted,
            })
            .onConflictDoNothing();

          coursesInserted++;
        }
      }

      if (missingCodes.length > 0) {
        logger.warn(
          `Template "${template.name}": ${missingCodes.length} course code(s) not found in catalog: ${missingCodes.join(", ")}`
        );
      }

      templateCoursesSeeded += coursesInserted;
      templatesSeeded++;
      logger.info(
        `Template "${template.name}": ${coursesInserted} courses seeded`
      );
    }

    logger.info(
      `Seeded ${templatesSeeded} plan templates with ${templateCoursesSeeded} total courses`
    );
  }

  // ─── Backfill accounts for existing students ──────────────────────────────
  // Creates account and account_members rows for any student user that
  // does not yet have a corresponding account (migration compatibility).
  logger.info("Backfilling accounts for existing student users...");

  const studentUsers = await db
    .select({
      id: users.id,
      email: users.email,
      dateOfBirth: users.dateOfBirth,
    })
    .from(users)
    .where(eq(users.role, "student"));

  let accountsCreated = 0;

  for (const student of studentUsers) {
    // Check if this student already has an account
    const existingAccount = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.studentUserId, student.id))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (existingAccount) {
      continue; // Already has an account
    }

    // Derive a student name from the email prefix
    const studentName = student.email.split("@")[0];

    // Create the account
    const [newAccount] = await db
      .insert(accounts)
      .values({
        studentName,
        studentDateOfBirth: student.dateOfBirth,
        studentUserId: student.id,
        createdBy: student.id,
        claimedAt: new Date(),
      })
      .returning({ id: accounts.id });

    // Create account membership
    await db
      .insert(accountMembers)
      .values({
        accountId: newAccount.id,
        userId: student.id,
        role: "student",
        canEdit: true,
      })
      .onConflictDoNothing();

    // Link existing subscription to the account if one exists
    await db
      .update(subscriptions)
      .set({ accountId: newAccount.id })
      .where(
        and(
          eq(subscriptions.userId, student.id),
          isNull(subscriptions.accountId)
        )
      );

    accountsCreated++;
  }

  if (accountsCreated > 0) {
    logger.info(`Backfilled ${accountsCreated} account(s) for existing students`);
  } else {
    logger.info("No student accounts needed backfilling");
  }

  logger.info("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
