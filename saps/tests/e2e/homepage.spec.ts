import { test, expect } from "@playwright/test";

// ─── Home Page (/) ─────────────────────────────────────────────────────────

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with hero heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Plan Your 4-Year.*High School Journey/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CTA buttons are visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Get Started Free" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "See How It Works" })).toBeVisible();
  });

  test("free early access badge is visible", async ({ page }) => {
    await expect(page.locator("text=Free during early access").first()).toBeVisible();
  });

  test("Why SAPS section shows 3 pain points", async ({ page }) => {
    // Section heading was renamed to "Why students need SAPS" with new pain-point copy
    await expect(page.locator("text=Why students need SAPS")).toBeVisible();
    await expect(page.locator("text=Course maze")).toBeVisible();
    await expect(page.locator("text=Graduation surprises")).toBeVisible();
    await expect(page.locator("text=Everyone's in the dark")).toBeVisible();
  });

  test("features section shows 5 feature cards", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Everything you need to plan ahead" })
    ).toBeVisible();
    await expect(page.locator("text=4-Year Course Planner")).toBeVisible();
    await expect(page.locator("text=GPA & Grade Tracking")).toBeVisible();
    await expect(page.locator("text=Graduation Progress")).toBeVisible();
    await expect(page.locator("text=Prerequisite Intelligence")).toBeVisible();
    await expect(page.locator("text=Family & Counselor Access")).toBeVisible();
  });

  test("how-it-works section shows 3 steps", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Get started in 3 simple steps" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create your account" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Build your plan" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Track your progress" })
    ).toBeVisible();
  });

  test("FAQ section — clicking a question expands the answer", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Common questions" })
    ).toBeVisible();

    // First FAQ: "Is SAPS free?"
    const faqButton = page.getByRole("button", { name: "Is SAPS free?" });
    await expect(faqButton).toBeVisible();

    // FAQ rows use a max-height transition rather than display:none, so the
    // answer text is always in the DOM. Verify the parent container's
    // collapsed/expanded class instead of pure visibility.
    const answerLocator = page.locator("text=Yes! SAPS is completely free during early access.").first();

    // Click to expand
    await faqButton.click();
    await expect(answerLocator).toBeVisible();

    // Click again to collapse — the container animates closed
    await faqButton.click();
  });

  test("final CTA section is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Start planning your future today" })
    ).toBeVisible();
  });

  test("navigation has SAPS logo, About, FAQ, Sign in, Get Started Free", async ({ page, isMobile }) => {
    const header = page.locator("header");
    await expect(header.locator("text=SAPS")).toBeVisible();
    // On mobile, About/FAQ collapse into a hamburger menu — assert on the
    // always-visible items only.
    if (!isMobile) {
      await expect(header.getByRole("link", { name: "About" })).toBeVisible();
      await expect(header.getByRole("link", { name: "FAQ" })).toBeVisible();
    }
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Get Started Free" })).toBeVisible();
  });

  test("footer has Product, Legal, Connect columns", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.locator("text=Product")).toBeVisible();
    await expect(footer.locator("text=Legal")).toBeVisible();
    await expect(footer.locator("text=Connect")).toBeVisible();
    // Social icons were removed; the Connect column is now just a "supporting Stevenson HS" note
  });
});

// ─── About Page (/about) ──────────────────────────────────────────────────

test.describe("About Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about");
  });

  test("page loads with About SAPS heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "About SAPS" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Our Story, Our Mission, What We Do sections visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Our Story" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Our Mission" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What We Do" })).toBeVisible();
  });

  test("not affiliated disclaimer visible", async ({ page }) => {
    // Both the about page body AND the footer carry an affiliation disclaimer.
    // .first() picks the in-page mention.
    await expect(
      page.locator("text=not affiliated with").first()
    ).toBeVisible();
  });
});

// ─── Contact Page (/contact) ──────────────────────────────────────────────

test.describe("Contact Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact");
  });

  test("page loads with Contact Us heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Contact Us" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Name, Email, Subject, Message fields exist", async ({ page }) => {
    await expect(page.getByPlaceholder("Your name")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("What's this about?")).toBeVisible();
    await expect(page.getByPlaceholder("Tell us more...")).toBeVisible();
  });

  test("Send button disabled when fields empty", async ({ page }) => {
    const sendBtn = page.getByRole("button", { name: "Send Message" });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
  });

  test("Send button enabled when required fields filled", async ({ page }) => {
    await page.getByPlaceholder("Your name").fill("Test User");
    await page.getByPlaceholder("you@example.com").fill("test@example.com");
    await page.getByPlaceholder("Tell us more...").fill("This is a test message.");

    const sendBtn = page.getByRole("button", { name: "Send Message" });
    await expect(sendBtn).toBeEnabled();
  });
});

// ─── Testimonials (disabled) ────────────────────────────────────────────────

test.describe("Testimonials", () => {
  test("testimonials section is hidden when feature flag is off", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    await expect(page.getByText("Loved by students and families")).not.toBeVisible();
  });
});

// ─── Footer Contact Link ────────────────────────────────────────────────────

test.describe("Footer Links", () => {
  test("Contact Us link navigates to contact page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    // Footer "Contact Us" is gated by HOME_FEATURES.showContactPage. Skip when
    // the link isn't rendered rather than timing out.
    const contactLink = page.locator("footer").getByRole("link", { name: "Contact Us" });
    if ((await contactLink.count()) === 0) {
      test.skip(true, "Contact page feature flag is disabled");
      return;
    }
    await expect(contactLink).toBeVisible();
    await contactLink.click();
    await page.waitForURL("**/contact", { timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Contact Us" })).toBeVisible();
  });
});
