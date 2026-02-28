"use client";

import { useRole } from "@/hooks/use-role";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface MetadataPanelProps {
  record: {
    title: string;
    series: string | null;
    reporter: string | null;
    filmReel: string | null;
    reelSegment: string | null;
    date: string | null;
    viewOnline: string | null;
    accessCopy: string | null;
    kalturaId: string | null;
    startTime: number | null;
    stopTime: number | null;
    updatedAt: string | null;
    lastModifiedById: string | null;
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function MetadataPanel({ record }: MetadataPanelProps) {
  const { canMutate } = useRole();

  return (
    <div className="space-y-6">
      {/* Basic fields — visible to all roles */}
      <dl className="space-y-4">
        <Field label="Title" value={record.title} />
        <Field label="Series" value={record.series} />
        <Field label="Reporter" value={record.reporter} />
        <Field label="Film Reel" value={record.filmReel} />
        <Field label="Reel Segment" value={record.reelSegment} />
        <Field
          label="Date"
          value={
            record.date
              ? new Date(record.date).toLocaleDateString()
              : null
          }
        />
        <Field
          label="View Online"
          value={
            record.viewOnline ? (
              <a
                href={record.viewOnline}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:no-underline"
              >
                {record.viewOnline}
              </a>
            ) : null
          }
        />
      </dl>

      {/* Advanced fields — EDITOR+ only */}
      {canMutate && (
        <>
          <Separator />
          <div>
            <Badge variant="outline" className="mb-3 text-[10px]">
              Editor Details
            </Badge>
            <dl className="space-y-4">
              <Field label="Access Copy" value={record.accessCopy} />
              <Field label="Kaltura ID" value={record.kalturaId} />
              <Field
                label="Start Time"
                value={
                  record.startTime !== null
                    ? formatTime(record.startTime)
                    : null
                }
              />
              <Field
                label="Stop Time"
                value={
                  record.stopTime !== null
                    ? formatTime(record.stopTime)
                    : null
                }
              />
              <Field
                label="Last Modified"
                value={
                  record.updatedAt
                    ? new Date(record.updatedAt).toLocaleString()
                    : null
                }
              />
              <Field label="Modified By" value={record.lastModifiedById} />
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
