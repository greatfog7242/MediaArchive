import "server-only";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { redis } from "@/server/redis";

// ─── Validation Schemas ────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("VIEWER"),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

// ─── Service Functions ─────────────────────────────────────────────

export async function listUsers() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(input: CreateUserInput) {
  // Check for existing email
  const existing = await db.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function updateUserRole(userId: string, input: UpdateUserRoleInput) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const updated = await db.user.update({
    where: { id: userId },
    data: { role: input.role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  // Invalidate Redis role cache so verifyRole picks up change immediately
  await redis.del(`role:${userId}`);

  return updated;
}

export async function deleteUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Prevent deleting the last ADMIN
  if (user.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new Error("Cannot delete the last admin user");
    }
  }

  await db.user.delete({ where: { id: userId } });

  // Clean up Redis cache
  await redis.del(`role:${userId}`);

  return user;
}

export async function getSystemStats() {
  const [recordCount, userCount, lastSyncTime] = await Promise.all([
    db.mediaRecord.count(),
    db.user.count(),
    redis.get("last_sync_time"),
  ]);

  return {
    recordCount,
    userCount,
    lastSyncTime: lastSyncTime ?? null,
  };
}
