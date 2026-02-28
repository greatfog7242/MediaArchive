import { notFound } from "next/navigation";
import { getRecordById } from "@/server/services/record.service";
import { RecordDetailClient } from "./RecordDetailClient";

interface RecordPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { id } = await params;
  const record = await getRecordById(id);

  if (!record) {
    notFound();
  }

  // Serialize for client component (Date → string)
  const serialized = {
    id: record.id,
    title: record.title,
    series: record.series,
    reporter: record.reporter,
    filmReel: record.filmReel,
    reelSegment: record.reelSegment,
    date: record.date?.toISOString() ?? null,
    accessCopy: record.accessCopy,
    kalturaId: record.kalturaId,
    embedCode: record.embedCode,
    viewOnline: record.viewOnline,
    startTime: record.startTime,
    stopTime: record.stopTime,
    updatedAt: record.lastModified?.toISOString() ?? null,
    lastModifiedById: record.lastModifiedById,
  };

  return <RecordDetailClient record={serialized} />;
}
