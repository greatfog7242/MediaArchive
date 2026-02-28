import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import {
  importBatch,
  updateImportProgress,
  type CsvRow,
  type ImportProgress,
} from "@/server/services/csv.service";

// BullMQ creates its own Redis connections — cannot share the ioredis singleton.
// Parse the full REDIS_URL to extract host, port, and password.
function parseRedisConnection(): ConnectionOptions {
  const url = process.env["REDIS_URL"];
  if (!url) return { host: "localhost", port: 6379 };

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
  };
}

const connection = parseRedisConnection();

const QUEUE_NAME = "csv-import";
const BATCH_SIZE = 100;

// ─── Singleton Queue (globalThis pattern) ──────────────────────────

const globalForQueue = globalThis as unknown as {
  importQueue: Queue | undefined;
  importWorker: Worker | undefined;
};

export function getImportQueue(): Queue {
  if (globalForQueue.importQueue) return globalForQueue.importQueue;

  const queue = new Queue(QUEUE_NAME, { connection });

  if (process.env.NODE_ENV !== "production") {
    globalForQueue.importQueue = queue;
  }

  return queue;
}

export interface ImportJobData {
  jobId: string;
  rows: CsvRow[];
  editorId: string;
}

// ─── Worker ────────────────────────────────────────────────────────

export function ensureWorker(): Worker {
  if (globalForQueue.importWorker) return globalForQueue.importWorker;

  const worker = new Worker<ImportJobData>(
    QUEUE_NAME,
    async (job) => {
      const { jobId, rows, editorId } = job.data;
      const total = rows.length;
      const allErrors: ImportProgress["errors"] = [];
      let processed = 0;

      // Update progress: processing
      await updateImportProgress(jobId, {
        jobId,
        status: "processing",
        total,
        processed: 0,
        errors: [],
      });

      // Process in batches of BATCH_SIZE
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const result = await importBatch(batch, editorId);
        processed += result.imported + result.errors.length;

        // Offset error row numbers to reflect position in full dataset
        const offsetErrors = result.errors.map((e) => ({
          row: e.row + i,
          message: e.message,
        }));
        allErrors.push(...offsetErrors);

        await updateImportProgress(jobId, {
          jobId,
          status: "processing",
          total,
          processed,
          errors: allErrors,
        });
      }

      // Final status
      await updateImportProgress(jobId, {
        jobId,
        status: "completed",
        total,
        processed,
        errors: allErrors,
      });
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", async (job, err) => {
    if (job) {
      const { jobId } = job.data;
      await updateImportProgress(jobId, {
        jobId,
        status: "failed",
        total: job.data.rows.length,
        processed: 0,
        errors: [{ row: 0, message: err.message }],
      });
    }
    console.error("[ImportWorker] Job failed:", err);
  });

  if (process.env.NODE_ENV !== "production") {
    globalForQueue.importWorker = worker;
  }

  return worker;
}
