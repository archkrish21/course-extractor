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
