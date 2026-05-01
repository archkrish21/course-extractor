/**
 * Validation warnings sometimes arrive twice for paired full-year courses
 * (e.g. SPA201/SPA202 emits one violation per side, both pointing at the
 * same course id). Dedupe by `type` + `message` so popovers and report
 * groups reflect distinct issues only.
 */
export interface DedupableViolation {
  type: string;
  message: string;
}

export function dedupeViolations<T extends DedupableViolation>(list: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const v of list) {
    const key = `${v.type}::${v.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(v);
  }
  return result;
}
