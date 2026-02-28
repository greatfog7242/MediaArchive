import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../hono";
import { verifyRole } from "../middleware/verifyRole";
import {
  createUserSchema,
  updateUserRoleSchema,
  listUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getSystemStats,
} from "@/server/services/user.service";

export const usersRouter = new Hono<AppEnv>()

  // GET /api/hono/users — ADMIN only: list all users
  .get("/", verifyRole("ADMIN"), async (c) => {
    const users = await listUsers();
    return c.json({ data: users });
  })

  // POST /api/hono/users — ADMIN only: create user
  .post("/", verifyRole("ADMIN"), zValidator("json", createUserSchema), async (c) => {
    const body = c.req.valid("json");
    try {
      const user = await createUser(body);
      return c.json({ data: user }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      return c.json({ error: message }, 400);
    }
  })

  // PUT /api/hono/users/:id/role — ADMIN only: update user role
  .put("/:id/role", verifyRole("ADMIN"), zValidator("json", updateUserRoleSchema), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const user = await updateUserRole(id, body);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ data: user });
  })

  // DELETE /api/hono/users/:id — ADMIN only: delete user
  .delete("/:id", verifyRole("ADMIN"), async (c) => {
    const id = c.req.param("id");
    try {
      const user = await deleteUser(id);
      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }
      return c.json({ message: "User deleted", id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      return c.json({ error: message }, 400);
    }
  })

  // GET /api/hono/users/stats — ADMIN only: system stats
  .get("/stats", verifyRole("ADMIN"), async (c) => {
    const stats = await getSystemStats();
    return c.json({ data: stats });
  });
