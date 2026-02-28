import { z } from "zod";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { db } from "@/server/db";
import { bulkUpsertToTypesense } from "@/server/typesense.service";
import { redis } from "@/server/redis";

// ─── CSV Column Mapping ────────────────────────────────────────────

const CSV_HEADERS = [
  "Title",
  "Series",
  "Date",
  "Access Copy",
  "KalturaID",
  "View Online",
  "Start Time",
  "Stop Time",
  "Film Reel",
  "Reel Segment",
  "Reporter",
] as const;

// ─── Row Validation ────────────────────────────────────────────────

const csvRowSchema = z.object({
  Title: z.string().min(1, "Title is required"),
  Series: z.string().optional().default(""),
  Date: z.string().optional().default(""),
  "Access Copy": z.string().optional().default(""),
  KalturaID: z.string().optional().default(""),
  "View Online": z.string().optional().default(""),
  "Start Time": z.string().optional().default(""),
  "Stop Time": z.string().optional().default(""),
  "Film Reel": z.string().optional().default(""),
  "Reel Segment": z.string().optional().default(""),
  Reporter: z.string().optional().default(""),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

export interface ValidationResult {
  valid: CsvRow[];
  errors: Array<{ row: number; message: string }>;
}

export interface ImportProgress {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  total: number;
  processed: number;
  errors: Array<{ row: number; message: string }>;
}

// ─── Service Functions ─────────────────────────────────────────────

export function parseCsvToRows(csvContent: string): Record<string, string>[] {
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];
}

export function validateRows(rows: Record<string, string>[]): ValidationResult {
  const valid: CsvRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const result = csvRowSchema.safeParse(rows[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      const messages = result.error.issues.map((issue) => issue.message).join("; ");
      errors.push({ row: i + 2, message: messages }); // +2 for 1-indexed + header row
    }
  }

  return { valid, errors };
}

function parseOptionalInt(value: string): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function parseOptionalDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function importBatch(
  rows: CsvRow[],
  editorId: string
): Promise<{ imported: number; errors: Array<{ row: number; message: string }> }> {
  const errors: Array<{ row: number; message: string }> = [];
  const imported: Array<Parameters<typeof bulkUpsertToTypesense>[0][number]> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const kalturaId = row.KalturaID?.trim() || null;

      const data = {
        title: row.Title,
        series: row.Series || null,
        date: parseOptionalDate(row.Date),
        accessCopy: row["Access Copy"] || null,
        kalturaId,
        viewOnline: row["View Online"] || null,
        startTime: parseOptionalInt(row["Start Time"]),
        stopTime: parseOptionalInt(row["Stop Time"]),
        filmReel: row["Film Reel"] || null,
        reelSegment: row["Reel Segment"] || null,
        reporter: row.Reporter || null,
        lastModifiedById: editorId,
      };

      let record;
      if (kalturaId) {
        // Upsert on kalturaId for dedup
        record = await db.mediaRecord.upsert({
          where: { kalturaId },
          update: data,
          create: data,
        });
      } else {
        // No kalturaId — always create (no dedup key)
        record = await db.mediaRecord.create({ data });
      }

      imported.push(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push({ row: i + 1, message });
    }
  }

  // Bulk sync to Typesense
  if (imported.length > 0) {
    await bulkUpsertToTypesense(imported);
  }

  return { imported: imported.length, errors };
}

export async function exportRecordsCsv(): Promise<string> {
  const records = await db.mediaRecord.findMany({
    orderBy: { createdAt: "desc" },
  });

  const rows = records.map((r) => ({
    Title: r.title,
    Series: r.series ?? "",
    Date: r.date ? r.date.toISOString().slice(0, 10) : "",
    "Access Copy": r.accessCopy ?? "",
    KalturaID: r.kalturaId ?? "",
    "View Online": r.viewOnline ?? "",
    "Start Time": r.startTime?.toString() ?? "",
    "Stop Time": r.stopTime?.toString() ?? "",
    "Film Reel": r.filmReel ?? "",
    "Reel Segment": r.reelSegment ?? "",
    Reporter: r.reporter ?? "",
  }));

  return stringify(rows, {
    header: true,
    columns: CSV_HEADERS as unknown as string[],
  });
}

// ─── Progress Tracking (Redis) ─────────────────────────────────────

const PROGRESS_TTL = 3600; // 1 hour

export async function updateImportProgress(
  jobId: string,
  progress: ImportProgress
): Promise<void> {
  await redis.set(
    `import:job:${jobId}`,
    JSON.stringify(progress),
    "EX",
    PROGRESS_TTL
  );
}

export async function getImportProgress(
  jobId: string
): Promise<ImportProgress | null> {
  const data = await redis.get(`import:job:${jobId}`);
  if (!data) return null;
  return JSON.parse(data) as ImportProgress;
}
