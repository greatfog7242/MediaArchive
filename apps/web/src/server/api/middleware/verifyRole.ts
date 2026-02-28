import type { MiddlewareHandler } from "hono";
import { decode } from "next-auth/jwt";
import { getCookie } from "hono/cookie";
import type { Role } from "@prisma/client";
import { redis } from "@/server/redis";
import { db } from "@/server/db";
import type { AppEnv } from "../hono";

/** Role hierarchy — higher index = more privilege. */
const ROLE_LEVEL: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
};

const ROLE_CACHE_TTL = 300; // 5 minutes

/**
 * Higher-order middleware that enforces a minimum role requirement.
 *
 * Flow:
 * 1. Read `authjs.session-token` cookie from the request.
 * 2. Decode the JWT using AUTH_SECRET.
 * 3. Check Redis cache for `role:{userId}` → avoid re-decoding on hot paths.
 * 4. Compare the user's role level against the required minimum.
 * 5. Set `userId` and `userRole` on Hono context variables.
 */
export function verifyRole(minimumRole: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    // 1. Extract session token from cookie
    const token =
      getCookie(c, "authjs.session-token") ??
      getCookie(c, "__Secure-authjs.session-token");

    if (!token) {
      return c.json({ error: "Unauthorized — no session token" }, 401);
    }

    const secret = process.env["AUTH_SECRET"];
    if (!secret) {
      console.error("[verifyRole] AUTH_SECRET is not set");
      return c.json({ error: "Internal server error" }, 500);
    }

    let userId: string;
    let userRole: Role;

    try {
      // 2. Decode the JWT
      const payload = await decode({ token, secret, salt: "authjs.session-token" });
      if (!payload || !payload["id"] || !payload["role"]) {
        return c.json({ error: "Unauthorized — invalid token" }, 401);
      }

      userId = payload["id"] as string;
      userRole = payload["role"] as Role;

      // 3. Try Redis cache first for role; on cache miss, query DB for
      //    the authoritative role (handles admin role changes mid-session).
      const cachedRole = await redis.get(`role:${userId}`);
      if (cachedRole && (cachedRole === "ADMIN" || cachedRole === "EDITOR" || cachedRole === "VIEWER")) {
        userRole = cachedRole as Role;
      } else {
        // Cache miss — look up the DB for the current role instead of
        // trusting the JWT (which may be stale after a role change).
        const dbUser = await db.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (dbUser) {
          userRole = dbUser.role;
        }
        await redis.set(`role:${userId}`, userRole, "EX", ROLE_CACHE_TTL);
      }
    } catch (err) {
      console.error("[verifyRole] JWT decode failed:", err);
      return c.json({ error: "Unauthorized — token decode failed" }, 401);
    }

    // 4. Check role hierarchy
    if (ROLE_LEVEL[userRole] < ROLE_LEVEL[minimumRole]) {
      return c.json(
        {
          error: `Forbidden — requires ${minimumRole} role or higher`,
          yourRole: userRole,
        },
        403
      );
    }

    // 5. Set context variables for downstream handlers
    c.set("userId", userId);
    c.set("userRole", userRole);

    await next();
  };
}
