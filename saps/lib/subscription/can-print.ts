import { FREE_LAUNCH_MODE } from "@/config/subscription-plans";

/** Whether the current user's tier allows printing. */
export function canPrint(subscriptionTier?: string | null): boolean {
  return FREE_LAUNCH_MODE || subscriptionTier === "plus" || subscriptionTier === "elite";
}
