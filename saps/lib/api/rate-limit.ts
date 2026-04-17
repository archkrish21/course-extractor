import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

// Only initialize Redis if credentials are configured
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = !!(REDIS_URL && REDIS_TOKEN && REDIS_URL !== "undefined" && REDIS_TOKEN !== "undefined");

const redis = redisConfigured
  ? new Redis({ url: REDIS_URL!, token: REDIS_TOKEN! })
  : null;

// Cache Redis availability to avoid repeated connection attempts
let redisAvailable = redisConfigured;
let lastRedisCheck = 0;
let lastWarnLog = 0;
const REDIS_RETRY_INTERVAL_MS = 60_000; // Retry Redis every 60s after a failure

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding-window rate limiter using Upstash Redis.
 * Fails open if Redis is not configured or unavailable.
 *
 * @param key - Unique key for the rate limit bucket (e.g., `ratelimit:{userId}:courses`)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowSeconds - Window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const resetAt = Math.ceil(Date.now() / 1000) + windowSeconds;
  const passThrough: RateLimitResult = { success: true, remaining: limit, resetAt };

  // Fast path: Redis not configured or known-unavailable (skip connection attempt)
  if (!redis || !redisAvailable) {
    // Periodically retry Redis after a failure
    if (redis && !redisAvailable && Date.now() - lastRedisCheck > REDIS_RETRY_INTERVAL_MS) {
      // Try to reconnect in the background, don't block this request
      redisAvailable = true; // Optimistic — will be set back to false if it fails again
    } else {
      if (process.env.NODE_ENV === "production" && !redis) {
        const now = Date.now();
        if (now - lastWarnLog > 60_000) {
          logger.warn({ key }, "[rate-limit] passing through — Redis not configured in production");
          lastWarnLog = now;
        }
      }
      return passThrough;
    }
  }

  try {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    const pipe = redis.pipeline();
    pipe.zremrangebyscore(redisKey, 0, windowStart);
    pipe.zadd(redisKey, { score: now, member: `${now}:${Math.random()}` });
    pipe.zcard(redisKey);
    pipe.expire(redisKey, windowSeconds);

    const results = await pipe.exec();
    const count = results[2] as number;

    // Redis is working — mark as available
    redisAvailable = true;

    if (count > limit) {
      return {
        success: false,
        remaining: 0,
        resetAt: Math.ceil((now + windowMs) / 1000),
      };
    }

    return {
      success: true,
      remaining: Math.max(0, limit - count),
      resetAt: Math.ceil((now + windowMs) / 1000),
    };
  } catch (error) {
    // Mark Redis as unavailable and record the time
    redisAvailable = false;
    lastRedisCheck = Date.now();
    console.warn("[rate-limit] Redis unavailable, failing open. Will retry in 60s.", String(error).slice(0, 100));
    return passThrough;
  }
}
