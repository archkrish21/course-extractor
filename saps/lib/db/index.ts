import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL environment variable is required");

const pool = new Pool({
  connectionString: dbUrl,
});

export const db = drizzle(pool, { schema });
