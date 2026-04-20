import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/v1/sentry-test
 * Temporary route to verify Sentry is capturing errors in production.
 * DELETE THIS FILE after verification.
 */
export async function GET() {
  const error = new Error("Sentry test error — verify this appears in Sentry dashboard");
  Sentry.captureException(error);
  await Sentry.flush(2000);
  return NextResponse.json({ ok: true, message: "Error sent to Sentry" });
}
