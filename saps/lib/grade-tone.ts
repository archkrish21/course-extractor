import type { BadgeVariant } from "@/components/ui/badge";

/**
 * Map a letter grade to the semantic tone used to color it across the app.
 * A → success, B → info, C → muted (default), D → warning, F → destructive.
 * P → success (passed), I → muted (incomplete).
 *
 * The rest of the planner/transcript/year-end pages share this mapping so
 * students can spot the spread of grades on a plan at a glance.
 */
export function gradeToneVariant(grade: string | null | undefined): BadgeVariant {
  switch (grade) {
    case "A":
    case "P":
      return "success";
    case "B":
      return "info";
    case "D":
      return "warning";
    case "F":
      return "destructive";
    case "C":
    case "I":
    default:
      return "default";
  }
}

/** Tailwind class string equivalent of {@link gradeToneVariant}, for spans/divs that don't use the Badge component. */
export function gradeToneClasses(grade: string | null | undefined): string {
  switch (gradeToneVariant(grade)) {
    case "success":
      return "bg-success-light text-success";
    case "info":
      return "bg-info-light text-info";
    case "warning":
      return "bg-warning-light text-warning";
    case "destructive":
      return "bg-destructive-light text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Text-color-only variant for places (e.g. transcript table rows) that color the letter without a pill background. */
export function gradeToneTextColor(grade: string | null | undefined): string {
  switch (gradeToneVariant(grade)) {
    case "success":
      return "text-success";
    case "info":
      return "text-info";
    case "warning":
      return "text-warning";
    case "destructive":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}
