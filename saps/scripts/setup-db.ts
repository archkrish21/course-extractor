/**
 * Unified database setup script.
 *
 * Performs ALL seeding in the correct order:
 *   1. Apply hand-written migrations (RLS policies, contact/school tables)
 *   2. Load course catalog from extractor JSON
 *   3. Seed subscription plans, divisions, departments
 *   4. Seed graduation requirements (depends on courses)
 *   5. Seed plan templates (depends on courses)
 *   6. Seed legal documents (ToS + Privacy Policy)
 *   7. Backfill accounts for existing students
 *
 * Usage:
 *   npx tsx scripts/setup-db.ts                     # full setup
 *   npx tsx scripts/setup-db.ts --skip-courses       # skip course catalog load (if already loaded)
 *   npx tsx scripts/setup-db.ts --skip-rls           # skip RLS migration (if already applied)
 *   npx tsx scripts/setup-db.ts --courses-only       # only load course catalog
 *   npx tsx scripts/setup-db.ts --dry-run            # show what would be done without writing
 *
 * Reads DATABASE_URL from .env.local. Safe to run multiple times — all
 * operations use upserts / ON CONFLICT so re-runs are idempotent.
 *
 * Safety: refuses to run if NODE_ENV=production.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, desc, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  subscriptionPlans,
  divisions,
  departments,
  graduationRequirements,
  fourYearPlans,
  planCourses,
  courses,
  courseCatalogVersions,
  coursePrerequisites,
  users,
  accounts,
  accountMembers,
  subscriptions,
} from "../lib/db/schema";
import { SUBSCRIPTION_PLANS } from "../config/subscription-plans";
import { PLAN_TEMPLATES } from "../config/seeds/plan-templates";
import { expandWithEquivalents } from "../lib/prereq/expand-prereqs";
import { seedLegalDocuments, LEGAL_DOCUMENT_SEEDS } from "./seeds/legal-documents";

// ─── Safety ─────────────────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: setup-db cannot run in production (NODE_ENV=production). Aborting.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Check your .env.local file.");
  process.exit(1);
}

// ─── CLI flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const skipCourses = args.includes("--skip-courses");
const skipRls = args.includes("--skip-rls");
const coursesOnly = args.includes("--courses-only");
const dryRun = args.includes("--dry-run");

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(step: string, msg: string) {
  const prefix = dryRun ? "[DRY RUN]" : "[setup]";
  console.log(`${prefix} [${step}] ${msg}`);
}

function warn(step: string, msg: string) {
  console.warn(`[setup] [${step}] WARNING: ${msg}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  // Warn if pointing at a hosted DB
  const dbUrl = process.env.DATABASE_URL!;
  if (dbUrl.includes("supabase.co") || dbUrl.includes("neon.tech") || dbUrl.includes("rds.amazonaws.com")) {
    console.log("\n⚠️  DATABASE_URL points to a hosted database.");
    console.log(`   ${dbUrl.slice(0, 60)}...`);
    console.log("   Proceeding in 3 seconds... (Ctrl+C to abort)\n");
    await new Promise((r) => setTimeout(r, 3000));
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // Step 1: Apply hand-written RLS migrations
    // ═══════════════════════════════════════════════════════════════════════

    if (!skipRls && !coursesOnly) {
      log("1/7", "Applying RLS policies and creating log tables...");

      if (!dryRun) {
        const migrationsDir = path.join(__dirname, "..", "lib", "db", "migrations");

        // Check if RLS is already applied (idempotent — safe to re-run)
        const { rows: rlsCheck } = await pool.query(
          "SELECT count(*) as c FROM pg_policies WHERE schemaname = 'public'"
        );
        const existingPolicies = parseInt(rlsCheck[0].c, 10);

        if (existingPolicies >= 36) {
          log("1/7", `RLS already applied (${existingPolicies} policies found). Skipping.`);
        } else {
          const rlsSql = fs.readFileSync(path.join(migrationsDir, "0009_enable_rls.sql"), "utf-8");
          await pool.query(rlsSql);
          log("1/7", "0009_enable_rls.sql applied.");
        }

        // 0010 uses IF NOT EXISTS so it's always safe to re-run
        const tablesSql = fs.readFileSync(path.join(migrationsDir, "0010_create_contact_school_tables.sql"), "utf-8");
        await pool.query(tablesSql);
        log("1/7", "0010_create_contact_school_tables.sql applied.");

        // Verify
        const { rows } = await pool.query(
          "SELECT count(*) FILTER (WHERE rowsecurity) as rls_on, count(*) as total FROM pg_tables WHERE schemaname='public'"
        );
        log("1/7", `RLS enabled: ${rows[0].rls_on}/${rows[0].total} tables.`);
      } else {
        log("1/7", "Would apply 0009_enable_rls.sql and 0010_create_contact_school_tables.sql");
      }
    } else if (coursesOnly) {
      log("1/7", "Skipped (--courses-only).");
    } else {
      log("1/7", "Skipped (--skip-rls).");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 2: Load course catalog from JSON
    // ═══════════════════════════════════════════════════════════════════════

    if (!skipCourses) {
      log("2/7", "Loading course catalog...");

      const jsonPath = path.join(__dirname, "..", "extractor", "data", "2026-courses-with-summer.json");
      if (!fs.existsSync(jsonPath)) {
        warn("2/7", `Course data not found at ${jsonPath}. Skipping.`);
      } else {
        const coursesData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        const catalogYear: number = coursesData.catalog_year;
        const courseList: Array<Record<string, unknown>> = coursesData.courses;
        log("2/7", `Loaded ${courseList.length} courses from JSON (catalog year: ${catalogYear}).`);

        if (!dryRun) {
          const schoolYear = `${catalogYear}-${catalogYear + 1}`;
          const now = new Date();

          // Wrap the entire course catalog refresh in a single transaction.
          // Without this, an interruption between the prereq DELETE and the
          // last INSERT (network blip, Ctrl-C, DNS hiccup) would leave the
          // database with a partial prereq graph until the next successful
          // re-run. Particularly important against production.
          const client = await pool.connect();
          try {
            await client.query("BEGIN");

            // 2a. Upsert catalog version
            const { rows: versionRows } = await client.query(
              `INSERT INTO course_catalog_versions
                 (school_year, source_pdf_url, change_summary, courses_added, courses_removed, courses_modified, loaded_at)
               VALUES ($1, $2, $3::jsonb, $4, 0, 0, $5)
               ON CONFLICT (school_year) DO UPDATE SET
                 source_pdf_url = EXCLUDED.source_pdf_url,
                 change_summary = EXCLUDED.change_summary,
                 courses_added = EXCLUDED.courses_added,
                 loaded_at = EXCLUDED.loaded_at
               RETURNING id`,
              [
                schoolYear,
                (coursesData.pdf_path as string) ?? "",
                JSON.stringify({ loaded_by: "setup-db" }),
                courseList.length,
                now,
              ]
            );
            const versionId = versionRows[0].id;
            log("2/7", `Catalog version: ${versionId}`);

            // Deactivate courses from previous versions
            await client.query(
              "UPDATE courses SET is_active = FALSE WHERE catalog_version_id != $1 AND is_active = TRUE",
              [versionId]
            );

            // 2b. Upsert divisions from course data
            const divisionNames = [...new Set(courseList.map((c) => c.division as string))];
            const divisionIds: Record<string, string> = {};

            for (const divName of divisionNames.sort()) {
              const divCode = divName.toUpperCase().replace(/\s+/g, "_").replace(/[,&]/g, "").slice(0, 20);
              const { rows } = await client.query(
                `INSERT INTO divisions (name, code) VALUES ($1, $2)
                 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [divName, divCode]
              );
              divisionIds[divName] = rows[0].id;
            }
            log("2/7", `Upserted ${divisionNames.length} divisions.`);

            // 2c. Upsert departments from course data
            const deptPairs = [...new Set(courseList.map((c) => `${c.division}|||${c.department}`))];
            const departmentIds: Record<string, string> = {};

            for (const pair of deptPairs.sort()) {
              const [divName, deptName] = pair.split("|||");
              const { rows } = await client.query(
                `INSERT INTO departments (name, division_id) VALUES ($1, $2)
                 ON CONFLICT (division_id, name) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [deptName, divisionIds[divName]]
              );
              departmentIds[pair] = rows[0].id;
            }
            log("2/7", `Upserted ${deptPairs.length} departments.`);

            // 2d. Build existing course lookup for upsert
            const { rows: existingRows } = await client.query(
              "SELECT id, code FROM courses WHERE catalog_version_id = $1",
              [versionId]
            );
            const existingByCode: Record<string, string> = {};
            for (const row of existingRows) {
              existingByCode[row.code] = row.id;
            }

            // 2e. Upsert courses
            const courseIds: Record<string, string> = {};
            const newCodes = new Set<string>();
            let insertedCount = 0;
            let updatedCount = 0;

            for (const c of courseList) {
              const code = c.code as string;
              const divId = divisionIds[c.division as string];
              const deptId = departmentIds[`${c.division}|||${c.department}`];
              newCodes.add(code);

              if (existingByCode[code]) {
                // Update existing
                await client.query(
                  `UPDATE courses SET
                     name = $1, division_id = $2, department_id = $3,
                     description = $4, credit_value = $5, duration = $6,
                     grade_levels = $7, credit_type = $8,
                     is_ap = $9, is_dual_credit = $10, is_honors = $11,
                     gpa_waiver = $12, semesters_offered = $13, notes = $14,
                     is_active = TRUE, updated_at = $15
                   WHERE id = $16`,
                  [
                    c.name, divId, deptId,
                    c.description ?? "", c.credit_value, c.duration,
                    c.grade_levels, c.credit_type,
                    c.is_ap ?? false, c.is_dual_credit ?? false,
                    c.credit_type === "Honors",
                    c.gpa_waiver ?? false, c.semesters_offered ?? null,
                    c.notes ?? null, now, existingByCode[code],
                  ]
                );
                courseIds[code] = existingByCode[code];
                updatedCount++;
              } else {
                // Insert new
                const { rows } = await client.query(
                  `INSERT INTO courses
                     (code, name, division_id, department_id, catalog_version_id,
                      description, credit_value, duration, grade_levels,
                      credit_type, is_ap, is_dual_credit, is_honors, gpa_waiver,
                      semesters_offered, notes, is_active, created_at, updated_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,$17,$18)
                   RETURNING id`,
                  [
                    code, c.name, divId, deptId, versionId,
                    c.description ?? "", c.credit_value, c.duration,
                    c.grade_levels, c.credit_type,
                    c.is_ap ?? false, c.is_dual_credit ?? false,
                    c.credit_type === "Honors",
                    c.gpa_waiver ?? false, c.semesters_offered ?? null,
                    c.notes ?? null, now, now,
                  ]
                );
                courseIds[code] = rows[0].id;
                insertedCount++;
              }
            }

            // Deactivate stale courses
            const staleCodes = Object.keys(existingByCode).filter((c) => !newCodes.has(c));
            if (staleCodes.length > 0) {
              const staleIds = staleCodes.map((c) => existingByCode[c]);
              await client.query(
                "UPDATE courses SET is_active = FALSE, updated_at = $1 WHERE id = ANY($2::uuid[])",
                [now, staleIds]
              );
              log("2/7", `Deactivated ${staleIds.length} stale courses.`);
            }

            log("2/7", `Courses: ${insertedCount} inserted, ${updatedCount} updated.`);

            // 2f. Insert prerequisites
            await client.query("DELETE FROM course_prerequisites WHERE catalog_version_id = $1", [versionId]);

            function resolveCode(code: string): { id: string; canonical: string } | null {
              if (courseIds[code]) return { id: courseIds[code], canonical: code };
              for (const composite of Object.keys(courseIds)) {
                if (composite.includes("/") && composite.split("/").includes(code)) {
                  return { id: courseIds[composite], canonical: composite };
                }
              }
              return null;
            }

            async function insertPrereqEdges(
              courseId: string,
              prereqId: string,
              prereqCanonical: string,
              group: number
            ): Promise<number> {
              let inserted = 0;
              for (const id of expandWithEquivalents(prereqId, prereqCanonical, courseIds)) {
                if (id === courseId) continue;
                await client.query(
                  `INSERT INTO course_prerequisites
                     (course_id, prerequisite_id, relationship_type, requirement_group, catalog_version_id)
                   VALUES ($1, $2, 'prerequisite', $3, $4)
                   ON CONFLICT (course_id, prerequisite_id, catalog_version_id) DO NOTHING`,
                  [courseId, id, group, versionId]
                );
                inserted++;
              }
              return inserted;
            }

            let prereqCount = 0;
            for (const c of courseList) {
              const courseId = courseIds[c.code as string];
              const groups = (c as Record<string, unknown>).prerequisite_groups as Array<{ group: number; codes: string[] }> | undefined;

              if (groups && groups.length > 0) {
                for (const g of groups) {
                  for (const prereqCode of g.codes) {
                    const resolved = resolveCode(prereqCode);
                    if (resolved) {
                      prereqCount += await insertPrereqEdges(courseId, resolved.id, resolved.canonical, g.group);
                    }
                  }
                }
              } else {
                const prereqCodes = (c.prerequisite_codes as string[]) ?? [];
                for (const prereqCode of prereqCodes) {
                  const resolved = resolveCode(prereqCode);
                  if (resolved) {
                    prereqCount += await insertPrereqEdges(courseId, resolved.id, resolved.canonical, 1);
                  }
                }
              }
            }

            log("2/7", `Inserted ${prereqCount} prerequisite links (incl. summer/regular equivalents and rigor-ladder siblings).`);

            await client.query("COMMIT");
          } catch (err) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw err;
          } finally {
            client.release();
          }
        } else {
          log("2/7", `Would load ${courseList.length} courses.`);
        }
      }
    } else {
      log("2/7", "Skipped (--skip-courses).");
    }

    if (coursesOnly) {
      log("done", "Course catalog loaded. Exiting (--courses-only).");
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 3: Seed subscription plans
    // ═══════════════════════════════════════════════════════════════════════

    log("3/7", "Seeding subscription plans...");
    if (!dryRun) {
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
      log("3/7", `Seeded ${SUBSCRIPTION_PLANS.length} subscription plans.`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 4: Seed graduation requirements
    // ═══════════════════════════════════════════════════════════════════════

    log("4/7", "Seeding graduation requirements...");

    if (!dryRun) {
      const gradCatalogVersion = await db
        .select({ id: courseCatalogVersions.id })
        .from(courseCatalogVersions)
        .orderBy(desc(courseCatalogVersions.loadedAt))
        .limit(1)
        .then((rows) => rows[0]);

      if (!gradCatalogVersion) {
        warn("4/7", "No catalog version found — skipping. Load courses first.");
      } else {
        // Build division lookup
        const allDivisions = await db
          .select({ id: divisions.id, name: divisions.name })
          .from(divisions);
        const divisionNameToId = new Map<string, string>();
        for (const d of allDivisions) divisionNameToId.set(d.name, d.id);

        // Import requirement definitions from the seed script
        // (reuse the same data structure inline to avoid circular deps)
        const allRequirements = buildRequirementsList();

        let reqsSeeded = 0;
        for (const req of allRequirements) {
          const divisionId = req.divisionName ? divisionNameToId.get(req.divisionName) : null;
          if (req.divisionName && !divisionId) {
            warn("4/7", `Division "${req.divisionName}" not found — skipping requirement "${req.requirementName}"`);
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
        log("4/7", `Seeded ${reqsSeeded} graduation requirements.`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 5: Seed plan templates
    // ═══════════════════════════════════════════════════════════════════════

    log("5/7", "Seeding plan templates...");

    if (!dryRun) {
      const latestCatalogVersion = await db
        .select({ id: courseCatalogVersions.id, schoolYear: courseCatalogVersions.schoolYear })
        .from(courseCatalogVersions)
        .orderBy(desc(courseCatalogVersions.loadedAt))
        .limit(1)
        .then((rows) => rows[0]);

      if (!latestCatalogVersion) {
        warn("5/7", "No catalog version found — skipping. Load courses first.");
      } else {
        const allCourses = await db
          .select({ id: courses.id, code: courses.code })
          .from(courses)
          .where(and(eq(courses.catalogVersionId, latestCatalogVersion.id), eq(courses.isActive, true)));

        const courseCodeToId = new Map<string, string>();
        for (const c of allCourses) courseCodeToId.set(c.code, c.id);

        let templatesSeeded = 0;
        let templateCoursesSeeded = 0;

        for (const template of PLAN_TEMPLATES) {
          const existing = await db
            .select({ id: fourYearPlans.id })
            .from(fourYearPlans)
            .where(and(eq(fourYearPlans.name, template.name), eq(fourYearPlans.isTemplate, true)))
            .limit(1)
            .then((rows) => rows[0]);

          let templatePlanId: string;

          if (existing) {
            templatePlanId = existing.id;
            await db.delete(planCourses).where(eq(planCourses.planId, templatePlanId));
          } else {
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

          let coursesInserted = 0;
          const missingCodes: string[] = [];

          for (const tc of template.courses) {
            const courseId = courseCodeToId.get(tc.code);
            if (!courseId) { missingCodes.push(tc.code); continue; }

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
            warn("5/7", `Template "${template.name}": ${missingCodes.length} course codes not found: ${missingCodes.join(", ")}`);
          }

          templateCoursesSeeded += coursesInserted;
          templatesSeeded++;
        }
        log("5/7", `Seeded ${templatesSeeded} templates with ${templateCoursesSeeded} courses.`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 6: Seed legal documents
    // ═══════════════════════════════════════════════════════════════════════

    log("6/7", "Seeding legal documents...");

    if (!dryRun) {
      await seedLegalDocuments(db);
      const names = LEGAL_DOCUMENT_SEEDS.map((d) => `${d.type} v${d.version}`).join(", ");
      log("6/7", `Seeded: ${names}.`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Step 7: Backfill accounts for existing students
    // ═══════════════════════════════════════════════════════════════════════

    log("7/7", "Backfilling accounts for existing student users...");

    if (!dryRun) {
      const studentUsers = await db
        .select({ id: users.id, email: users.email, dateOfBirth: users.dateOfBirth })
        .from(users)
        .where(eq(users.role, "student"));

      let accountsCreated = 0;
      for (const student of studentUsers) {
        const existingAccount = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.studentUserId, student.id))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (existingAccount) continue;

        const studentName = student.email.split("@")[0];
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

        await db
          .insert(accountMembers)
          .values({ accountId: newAccount.id, userId: student.id, role: "student", canEdit: true })
          .onConflictDoNothing();

        await db
          .update(subscriptions)
          .set({ accountId: newAccount.id })
          .where(and(eq(subscriptions.userId, student.id), isNull(subscriptions.accountId)));

        accountsCreated++;
      }

      if (accountsCreated > 0) {
        log("7/7", `Backfilled ${accountsCreated} account(s).`);
      } else {
        log("7/7", "No accounts needed backfilling.");
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Done
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n✓ Database setup complete.\n");

    // Final summary query
    if (!dryRun) {
      const counts = await pool.query(`
        SELECT
          (SELECT count(*) FROM courses WHERE is_active = true) as courses,
          (SELECT count(*) FROM divisions) as divisions,
          (SELECT count(*) FROM departments) as departments,
          (SELECT count(*) FROM subscription_plans) as subscription_plans,
          (SELECT count(*) FROM graduation_requirements) as graduation_requirements,
          (SELECT count(*) FROM four_year_plans WHERE is_template = true) as plan_templates,
          (SELECT count(*) FROM legal_documents WHERE is_current = true) as legal_documents,
          (SELECT count(*) FROM course_prerequisites) as prerequisites,
          (SELECT count(*) FILTER (WHERE rowsecurity) FROM pg_tables WHERE schemaname = 'public') as rls_tables,
          (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as total_tables
      `);
      const s = counts.rows[0];
      console.log("  Summary:");
      console.log(`    Courses:          ${s.courses}`);
      console.log(`    Divisions:        ${s.divisions}`);
      console.log(`    Departments:      ${s.departments}`);
      console.log(`    Prerequisites:    ${s.prerequisites}`);
      console.log(`    Sub plans:        ${s.subscription_plans}`);
      console.log(`    Grad requirements: ${s.graduation_requirements}`);
      console.log(`    Plan templates:   ${s.plan_templates}`);
      console.log(`    Legal documents:  ${s.legal_documents}`);
      console.log(`    RLS enabled:      ${s.rls_tables}/${s.total_tables} tables`);
      console.log();
    }
  } finally {
    await pool.end();
  }
}

// ─── Graduation Requirements Data ───────────────────────────────────────────
// Extracted from the original seed.ts to keep this file self-contained.

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

function buildRequirementsList(): SeedRequirement[] {
  return [
    // Graduation Requirements (Tier 1)
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

    // IL Public University Admission (Tier 2) — opt-in
    { requirementName: "English (University)", category: "English", requiredCredits: "8.0", divisionName: "Communication Arts", notes: "Emphasis on written/oral communication and literature", matchingRule: { type: "code_prefix", prefix: "ENG" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 1 },
    { requirementName: "Mathematics (University)", category: "Mathematics", requiredCredits: "6.0", divisionName: "Mathematics", notes: "Including algebra, advanced algebra, geometry and/or trigonometry", matchingRule: { type: "division" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 2 },
    { requirementName: "Science (University)", category: "Science", requiredCredits: "6.0", divisionName: "Science", notes: "Lab sciences with foundation in biology, chemistry and physics", matchingRule: { type: "division" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 3 },
    { requirementName: "Social Studies (University)", category: "Social Studies", requiredCredits: "6.0", divisionName: "Social Studies", notes: "Emphasis on history and government", matchingRule: { type: "division" }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 4 },
    { requirementName: "Electives (University)", category: "Electives", requiredCredits: "4.0", divisionName: "Fine Arts", notes: "From: Multilingual Learning, Applied Arts, or Fine Arts", matchingRule: { type: "multi_division", divisionNames: ["Multilingual Learning", "Applied Arts", "Fine Arts"] }, requirementGroup: "il_public_university", isOptIn: true, displayOrder: 5 },

    // Non-Course Requirements (Tier 3)
    { requirementName: "ACT Graduation Requirement", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "Must take the ACT exam", requirementGroup: "non_course", evaluationType: "manual_checkbox", displayOrder: 1 },
    { requirementName: "FAFSA Requirement", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "File FAFSA, IL alternative application, or non-participation form (senior year)", requirementGroup: "non_course", evaluationType: "manual_checkbox", displayOrder: 2 },
    { requirementName: "46th Credit (Drug Education)", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "Automatic upon completing Health Education", matchingRule: { type: "codes", codes: ["PED201", "PED202"] }, requirementGroup: "non_course", evaluationType: "auto_from_course", displayOrder: 3 },
    { requirementName: "Civics and Patriotism Assessments", category: "Non-Course", requiredCredits: "0.0", divisionName: null, notes: "Automatic upon passing Government course assessments", matchingRule: { type: "codes", codes: ["SOC401", "SOC402", "SOC631", "SOC632", "SOC681", "SOC682"] }, requirementGroup: "non_course", evaluationType: "auto_from_course", displayOrder: 4 },

    // Course Load Per-Semester (Tier 5)
    ...([9, 10, 11, 12] as const).flatMap((grade) =>
      ([1, 2] as const).map((sem) => ({
        requirementName: `Course Load — Grade ${grade} Sem ${sem}`,
        category: "Course Load",
        requiredCredits: "0.0",
        divisionName: null as string | null,
        notes: "Min 5, max 7 courses (8 with Early Bird)",
        matchingRule: { type: "course_load", gradeLevel: grade, semester: sem, minCourses: 5, maxCourses: 7, maxWithEarlyBird: 8 },
        requirementGroup: "course_load",
        evaluationType: "course_load_check",
        displayOrder: (grade - 9) * 2 + sem,
      }))
    ),

    // Physical Welfare Per-Semester (Tier 5b)
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
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
