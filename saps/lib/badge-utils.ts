import type { BadgeVariant } from "@/components/ui/badge";

/**
 * Maps a course credit type string to the appropriate badge variant.
 * Handles both exact matches (e.g. "AP") and substring matches (e.g. "AP Chemistry").
 */
export function creditTypeBadgeVariant(creditType: string): BadgeVariant {
  const lower = creditType.toLowerCase();
  if (lower.includes("ap")) return "ap";
  if (lower.includes("honors")) return "honors";
  if (lower.includes("dual")) return "dual-credit";
  if (lower.includes("accelerated")) return "accelerated";
  return "default";
}

/** Display label for a credit type — collapses "Pass/Fail" to "P/F" for compact
 * badges and expands "CP" to its full "College Prep" name. */
export function creditTypeLabel(creditType: string): string {
  if (creditType === "Pass/Fail") return "P/F";
  if (creditType === "CP") return "College Prep";
  return creditType;
}
