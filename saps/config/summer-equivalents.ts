/**
 * Maps summer course codes to their regular school year equivalents.
 * Used for:
 *   1. Preventing duplicate enrollment (can't add SOC101/SOC102 if SOC13S already in plan)
 *   2. Showing "Also available as" in course detail views
 *   3. Graduation requirement matching
 *
 * Codes must match exactly what's in the courses table (including composites like SOC101/SOC102).
 */

const SUMMER_TO_REGULAR: Record<string, string[]> = {
  // Social Studies
  "SOC13S/SOC14S": ["SOC101/SOC102"],
  "SOC41S": ["SOC321/SOC322"],
  "SOC42S": ["SOC321/SOC322"],
  "SOC33S/SOC34S": ["SOC401", "SOC402"],
  "SOC43S": ["SOC411/SOC412"],
  "SOC44S": ["SOC411/SOC412"],

  // Mathematics (both use composites)
  "MTH15S/MTH16S": ["MTH151/MTH152"],
  "MTH25S/MTH26S": ["MTH251/MTH252"],
  "MTH51S/MTH52S": ["MTH351/MTH352"],
  "MTH37S/MTH38S": ["MTH171/MTH172"],

  // Physical Welfare
  "PED21S": ["PED201", "PED202"],
  "PED22S": ["PED201", "PED202"],

  // Applied Arts
  "D/E21S": ["D/E231", "D/E232"],
  "D/E22S": ["D/E231", "D/E232"],

  // Computer Science
  "CSC61S": ["CSC161", "CSC162"],
  "CSC82S": ["CSC181", "CSC182"],

  // Fine Arts
  "ART11S": ["ART101", "ART102"],
  "ART12S": ["ART101", "ART102"],
  "ART31S": ["ART401", "ART402"],
  "ART32S": ["ART401", "ART402"],
  "ART51S": ["ART501", "ART502"],
  "ART52S": ["ART501", "ART502"],
  "THR11S": ["THR101"],

  // Communication Arts
  "ENG57S": ["ENG501", "ENG502"],

  // Business
  "BUS71S": ["BUS171", "BUS172"],
  "BUS12S": ["BUS131", "BUS132"],
};

// Build reverse map: regular → summer
const REGULAR_TO_SUMMER: Record<string, string[]> = {};
for (const [summer, regulars] of Object.entries(SUMMER_TO_REGULAR)) {
  for (const regular of regulars) {
    if (!REGULAR_TO_SUMMER[regular]) REGULAR_TO_SUMMER[regular] = [];
    if (!REGULAR_TO_SUMMER[regular].includes(summer)) {
      REGULAR_TO_SUMMER[regular].push(summer);
    }
  }
}

/**
 * Get all equivalent course codes for a given code (both directions).
 */
export function getEquivalents(code: string): string[] {
  return [
    ...(SUMMER_TO_REGULAR[code] ?? []),
    ...(REGULAR_TO_SUMMER[code] ?? []),
  ];
}

/**
 * Check if two course codes are equivalents of each other.
 */
export function areEquivalent(code1: string, code2: string): boolean {
  return getEquivalents(code1).includes(code2);
}

/**
 * Given a set of course codes already in a plan, return any code
 * that is equivalent to the given code (for duplicate detection).
 */
export function findEquivalentInPlan(
  code: string,
  planCourseCodes: string[]
): string | null {
  const equivalents = getEquivalents(code);
  for (const eq of equivalents) {
    if (planCourseCodes.includes(eq)) return eq;
  }
  return null;
}
