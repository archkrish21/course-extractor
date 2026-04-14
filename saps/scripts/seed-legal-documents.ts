import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { seedLegalDocuments, LEGAL_DOCUMENT_SEEDS } from "./seeds/legal-documents";

// Safety: block production execution
if (process.env.NODE_ENV === "production") {
  console.error("ERROR: seed-legal-documents cannot run in production (NODE_ENV=production). Aborting.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

async function seed() {
  console.log("Seeding initial legal document versions...");
  await seedLegalDocuments(db);
  const names = LEGAL_DOCUMENT_SEEDS.map((d) => `${d.type} v${d.version}`).join(", ");
  console.log(`Done. Seeded: ${names}.`);
  await pool.end();
}

seed().catch((e) => { console.error(e); pool.end(); process.exit(1); });
