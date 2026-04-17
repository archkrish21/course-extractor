# Backend Development Guide

Use this guide when building or modifying backend code (API routes, DB queries, auth, business logic) in the SAPS Next.js application (`saps/`).

## Route Handler Anatomy

Every protected API route follows this structure:

```typescript
import { NextRequest } from "next/server";
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";
import { successResponse, errorResponse } from "@/lib/api/response";
import { db } from "@/lib/db";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const user = await requireAuth();
    if (user instanceof Response) return user;

    // 2. Validate
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400,
        { details: parsed.error.flatten().fieldErrors });
    }

    // 3. Account context
    const accountId = request.headers.get("X-Account-Id") ?? undefined;
    const accountCtx = await getAccountContext(user.id, accountId);
    if (!accountCtx) return errorResponse("FORBIDDEN", "Not a member of this account.", 403);

    // 4. Tier check (if feature-gated)
    const tier = await getEffectiveTier({ accountId: accountCtx.accountId });
    if (!tier.canWhatIf) {
      return errorResponse("UPGRADE_REQUIRED", "Upgrade to Plus.", 402,
        { minimum_tier: "plus", current_tier: tier.tier });
    }

    // 5. Business logic + DB queries
    const result = await db.insert(myTable).values({ ... }).returning();

    // 6. Response
    return successResponse(result, undefined, 201);
  } catch (error) {
    console.error("[my-route] Error:", error);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
```

## Authentication (`@/lib/auth/get-user`)

```typescript
import { requireAuth, getAccountContext } from "@/lib/auth/get-user";

// Returns AuthenticatedUser or 401 Response
const user = await requireAuth();
if (user instanceof Response) return user;
// user.id, user.email are available

// Verify account membership + get role/permissions
const accountCtx = await getAccountContext(user.id, accountId);
// accountCtx.accountId, accountCtx.role, accountCtx.canEdit
```

- `requireAuth()` reads the Supabase session from cookies via `createSupabaseServerClient()`
- `getAccountContext()` resolves account from `X-Account-Id` header or first membership
- Counselors always have `canEdit: false`

## Plan Permissions (`@/lib/auth/plan-permissions`)

```typescript
import { getPlanAccess, hasPermission } from "@/lib/auth/plan-permissions";

const access = await getPlanAccess(user.id, planId, plan.accountId);
if (!access || !hasPermission(access.permission, "edit")) {
  return errorResponse("FORBIDDEN", "No edit permission.", 403);
}
```

**Permission hierarchy:** `owner` > `delete` > `edit` > `view`

Lookup order:
1. `plan_shares` table (explicit per-plan share)
2. Fallback to `account_members.canEdit` (backward compatibility)

## Response Helpers (`@/lib/api/response`)

```typescript
import { successResponse, errorResponse } from "@/lib/api/response";

// Success (200 default)
return successResponse(data);
return successResponse(data, undefined, 201);

// Success with pagination
return successResponse(items, { has_more: true, next_cursor: "base64..." });

// Error
return errorResponse("NOT_FOUND", "Plan not found.", 404);
return errorResponse("UPGRADE_REQUIRED", "Upgrade to Plus.", 402,
  { minimum_tier: "plus", current_tier: "starter" });
```

**Response shapes:**
```json
// Success
{ "data": { ... }, "meta": { "has_more": true, "next_cursor": "..." } }

// Error
{ "error": { "code": "NOT_FOUND", "message": "Plan not found." } }
```

**Standard error codes:**
| Code | Status | When |
|------|--------|------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized / account frozen |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | Grade locked, duplicate course |
| `VALIDATION_ERROR` | 400 | Bad request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `UPGRADE_REQUIRED` | 402 | Feature requires higher tier |
| `COPPA_BLOCKED` | 403 | User under 13 |
| `INTERNAL_ERROR` | 500 | Unexpected error |

## Request Validation (Zod)

Always use `.safeParse()` — never `.parse()` (which throws):

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  course_id: z.string().uuid(),
  grade_level: z.number().int().min(9).max(12),
  semester: z.number().int().min(-2).max(2).nullable(), // -2,-1 = summer
  status: z.enum(["planned", "enrolled", "completed", "dropped"]),
});

const parsed = schema.safeParse(body);
if (!parsed.success) {
  return errorResponse("VALIDATION_ERROR", "Invalid request body.", 400,
    { details: parsed.error.flatten().fieldErrors });
}
const { name, course_id } = parsed.data;
```

## Database (Drizzle ORM)

### Client

```typescript
import { db } from "@/lib/db";
import { eq, and, or, sql, desc, asc } from "drizzle-orm";
import { users, accounts, fourYearPlans, planCourses, ... } from "@/lib/db/schema";
```

The client is a singleton `drizzle(Pool, { schema })` using `pg` with `DATABASE_URL`.

### Common Query Patterns

**Select with join:**
```typescript
const plans = await db
  .select({
    id: fourYearPlans.id,
    name: fourYearPlans.name,
    permission: planShares.permission,
  })
  .from(fourYearPlans)
  .leftJoin(planShares, and(
    eq(planShares.planId, fourYearPlans.id),
    eq(planShares.userId, user.id)
  ))
  .where(eq(fourYearPlans.accountId, accountId))
  .orderBy(fourYearPlans.createdAt);
```

**Inline subqueries:**
```typescript
const plans = await db
  .select({
    id: fourYearPlans.id,
    courseCount: sql<number>`(
      SELECT COUNT(*)::int FROM plan_courses
      WHERE plan_courses.plan_id = ${fourYearPlans.id}
    )`,
  })
  .from(fourYearPlans)
  .where(eq(fourYearPlans.accountId, accountId));
```

**Insert with returning:**
```typescript
const [newPlan] = await db
  .insert(fourYearPlans)
  .values({ name, studentId, accountId, status: "draft" })
  .returning();
```

**Batch insert (e.g., template copy):**
```typescript
await db.insert(planCourses).values(
  templateCourses.map(tc => ({
    planId: newPlan.id,
    courseId: tc.courseId,
    gradeLevel: tc.gradeLevel,
    semester: tc.semester,
    status: "planned" as const,
  }))
);
```

**Update:**
```typescript
await db
  .update(subscriptions)
  .set({ status: "active", currentPeriodEnd: periodEnd })
  .where(eq(subscriptions.accountId, accountId));
```

**Upsert (conflict handling):**
```typescript
await db.insert(subscriptionPlans)
  .values({ name, displayName, priceMonthly, features })
  .onConflictDoUpdate({
    target: subscriptionPlans.name,
    set: { displayName, priceMonthly, features },
  });
```

**Delete:**
```typescript
await db.delete(planCourses)
  .where(and(
    eq(planCourses.planId, planId),
    eq(planCourses.courseId, courseId)
  ));
```

### Schema Conventions

- Primary keys: `uuid("id").primaryKey().defaultRandom()`
- Timestamps: `timestamp("created_at", { withTimezone: true }).defaultNow()`
- Enums: `text("status", { enum: ["draft", "active", "archived"] })`
- Foreign keys: `.references(() => otherTable.id, { onDelete: "cascade" })`
- JSONB: `jsonb("features").default({})`
- Arrays: `smallint("grade_levels").array()`
- Semester values: `-2` (Summer S1), `-1` (Summer S2), `1` (Regular S1), `2` (Regular S2)

### Migrations

```bash
npm run db:generate   # Generate from schema changes
npm run db:migrate    # Run pending migrations
npm run db:push       # Dev shortcut (push schema directly)
```

Migrations stored in `lib/db/migrations/` (9 files, 0000-0008).

## Subscription Tier Checking (`@/lib/subscription/middleware`)

```typescript
import { getEffectiveTier, invalidateSubscriptionCache } from "@/lib/subscription/middleware";

const tier = await getEffectiveTier({ accountId });
// tier.tier: "starter" | "trial" | "plus" | "elite"
// tier.accountStatus: "active" | "frozen" | ...
// Feature flags: tier.canWhatIf, tier.canExportPdf, tier.canUseAI, etc.
// Limits: tier.maxPlans, tier.maxLinkedAccounts

// After changing subscription state:
await invalidateSubscriptionCache({ accountId });
```

**Feature flags available:**
`canWhatIf`, `canExportPdf`, `canComparePlans`, `canSharePlans`, `canUseAI`, `canViewPercentile`, `canRigorScoring`, `canParentDraft`, `canCreateGoals`

**Caching:** 5-minute TTL in Redis (Upstash). Falls back to DB query on cache miss. Fails open if Redis unavailable.

## Rate Limiting (`@/lib/api/rate-limit`)

```typescript
import { rateLimit } from "@/lib/api/rate-limit";

const rl = await rateLimit(`gpa:get:${user.id}`, 60, 60); // 60 requests per 60 seconds
if (!rl.success) {
  return errorResponse("RATE_LIMITED", "Too many requests.", 429,
    { retry_after: rl.resetAt - Math.floor(Date.now() / 1000) });
}
```

**Standard limits:**
| Endpoint | Limit | Key |
|----------|-------|-----|
| Auth (signup/login) | 5/min | Per IP |
| GPA | 60/min | Per user |
| What-if | 5/min | Per user |
| GPA snapshots | 60/min | Per user |
| Course search | 30/min | Per user |
| Stripe checkout | 5/min | Per user |
| Invite generation | 5/60s | Per user |

Redis sliding-window algorithm. **Fails open** if Redis unavailable (rate limiting bypassed, not blocked).

## Supabase Auth Clients (`@/lib/supabase/`)

```typescript
// Server-side (API routes, Server Components) — reads session from cookies
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Admin (privileged operations: delete users, bypass RLS)
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Client-side (browser) — used in frontend components only
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
```

- **Server client**: reads/writes cookies for session management
- **Admin client**: uses `SUPABASE_SERVICE_ROLE_KEY` — never expose to client
- **Browser client**: uses anon key — safe for client-side

## Business Logic Modules

### GPA Calculation (`@/lib/gpa/calc`)

```typescript
import { calculateGPA, formatGPA } from "@/lib/gpa/calc";

const result = calculateGPA(courses, "projected"); // or "actual"
// result.unweighted: number | null
// result.weighted: number | null
// result.totalCredits: number
// result.coursesUsed: number

formatGPA(3.756); // "3.76"
formatGPA(null);   // "--"
```

**Rules:**
- Skips dropped courses, P/F courses (via `isPassFailCourse(code)`), and waiver-applied courses
- Full-year courses: credit halved to 0.5 per semester row (avoids double-counting)
- Weights from `@/config/gpa-weights`: CP +0.0, Accelerated +0.5, Honors +0.5, AP +1.0
- "projected" mode = planned + enrolled + completed; "actual" = completed only

### Prerequisite Validation (`@/lib/prereq/validator`)

```typescript
import { validateCourseAddition, validatePlanIntegrity, getTransitiveDownstream } from "@/lib/prereq/validator";

// Before adding a course
const { valid, violations } = await validateCourseAddition(planId, courseId, gradeLevel, semester);

// Full plan validation
const { valid, violations } = await validatePlanIntegrity(planId);

// Blast radius on course removal
const downstream = await getTransitiveDownstream(courseId, catalogVersionId);
```

**What it checks:**
- Course existence and grade-level eligibility
- Enrollment rules (full-year must span both semesters)
- Prerequisites (AND/OR group semantics, slot ordering: summer < regular)
- Corequisites (must be in same semester)
- Duplicates (same course at any grade, semester partner detection)
- Summer equivalents (SOC13S blocks SOC101)

**Slot ordering:** Within a grade level: `-2 < -1 < 1 < 2`. Across grades: lower grade < higher grade.

### Stripe (`@/lib/stripe/`)

```typescript
import { stripe, requireStripe } from "@/lib/stripe/client";
import { getStripePriceId, isOneTimePayment } from "@/lib/stripe/prices";

const priceId = getStripePriceId("plus", "annual"); // Returns Stripe price ID
const isOneTime = isOneTimePayment("four_year"); // true — uses Stripe payment mode

const s = requireStripe(); // Throws if STRIPE_SECRET_KEY not set
```

- `stripe` is a nullable singleton (null if no key — dev-friendly)
- `requireStripe()` throws for routes that must have Stripe
- 4-year billing uses Stripe `mode: "payment"` (one-time), not `mode: "subscription"`

### Email (`@/lib/email/`)

```typescript
import { sendEmail } from "@/lib/email/client";
import { inviteEmailTemplate } from "@/lib/email/templates";

const html = inviteEmailTemplate({
  inviterName: "Jane",
  studentName: "Alex",
  role: "parent",
  inviteCode: "ABC12345",
  claimUrl: "https://saps.app/join?code=ABC12345",
});

await sendEmail({ to: "parent@example.com", subject: "Join SAPS", html });
// Returns true on success, false on failure (non-throwing)
```

- Uses Resend API. Returns boolean, never throws.
- Default sender: `"SAPS <onboarding@resend.dev>"`
- All user inputs HTML-escaped in templates
- Gracefully skips if `RESEND_API_KEY` not set

## Webhook Handling Pattern (Stripe)

```typescript
// No auth — uses Stripe signature verification
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;
  const event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);

  // Idempotency: check stripe_events table
  const [existing] = await db.select().from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, event.id)).limit(1);
  if (existing?.processed) return NextResponse.json({ received: true, duplicate: true });

  // Log before processing
  await db.insert(stripeEvents).values({
    stripeEventId: event.id,
    eventType: event.type,
    payload: event,
  }).onConflictDoNothing();

  // Dispatch
  switch (event.type) {
    case "checkout.session.completed": await handleCheckout(event.data.object); break;
    case "customer.subscription.updated": await handleUpdate(event.data.object); break;
    // ...
  }

  // Mark processed
  await db.update(stripeEvents)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(stripeEvents.stripeEventId, event.id));

  // Invalidate cache
  await invalidateSubscriptionCache({ accountId });
}
```

## Account Deletion Pattern

The `DELETE /api/v1/users/me` handler performs cascading cleanup:

1. **Stripe** — cancel subscription, delete customer
2. **DB** — delete GPA snapshots, plan shares, subscriptions, profiles, members; anonymize consent records (`userId → null`)
3. **FK nullification** — null out `billing_contact_id`, `created_by`, `claimed_by` references
4. **Account cascade** — delete accounts where user is student (FK cascades remove plans, courses, etc.)
5. **Supabase auth** — `admin.deleteUser(userId)`
6. **Redis** — clear subscription + rate limit cache keys
7. **PostHog** — delete person data

Each external service cleanup is non-fatal (try/catch, log warning, continue).

## Seed Script (`scripts/seed.ts`)

```bash
npm run db:seed  # Only works when NODE_ENV !== "production"
```

**Guards:** Refuses to run if `NODE_ENV=production` or `PRODUCTION_DATABASE` env var is set.

**Seed order:** subscription plans → divisions → departments → courses (from JSON) → prerequisites → graduation requirements (37 across 4 groups) → plan templates (6) → legal documents.

Uses `onConflictDoUpdate` for idempotent re-runs.

## Key Files Reference

| Purpose | File |
|---------|------|
| Auth helpers | `lib/auth/get-user.ts` |
| Plan permissions | `lib/auth/plan-permissions.ts` |
| Subscription middleware | `lib/subscription/middleware.ts` |
| Response helpers | `lib/api/response.ts` |
| Rate limiting | `lib/api/rate-limit.ts` |
| DB client | `lib/db/index.ts` |
| Schema (all tables) | `lib/db/schema.ts` |
| GPA calculation | `lib/gpa/calc.ts` |
| Prerequisite validation | `lib/prereq/validator.ts` |
| Stripe client | `lib/stripe/client.ts` |
| Stripe price mapping | `lib/stripe/prices.ts` |
| Email client | `lib/email/client.ts` |
| Email templates | `lib/email/templates.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Supabase admin client | `lib/supabase/admin.ts` |
| Supabase browser client | `lib/supabase/client.ts` |
| GPA weights config | `config/gpa-weights.ts` |
| Grade scale config | `config/grade-scale.ts` |
| Subscription tiers config | `config/subscription-plans.ts` |
| Semester definitions | `config/semesters.ts` |
| Summer equivalents | `config/summer-equivalents.ts` |
| Logger | `lib/logger.ts` |
| PostHog analytics | `lib/analytics/posthog.ts` |

## Logging

```typescript
import { logger } from "@/lib/logger";

logger.info({ planId, userId }, "Plan created");
logger.warn({ courseCode }, "AI hallucinated course");
logger.error({ error }, "Stripe webhook failed");
```

- Pino with JSON output. Level from `LOG_LEVEL` env (default: `info`).
- **Redacted fields:** `authorization`, `password`, `token`, `grade`, `final_grade`, `finalGrade`
- Never log raw grade data, PII, or tokens.

## Testing

```bash
npm test                                          # All unit/API tests
npx vitest run tests/unit/gpa-calc.test.ts        # Single test file
npm run test:e2e                                  # Playwright E2E
```

- API tests use Vitest with direct route handler imports or HTTP calls to localhost
- Test setup in `tests/setup.ts` (imports jest-dom globals)
- E2E global setup resets DB + seeds test accounts
