import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { legalDocuments } from "../../lib/db/schema";

type LegalDocSeed = {
  type: "terms_of_service" | "privacy_policy" | "age_attestation";
  version: string;
  contentHash: string;
  summaryOfChanges: string;
};

export const LEGAL_DOCUMENT_SEEDS: LegalDocSeed[] = [
  {
    type: "terms_of_service",
    version: "1.0",
    contentHash: "placeholder-tos-v1.0",
    summaryOfChanges: "Initial version",
  },
  {
    type: "privacy_policy",
    version: "1.0",
    contentHash: "placeholder-pp-v1.0",
    summaryOfChanges: "Initial version",
  },
  {
    type: "age_attestation",
    version: "1.0",
    contentHash: "age-attestation-v1.0-13-or-older",
    summaryOfChanges: "Initial version: user confirms they are at least 13 years old.",
  },
];

export async function seedLegalDocuments(db: NodePgDatabase): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const publishedAt = new Date();

  for (const seed of LEGAL_DOCUMENT_SEEDS) {
    await db
      .insert(legalDocuments)
      .values({
        type: seed.type,
        version: seed.version,
        effectiveDate: today,
        contentHash: seed.contentHash,
        summaryOfChanges: seed.summaryOfChanges,
        isCurrent: true,
        publishedAt,
      })
      .onConflictDoNothing();
  }
}
