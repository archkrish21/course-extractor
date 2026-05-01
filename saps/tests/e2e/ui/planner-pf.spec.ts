import { test, expect, type Page } from "@playwright/test";
import {
  createPlan,
  forceDeletePlan,
  addCourseToPlan,
  findCourseByCode,
  resetToPrimaryPlanOnly,
  type Plan,
} from "../helpers/api-client";

/**
 * Planner P/F coverage — verifies the badge label and grade-dropdown options
 * for three representative P/F course shapes:
 *
 *   - PED121 (regular PE)         — P/F via the PE/Driver-Ed code rule
 *   - PED331 (Adventure Ed)       — P/F via the same rule (was incorrectly
 *                                    exempted before PR #129; this guards the
 *                                    Course Book p. 86 alignment)
 *   - ACTPREPS2 (catalog Pass/Fail) — P/F via the catalog credit_type rule
 *                                    (Student Learning Programs department)
 *
 * For each: assert the credit-type badge renders "P/F" (not "Pass/Fail") and
 * the grade dropdown lists only "" + P + F (no A–D).
 */
test.use({ storageState: "./tests/e2e/.auth/student.json" });

const PF_CODES = ["PED121", "PED331", "ACTPREPS2"] as const;

function cardLocator(page: Page, code: string) {
  // Cards expose `aria-label="<name> (<code>), <status>…"` — the
  // "(<code>)," fragment is stable and unique per card.
  return page.locator(`[role="button"][aria-label*="(${code}),"]`).first();
}

test("planner shows P/F badge + P/F-only grade dropdown for catalog and code-rule courses", async ({
  request,
  page,
}) => {
  await resetToPrimaryPlanOnly(request);
  let plan: Plan | null = null;
  try {
    plan = await createPlan(request, "E2E P/F Coverage Plan");

    // Resolve catalog ids by code, then bail with a clear message if any are
    // missing — better than a confusing UI assertion later.
    const courses = await Promise.all(
      PF_CODES.map(async (code) => {
        const c = await findCourseByCode(request, code);
        if (!c) throw new Error(`Catalog missing ${code} — re-run db:seed`);
        return c;
      }),
    );

    // All three land in Gr11 regular semesters so we only need to expand the
    // Gr11 row (Gr10 is the only grade expanded by default for a Gr10
    // student). force_add bypasses the semestersOffered check so ACTPREPS2
    // (catalog says pre-summer-only) can be placed in Sem 1 for the test.
    const slots = [
      { gradeLevel: 11, semester: 1 },
      { gradeLevel: 11, semester: 2 },
      { gradeLevel: 11, semester: 1 },
    ] as const;

    for (let i = 0; i < courses.length; i++) {
      const res = await addCourseToPlan(request, plan.id, {
        courseId: courses[i].id,
        gradeLevel: slots[i].gradeLevel,
        semester: slots[i].semester,
        status: "planned",
        forceAdd: true,
      });
      expect(res.status(), `add ${PF_CODES[i]}`).toBe(201);
    }

    await page.goto(`/planner?planId=${plan.id}`);
    await expect(page.locator("text=Loading your plans...")).toBeHidden({ timeout: 15_000 });
    await expect(page.locator("text=/Course planner/")).toBeVisible({ timeout: 10_000 });

    // The student is in Gr10, so only Gr10 is expanded by default. Expand
    // Gr11 so the planted P/F cards become visible.
    const grade11Header = page.getByRole("rowheader", { name: /Grade 11/ });
    if ((await grade11Header.getAttribute("aria-expanded")) !== "true") {
      await grade11Header.click();
    }

    for (const code of PF_CODES) {
      const card = cardLocator(page, code);
      await expect(card, `card for ${code}`).toBeVisible();

      const select = card.locator('select[aria-label*="grade for"]');
      const optionValues = await select.locator("option").evaluateAll((opts) =>
        opts.map((o) => (o as HTMLOptionElement).value),
      );
      // Empty placeholder + P + F only — no A/B/C/D.
      expect(optionValues, `dropdown options for ${code}`).toEqual(["", "P", "F"]);

      // Credit-type badge must read "P/F" — never the literal "Pass/Fail".
      await expect(card).not.toContainText("Pass/Fail");
      await expect(card).toContainText("P/F");
    }
  } finally {
    if (plan?.id) await forceDeletePlan(request, plan.id);
  }
});
