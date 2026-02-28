import type { MiddlewareHandler } from "hono";
import { redis } from "@/server/redis";
import type { AppEnv } from "../hono";

/**
 * Sliding-window rate limiter using Redis.
 *
 * Key format: `rl:{userId}:{path}`
 * Uses INCR + EXPIRE for a simple fixed-window counter.
 */
export function rateLimit(
  maxRequests: number,
  windowSeconds: number
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = c.get("userId");
    const path = c.req.path;
    const key = `rl:${userId}:${path}`;

    const current = await redis.incr(key);

    // Set TTL on first request in the window
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > maxRequests) {
      const ttl = await redis.ttl(key);
      c.header("Retry-After", String(ttl > 0 ? ttl : windowSeconds));
      return c.json(
        { error: "Too many requests. Please try again later." },
        429
      );
    }

    await next();
  };
}
