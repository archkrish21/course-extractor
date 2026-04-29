import type { DriveStep } from "driver.js";

export const TOUR_IDS = {
  welcome: "welcome_completed",
  planner: "planner_completed",
  progress: "progress_completed",
  courses: "courses_completed",
} as const;

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];

export const welcomeTourSteps: DriveStep[] = [
  {
    popover: {
      title: "Welcome aboard.",
      description: "Let me show you the four spots you'll use most.",
    },
  },
  {
    element: "nav[aria-label='Main navigation'] a[href='/dashboard']",
    popover: {
      title: "Dashboard",
      description: "Your snapshot — GPA, graduation progress, and anything that needs your attention, all in one place.",
      side: "bottom",
    },
  },
  {
    element: "nav[aria-label='Main navigation'] a[href='/planner']",
    popover: {
      title: "Course planner",
      description: "Map every course from now through senior year. I'll flag prereq conflicts before you commit.",
      side: "bottom",
    },
  },
  {
    element: "nav[aria-label='Main navigation'] a[href='/progress']",
    popover: {
      title: "Academic progress",
      description: "Every Stevenson graduation requirement, tracked — so you'll always know what's left.",
      side: "bottom",
    },
  },
  {
    element: "[aria-label='User menu'], [aria-label='Switch account']",
    popover: {
      title: "Your account",
      description: "Settings, billing, sign out. Parents — switch between kids' accounts here.",
      side: "left",
    },
  },
  {
    element: "[aria-label='Send feedback']",
    popover: {
      title: "Feedback",
      description: "Drop a note anytime — what's working, what isn't, what's missing.",
      side: "left",
    },
  },
];

/** Returns planner tour steps based on whether plans exist */
export function getPlannerTourSteps(hasPlans: boolean): DriveStep[] {
  if (!hasPlans) {
    return [
      {
        popover: {
          title: "Course planner",
          description: "Where your four-year plan comes together. Let's start one.",
        },
      },
      {
        element: "[data-tour='create-first-plan']",
        popover: {
          title: "Start a plan",
          description: "Pick a template like STEM Focus or Pre-Med — or start blank and build it your way.",
          side: "bottom",
        },
      },
    ];
  }

  return [
    {
      popover: {
        title: "Course planner",
        description: "A quick walk through the tools you'll use most.",
      },
    },
    {
      element: "[aria-label='Select a plan']",
      popover: {
        title: "Switch plans",
        description: "If you've got more than one path in mind, flip between them here. The star marks your primary.",
        side: "bottom",
      },
    },
    {
      element: "[data-grade='9'], [data-grade='10'], [data-grade='11']",
      popover: {
        title: "Your four years, side by side",
        description: "One row per year. Expand any row to see fall, spring, and summer.",
        side: "bottom",
      },
    },
    {
      element: "[title='New Plan']",
      popover: {
        title: "New plan",
        description: "Spin up another path — useful for comparing a STEM-focused plan against a humanities-focused one.",
        side: "bottom",
      },
    },
    {
      element: "[title='Manage Plans']",
      popover: {
        title: "Manage plans",
        description: "Share with family, hide drafts, or control who can view or edit.",
        side: "bottom",
      },
    },
  ];
}

/**
 * Returns courses tour steps. Adapts to viewport (mobile filter button vs.
 * desktop sidebar) and to whether the result list has anything to point at.
 */
export function getCoursesTourSteps(hasResults: boolean, isMobile: boolean): DriveStep[] {
  const intro: DriveStep = {
    popover: {
      title: "Courses",
      description: "300+ to choose from. Let me help you narrow it down.",
    },
  };

  const search: DriveStep = {
    element: "[data-tour='course-search']",
    popover: {
      title: "Search",
      description: "Type any course name or code. Results update as you type.",
      side: "bottom",
    },
  };

  const filters: DriveStep = isMobile
    ? {
        element: "[data-tour='mobile-filters-button']",
        popover: {
          title: "Filters",
          description: "Tap to narrow by department, grade level, or AP/honors rigor.",
          side: "bottom",
        },
      }
    : {
        element: "[data-tour='course-filters']",
        popover: {
          title: "Filters",
          description: "Narrow by department, grade level, or AP/honors. The fastest way to browse a subject.",
          side: "right",
        },
      };

  const card: DriveStep = {
    element: "[data-tour='course-results'] > li:first-child",
    popover: {
      title: "Course details",
      description: isMobile
        ? "Tap any course for prerequisites, what it unlocks, and a one-click add to your plan."
        : "Click any course for prerequisites, what it unlocks, and a one-click add to your plan.",
      side: "top",
    },
  };

  return hasResults ? [intro, search, filters, card] : [intro, search, filters];
}

/** Returns progress tour steps based on whether a plan exists */
export function getProgressTourSteps(hasPlan: boolean): DriveStep[] {
  if (!hasPlan) {
    return [
      {
        popover: {
          title: "Academic progress",
          description: "Once you've got a plan started, this is where you'll track every Stevenson graduation requirement.",
        },
      },
    ];
  }

  return [
    {
      popover: {
        title: "Academic progress",
        description: "Here's how you're tracking toward graduation.",
      },
    },
    {
      element: "[data-tour='progress-filter']",
      popover: {
        title: "Spot the gaps",
        description: "Filter to see what's met, what's in progress, and what's still missing.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='progress-requirements']",
      popover: {
        title: "Grouped by category",
        description: "Graduation, course load, IL public university, non-course — every category Stevenson tracks.",
        side: "right",
      },
    },
  ];
}
