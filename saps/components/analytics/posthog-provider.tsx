"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { initPostHog } from "@/lib/analytics/posthog";

/**
 * Mount once in the root layout. Bootstraps PostHog on first render and
 * captures a synthetic $pageview on client-side route changes (App Router
 * doesn't fire window.onpopstate the way posthog-js autocapture expects).
 *
 * Silently no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset — keeps local dev
 * lightweight and doesn't require the env var for tests.
 */
export function PostHogProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
