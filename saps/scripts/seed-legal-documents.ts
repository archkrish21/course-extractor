import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { legalDocuments } from "../lib/db/schema";
import { sql } from "drizzle-orm";

// Safety: block production execution
if (process.env.NODE_ENV === "production") {
  console.error("ERROR: seed-legal-documents cannot run in production (NODE_ENV=production). Aborting.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function seed() {
  console.log("Seeding initial legal document versions...");

  const today = new Date().toISOString().split("T")[0];

  // Upsert ToS v1.0
  await db
    .insert(legalDocuments)
    .values({
      type: "terms_of_service",
      version: "1.0",
      effectiveDate: today,
      contentHash: "placeholder-tos-v1.0",
      summaryOfChanges: "Initial version",
      isCurrent: true,
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  // Upsert PP v1.0
  await db
    .insert(legalDocuments)
    .values({
      type: "privacy_policy",
      version: "1.0",
      effectiveDate: today,
      contentHash: "placeholder-pp-v1.0",
      summaryOfChanges: "Initial version",
      isCurrent: true,
      publishedAt: new Date(),
    })
    .onConflictDoNothing();

  console.log("Done. ToS v1.0 and Privacy Policy v1.0 seeded.");
  await pool.end();
}

seed().catch((e) => { console.error(e); pool.end(); process.exit(1); });
