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
