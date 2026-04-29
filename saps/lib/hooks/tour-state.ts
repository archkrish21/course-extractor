// Tour-state value shape and readers. Kept separate from use-tour.ts so the
// pure logic can be unit-tested without React.

export type TourValue = boolean | { completed?: boolean; declined?: boolean; lastStep?: number };
export type TourStateMap = Record<string, TourValue>;

/**
 * Normalizes a tour-state value across the legacy `true = completed` form and
 * the object form `{ completed, declined, lastStep }`. Missing entries return
 * neither completed nor declined.
 */
export function readTourValue(value: TourValue | undefined): { completed: boolean; declined: boolean } {
  if (value === undefined) return { completed: false, declined: false };
  if (typeof value === "boolean") return { completed: value, declined: false };
  return { completed: !!value.completed, declined: !!value.declined };
}
