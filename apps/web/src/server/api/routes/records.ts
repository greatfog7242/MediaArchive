import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../hono";
import { verifyRole } from "../middleware/verifyRole";
import { rateLimit } from "../middleware/rateLimit";
import {
  createRecordSchema,
  updateRecordSchema,
  bulkUpdateSchema,
  paginationSchema,
  listRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  bulkUpdateRecords,
} from "@/server/services/record.service";

export const recordsRouter = new Hono<AppEnv>()

  // GET /api/hono/records — VIEWER+
  .get("/", verifyRole("VIEWER"), zValidator("query", paginationSchema), async (c) => {
    const params = c.req.valid("query");
    const result = await listRecords(params);
    return c.json(result);
  })

  // GET /api/hono/records/:id — VIEWER+
  .get("/:id", verifyRole("VIEWER"), async (c) => {
    const id = c.req.param("id");
    const record = await getRecordById(id);
    if (!record) {
      return c.json({ error: "Record not found" }, 404);
    }
    return c.json({ data: record });
  })

  // POST /api/hono/records/bulk — EDITOR+: bulk update
  .post("/bulk", verifyRole("EDITOR"), rateLimit(10, 60), zValidator("json", bulkUpdateSchema), async (c) => {
    const { recordIds, updates } = c.req.valid("json");
    const userId = c.get("userId");
    const result = await bulkUpdateRecords(recordIds, updates, userId);
    return c.json(result);
  })

  // POST /api/hono/records — EDITOR+
  .post("/", verifyRole("EDITOR"), rateLimit(60, 60), zValidator("json", createRecordSchema), async (c) => {
    try {
      const body = c.req.valid("json");
      const userId = c.get("userId");
      const record = await createRecord(body, userId);
      return c.json({ data: record }, 201);
    } catch (error: any) {
      console.error("Error creating record:", error);

      // Handle Prisma unique constraint error
      if (error.code === 'P2002') {
        return c.json({
          error: "A record with this Kaltura ID already exists. Please use a different Kaltura ID or leave it empty."
        }, 409); // 409 Conflict
      }

      // Handle other Prisma errors
      if (error.code?.startsWith('P')) {
        return c.json({
          error: "Database error occurred while creating record."
        }, 500);
      }

      // Generic error
      return c.json({
        error: "Failed to create record. Please try again."
      }, 500);
    }
  })

  // PUT /api/hono/records/:id — EDITOR+
  .put("/:id", verifyRole("EDITOR"), zValidator("json", updateRecordSchema), async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const userId = c.get("userId");
    const record = await updateRecord(id, body, userId);
    if (!record) {
      return c.json({ error: "Record not found" }, 404);
    }
    return c.json({ data: record });
  })

  // DELETE /api/hono/records/:id — ADMIN only
  .delete("/:id", verifyRole("ADMIN"), rateLimit(30, 60), async (c) => {
    const id = c.req.param("id");
    const record = await deleteRecord(id);
    if (!record) {
      return c.json({ error: "Record not found" }, 404);
    }
    return c.json({ message: "Record deleted", id });
  });
