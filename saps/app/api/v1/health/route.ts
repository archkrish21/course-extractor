import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);

    return NextResponse.json(
      {
        status: "healthy",
        version: process.env.NEXT_PUBLIC_APP_URL || "dev",
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error({ err: error }, "Health check failed: database unreachable");

    return NextResponse.json(
      {
        status: "unhealthy",
        version: process.env.NEXT_PUBLIC_APP_URL || "dev",
      },
      { status: 503 }
    );
  }
}
