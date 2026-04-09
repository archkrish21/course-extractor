import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  fourYearPlans,
  planShares,
  accountMembers,
} from "../lib/db/schema";
import { eq, and, ne, sql } from "drizzle-orm";

/**
 * One-time migration: create plan_shares rows for all existing plans.
 * Usage: npx tsx scripts/migrate-plan-shares.ts
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function migrate() {
  console.log("Starting plan_shares migration...");

  // Wrap in a transaction so partial failures can be rolled back
  await db.execute(sql`BEGIN`);

  const plans = await db
    .select({
      id: fourYearPlans.id,
      createdBy: fourYearPlans.createdBy,
      accountId: fourYearPlans.accountId,
      visibility: fourYearPlans.visibility,
    })
    .from(fourYearPlans)
    .where(eq(fourYearPlans.isTemplate, false));

  console.log(`Found ${plans.length} plans to migrate.`);

  let ownerCount = 0;
  let shareCount = 0;
  let skipCount = 0;

  for (const plan of plans) {
    if (plan.createdBy) {
      try {
        await db.insert(planShares).values({
          planId: plan.id,
          userId: plan.createdBy,
          grantedBy: plan.createdBy,
          permission: "owner",
        });
        ownerCount++;
      } catch (err: any) {
        if (err?.code === "23505") {
          skipCount++;
        } else {
          console.error(`Error creating owner share for plan ${plan.id}:`, err);
        }
      }
    }

    if (plan.accountId && plan.visibility === "shared") {
      const members = await db
        .select({
          userId: accountMembers.userId,
          canEdit: accountMembers.canEdit,
        })
        .from(accountMembers)
        .where(
          and(
            eq(accountMembers.accountId, plan.accountId),
            plan.createdBy ? ne(accountMembers.userId, plan.createdBy) : undefined
          )
        );

      for (const member of members) {
        try {
          await db.insert(planShares).values({
            planId: plan.id,
            userId: member.userId,
            grantedBy: plan.createdBy ?? undefined,
            permission: member.canEdit ? "edit" : "view",
          });
          shareCount++;
        } catch (err: any) {
          if (err?.code === "23505") {
            skipCount++;
          } else {
            console.error(`Error creating share for plan ${plan.id}, user ${member.userId}:`, err);
          }
        }
      }
    }
  }

  await db.execute(sql`COMMIT`);

  console.log(`Migration complete.`);
  console.log(`  Owner shares created: ${ownerCount}`);
  console.log(`  Member shares created: ${shareCount}`);
  console.log(`  Skipped (already exist): ${skipCount}`);

  await pool.end();
  process.exit(0);
}

migrate().catch(async (err) => {
  console.error("Migration failed:", err);
  try { await db.execute(sql`ROLLBACK`); } catch { /* already rolled back */ }
  await pool.end();
  process.exit(1);
});
