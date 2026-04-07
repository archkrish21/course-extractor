"use client";

import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { welcomeTourSteps, getPlannerTourSteps, getProgressTourSteps } from "@/config/tours";

export function TourButton() {
  const pathname = usePathname();

  const handleClick = () => {
    let steps;
    if (pathname.startsWith("/planner")) {
      const hasPlans = !!document.querySelector("[aria-label='Select a plan']");
      steps = getPlannerTourSteps(hasPlans);
    } else if (pathname.startsWith("/progress")) {
      const hasPlan = !!document.querySelector("[data-tour='progress-filter']");
      steps = getProgressTourSteps(hasPlan);
    } else {
      steps = welcomeTourSteps;
    }

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0, 0, 0, 0.5)",
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "saps-tour-popover",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Done!",
      progressText: "{{current}} of {{total}}",
      steps,
    });
    driverObj.drive();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors sm:flex"
      title="Take a guided tour of this page"
    >
      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
      Tour
    </button>
  );
}
