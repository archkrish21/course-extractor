import { describe, it, expect } from "vitest";
import {
  TOUR_IDS,
  welcomeTourSteps,
  getPlannerTourSteps,
  getCoursesTourSteps,
  getProgressTourSteps,
} from "@/config/tours";
import type { TourStep } from "@/lib/hooks/tour-state";

describe("TOUR_IDS — registered tours", () => {
  it("includes welcome, planner, progress, and courses", () => {
    expect(TOUR_IDS).toEqual({
      welcome: "welcome_completed",
      planner: "planner_completed",
      progress: "progress_completed",
      courses: "courses_completed",
    });
  });
});

describe("Welcome tour — structure", () => {
  it("has 7 steps (intro + 5 nav links + feedback)", () => {
    expect(welcomeTourSteps).toHaveLength(7);
  });

  it("includes a Courses step pointing at the nav link", () => {
    const courses = welcomeTourSteps.find(
      (s) => s.element === "nav[aria-label='Main navigation'] a[href='/courses']",
    );
    expect(courses).toBeDefined();
    expect(courses?.popover?.title).toBe("Courses");
  });

  it("orders nav steps as Dashboard → Courses → Course planner → Academic progress", () => {
    const navTitles = welcomeTourSteps
      .filter((s) => s.element?.toString().includes("Main navigation"))
      .map((s) => s.popover?.title);
    expect(navTitles).toEqual(["Dashboard", "Courses", "Course planner", "Academic progress"]);
  });
});

describe("Courses tour — adaptive step count", () => {
  it("returns 4 steps when results are present", () => {
    expect(getCoursesTourSteps(true, false)).toHaveLength(4);
    expect(getCoursesTourSteps(true, true)).toHaveLength(4);
  });

  it("returns 3 steps when the result list is empty", () => {
    expect(getCoursesTourSteps(false, false)).toHaveLength(3);
    expect(getCoursesTourSteps(false, true)).toHaveLength(3);
  });
});

describe("Planner tour — adaptive step count", () => {
  it("returns 2 steps when no plans exist", () => {
    expect(getPlannerTourSteps(false)).toHaveLength(2);
  });

  it("returns 5 steps once plans exist", () => {
    expect(getPlannerTourSteps(true)).toHaveLength(5);
  });
});

describe("Progress tour — adaptive step count", () => {
  it("returns 1 step when no plan data is present", () => {
    expect(getProgressTourSteps(false)).toHaveLength(1);
  });

  it("returns 3 steps once plan data is available", () => {
    expect(getProgressTourSteps(true)).toHaveLength(3);
  });
});

describe("Tour configs — forward-action CTAs", () => {
  it("welcome tour ends with 'Start planning →' to /planner", () => {
    const last = welcomeTourSteps[welcomeTourSteps.length - 1];
    expect(last.finalCta).toEqual({ label: "Start planning →", href: "/planner" });
  });

  it("planner tour (no plans) ends with 'Browse courses →' to /courses", () => {
    const steps = getPlannerTourSteps(false);
    const last = steps[steps.length - 1];
    expect(last.finalCta).toEqual({ label: "Browse courses →", href: "/courses" });
  });

  it("planner tour (with plans) ends with 'Browse courses →' to /courses", () => {
    const steps = getPlannerTourSteps(true);
    const last = steps[steps.length - 1];
    expect(last.finalCta).toEqual({ label: "Browse courses →", href: "/courses" });
  });

  it("courses tour (with results) ends with 'See your progress →' on the card step", () => {
    const steps = getCoursesTourSteps(true, false);
    const last = steps[steps.length - 1];
    expect(last.finalCta).toEqual({ label: "See your progress →", href: "/progress" });
    expect(last.element).toBe("[data-tour='course-results'] > li:first-child");
  });

  it("courses tour (no results) ends with 'See your progress →' on the filters step", () => {
    const steps = getCoursesTourSteps(false, false);
    const last = steps[steps.length - 1];
    expect(last.finalCta).toEqual({ label: "See your progress →", href: "/progress" });
    expect(last.element).toBe("[data-tour='course-filters']");
  });

  it("progress tour (no plan) ends with 'Start a plan →' to /planner", () => {
    const steps = getProgressTourSteps(false);
    const last = steps[steps.length - 1];
    expect(last.finalCta).toEqual({ label: "Start a plan →", href: "/planner" });
  });

  it("progress tour (with plan) ends with 'Refine your plan →' to /planner", () => {
    const steps = getProgressTourSteps(true);
    const last = steps[steps.length - 1];
    expect(last.finalCta).toEqual({ label: "Refine your plan →", href: "/planner" });
  });
});

describe("Tour configs — interactive moments (waitFor)", () => {
  it("courses search step waits for input on the search box", () => {
    const steps = getCoursesTourSteps(true, false);
    const search = steps.find((s: TourStep) => s.element === "[data-tour='course-search']");
    expect(search?.waitFor).toEqual({
      event: "input",
      selector: "[data-tour='course-search']",
      minLength: 2,
    });
  });

  it("progress filter step waits for click on a filter button", () => {
    const steps = getProgressTourSteps(true);
    const filter = steps.find((s: TourStep) => s.element === "[data-tour='progress-filter']");
    expect(filter?.waitFor).toEqual({
      event: "click",
      selector: "[data-tour='progress-filter'] button",
    });
  });

  it("non-interactive steps have no waitFor", () => {
    const last = welcomeTourSteps[welcomeTourSteps.length - 1];
    expect(last.waitFor).toBeUndefined();
  });
});

describe("Courses tour — adaptive selectors", () => {
  it("desktop variant points the filters step at the sidebar", () => {
    const steps = getCoursesTourSteps(true, false);
    const filters = steps.find((s: TourStep) => s.popover?.title === "Filters");
    expect(filters?.element).toBe("[data-tour='course-filters']");
  });

  it("mobile variant points the filters step at the drawer trigger", () => {
    const steps = getCoursesTourSteps(true, true);
    const filters = steps.find((s: TourStep) => s.popover?.title === "Filters");
    expect(filters?.element).toBe("[data-tour='mobile-filters-button']");
  });
});
