import { Hono } from "hono";
import type { AppEnv } from "../hono";
import { verifyRole } from "../middleware/verifyRole";
import { fullSyncToTypesense } from "@/server/typesense.service";
import { redis } from "@/server/redis";

export const syncRouter = new Hono<AppEnv>()

  // POST /api/hono/sync — ADMIN only: full PG → Typesense re-index
  .post("/", verifyRole("ADMIN"), async (c) => {
    const start = Date.now();
    await fullSyncToTypesense();
    const durationMs = Date.now() - start;

    // Store last sync time for admin dashboard
    await redis.set("last_sync_time", new Date().toISOString());

    return c.json({
      message: "Full sync complete",
      durationMs,
    });
  });
