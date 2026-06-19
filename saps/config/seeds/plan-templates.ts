/**
 * Plan Template Seed Data
 *
 * Six pre-seeded plan templates using real Stevenson 2026 catalog course codes.
 *
 * Constraints enforced:
 * - All 12 graduation requirements (45+ credits)
 * - College Prep targets 5 academic courses/semester; all other tracks target
 *   6/semester (falling back to 5 only where a clean 6th course isn't available)
 * - One-semester courses appear ONCE per year (a fall code paired with a spring
 *   code of a *different* course fills a year-long slot). The only repeatable
 *   exception is pass/fail PE (Freshman PE, Choice P.E.).
 * - Freshman PE is one semester (Gr 9 S1); Choice P.E. fills Gr 9 S2.
 * - Gr 10 physical-welfare: Health Education (S1) + Driver Education (S2).
 * - Health Education in Gr 10 only; U.S. History in Gr 11; Government in Gr 12.
 *
 * Math pathways:
 * - College Prep (regular, no AP/accel): Geometry → Algebra 2 → Precalculus →
 *   Data Science.
 * - Pre-Med / Humanities / Business (accelerated, AB): Geometry AB/BC →
 *   Algebra 2 AB/BC → AP Precalculus AB → AP Calculus AB.
 * - STEM / Computer Science (accelerated, BC): Geometry AB/BC → Algebra 2 AB/BC
 *   → AP Precalculus BC → AP Calculus BC.
 * - All math pathways start at Geometry in Gr 9, which assumes Algebra 1 was
 *   completed in middle school (it is the Gr 9 Geometry prerequisite).
 *
 * Computer Science pathway (STEM + CS tracks): Computer Programming 1 + 2 in
 * Gr 9 → AP Computer Science A (Gr 10) → AP CS Principles (Gr 11) → CS
 * Algorithms (Gr 12). (AP CS Principles lists Algebra 1 as its only prereq, so
 * it carries the same middle-school-Algebra-1 assumption as Geometry.)
 *
 * World History: taken in the summer before Gr 9 (codes SOC13S/SOC14S, summer
 * sessions -2/-1) for every track EXCEPT College Prep, which keeps it as a
 * regular Gr 9 course. The summer version satisfies the same graduation
 * requirement and does not count toward the per-semester academic load.
 */

export interface PlanTemplateCourse {
  code: string;
  grade_level: number;
  semester: number | null;
}

export interface PlanTemplate {
  name: string;
  description: string;
  courses: PlanTemplateCourse[];
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  // ─── 1. College Prep (General) ───────────────────────────────────────────────
  {
    name: "College Prep (General)",
    description:
      "A balanced college-prep course mix (regular level, no AP or accelerated courses) that satisfies all graduation requirements. Ideal for students who want a well-rounded high school experience with room for electives.",
    courses: [
      // Grade 9 — 5 academic + PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH251/MTH252", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED452", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH351/MTH352", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "ART101", grade_level: 10, semester: 1 },
      { code: "ART202", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 5 academic + PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH451/MTH452", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SPA301/SPA302", grade_level: 11, semester: null },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH481/MTH482", grade_level: 12, semester: null },
      { code: "SOC411/SOC412", grade_level: 12, semester: null },
      { code: "SCI271/SCI272", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "SOC552", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 2. STEM Focus ───────────────────────────────────────────────────────────
  {
    name: "STEM Focus",
    description:
      "A math, science, and computer-science-heavy track with AP Physics, AP Chemistry, and a full CS pathway through AP Computer Science and CS Algorithms. Designed for students pursuing engineering, science, or technology fields.",
    courses: [
      // Summer before Grade 9 — World History
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -2 },
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -1 },

      // Grade 9 — 6 academic + PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH271/MTH272", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "TEC151/TEC152", grade_level: 9, semester: null },
      { code: "CSC161", grade_level: 9, semester: 1 },
      { code: "CSC182", grade_level: 9, semester: 2 },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED452", grade_level: 9, semester: 2 },

      // Grade 10 — 6 academic + PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH171/MTH172", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "CSC391/CSC392", grade_level: 10, semester: null },
      { code: "TEC301/TEC302", grade_level: 10, semester: null },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH421/MTH422", grade_level: 11, semester: null },
      { code: "SCI611/SCI612", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "CSC371/CSC372", grade_level: 11, semester: null },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 6 academic + PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH491/MTH492", grade_level: 12, semester: null },
      { code: "SCI651/SCI652", grade_level: 12, semester: null },
      { code: "CSC421/CSC422", grade_level: 12, semester: null },
      { code: "SCI641/SCI642", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "BUS302", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 3. Pre-Med Track ────────────────────────────────────────────────────────
  {
    name: "Pre-Med Track",
    description:
      "A biology, chemistry, and physics-focused sequence with AP Biology, AP Chemistry, Human Anatomy, and Science Research. Designed for students interested in medical or health-science careers.",
    courses: [
      // Summer before Grade 9 — World History
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -2 },
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -1 },

      // Grade 9 — 6 academic + PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH271/MTH272", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "ART101", grade_level: 9, semester: 1 },
      { code: "ART202", grade_level: 9, semester: 2 },
      { code: "CSC161", grade_level: 9, semester: 1 },
      { code: "CSC182", grade_level: 9, semester: 2 },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED452", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH171/MTH172", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "SCI351/SCI352", grade_level: 10, semester: null },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + PW (Applied Health + Choice P.E.)
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH411/MTH412", grade_level: 11, semester: null },
      { code: "SCI631/SCI632", grade_level: 11, semester: null },
      { code: "SCI651/SCI652", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "PED231", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH471/MTH472", grade_level: 12, semester: null },
      { code: "SCI521/SCI522", grade_level: 12, semester: null },
      { code: "SCI401/SCI402", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "BUS302", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 4. Computer Science Track ───────────────────────────────────────────────
  {
    name: "Computer Science Track",
    description:
      "A progressive CS sequence from Computer Programming 1 & 2 through AP Computer Science A, AP CS Principles, CS Algorithms, and Mobile App Development, alongside engineering coursework. Ideal for aspiring software engineers.",
    courses: [
      // Summer before Grade 9 — World History
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -2 },
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -1 },

      // Grade 9 — 6 academic + PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH271/MTH272", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "TEC151/TEC152", grade_level: 9, semester: null },
      { code: "CSC161", grade_level: 9, semester: 1 },
      { code: "CSC182", grade_level: 9, semester: 2 },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED452", grade_level: 9, semester: 2 },

      // Grade 10 — 6 academic + PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH171/MTH172", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "CSC391/CSC392", grade_level: 10, semester: null },
      { code: "TEC301/TEC302", grade_level: 10, semester: null },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH421/MTH422", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "CSC371/CSC372", grade_level: 11, semester: null },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 6 academic + PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH491/MTH492", grade_level: 12, semester: null },
      { code: "CSC421/CSC422", grade_level: 12, semester: null },
      { code: "CSC251/CSC252", grade_level: 12, semester: null },
      { code: "SCI641/SCI642", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "TEC122", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 5. Humanities Focus ─────────────────────────────────────────────────────
  {
    name: "Humanities Focus",
    description:
      "An English and social studies emphasis with AP English Language, AP Literature, AP European History, AP U.S. History, AP Government, and AP Art History. Ideal for students interested in law, writing, or the social sciences.",
    courses: [
      // Summer before Grade 9 — World History
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -2 },
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -1 },

      // Grade 9 — 6 academic + PW
      { code: "ENG161/ENG162", grade_level: 9, semester: null },
      { code: "MTH271/MTH272", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "THR101", grade_level: 9, semester: 1 },
      { code: "THR112", grade_level: 9, semester: 2 },
      { code: "ART221", grade_level: 9, semester: 1 },
      { code: "ART262", grade_level: 9, semester: 2 },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED452", grade_level: 9, semester: 2 },

      // Grade 10 — 6 academic + PW (Health + Driver Ed)
      { code: "ENG231/ENG232", grade_level: 10, semester: null },
      { code: "MTH171/MTH172", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SOC601/SOC602", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "ART721/ART722", grade_level: 10, semester: null },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + PW
      { code: "ENG371/ENG372", grade_level: 11, semester: null },
      { code: "MTH411/MTH412", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC621/SOC622", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "SPA301/SPA302", grade_level: 11, semester: null },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + PW
      { code: "ENG451/ENG452", grade_level: 12, semester: null },
      { code: "MTH471/MTH472", grade_level: 12, semester: null },
      { code: "SPA401/SPA402", grade_level: 12, semester: null },
      { code: "SOC681", grade_level: 12, semester: 1 },
      { code: "SOC652", grade_level: 12, semester: 2 },
      { code: "SOC541", grade_level: 12, semester: 1 },
      { code: "SOC552", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 6. Business/Economics Track ─────────────────────────────────────────────
  {
    name: "Business/Economics Track",
    description:
      "A business-focused path with Introduction to Business, Marketing, Entrepreneurship, Accounting, Business Law, Personal Finance, and Investment Management. Ideal for students interested in business, finance, or management careers.",
    courses: [
      // Summer before Grade 9 — World History
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -2 },
      { code: "SOC13S/SOC14S", grade_level: 9, semester: -1 },

      // Grade 9 — 6 academic + PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH271/MTH272", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "BUS171", grade_level: 9, semester: 1 },
      { code: "BUS132", grade_level: 9, semester: 2 },
      { code: "CSC161", grade_level: 9, semester: 1 },
      { code: "CSC182", grade_level: 9, semester: 2 },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED452", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH171/MTH172", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "BUS281", grade_level: 10, semester: 1 },
      { code: "BUS232", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH411/MTH412", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "BUS251", grade_level: 11, semester: 1 },
      { code: "BUS252", grade_level: 11, semester: 2 },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH471/MTH472", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "BUS301", grade_level: 12, semester: 1 },
      { code: "BUS351", grade_level: 12, semester: 1 },
      { code: "BUS372", grade_level: 12, semester: 2 },
      { code: "BUS362", grade_level: 12, semester: 2 },
      { code: "TEC172", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },
];
