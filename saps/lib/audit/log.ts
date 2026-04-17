import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import type { NextRequest } from "next/server";

interface AuditEntry {
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
}

export async function audit(entry: AuditEntry) {
  const ip = entry.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? entry.request?.headers.get("x-real-ip")
    ?? null;
  const userAgent = entry.request?.headers.get("user-agent") ?? null;

  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata ?? {},
      ip,
      userAgent,
    });
  } catch (err) {
    // Never block a request because audit failed
    console.error("[audit] failed to log", err);
  }
}
