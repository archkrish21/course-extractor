/**
 * Plan Template Seed Data
 *
 * Six pre-seeded plan templates, each containing a recommended 4-year course
 * sequence using real Stevenson High School course codes from the 2026 catalog.
 *
 * Course codes use the semester-pair format (e.g., "MTH151/MTH152") that matches
 * the codes stored in the courses table.
 */

export interface PlanTemplateCourse {
  /** Course code as it appears in the catalog (e.g., "MTH151/MTH152") */
  code: string;
  /** Grade level: 9, 10, 11, or 12 */
  grade_level: number;
  /** Semester: 1 or 2, or null for full-year courses */
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
      // Grade 9
      { code: "ENG151/ENG152", grade_level: 9, semester: null },    // English 9 — Community and Social Dynamics
      { code: "MTH151/MTH152", grade_level: 9, semester: null },    // Algebra 1
      { code: "SCI111/SCI112", grade_level: 9, semester: null },    // Biology
      { code: "SOC101/SOC102", grade_level: 9, semester: null },    // World History and Geography
      { code: "PED121", grade_level: 9, semester: 1 },              // PE Freshman Foundational Fitness
      { code: "PED122", grade_level: 9, semester: 2 },              // PE Freshman Foundational Fitness
      { code: "SPA101/SPA102", grade_level: 9, semester: null },    // Spanish 1

      // Grade 10
      { code: "ENG211/ENG212", grade_level: 10, semester: null },   // Sophomore English
      { code: "MTH251/MTH252", grade_level: 10, semester: null },   // Geometry
      { code: "SCI211/SCI212", grade_level: 10, semester: null },   // Chemistry
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "PED201", grade_level: 10, semester: 1 },             // Health Education
      { code: "PED202", grade_level: 10, semester: 2 },             // Health Education
      { code: "SPA201/SPA202", grade_level: 10, semester: null },   // Spanish 2

      // Grade 11
      { code: "ENG311/ENG312", grade_level: 11, semester: null },   // Junior English
      { code: "MTH351/MTH352", grade_level: 11, semester: null },   // Algebra 2
      { code: "SCI401/SCI402", grade_level: 11, semester: null },   // Physics
      { code: "SOC401", grade_level: 12, semester: 1 },             // Government
      { code: "SOC402", grade_level: 12, semester: 2 },             // Government
      { code: "SPA301/SPA302", grade_level: 11, semester: null },   // Spanish 3
      { code: "ART101", grade_level: 11, semester: 1 },             // Art and Design
      { code: "ART102", grade_level: 11, semester: 2 },             // Art and Design

      // Grade 12
      { code: "ENG431/ENG432", grade_level: 12, semester: null },   // World Literature
      { code: "MTH451/MTH452", grade_level: 12, semester: null },   // Precalculus
      { code: "SOC411/SOC412", grade_level: 12, semester: null },   // Economics
      { code: "SOC551", grade_level: 12, semester: 1 },             // Psychology
      { code: "SOC552", grade_level: 12, semester: 2 },             // Psychology
      { code: "PED451", grade_level: 12, semester: 1 },             // Choice P.E.
      { code: "PED452", grade_level: 12, semester: 2 },             // Choice P.E.
    ],
  },

  // ─── 2. STEM Focus ───────────────────────────────────────────────────────────
  {
    name: "STEM Focus",
    description:
      "A math and science-heavy track with AP Calculus, AP Physics, AP Chemistry, and AP Computer Science. Designed for students pursuing engineering, science, or technology fields in college.",
    courses: [
      // Grade 9
      { code: "ENG151/ENG152", grade_level: 9, semester: null },    // English 9
      { code: "MTH151/MTH152", grade_level: 9, semester: null },    // Algebra 1
      { code: "SCI111/SCI112", grade_level: 9, semester: null },    // Biology
      { code: "SOC101/SOC102", grade_level: 9, semester: null },    // World History and Geography
      { code: "PED121", grade_level: 9, semester: 1 },              // PE Freshman
      { code: "PED122", grade_level: 9, semester: 2 },              // PE Freshman
      { code: "TEC151/TEC152", grade_level: 9, semester: null },    // Intro to Engineering Design (PLTW)
      { code: "SPA101/SPA102", grade_level: 9, semester: null },    // Spanish 1

      // Grade 10
      { code: "ENG211/ENG212", grade_level: 10, semester: null },   // Sophomore English
      { code: "MTH251/MTH252", grade_level: 10, semester: null },   // Geometry
      { code: "SCI211/SCI212", grade_level: 10, semester: null },   // Chemistry
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "PED201", grade_level: 10, semester: 1 },             // Health Education
      { code: "PED202", grade_level: 10, semester: 2 },             // Health Education
      { code: "CSC161", grade_level: 10, semester: 1 },             // Computer Programming 1
      { code: "CSC162", grade_level: 10, semester: 2 },             // Computer Programming 1

      // Grade 11
      { code: "ENG311/ENG312", grade_level: 11, semester: null },   // Junior English
      { code: "MTH351/MTH352", grade_level: 11, semester: null },   // Algebra 2
      { code: "SCI611/SCI612", grade_level: 11, semester: null },   // AP Physics 1
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "CSC181", grade_level: 11, semester: 1 },             // Computer Programming 2
      { code: "CSC182", grade_level: 11, semester: 2 },             // Computer Programming 2

      // Grade 12
      { code: "ENG431/ENG432", grade_level: 12, semester: null },   // World Literature
      { code: "MTH451/MTH452", grade_level: 12, semester: null },   // Precalculus
      { code: "SCI651/SCI652", grade_level: 12, semester: null },   // AP Chemistry
      { code: "SOC401", grade_level: 12, semester: 1 },             // Government
      { code: "SOC402", grade_level: 12, semester: 2 },             // Government
      { code: "CSC391/CSC392", grade_level: 12, semester: null },   // AP Computer Science A
      { code: "PED451", grade_level: 12, semester: 1 },             // Choice P.E.
      { code: "PED452", grade_level: 12, semester: 2 },             // Choice P.E.
    ],
  },

  // ─── 3. Pre-Med Track ────────────────────────────────────────────────────────
  {
    name: "Pre-Med Track",
    description:
      "A biology, chemistry, and physics-focused sequence with AP Biology, AP Chemistry, and Human Anatomy. Designed for students interested in medical or health-science careers.",
    courses: [
      // Grade 9
      { code: "ENG151/ENG152", grade_level: 9, semester: null },    // English 9
      { code: "MTH151/MTH152", grade_level: 9, semester: null },    // Algebra 1
      { code: "SCI111/SCI112", grade_level: 9, semester: null },    // Biology
      { code: "SOC101/SOC102", grade_level: 9, semester: null },    // World History and Geography
      { code: "PED121", grade_level: 9, semester: 1 },              // PE Freshman
      { code: "PED122", grade_level: 9, semester: 2 },              // PE Freshman
      { code: "SPA101/SPA102", grade_level: 9, semester: null },    // Spanish 1

      // Grade 10
      { code: "ENG211/ENG212", grade_level: 10, semester: null },   // Sophomore English
      { code: "MTH251/MTH252", grade_level: 10, semester: null },   // Geometry
      { code: "SCI211/SCI212", grade_level: 10, semester: null },   // Chemistry
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "PED201", grade_level: 10, semester: 1 },             // Health Education
      { code: "PED202", grade_level: 10, semester: 2 },             // Health Education
      { code: "SPA201/SPA202", grade_level: 10, semester: null },   // Spanish 2

      // Grade 11
      { code: "ENG311/ENG312", grade_level: 11, semester: null },   // Junior English
      { code: "MTH351/MTH352", grade_level: 11, semester: null },   // Algebra 2
      { code: "SCI631/SCI632", grade_level: 11, semester: null },   // AP Biology
      { code: "SCI651/SCI652", grade_level: 11, semester: null },   // AP Chemistry
      { code: "SOC401", grade_level: 12, semester: 1 },             // Government
      { code: "SOC402", grade_level: 12, semester: 2 },             // Government
      { code: "SPA301/SPA302", grade_level: 11, semester: null },   // Spanish 3

      // Grade 12
      { code: "ENG431/ENG432", grade_level: 12, semester: null },   // World Literature
      { code: "MTH451/MTH452", grade_level: 12, semester: null },   // Precalculus
      { code: "SCI521/SCI522", grade_level: 12, semester: null },   // Human Anatomy and Physiology
      { code: "SCI401/SCI402", grade_level: 12, semester: null },   // Physics
      { code: "SOC411/SOC412", grade_level: 12, semester: null },   // Economics
      { code: "SOC551", grade_level: 12, semester: 1 },             // Psychology
      { code: "SOC552", grade_level: 12, semester: 2 },             // Psychology
    ],
  },

  // ─── 4. Computer Science Track ───────────────────────────────────────────────
  {
    name: "Computer Science Track",
    description:
      "A progressive CS course sequence from Intro to Engineering through AP Computer Science A, with web development and mobile app development electives. Ideal for aspiring software engineers.",
    courses: [
      // Grade 9
      { code: "ENG151/ENG152", grade_level: 9, semester: null },    // English 9
      { code: "MTH151/MTH152", grade_level: 9, semester: null },    // Algebra 1
      { code: "SCI111/SCI112", grade_level: 9, semester: null },    // Biology
      { code: "SOC101/SOC102", grade_level: 9, semester: null },    // World History and Geography
      { code: "PED121", grade_level: 9, semester: 1 },              // PE Freshman
      { code: "PED122", grade_level: 9, semester: 2 },              // PE Freshman
      { code: "TEC151/TEC152", grade_level: 9, semester: null },    // Intro to Engineering Design (PLTW)

      // Grade 10
      { code: "ENG211/ENG212", grade_level: 10, semester: null },   // Sophomore English
      { code: "MTH251/MTH252", grade_level: 10, semester: null },   // Geometry
      { code: "SCI211/SCI212", grade_level: 10, semester: null },   // Chemistry
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "CSC161", grade_level: 10, semester: 1 },             // Computer Programming 1
      { code: "CSC162", grade_level: 10, semester: 2 },             // Computer Programming 1
      { code: "PED201", grade_level: 10, semester: 1 },             // Health Education
      { code: "PED202", grade_level: 10, semester: 2 },             // Health Education

      // Grade 11
      { code: "ENG311/ENG312", grade_level: 11, semester: null },   // Junior English
      { code: "MTH351/MTH352", grade_level: 11, semester: null },   // Algebra 2
      { code: "SCI401/SCI402", grade_level: 11, semester: null },   // Physics
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "CSC181", grade_level: 11, semester: 1 },             // Computer Programming 2
      { code: "CSC182", grade_level: 11, semester: 2 },             // Computer Programming 2
      { code: "CSC371/CSC372", grade_level: 11, semester: null },   // AP Computer Science Principles

      // Grade 12
      { code: "ENG431/ENG432", grade_level: 12, semester: null },   // World Literature
      { code: "MTH451/MTH452", grade_level: 12, semester: null },   // Precalculus
      { code: "SOC401", grade_level: 12, semester: 1 },             // Government
      { code: "SOC402", grade_level: 12, semester: 2 },             // Government
      { code: "CSC391/CSC392", grade_level: 12, semester: null },   // AP Computer Science A
      { code: "CSC251/CSC252", grade_level: 12, semester: null },   // Mobile App Development
      { code: "PED451", grade_level: 12, semester: 1 },             // Choice P.E.
      { code: "PED452", grade_level: 12, semester: 2 },             // Choice P.E.
    ],
  },

  // ─── 5. Humanities Focus ─────────────────────────────────────────────────────
  {
    name: "Humanities Focus",
    description:
      "An English and social studies emphasis with AP English Language, AP Literature, AP European History, and AP U.S. History. Ideal for students interested in law, writing, journalism, or the social sciences.",
    courses: [
      // Grade 9
      { code: "ENG161/ENG162", grade_level: 9, semester: null },    // Reflection, Perception and Choices
      { code: "MTH151/MTH152", grade_level: 9, semester: null },    // Algebra 1
      { code: "SCI111/SCI112", grade_level: 9, semester: null },    // Biology
      { code: "SOC101/SOC102", grade_level: 9, semester: null },    // World History and Geography
      { code: "PED121", grade_level: 9, semester: 1 },              // PE Freshman
      { code: "PED122", grade_level: 9, semester: 2 },              // PE Freshman
      { code: "SPA101/SPA102", grade_level: 9, semester: null },    // Spanish 1

      // Grade 10
      { code: "ENG231/ENG232", grade_level: 10, semester: null },   // Sophomore English (Accelerated)
      { code: "MTH251/MTH252", grade_level: 10, semester: null },   // Geometry
      { code: "SCI211/SCI212", grade_level: 10, semester: null },   // Chemistry
      { code: "SOC601/SOC602", grade_level: 10, semester: null },   // AP European History
      { code: "PED201", grade_level: 10, semester: 1 },             // Health Education
      { code: "PED202", grade_level: 10, semester: 2 },             // Health Education
      { code: "SPA201/SPA202", grade_level: 10, semester: null },   // Spanish 2

      // Grade 11
      { code: "ENG371/ENG372", grade_level: 11, semester: null },   // AP English Language and Composition
      { code: "MTH351/MTH352", grade_level: 11, semester: null },   // Algebra 2
      { code: "SCI401/SCI402", grade_level: 11, semester: null },   // Physics
      { code: "SOC621/SOC622", grade_level: 11, semester: null },   // AP U.S. History
      { code: "SOC661/SOC662", grade_level: 12, semester: null },   // AP Psychology
      { code: "SPA301/SPA302", grade_level: 11, semester: null },   // Spanish 3

      // Grade 12
      { code: "ENG451/ENG452", grade_level: 12, semester: null },   // AP Literature and Composition
      { code: "MTH451/MTH452", grade_level: 12, semester: null },   // Precalculus
      { code: "SOC681", grade_level: 12, semester: 1 },             // AP Government—United States
      { code: "SOC682", grade_level: 12, semester: 2 },             // AP Government—United States
      { code: "SOC651", grade_level: 12, semester: 1 },             // AP Microeconomics
      { code: "SOC652", grade_level: 12, semester: 2 },             // AP Microeconomics
      { code: "PED451", grade_level: 12, semester: 1 },             // Choice P.E.
      { code: "PED452", grade_level: 12, semester: 2 },             // Choice P.E.
    ],
  },

  // ─── 6. Business/Economics Track ─────────────────────────────────────────────
  {
    name: "Business/Economics Track",
    description:
      "A business-focused path with Introduction to Business, Marketing, Entrepreneurship, Accounting, and Business Law. Ideal for students interested in business, finance, or management careers.",
    courses: [
      // Grade 9
      { code: "ENG151/ENG152", grade_level: 9, semester: null },    // English 9
      { code: "MTH151/MTH152", grade_level: 9, semester: null },    // Algebra 1
      { code: "SCI111/SCI112", grade_level: 9, semester: null },    // Biology
      { code: "SOC101/SOC102", grade_level: 9, semester: null },    // World History and Geography
      { code: "PED121", grade_level: 9, semester: 1 },              // PE Freshman
      { code: "PED122", grade_level: 9, semester: 2 },              // PE Freshman
      { code: "BUS171", grade_level: 9, semester: 1 },              // Introduction to Business
      { code: "BUS172", grade_level: 9, semester: 2 },              // Introduction to Business

      // Grade 10
      { code: "ENG211/ENG212", grade_level: 10, semester: null },   // Sophomore English
      { code: "MTH251/MTH252", grade_level: 10, semester: null },   // Geometry
      { code: "SCI211/SCI212", grade_level: 10, semester: null },   // Chemistry
      { code: "SOC321/SOC322", grade_level: 11, semester: null },   // U.S. History
      { code: "BUS281", grade_level: 10, semester: 1 },             // Marketing
      { code: "BUS282", grade_level: 10, semester: 2 },             // Marketing
      { code: "PED201", grade_level: 10, semester: 1 },             // Health Education
      { code: "PED202", grade_level: 10, semester: 2 },             // Health Education

      // Grade 11
      { code: "ENG311/ENG312", grade_level: 11, semester: null },   // Junior English
      { code: "MTH351/MTH352", grade_level: 11, semester: null },   // Algebra 2
      { code: "SCI401/SCI402", grade_level: 11, semester: null },   // Physics
      { code: "SOC401", grade_level: 12, semester: 1 },             // Government
      { code: "SOC402", grade_level: 12, semester: 2 },             // Government
      { code: "BUS251", grade_level: 11, semester: 1 },             // Accounting 1
      { code: "BUS252", grade_level: 11, semester: 2 },             // Accounting 2
      { code: "BUS231", grade_level: 11, semester: 1 },             // Entrepreneurship
      { code: "BUS232", grade_level: 11, semester: 2 },             // Entrepreneurship

      // Grade 12
      { code: "ENG431/ENG432", grade_level: 12, semester: null },   // World Literature
      { code: "MTH451/MTH452", grade_level: 12, semester: null },   // Precalculus
      { code: "SOC411/SOC412", grade_level: 12, semester: null },   // Economics
      { code: "BUS371", grade_level: 12, semester: 1 },             // Business Law
      { code: "BUS372", grade_level: 12, semester: 2 },             // Business Law
      { code: "BUS301", grade_level: 12, semester: 1 },             // Personal Finance
      { code: "BUS302", grade_level: 12, semester: 2 },             // Personal Finance
      { code: "PED451", grade_level: 12, semester: 1 },             // Choice P.E.
      { code: "PED452", grade_level: 12, semester: 2 },             // Choice P.E.
    ],
  },
];
