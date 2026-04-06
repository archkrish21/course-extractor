import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { legalDocuments, consentRecords, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/get-user";

/**
 * GET /api/v1/auth/consent
 * Returns whether the current user needs to consent to any legal documents.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    // Get all current legal documents
    const currentDocs = await db
      .select({
        id: legalDocuments.id,
        type: legalDocuments.type,
        version: legalDocuments.version,
        effectiveDate: legalDocuments.effectiveDate,
        summaryOfChanges: legalDocuments.summaryOfChanges,
      })
      .from(legalDocuments)
      .where(eq(legalDocuments.isCurrent, true));

    // Get user's consent records for current documents
    const userConsents = await db
      .select({
        legalDocumentId: consentRecords.legalDocumentId,
        consentedAt: consentRecords.consentedAt,
      })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.userId, user.id),
          eq(consentRecords.action, "accepted")
        )
      );

    const consentedDocIds = new Set(userConsents.map((c) => c.legalDocumentId));

    const pendingDocuments = currentDocs.filter((d) => !consentedDocIds.has(d.id));
    const consentRequired = pendingDocuments.length > 0;

    return successResponse({
      consent_required: consentRequired,
      pending_documents: pendingDocuments.map((d) => ({
        id: d.id,
        type: d.type,
        version: d.version,
        effective_date: d.effectiveDate,
        summary: d.summaryOfChanges,
      })),
      accepted_documents: currentDocs
        .filter((d) => consentedDocIds.has(d.id))
        .map((d) => {
          const consent = userConsents.find((c) => c.legalDocumentId === d.id);
          return {
            type: d.type,
            version: d.version,
            accepted_at: consent?.consentedAt,
          };
        }),
    });
  } catch (error) {
    console.error("[auth/consent] GET error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

/**
 * POST /api/v1/auth/consent
 * Record consent for legal documents.
 * Body: { document_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof Response) return user;

    // Verify user exists in our users table (not just Supabase auth)
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userRow) {
      return errorResponse(
        "NOT_FOUND",
        "Account not found. Please sign up again.",
        404
      );
    }

    const body = await request.json();
    const { document_ids } = body;

    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      return errorResponse("VALIDATION_ERROR", "document_ids must be a non-empty array.", 400);
    }

    // Verify all document IDs are valid current documents
    const currentDocs = await db
      .select({ id: legalDocuments.id, type: legalDocuments.type })
      .from(legalDocuments)
      .where(eq(legalDocuments.isCurrent, true));

    const currentDocIds = new Set(currentDocs.map((d) => d.id));
    for (const docId of document_ids) {
      if (!currentDocIds.has(docId)) {
        return errorResponse("VALIDATION_ERROR", `Invalid document ID: ${docId}`, 400);
      }
    }

    // Capture IP and user agent
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;
    const userAgent = request.headers.get("user-agent") ?? null;

    // Create consent records
    const now = new Date();
    for (const docId of document_ids) {
      await db.insert(consentRecords).values({
        userId: user.id,
        legalDocumentId: docId,
        action: "accepted",
        ipAddress,
        userAgent,
        consentedAt: now,
      });
    }

    // Update user's acceptance timestamps
    const docTypes = currentDocs
      .filter((d) => document_ids.includes(d.id))
      .map((d) => d.type);

    const userUpdate: Record<string, Date> = {};
    if (docTypes.includes("terms_of_service")) userUpdate.tosAcceptedAt = now;
    if (docTypes.includes("privacy_policy")) userUpdate.ppAcceptedAt = now;

    if (Object.keys(userUpdate).length > 0) {
      await db.update(users).set(userUpdate).where(eq(users.id, user.id));
    }

    return successResponse({ accepted: document_ids.length });
  } catch (error) {
    console.error("[auth/consent] POST error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
