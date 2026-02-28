import { Hono } from "hono";
import type { AppEnv } from "../hono";
import { verifyRole } from "../middleware/verifyRole";
import { rateLimit } from "../middleware/rateLimit";
import {
  parseCsvToRows,
  validateRows,
  importBatch,
  exportRecordsCsv,
  getImportProgress,
  updateImportProgress,
} from "@/server/services/csv.service";
import {
  getImportQueue,
  ensureWorker,
  type ImportJobData,
} from "@/server/workers/import.worker";

const INLINE_THRESHOLD = 5000; // rows

export const csvRouter = new Hono<AppEnv>()

  // POST /api/hono/csv/import — ADMIN only: upload CSV file
  .post("/import", verifyRole("ADMIN"), rateLimit(5, 60), async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ error: "No CSV file uploaded" }, 400);
    }

    const csvContent = await file.text();
    if (!csvContent.trim()) {
      return c.json({ error: "CSV file is empty" }, 400);
    }

    // Parse and validate
    let rawRows: Record<string, string>[];
    try {
      rawRows = parseCsvToRows(csvContent);
    } catch (err) {
      const message = err instanceof Error ? err.message : "CSV parse error";
      return c.json({ error: `CSV parse failed: ${message}` }, 400);
    }

    if (rawRows.length === 0) {
      return c.json({ error: "CSV file contains no data rows" }, 400);
    }

    const { valid, errors: validationErrors } = validateRows(rawRows);

    if (valid.length === 0) {
      return c.json(
        { error: "No valid rows found", validationErrors },
        400
      );
    }

    const editorId = c.get("userId");

    // Inline processing for small files
    if (valid.length <= INLINE_THRESHOLD) {
      const result = await importBatch(valid, editorId);
      return c.json({
        message: "Import complete",
        imported: result.imported,
        validationErrors,
        importErrors: result.errors,
        total: rawRows.length,
      });
    }

    // Queue for large files
    const jobId = crypto.randomUUID();

    await updateImportProgress(jobId, {
      jobId,
      status: "queued",
      total: valid.length,
      processed: 0,
      errors: validationErrors,
    });

    // Ensure the worker is running
    ensureWorker();

    const queue = getImportQueue();
    await queue.add("csv-import", {
      jobId,
      rows: valid,
      editorId,
    } satisfies ImportJobData);

    return c.json(
      {
        message: "Import queued",
        jobId,
        total: valid.length,
        validationErrors,
      },
      202
    );
  })

  // GET /api/hono/csv/import/:jobId/status — ADMIN only: poll progress
  .get("/import/:jobId/status", verifyRole("ADMIN"), async (c) => {
    const jobId = c.req.param("jobId");
    const progress = await getImportProgress(jobId);

    if (!progress) {
      return c.json({ error: "Job not found or expired" }, 404);
    }

    return c.json(progress);
  })

  // GET /api/hono/csv/export — VIEWER+: download CSV
  .get("/export", verifyRole("VIEWER"), async (c) => {
    const csv = await exportRecordsCsv();

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header(
      "Content-Disposition",
      `attachment; filename="media-archive-export-${new Date().toISOString().slice(0, 10)}.csv"`
    );

    return c.body(csv);
  });
