import "server-only";
import Redis from "ioredis";
import { serverEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(serverEnv.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
