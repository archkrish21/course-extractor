/**
 * Plan Template Seed Data
 *
 * Six pre-seeded plan templates using real Stevenson 2026 catalog course codes.
 *
 * Constraints enforced:
 * - All 12 graduation requirements (45+ credits)
 * - 5-7 academic courses per semester (PW/Dance/DriverEd excluded from count)
 * - PW/Dance/DriverEd course each semester
 * - Driver Education included (Gr 10)
 * - Health Education in Gr 10 only (catalog restriction)
 * - U.S. History in Gr 11 only, Government in Gr 12 only
 * - Prerequisites in correct sequence
 *
 * PW coverage: Gr 9 = Freshman PE, Gr 10 = Health + Driver Ed, Gr 11 = Choice PE, Gr 12 = Choice PE
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
      "A balanced CP/Accelerated course mix that satisfies all graduation requirements. Ideal for students who want a well-rounded high school experience with room for electives.",
    courses: [
      // Grade 9 — 5 academic + 1 PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH151/MTH152", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED122", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + 2 PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH251/MTH252", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "ART101", grade_level: 10, semester: 1 },
      { code: "ART102", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "PED202", grade_level: 10, semester: 2 },
      { code: "D/E231", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 5 academic + 1 PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH351/MTH352", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SPA301/SPA302", grade_level: 11, semester: null },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + 1 PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH451/MTH452", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "SOC402", grade_level: 12, semester: 2 },
      { code: "SOC411/SOC412", grade_level: 12, semester: null },
      { code: "SOC551", grade_level: 12, semester: 1 },
      { code: "SOC552", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 2. STEM Focus ───────────────────────────────────────────────────────────
  {
    name: "STEM Focus",
    description:
      "A math and science-heavy track with AP Physics, AP Chemistry, and AP Computer Science. Designed for students pursuing engineering, science, or technology fields.",
    courses: [
      // Grade 9 — 6 academic + 1 PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH151/MTH152", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "TEC151/TEC152", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED122", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + 2 PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH251/MTH252", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "CSC161", grade_level: 10, semester: 1 },
      { code: "CSC162", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "PED202", grade_level: 10, semester: 2 },
      { code: "D/E231", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + 1 PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH351/MTH352", grade_level: 11, semester: null },
      { code: "SCI611/SCI612", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "CSC181", grade_level: 11, semester: 1 },
      { code: "CSC182", grade_level: 11, semester: 2 },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + 1 PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH451/MTH452", grade_level: 12, semester: null },
      { code: "SCI651/SCI652", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "SOC402", grade_level: 12, semester: 2 },
      { code: "CSC391/CSC392", grade_level: 12, semester: null },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 3. Pre-Med Track ────────────────────────────────────────────────────────
  {
    name: "Pre-Med Track",
    description:
      "A biology, chemistry, and physics-focused sequence with AP Biology, AP Chemistry, and Human Anatomy. Designed for students interested in medical or health-science careers.",
    courses: [
      // Grade 9 — 5 academic + 1 PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH151/MTH152", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED122", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + 2 PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH251/MTH252", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "ART101", grade_level: 10, semester: 1 },
      { code: "ART102", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "PED202", grade_level: 10, semester: 2 },
      { code: "D/E231", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + 1 PW (Applied Health after Health prereq)
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH351/MTH352", grade_level: 11, semester: null },
      { code: "SCI631/SCI632", grade_level: 11, semester: null },
      { code: "SCI651/SCI652", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "PED231", grade_level: 11, semester: 1 },
      { code: "PED232", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + 1 PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH451/MTH452", grade_level: 12, semester: null },
      { code: "SCI521/SCI522", grade_level: 12, semester: null },
      { code: "SCI401/SCI402", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "SOC402", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 4. Computer Science Track ───────────────────────────────────────────────
  {
    name: "Computer Science Track",
    description:
      "A progressive CS course sequence from Intro to Engineering through AP Computer Science A, with mobile app development. Ideal for aspiring software engineers.",
    courses: [
      // Grade 9 — 5 academic + 1 PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH151/MTH152", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "TEC151/TEC152", grade_level: 9, semester: null },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED122", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + 2 PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH251/MTH252", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA101/SPA102", grade_level: 10, semester: null },
      { code: "CSC161", grade_level: 10, semester: 1 },
      { code: "CSC162", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "PED202", grade_level: 10, semester: 2 },
      { code: "D/E231", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + 1 PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH351/MTH352", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "CSC181", grade_level: 11, semester: 1 },
      { code: "CSC182", grade_level: 11, semester: 2 },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 6 academic + 1 PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH451/MTH452", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "SOC402", grade_level: 12, semester: 2 },
      { code: "CSC391/CSC392", grade_level: 12, semester: null },
      { code: "CSC251/CSC252", grade_level: 12, semester: null },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 5. Humanities Focus ─────────────────────────────────────────────────────
  {
    name: "Humanities Focus",
    description:
      "An English and social studies emphasis with AP English Language, AP Literature, AP European History, and AP U.S. History. Ideal for students interested in law, writing, or the social sciences.",
    courses: [
      // Grade 9 — 5 academic + 1 PW
      { code: "ENG161/ENG162", grade_level: 9, semester: null },
      { code: "MTH151/MTH152", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "SPA101/SPA102", grade_level: 9, semester: null },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED122", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + 2 PW (Health + Driver Ed)
      { code: "ENG231/ENG232", grade_level: 10, semester: null },
      { code: "MTH251/MTH252", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SOC601/SOC602", grade_level: 10, semester: null },
      { code: "SPA201/SPA202", grade_level: 10, semester: null },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "PED202", grade_level: 10, semester: 2 },
      { code: "D/E231", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + 1 PW
      { code: "ENG371/ENG372", grade_level: 11, semester: null },
      { code: "MTH351/MTH352", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC621/SOC622", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "SPA301/SPA302", grade_level: 11, semester: null },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 5 academic + 1 PW
      { code: "ENG451/ENG452", grade_level: 12, semester: null },
      { code: "MTH451/MTH452", grade_level: 12, semester: null },
      { code: "SOC681", grade_level: 12, semester: 1 },
      { code: "SOC682", grade_level: 12, semester: 2 },
      { code: "SOC651", grade_level: 12, semester: 1 },
      { code: "SOC652", grade_level: 12, semester: 2 },
      { code: "SPA401/SPA402", grade_level: 12, semester: null },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },

  // ─── 6. Business/Economics Track ─────────────────────────────────────────────
  {
    name: "Business/Economics Track",
    description:
      "A business-focused path with Introduction to Business, Marketing, Entrepreneurship, Accounting, and Business Law. Ideal for students interested in business, finance, or management careers.",
    courses: [
      // Grade 9 — 5 academic + 1 PW
      { code: "ENG151/ENG152", grade_level: 9, semester: null },
      { code: "MTH151/MTH152", grade_level: 9, semester: null },
      { code: "SCI111/SCI112", grade_level: 9, semester: null },
      { code: "SOC101/SOC102", grade_level: 9, semester: null },
      { code: "BUS171", grade_level: 9, semester: 1 },
      { code: "BUS172", grade_level: 9, semester: 2 },
      { code: "PED121", grade_level: 9, semester: 1 },
      { code: "PED122", grade_level: 9, semester: 2 },

      // Grade 10 — 5 academic + 2 PW (Health + Driver Ed)
      { code: "ENG211/ENG212", grade_level: 10, semester: null },
      { code: "MTH251/MTH252", grade_level: 10, semester: null },
      { code: "SCI211/SCI212", grade_level: 10, semester: null },
      { code: "SPA101/SPA102", grade_level: 10, semester: null },
      { code: "BUS281", grade_level: 10, semester: 1 },
      { code: "BUS282", grade_level: 10, semester: 2 },
      { code: "PED201", grade_level: 10, semester: 1 },
      { code: "PED202", grade_level: 10, semester: 2 },
      { code: "D/E231", grade_level: 10, semester: 1 },
      { code: "D/E232", grade_level: 10, semester: 2 },

      // Grade 11 — 6 academic + 1 PW
      { code: "ENG311/ENG312", grade_level: 11, semester: null },
      { code: "MTH351/MTH352", grade_level: 11, semester: null },
      { code: "SCI401/SCI402", grade_level: 11, semester: null },
      { code: "SOC321/SOC322", grade_level: 11, semester: null },
      { code: "SOC411/SOC412", grade_level: 11, semester: null },
      { code: "BUS251", grade_level: 11, semester: 1 },
      { code: "BUS252", grade_level: 11, semester: 2 },
      { code: "PED451", grade_level: 11, semester: 1 },
      { code: "PED452", grade_level: 11, semester: 2 },

      // Grade 12 — 6 academic + 1 PW
      { code: "ENG431/ENG432", grade_level: 12, semester: null },
      { code: "MTH451/MTH452", grade_level: 12, semester: null },
      { code: "SOC401", grade_level: 12, semester: 1 },
      { code: "SOC402", grade_level: 12, semester: 2 },
      { code: "BUS371", grade_level: 12, semester: 1 },
      { code: "BUS372", grade_level: 12, semester: 2 },
      { code: "BUS301", grade_level: 12, semester: 1 },
      { code: "BUS302", grade_level: 12, semester: 2 },
      { code: "PED451", grade_level: 12, semester: 1 },
      { code: "PED452", grade_level: 12, semester: 2 },
    ],
  },
];
