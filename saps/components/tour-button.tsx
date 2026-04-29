"use client";

import { useRouter, usePathname } from "next/navigation";
import { runTour } from "@/lib/hooks/run-tour";
import { welcomeTourSteps, getPlannerTourSteps, getProgressTourSteps, getCoursesTourSteps } from "@/config/tours";

export function TourButton() {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = () => {
    let steps;
    if (pathname.startsWith("/planner")) {
      const hasPlans = !!document.querySelector("[aria-label='Select a plan']");
      steps = getPlannerTourSteps(hasPlans);
    } else if (pathname.startsWith("/progress")) {
      const hasPlan = !!document.querySelector("[data-tour='progress-filter']");
      steps = getProgressTourSteps(hasPlan);
    } else if (pathname.startsWith("/courses")) {
      const hasResults = !!document.querySelector("[data-tour='course-results'] > li");
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      steps = getCoursesTourSteps(hasResults, isMobile);
    } else {
      steps = welcomeTourSteps;
    }

    runTour({
      steps,
      onNavigate: (href) => router.push(href),
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors sm:px-2.5"
      title="Take a guided tour of this page"
      aria-label="Take a guided tour of this page"
    >
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
      <span className="hidden sm:inline">Tour</span>
    </button>
  );
}
