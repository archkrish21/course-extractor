/**
 * Normalize an email for storage and comparison: trim + lowercase.
 *
 * Use everywhere email is compared (lookups, dedupe checks) or persisted
 * (invite recipient, etc.). Keeps mixed-case stored emails matching
 * lowercased inputs without each caller having to remember.
 */
export function normalizeEmail<T extends string | null | undefined>(email: T): T extends string ? string : null {
  if (typeof email !== "string") return null as T extends string ? string : null;
  return email.trim().toLowerCase() as T extends string ? string : null;
}
