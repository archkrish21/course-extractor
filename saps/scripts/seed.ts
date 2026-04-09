import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  subscriptionPlans,
  divisions,
  departments,
  graduationRequirements,
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

  try {
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
        priceFourYear: plan.priceFourYear?.toString() ?? null,
        maxPlans: plan.maxPlans,
        features: plan.features,
      })
      .onConflictDoUpdate({
        target: subscriptionPlans.name,
        set: {
          displayName: plan.displayName,
          priceMonthly: plan.priceMonthly?.toString() ?? null,
          priceAnnual: plan.priceAnnual?.toString() ?? null,
          priceFourYear: plan.priceFourYear?.toString() ?? null,
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

  // ─── Seed graduation requirements ──────────────────────────────────────
  logger.info("Seeding graduation requirements...");

  // Get the latest catalog version for graduation requirements
  const gradCatalogVersion = await db
    .select({ id: courseCatalogVersions.id })
    .from(courseCatalogVersions)
    .orderBy(desc(courseCatalogVersions.loadedAt))
    .limit(1)
    .then((rows) => rows[0]);

  if (!gradCatalogVersion) {
    logger.warn("No catalog version found — skipping graduation requirements seeding.");
  } else {
    // Build a lookup map: division name → division ID
    const allDivisions = await db
      .select({ id: divisions.id, name: divisions.name })
      .from(divisions);

    const divisionNameToId = new Map<string, string>();
    for (const d of allDivisions) {
      divisionNameToId.set(d.name, d.id);
    }

    interface SeedRequirement {
      requirementName: string;
      category: string;
      requiredCredits: string;
      divisionName: string | null;
      notes: string | null;
      matchingRule?: Record<string, unknown>;
      requirementGroup?: string;
      evaluationType?: string;
      displayOrder?: number;
      isOptIn?: boolean;
    }

    const allRequirements: SeedRequirement[] = [
      // ─── Graduation Requirements (Tier 1) ──────────────────────────
      { requirementName: "English", category: "English", requiredCredits: "8.0", divisionName: "Communication Arts", notes: null, matchingRule: { type: "code_prefix", prefix: "ENG" }, displayOrder: 1 },
      { requirementName: "Mathematics", category: "Mathematics", requiredCredits: "6.0", divisionName: "Mathematics", notes: null, matchingRule: { type: "division" }, displayOrder: 2 },
      { requirementName: "Biology", category: "Science", requiredCredits: "2.0", divisionName: "Science", notes: null, matchingRule: { type: "codes", codes: ["SCI111/SCI112", "SCI631/SCI632", "SCI63E1/SCI63E2", "SCI351/SCI352", "SCI521/SCI522", "SCI531/SCI532"] }, displayOrder: 3 },
      { requirementName: "Physical Science", category: "Science", requiredCredits: "2.0", divisionName: "Science", notes: null, matchingRule: { type: "codes", codes: ["SCI211/SCI212", "SCI271/SCI272", "SCI401/SCI402", "SCI611/SCI612", "SCI61E1/SCI61E2", "SCI641/SCI642", "SCI651/SCI652", "SCI65E1/SCI65E2", "SCI661/SCI662", "SCI66E1/SCI66E2", "SCI671/SCI672", "SCI681/SCI682"] }, displayOrder: 4 },
      { requirementName: "U.S. History", category: "Social Studies", requiredCredits: "2.0", divisionName: "Social Studies", notes: null, matchingRule: { type: "codes", codes: ["SOC321/SOC322", "SOC621/SOC622", "SOC691/SOC692", "ENG341/ENG342", "SOC41S", "SOC42S"] }, displayOrder: 5 },
      { requirementName: "World History and Geography", category: "Social Studies", requiredCredits: "2.0", divisionName: "Social Studies", notes: null, matchingRule: { type: "codes", codes: ["SOC101/SOC102", "SOC13S/SOC14S"] }, displayOrder: 6 },
      { requirementName: "Government", category: "Social Studies", requiredCredits: "1.0", divisionName: "Social Studies", notes: null, matchingRule: { type: "codes", codes: ["SOC401", "SOC402", "SOC631", "SOC632", "SOC681", "SOC682", "SOC33S/SOC34S"] }, displayOrder: 7 },
      { requirementName: "Economics or Personal Finance", category: "Social Studies", requiredCredits: "1.0", divisionName: "Social Studies", notes: "Economics, AP Macro/Micro, or Personal Finance", matchingRule: { type: "codes", codes: ["SOC411/SOC412", "SOC641", "SOC642", "SOC651", "SOC652", "BUS301", "BUS302", "SOC43S", "SOC44S"] }, displayOrder: 8 },
      { requirementName: "Health", category: "Physical Welfare", requiredCredits: "1.0", divisionName: "Physical Welfare", notes: null, matchingRule: { type: "codes", codes: ["PED201", "PED202", "PED21S", "PED22S"] }, displayOrder: 9 },
      { requirementName: "Driver Education", category: "Physical Welfare", requiredCredits: "1.0", divisionName: "Applied Arts", notes: null, matchingRule: { type: "codes", codes: ["D/E231", "D/E232", "D/E21S", "D/E22S"] }, displayOrder: 10 },
      { requirementName: "Required Electives", category: "Electives", requiredCredits: "2.0", divisionName: "Fine Arts", notes: "From: Applied Arts, Fine Arts, Multilingual Learning, or CSET", matchingRule: { type: "multi_division", divisionNames: ["Applied Arts", "Fine Arts", "Multilingual Learning", "Computer Science, Engineering and Technology"] }, displayOrder: 11 },
      { requirementName: "Additional Credits and P.E.", category: "Physical Welfare", requiredCredits: "17.0", divisionName: "Physical Welfare", notes: "All remaining credits including P.E.", matchingRule: { type: "remainder" }, displayOrder: 12 },

      // ─── IL Public University Admission (Tier 2) — opt-in ─────────
      { requirementName: "English (University)", category: "English", requiredCredits: "8.0", divisionName: "Communication Arts", notes: "Emphasis on written/oral communication and literature", matchingRule: { type: "code_prefix", prefix: "ENG" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 1 },
      { requirementName: "Mathematics (University)", category: "Mathematics", requiredCredits: "6.0", divisionName: "Mathematics", notes: "Including algebra, advanced algebra, geometry and/or trigonometry", matchingRule: { type: "division" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 2 },
      { requirementName: "Science (University)", category: "Science", requiredCredits: "6.0", divisionName: "Science", notes: "Lab sciences with foundation in biology, chemistry and physics", matchingRule: { type: "division" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 3 },
      { requirementName: "Social Studies (University)", category: "Social Studies", requiredCredits: "6.0", divisionName: "Social Studies", notes: "Emphasis on history and government", matchingRule: { type: "division" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 4 },
      { requirementName: "Electives (University)", category: "Electives", requiredCredits: "4.0", divisionName: "Fine Arts", notes: "From: Multilingual Learning, Applied Arts, or Fine Arts", matchingRule: { type: "multi_division", divisionNames: ["Multilingual Learning", "Applied Arts", "Fine Arts"] }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 5 },

      // ─── Non-Course Requirements (Tier 3) ─────────────────────────
      { requirementName: "ACT Graduation Requirement", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "Must take the ACT exam", requirementGroup: "non_course", evaluationType: "manual_checkbox", displayOrder: 1 },
      { requirementName: "FAFSA Requirement", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "File FAFSA, IL alternative application, or non-participation form (senior year)", requirementGroup: "non_course", evaluationType: "manual_checkbox", displayOrder: 2 },
      { requirementName: "46th Credit (Drug Education)", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "Automatic upon completing Health Education", matchingRule: { type: "codes", codes: ["PED201", "PED202"] }, requirementGroup: "non_course", evaluationType: "auto_from_course", displayOrder: 3 },
      { requirementName: "Civics and Patriotism Assessments", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "Automatic upon passing Government course assessments", matchingRule: { type: "codes", codes: ["SOC401", "SOC402", "SOC631", "SOC632", "SOC681", "SOC682"] }, requirementGroup: "non_course", evaluationType: "auto_from_course", displayOrder: 4 },

      // ─── Course Load Per-Semester (Tier 5) ────────────────────────
      ...([9, 10, 11, 12] as const).flatMap((grade) =>
        ([1, 2] as const).map((sem) => ({
          requirementName: `Course Load — Grade ${grade} Sem ${sem}`,
          category: "Course Load",
          requiredCredits: "0.0",
          divisionName: null as string | null,
          notes: `Min 5, max 7 courses (8 with Early Bird)`,
          matchingRule: { type: "course_load", gradeLevel: grade, semester: sem, minCourses: 5, maxCourses: 7, maxWithEarlyBird: 8 },
          requirementGroup: "course_load",
          evaluationType: "course_load_check",
          displayOrder: (grade - 9) * 2 + sem,
        }))
      ),

      // ─── Physical Welfare Per-Semester (Tier 5b) ──────────────────
      // Each semester must include a Physical Welfare, Dance, or Driver Ed course (or waiver — waivers deferred)
      ...([9, 10, 11, 12] as const).flatMap((grade) =>
        ([1, 2] as const).map((sem) => ({
          requirementName: `PW/Dance/DriverEd — Grade ${grade} Sem ${sem}`,
          category: "Course Load",
          requiredCredits: "0.0",
          divisionName: null as string | null,
          notes: "Must include a Physical Welfare, Dance, or Driver Education course each semester",
          matchingRule: { type: "pw_dance_check", gradeLevel: grade, semester: sem, divisionNames: ["Physical Welfare"], codePrefixes: ["DNC", "D/E"] },
          requirementGroup: "course_load",
          evaluationType: "pw_dance_check",
          displayOrder: 10 + (grade - 9) * 2 + sem,
        }))
      ),
    ];

    let reqsSeeded = 0;

    for (const req of allRequirements) {
      const divisionId = req.divisionName ? divisionNameToId.get(req.divisionName) : null;
      if (req.divisionName && !divisionId) {
        logger.warn(`Division "${req.divisionName}" not found — skipping requirement "${req.requirementName}"`);
        continue;
      }

      await db
        .insert(graduationRequirements)
        .values({
          divisionId: divisionId ?? null,
          requirementName: req.requirementName,
          requiredCredits: req.requiredCredits,
          eligibleCreditTypes: [req.category],
          matchingRule: req.matchingRule ?? null,
          notes: req.notes,
          catalogVersionId: gradCatalogVersion.id,
          requirementGroup: req.requirementGroup ?? "graduation",
          evaluationType: req.evaluationType ?? "course_match",
          displayOrder: req.displayOrder ?? 0,
          isOptIn: req.isOptIn ?? false,
        })
        .onConflictDoUpdate({
          target: [graduationRequirements.catalogVersionId, graduationRequirements.requirementName],
          set: {
            divisionId: divisionId ?? null,
            requiredCredits: req.requiredCredits,
            eligibleCreditTypes: [req.category],
            matchingRule: req.matchingRule ?? null,
            notes: req.notes,
            requirementGroup: req.requirementGroup ?? "graduation",
            evaluationType: req.evaluationType ?? "course_match",
            displayOrder: req.displayOrder ?? 0,
            isOptIn: req.isOptIn ?? false,
          },
        });

      reqsSeeded++;
    }

    logger.info(`Seeded ${reqsSeeded} requirements (graduation + university + non-course + honors + course load)`);
  }

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
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
