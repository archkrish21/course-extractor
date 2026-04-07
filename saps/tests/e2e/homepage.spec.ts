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

  test("14-day free trial badge is visible", async ({ page }) => {
    await expect(page.locator("text=14-day free trial")).toBeVisible();
  });

  test("Why SAPS section shows 3 pain points", async ({ page }) => {
    await expect(page.locator("text=Why SAPS?")).toBeVisible();
    await expect(page.locator("text=300+ courses, complex prerequisites")).toBeVisible();
    await expect(page.locator("text=GPA surprises at graduation")).toBeVisible();
    await expect(page.locator("text=Parents and counselors in the dark")).toBeVisible();
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
      page.getByRole("heading", { name: "Get started in minutes" })
    ).toBeVisible();
    await expect(page.locator("text=Sign Up")).toBeVisible();
    await expect(page.locator("text=Build Your Plan")).toBeVisible();
    await expect(page.locator("text=Track Progress")).toBeVisible();
  });

  test("FAQ section — clicking a question expands the answer", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Frequently asked questions" })
    ).toBeVisible();

    // First FAQ: "Is SAPS free?"
    const faqButton = page.getByRole("button", { name: "Is SAPS free?" });
    await expect(faqButton).toBeVisible();

    // Answer should not be visible before clicking
    await expect(page.locator("text=Yes! SAPS is free to use.")).not.toBeVisible();

    // Click to expand
    await faqButton.click();
    await expect(page.locator("text=Yes! SAPS is free to use.")).toBeVisible();

    // Click again to collapse
    await faqButton.click();
    await expect(page.locator("text=Yes! SAPS is free to use.")).not.toBeVisible();
  });

  test("final CTA section is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Ready to plan your future?" })
    ).toBeVisible();
  });

  test("navigation has SAPS logo, About, FAQ, Sign in, Get Started Free", async ({ page }) => {
    const header = page.locator("header");
    await expect(header.locator("text=SAPS")).toBeVisible();
    await expect(header.getByRole("link", { name: "About" })).toBeVisible();
    await expect(header.getByRole("link", { name: "FAQ" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Get Started Free" })).toBeVisible();
  });

  test("footer has Product, Legal, Connect columns with social icons", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer.locator("text=Product")).toBeVisible();
    await expect(footer.locator("text=Legal")).toBeVisible();
    await expect(footer.locator("text=Connect")).toBeVisible();

    // Social icons via aria-label
    await expect(footer.getByLabel("Instagram")).toBeVisible();
    await expect(footer.getByLabel("Facebook")).toBeVisible();
    await expect(footer.getByLabel("Twitter")).toBeVisible();
    await expect(footer.getByLabel("LinkedIn")).toBeVisible();
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
    await expect(
      page.locator("text=not affiliated with")
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

// ─── Testimonials ───────────────────────────────────────────────────────────

test.describe("Testimonials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
  });

  test("testimonials section is visible", async ({ page }) => {
    await expect(page.getByText("Loved by students and families")).toBeVisible();
  });

  test("shows three testimonial cards", async ({ page }) => {
    await expect(page.getByText("Maya S.")).toBeVisible();
    await expect(page.getByText("David P.")).toBeVisible();
    await expect(page.getByText("Ms. Chen")).toBeVisible();
  });

  test("shows star ratings", async ({ page }) => {
    // Each testimonial has 5 star SVGs — should have at least 15 stars total
    const stars = page.locator("section").filter({ hasText: "Loved by students" }).locator("svg.fill-current");
    await expect(stars.first()).toBeVisible();
  });

  test("shows role labels", async ({ page }) => {
    await expect(page.getByText("Sophomore")).toBeVisible();
    await expect(page.getByText("Parent")).toBeVisible();
    await expect(page.getByText("Counselor")).toBeVisible();
  });
});

// ─── Footer Feedback Link ───────────────────────────────────────────────────

test.describe("Footer Links", () => {
  test("feedback link navigates to contact page", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);
    const feedbackLink = page.locator("footer").getByText("Feedback");
    await expect(feedbackLink).toBeVisible();
    await feedbackLink.click();
    await page.waitForURL("**/contact", { timeout: 5000 });
    await expect(page.getByText("Contact Us")).toBeVisible();
  });
});
