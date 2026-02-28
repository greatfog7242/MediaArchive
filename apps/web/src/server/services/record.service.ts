import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import {
  upsertToTypesense,
  deleteFromTypesense,
  bulkUpsertToTypesense,
} from "@/server/typesense.service";

// ─── Validation Schemas ──────────────────────────────────────────

export const createRecordSchema = z.object({
  title: z.string().min(1, "Title is required"),
  series: z.string().nullish(),
  date: z.string().datetime().nullish(),
  accessCopy: z.string().nullish(),
  kalturaId: z.string().nullish(),
  embedCode: z.string().nullish(),
  viewOnline: z.string().url().nullish(),
  startTime: z.number().int().nonnegative().nullish(),
  stopTime: z.number().int().nonnegative().nullish(),
  filmReel: z.string().nullish(),
  reelSegment: z.string().nullish(),
  reporter: z.string().nullish(),
});

export const updateRecordSchema = createRecordSchema.partial();

export const bulkUpdateSchema = z.object({
  recordIds: z.array(z.string()).min(1).max(100),
  updates: createRecordSchema.partial(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  series: z.string().optional(),
  reporter: z.string().optional(),
  filmReel: z.string().optional(),
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── Service Functions ───────────────────────────────────────────

export async function listRecords(params: PaginationInput) {
  const { page, limit, series, reporter, filmReel } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(series && { series }),
    ...(reporter && { reporter }),
    ...(filmReel && { filmReel }),
  };

  const [records, total] = await Promise.all([
    db.mediaRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.mediaRecord.count({ where }),
  ]);

  return {
    data: records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getRecordById(id: string) {
  return db.mediaRecord.findUnique({ where: { id } });
}

export async function createRecord(input: CreateRecordInput, editorId: string) {
  // 1. Write to PostgreSQL (source of truth)
  const record = await db.mediaRecord.create({
    data: {
      title: input.title,
      series: input.series ?? null,
      date: input.date ? new Date(input.date) : null,
      accessCopy: input.accessCopy ?? null,
      kalturaId: input.kalturaId ?? null,
      embedCode: input.embedCode ?? null,
      viewOnline: input.viewOnline ?? null,
      startTime: input.startTime ?? null,
      stopTime: input.stopTime ?? null,
      filmReel: input.filmReel ?? null,
      reelSegment: input.reelSegment ?? null,
      reporter: input.reporter ?? null,
      lastModifiedById: editorId,
    },
  });

  // 2. Sync to Typesense (non-throwing)
  await upsertToTypesense(record);

  return record;
}

export async function updateRecord(
  id: string,
  input: UpdateRecordInput,
  editorId: string
) {
  // Check record exists
  const existing = await db.mediaRecord.findUnique({ where: { id } });
  if (!existing) return null;

  // 1. Update in PostgreSQL
  const record = await db.mediaRecord.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.series !== undefined && { series: input.series ?? null }),
      ...(input.date !== undefined && {
        date: input.date ? new Date(input.date) : null,
      }),
      ...(input.accessCopy !== undefined && {
        accessCopy: input.accessCopy ?? null,
      }),
      ...(input.kalturaId !== undefined && {
        kalturaId: input.kalturaId ?? null,
      }),
      ...(input.embedCode !== undefined && {
        embedCode: input.embedCode ?? null,
      }),
      ...(input.viewOnline !== undefined && {
        viewOnline: input.viewOnline ?? null,
      }),
      ...(input.startTime !== undefined && {
        startTime: input.startTime ?? null,
      }),
      ...(input.stopTime !== undefined && {
        stopTime: input.stopTime ?? null,
      }),
      ...(input.filmReel !== undefined && {
        filmReel: input.filmReel ?? null,
      }),
      ...(input.reelSegment !== undefined && {
        reelSegment: input.reelSegment ?? null,
      }),
      ...(input.reporter !== undefined && {
        reporter: input.reporter ?? null,
      }),
      lastModifiedById: editorId,
    },
  });

  // 2. Sync to Typesense
  await upsertToTypesense(record);

  return record;
}

export async function deleteRecord(id: string) {
  // Check record exists
  const existing = await db.mediaRecord.findUnique({ where: { id } });
  if (!existing) return null;

  // 1. Delete from PostgreSQL
  await db.mediaRecord.delete({ where: { id } });

  // 2. Remove from Typesense
  await deleteFromTypesense(id);

  return existing;
}

export async function bulkUpdateRecords(
  recordIds: string[],
  updates: UpdateRecordInput,
  editorId: string
) {
  const results: { updated: number; errors: Array<{ id: string; error: string }> } = {
    updated: 0,
    errors: [],
  };

  const updatedRecords: Parameters<typeof bulkUpsertToTypesense>[0] = [];

  // Build the Prisma data object (only non-undefined fields)
  const data: Record<string, unknown> = { lastModifiedById: editorId };
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.series !== undefined) data.series = updates.series ?? null;
  if (updates.date !== undefined) data.date = updates.date ? new Date(updates.date) : null;
  if (updates.accessCopy !== undefined) data.accessCopy = updates.accessCopy ?? null;
  if (updates.kalturaId !== undefined) data.kalturaId = updates.kalturaId ?? null;
  if (updates.embedCode !== undefined) data.embedCode = updates.embedCode ?? null;
  if (updates.viewOnline !== undefined) data.viewOnline = updates.viewOnline ?? null;
  if (updates.startTime !== undefined) data.startTime = updates.startTime ?? null;
  if (updates.stopTime !== undefined) data.stopTime = updates.stopTime ?? null;
  if (updates.filmReel !== undefined) data.filmReel = updates.filmReel ?? null;
  if (updates.reelSegment !== undefined) data.reelSegment = updates.reelSegment ?? null;
  if (updates.reporter !== undefined) data.reporter = updates.reporter ?? null;

  for (const id of recordIds) {
    try {
      const record = await db.mediaRecord.update({
        where: { id },
        data,
      });
      updatedRecords.push(record);
      results.updated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.errors.push({ id, error: message });
    }
  }

  // Sync all updated records to Typesense in one batch
  if (updatedRecords.length > 0) {
    await bulkUpsertToTypesense(updatedRecords);
  }

  return results;
}
