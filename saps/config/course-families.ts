/**
 * Course families: groups of courses that cover the same subject across
 * different rigor levels (CP < Accelerated < Honors < AP).
 *
 * Used for prerequisite satisfaction under the rigor-ladder rule: a plan
 * course satisfies a prereq if both belong to the same family AND the plan
 * course is at a level >= the prereq's level. (E.g. AP U.S. History
 * SOC621/SOC622 satisfies a prereq for CP U.S. History SOC321/SOC322.)
 *
 * Lateral summer/regular pairs live in `summer-equivalents.ts` and compose
 * with this map at seed time and during runtime validation.
 *
 * Codes must match catalog entries exactly (including `/`-joined composites).
 */

export type RigorLevel = "CP" | "Accelerated" | "Honors" | "AP";

const RIGOR_RANK: Record<RigorLevel, number> = {
  CP: 1,
  Accelerated: 2,
  Honors: 3,
  AP: 4,
};

export interface FamilyMember {
  code: string;
  level: RigorLevel;
}

export interface CourseFamily {
  id: string;
  members: FamilyMember[];
}

export const COURSE_FAMILIES: CourseFamily[] = [
  // Communication Arts
  {
    id: "sophomore-english",
    members: [
      { code: "ENG211/ENG212", level: "CP" },
      { code: "ENG231/ENG232", level: "Accelerated" },
    ],
  },
  {
    id: "junior-english",
    members: [
      { code: "ENG311/ENG312", level: "CP" },
      { code: "ENG381/ENG382", level: "Accelerated" },
      { code: "ENG371/ENG372", level: "AP" },
      { code: "ENG341/ENG342", level: "AP" }, // American Studies (combined AP English Lang + AP USH)
    ],
  },

  // Mathematics
  {
    id: "precalculus",
    members: [
      { code: "MTH451/MTH452", level: "CP" },
      { code: "MTH411/MTH412", level: "AP" }, // AP Precalc AB
      { code: "MTH421/MTH422", level: "AP" }, // AP Precalc BC
    ],
  },

  // Science
  {
    id: "biology",
    members: [
      { code: "SCI111/SCI112", level: "CP" },
      { code: "SCI631/SCI632", level: "AP" },
      { code: "SCI63E1/SCI63E2", level: "AP" }, // AP Biology Early Bird
    ],
  },
  {
    id: "chemistry",
    members: [
      { code: "SCI211/SCI212", level: "CP" },
      { code: "SCI651/SCI652", level: "AP" },
      { code: "SCI65E1/SCI65E2", level: "AP" }, // AP Chemistry Early Bird
    ],
  },
  {
    id: "physics",
    members: [
      { code: "SCI401/SCI402", level: "CP" },
      { code: "SCI611/SCI612", level: "AP" }, // AP Physics 1
      { code: "SCI61E1/SCI61E2", level: "AP" }, // AP Physics 1 Early Bird
      { code: "SCI661/SCI662", level: "AP" }, // AP Physics (C)
      { code: "SCI681/SCI682", level: "AP" }, // AP Physics 2
    ],
  },

  // Social Studies
  {
    id: "us-history",
    members: [
      { code: "SOC321/SOC322", level: "CP" },
      { code: "SOC621/SOC622", level: "AP" },
    ],
  },
  {
    id: "us-government",
    members: [
      { code: "SOC401", level: "CP" },
      { code: "SOC402", level: "CP" },
      { code: "SOC681", level: "AP" },
      { code: "SOC682", level: "AP" },
    ],
  },
  {
    id: "psychology",
    members: [
      { code: "SOC551", level: "CP" },
      { code: "SOC552", level: "CP" },
      { code: "SOC661/SOC662", level: "AP" },
    ],
  },
  {
    id: "sociology",
    members: [
      { code: "SOC541", level: "CP" },
      { code: "SOC542", level: "CP" },
      { code: "SOC571", level: "Honors" },
      { code: "SOC572", level: "Honors" },
    ],
  },
];

const FAMILY_BY_CODE: Map<string, CourseFamily> = (() => {
  const map = new Map<string, CourseFamily>();
  for (const f of COURSE_FAMILIES) {
    for (const m of f.members) map.set(m.code, f);
  }
  return map;
})();

/**
 * Codes in the same family at level >= the given code's level (excluding the
 * code itself). These are the courses that, if present in the plan, satisfy a
 * prereq edge pointing at `prereqCode` under the rigor-ladder rule.
 */
export function getHigherOrEqualRigorSiblings(prereqCode: string): string[] {
  const family = FAMILY_BY_CODE.get(prereqCode);
  if (!family) return [];
  const me = family.members.find((m) => m.code === prereqCode)!;
  const myRank = RIGOR_RANK[me.level];
  return family.members
    .filter((m) => m.code !== prereqCode && RIGOR_RANK[m.level] >= myRank)
    .map((m) => m.code);
}

/**
 * True iff `planCode` satisfies a prereq pointing at `prereqCode` under the
 * rigor-ladder rule (same family + plan-side level >= prereq-side level).
 * Returns false for the trivial self case — callers handle exact matches
 * separately via courseId.
 */
export function satisfiesByRigor(planCode: string, prereqCode: string): boolean {
  if (planCode === prereqCode) return false;
  const planFamily = FAMILY_BY_CODE.get(planCode);
  const prereqFamily = FAMILY_BY_CODE.get(prereqCode);
  if (!planFamily || planFamily !== prereqFamily) return false;
  const planMember = planFamily.members.find((m) => m.code === planCode)!;
  const prereqMember = planFamily.members.find((m) => m.code === prereqCode)!;
  return RIGOR_RANK[planMember.level] >= RIGOR_RANK[prereqMember.level];
}
