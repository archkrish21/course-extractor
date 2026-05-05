import { getEquivalents } from "@/config/summer-equivalents";
import { getHigherOrEqualRigorSiblings } from "@/config/course-families";

/**
 * For a single prereq edge `X → Y`, return the full set of course IDs that
 * should be inserted as siblings in `Y`'s `requirement_group`, so any one of
 * them satisfies the prereq under OR semantics.
 *
 * Composes two equivalence layers:
 *   - lateral summer/regular pairs (`config/summer-equivalents.ts`)
 *   - upward rigor-ladder siblings (`config/course-families.ts`)
 *
 * The returned array always includes `prereqId` itself, then any sibling IDs
 * that the caller's `courseIds` map can resolve. Codes without matching IDs
 * are silently skipped — they may belong to a different catalog version.
 */
export function expandWithEquivalents(
  prereqId: string,
  prereqCanonical: string,
  courseIds: Record<string, string>
): string[] {
  const ids = new Set<string>([prereqId]);
  for (const eqCode of getEquivalents(prereqCanonical)) {
    const eqId = courseIds[eqCode];
    if (eqId) ids.add(eqId);
  }
  for (const sibCode of getHigherOrEqualRigorSiblings(prereqCanonical)) {
    const sibId = courseIds[sibCode];
    if (sibId) ids.add(sibId);
  }
  return Array.from(ids);
}
