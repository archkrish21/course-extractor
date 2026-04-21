import { test as setup } from "@playwright/test";
import { loginViaForm } from "./helpers/auth";
import { USERS } from "./fixtures/test-users";

// Setup tests run before all others and create storageState files per role.
// Each role gets its own file that all tests in that project share.
// Dev-server cold compilation happens on the first goto in auth-student,
// so give this first setup a generous budget.
setup.setTimeout(60_000);

setup("authenticate as student", async ({ page }) => {
  await loginViaForm(page, USERS.student.email, USERS.student.password);
  await page.context().storageState({ path: "./tests/e2e/.auth/student.json" });
});

setup("authenticate as parent", async ({ page }) => {
  await loginViaForm(page, USERS.parent.email, USERS.parent.password);
  await page.context().storageState({ path: "./tests/e2e/.auth/parent.json" });
});

setup("authenticate as counselor", async ({ page }) => {
  await loginViaForm(page, USERS.counselor.email, USERS.counselor.password);
  await page.context().storageState({ path: "./tests/e2e/.auth/counselor.json" });
});
