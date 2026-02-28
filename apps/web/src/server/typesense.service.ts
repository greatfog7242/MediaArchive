import "server-only";
import { getTypesenseClient } from "@/server/typesense";
import { db } from "@/server/db";

const COLLECTION = "media_records";

export interface TypesenseMediaRecord {
  id: string;
  title: string;
  series: string;
  reporter: string;
  filmReel: string;
  reelSegment: string;
  accessCopy: string;
  date: number;
  kalturaId: string;
  viewOnline: string;
  startTime: number;
  stopTime: number;
}

function toTypesenseDoc(record: {
  id: string;
  title: string;
  series: string | null;
  reporter: string | null;
  filmReel: string | null;
  reelSegment: string | null;
  accessCopy: string | null;
  date: Date | null;
  kalturaId: string | null;
  viewOnline: string | null;
  startTime: number | null;
  stopTime: number | null;
}): TypesenseMediaRecord {
  return {
    id: record.id,
    title: record.title,
    series: record.series ?? "",
    reporter: record.reporter ?? "",
    filmReel: record.filmReel ?? "",
    reelSegment: record.reelSegment ?? "",
    accessCopy: record.accessCopy ?? "",
    date: record.date ? Math.floor(record.date.getTime() / 1000) : 0,
    kalturaId: record.kalturaId ?? "",
    viewOnline: record.viewOnline ?? "",
    startTime: record.startTime ?? 0,
    stopTime: record.stopTime ?? 0,
  };
}

export async function upsertToTypesense(record: Parameters<typeof toTypesenseDoc>[0]) {
  try {
    await getTypesenseClient()
      .collections(COLLECTION)
      .documents()
      .upsert(toTypesenseDoc(record));
  } catch (err) {
    console.error(`[Typesense] upsert failed for id=${record.id}:`, err);
    // Log but do not throw — PG is source of truth
  }
}

export async function deleteFromTypesense(id: string) {
  try {
    await getTypesenseClient().collections(COLLECTION).documents(id).delete();
  } catch (err) {
    console.error(`[Typesense] delete failed for id=${id}:`, err);
  }
}

export async function bulkUpsertToTypesense(
  records: Parameters<typeof toTypesenseDoc>[0][]
) {
  if (records.length === 0) return;
  try {
    const docs = records.map(toTypesenseDoc);
    await getTypesenseClient()
      .collections(COLLECTION)
      .documents()
      .import(docs, { action: "upsert" });
  } catch (err) {
    console.error("[Typesense] bulkUpsert failed:", err);
  }
}

/** Full re-sync from PostgreSQL — use for reconciliation only. */
export async function fullSyncToTypesense() {
  const records = await db.mediaRecord.findMany();
  await bulkUpsertToTypesense(records);
  console.log(`[Typesense] Full sync complete — ${records.length} records.`);
}
