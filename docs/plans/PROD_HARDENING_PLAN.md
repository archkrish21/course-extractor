# Production Hardening Implementation Plan

Purpose: close the non-auth operational and abuse-protection gaps identified in the pre-prod audit before launch.

Scope: three items, focused on **abuse prevention, observability, and forensics** — things that aren't part of authentication itself but were surfaced during the auth audit and should land before opening signups. Pure authentication and authorization work is tracked in [AUTH_HARDENING_PLAN.md](AUTH_HARDENING_PLAN.md).

Each step is self-contained with concrete files, code sketches, verification, and rollback notes.

| Step | Category | Priority |
|---|---|---|
| 1. Rate-limit spam endpoints | Abuse prevention | Launch blocker |
| 2. Fail-loud Redis observability | Operational safety net | Launch blocker |
| 3. Audit log for sensitive actions | Forensics / incident response | Should-fix |

Work under `saps/` unless noted otherwise.

---

## Pre-work (once, before starting)

Branch off `main`:
```
git checkout -b prod-hardening
```

Can be worked in parallel with [AUTH_HARDENING_PLAN.md](AUTH_HARDENING_PLAN.md) — see that file for cross-dependencies.

---

## Step 1 — Rate-limit spam endpoints  *(launch blocker)*

**Goal:** Prevent the unauthenticated contact/marketing forms from being turned into free abuse tools for filling your DB with junk. These are not auth endpoints — rate limiting here is purely about spam/abuse prevention.

### 1a. Endpoints to cover

| Route | Key | Limit | Window |
|---|---|---|---|
| `POST /api/v1/contact` | `contact:${ip}` | 5 | 60s |
| `POST /api/v1/school-request` | `school-request:${ip}` | 5 | 60s |
| `POST /api/v1/feedback` | `feedback:${userId}` | 10 | 300s |

### 1b. For unauthenticated routes, key by IP

Contact and school-request are unauthenticated. Use the caller IP as the key:

```ts
// top of saps/app/api/v1/contact/route.ts
import { rateLimit } from "@/lib/api/rate-limit";
import { errorResponse } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
  const rl = await rateLimit(`contact:${ip}`, 5, 60);
  if (!rl.success) {
    return errorResponse("RATE_LIMITED", "Too many requests.", 429);
  }
  // ... existing handler
}
```

Do the same in `school-request/route.ts`.

### 1c. For feedback, key by userId

Feedback requires auth, so use `user.id`:

```ts
// saps/app/api/v1/feedback/route.ts, just after requireAuth
const rl = await rateLimit(`feedback:${user.id}`, 10, 300);
if (!rl.success) {
  return errorResponse("RATE_LIMITED", "Too many requests.", 429);
}
```

### 1d. Verify

1. Hit `contact` 6 times in quick succession with the same source IP → 6th returns 429.
2. Write a Vitest test that mocks `rateLimit` to return `{success: false}` and asserts 429 for `contact` (covers one unauth route).

### 1e. Rollback

Revert the commit. Rate limits are additive.

### 1f. Exit criteria

- [ ] `contact`, `school-request`, `feedback` all have `rateLimit()` calls
- [ ] New test covers the 429 path for `contact`
- [ ] Manual curl verification for `contact`

---

## Step 2 — Fail loudly when Redis is missing in production  *(launch blocker)*

**Goal:** If `UPSTASH_REDIS_REST_URL` is not set (or unreachable) in production, the app should warn once at startup and log every request that falls through. Today it silently passes through with no signal, which means you could deploy with no rate limiting at all and never notice.

### 2a. Add a startup check

Create `saps/lib/api/startup-checks.ts`:

```ts
import { logger } from "@/lib/logger";

let checked = false;

export function runStartupChecks() {
  if (checked) return;
  checked = true;

  if (process.env.NODE_ENV !== "production") return;

  const redisConfigured = !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (!redisConfigured) {
    logger.error(
      { check: "redis" },
      "[startup] UPSTASH_REDIS_REST_URL not set in production — rate limiting will fail open. This is a security risk."
    );
  }
}
```

Wire it into a place that runs once per deploy via Next.js's instrumentation hook:

```ts
// saps/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupChecks } = await import("@/lib/api/startup-checks");
    runStartupChecks();
  }
}
```

Confirm `experimental.instrumentationHook` is enabled (default on Next 15+) in [saps/next.config.ts](saps/next.config.ts).

### 2b. Warn on every fall-through

Update [saps/lib/api/rate-limit.ts:40-48](saps/lib/api/rate-limit.ts#L40-L48) to log when Redis is missing in production:

```ts
let lastWarnLog = 0;

// inside rateLimit(), in the "fail open" branch:
if (!redis || !redisAvailable) {
  if (process.env.NODE_ENV === "production" && !redis) {
    // Log once per minute at most to avoid flooding
    const now = Date.now();
    if (now - lastWarnLog > 60_000) {
      logger.warn({ key }, "[rate-limit] passing through — Redis not configured in production");
      lastWarnLog = now;
    }
  }
  // existing fall-through...
}
```

### 2c. Verify

1. Run `npm run build && NODE_ENV=production npm start` locally with `UPSTASH_REDIS_REST_URL` unset → see startup warning in logs, see the fall-through warning when hitting a rate-limited route.
2. Run with Redis configured → no warnings.

### 2d. Rollback

Purely additive logging; rollback = revert commit.

### 2e. Exit criteria

- [ ] Startup check warns once at process start if Redis missing in prod
- [ ] Rate-limit fall-through logs throttled warning in prod
- [ ] Local verification done

---

## Step 3 — Audit log table and logging in sensitive handlers  *(should-fix)*

**Goal:** Record an immutable log of sensitive actions so you can answer "who did X and when" after an incident or support request. This is forensics/compliance infrastructure — useful for investigating auth incidents but not itself an auth mechanism.

### 3a. Schema

Add to `saps/lib/db/schema.ts`:

```ts
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_audit_log_user").on(table.userId, table.createdAt),
    index("idx_audit_log_action").on(table.action, table.createdAt),
  ]
);
```

Run `npm run db:generate` then `npm run db:migrate`.

**Note:** If the auth plan's Step 1 (RLS) is landing on the same branch, bundle this schema change into the same migration generation cycle so you only run `db:migrate` once. Also enable RLS on the new `audit_log` table with a read-only-self policy.

### 3b. Helper

New file `saps/lib/audit/log.ts`:

```ts
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import type { NextRequest } from "next/server";

interface AuditEntry {
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
}

export async function audit(entry: AuditEntry) {
  const ip = entry.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? entry.request?.headers.get("x-real-ip")
    ?? null;
  const userAgent = entry.request?.headers.get("user-agent") ?? null;

  try {
    await db.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: entry.metadata ?? {},
      ip,
      userAgent,
    });
  } catch (err) {
    // Never block a request because audit failed — just log
    console.error("[audit] failed to log", err);
  }
}
```

### 3c. Wire into sensitive handlers

At minimum, call `audit()` in:

| Handler | Action string |
|---|---|
| `POST /accounts/:id/members` | `member.invited` |
| `DELETE /accounts/:id/members/:userId` | `member.removed` |
| `POST /accounts/:id/members/join` | `member.joined` |
| `POST /plans/:id/shares` | `plan.shared` |
| `DELETE /plans/:id/shares/:userId` | `plan.unshared` |
| `POST /plans` | `plan.created` |
| `DELETE /plans/:id` | `plan.deleted` |
| `DELETE /users/me` | `account.deleted` |
| `POST /auth/login` | `auth.login` |
| `POST /auth/signup` | `auth.signup` |
| Failed login (401) | `auth.login_failed` |

Example:
```ts
await audit({
  userId: user.id,
  action: "member.invited",
  resourceType: "account",
  resourceId: accountId,
  metadata: { targetEmail: parsed.data.email, targetRole: target_role },
  request,
});
```

### 3d. Verify

1. Run a few flows locally; query `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10` and confirm entries appear.
2. Pull the DB cord briefly (or mock the insert to throw) → the calling request should still succeed.

### 3e. Rollback

Drop the table migration; remove `audit()` calls. Safe because audit writes are best-effort and don't affect request success.

### 3f. Exit criteria

- [ ] `audit_log` table exists
- [ ] `audit()` helper in place
- [ ] All 11 sensitive handlers call `audit()`
- [ ] Audit writes don't block request flow

---

## Checklist — prod hardening complete

- [ ] Step 1 — Spam endpoints rate-limited
- [ ] Step 2 — Startup check + fall-through logging active
- [ ] Step 3 — `audit_log` table + logging in 11 sensitive handlers

### Regression safety
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes
- [ ] Rollback instructions for each step documented and tested

---

## Dependencies and sequencing with the auth plan

- **Step 1 (spam rate limits)** uses the same `rateLimit()` infrastructure as auth plan Step 2 — if doing them together, bundle into one branch to avoid merge conflicts in `lib/api/rate-limit.ts` if you modify it.
- **Step 2 (fail-loud Redis)** complements auth plan Step 2 — if auth rate limits are the primary reason you need Redis in prod, this observability layer gives you the signal to catch a broken deploy. Worth landing both together.
- **Step 3 (audit log)** schema can be bundled with auth plan Step 1 (RLS) migration to save a `db:migrate` cycle, but the two are logically independent.

## What this plan explicitly does NOT cover

- Authentication, authorization, RLS, session management, Origin/CSRF checks, Supabase dashboard config — all tracked in [AUTH_HARDENING_PLAN.md](AUTH_HARDENING_PLAN.md).
- Penetration testing. Budget for an external security review after launch if the app gains traction.
- SOC 2 / compliance frameworks. Not applicable at current stage.
- WAF or DDoS protection. Vercel's platform provides baseline DDoS protection. Consider Cloudflare in front of Vercel only if targeted abuse emerges.
- Secrets scanning in CI. Worth adding separately (GitHub's secret scanning is free). Not part of this plan because it's meta-infrastructure.
- Encryption at rest for PII. Supabase encrypts the whole database at rest by default. Column-level encryption for sensitive fields (DOB, etc.) is a future project.
