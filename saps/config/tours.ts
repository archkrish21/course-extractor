import type { DriveStep } from "driver.js";

export const TOUR_IDS = {
  welcome: "welcome_completed",
  planner: "planner_completed",
  progress: "progress_completed",
} as const;

export type TourId = (typeof TOUR_IDS)[keyof typeof TOUR_IDS];

export const welcomeTourSteps: DriveStep[] = [
  {
    popover: {
      title: "Welcome to SAPS! 🎓",
      description: "Let's take a quick tour to help you get started with your academic planning journey.",
    },
  },
  {
    element: "nav[aria-label='Main navigation'] a[href='/dashboard']",
    popover: {
      title: "Dashboard",
      description: "Your home base. See your active plan, GPA, graduation progress, and alerts at a glance.",
      side: "bottom",
    },
  },
  {
    element: "nav[aria-label='Main navigation'] a[href='/planner']",
    popover: {
      title: "Course Planner",
      description: "Build your 4-year course plan. Add courses, track prerequisites, and organize by semester.",
      side: "bottom",
    },
  },
  {
    element: "nav[aria-label='Main navigation'] a[href='/progress']",
    popover: {
      title: "Academic Progress",
      description: "Monitor 37 graduation requirements across 4 categories. See what's earned, planned, and remaining.",
      side: "bottom",
    },
  },
  {
    element: "[aria-label='User menu'], [aria-label='Switch account']",
    popover: {
      title: "Your Profile",
      description: "Access settings, billing, and sign out from here. Parents can switch between children's accounts.",
      side: "left",
    },
  },
  {
    element: "[aria-label='Send feedback']",
    popover: {
      title: "We'd Love Your Feedback!",
      description: "Rate your experience and help us improve SAPS. Click the Feedback button anytime.",
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
          title: "Course Planner 📋",
          description: "This is where you'll build your 4-year course plan. Let's create your first one!",
        },
      },
      {
        element: "[data-tour='create-first-plan']",
        popover: {
          title: "Create Your First Plan",
          description: "Click here to start. Pick a template like STEM Focus or Pre-Med, or start from scratch.",
          side: "bottom",
        },
      },
    ];
  }

  return [
    {
      popover: {
        title: "Course Planner Tour 📋",
        description: "Let's explore how to build and manage your 4-year course plan.",
      },
    },
    {
      element: "[aria-label='Select a plan']",
      popover: {
        title: "Plan Selector",
        description: "Switch between your plans here. The star (★) marks your primary plan.",
        side: "bottom",
      },
    },
    {
      element: "[data-grade='9'], [data-grade='10'], [data-grade='11']",
      popover: {
        title: "Grade Rows",
        description: "Each row represents a school year. Click to expand and see your courses by semester.",
        side: "bottom",
      },
    },
    {
      element: "[title='New Plan']",
      popover: {
        title: "Create New Plan",
        description: "Start a blank plan or choose from 6 templates like STEM Focus or Pre-Med Track.",
        side: "bottom",
      },
    },
    {
      element: "[title='Manage Plans']",
      popover: {
        title: "Manage Plans",
        description: "Share plans with family, hide/show plans, and control who can view or edit.",
        side: "bottom",
      },
    },
  ];
}

/** Returns progress tour steps based on whether a plan exists */
export function getProgressTourSteps(hasPlan: boolean): DriveStep[] {
  if (!hasPlan) {
    return [
      {
        popover: {
          title: "Academic Progress 📊",
          description: "This page tracks your graduation requirements. Create a plan first to see your progress here.",
        },
      },
    ];
  }

  return [
    {
      popover: {
        title: "Academic Progress Tour 📊",
        description: "See how you're tracking toward graduation requirements.",
      },
    },
    {
      element: "[data-tour='progress-filter']",
      popover: {
        title: "Filter by Status",
        description: "Filter requirements by status: All, Met, In Progress, Gaps, or Not Started.",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='progress-requirements']",
      popover: {
        title: "Requirement Groups",
        description: "Requirements are organized by category: Graduation, Course Load, IL Public University, and Non-Course.",
        side: "right",
      },
    },
  ];
}
