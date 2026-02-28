"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecordData {
  id: string;
  title: string;
  series: string | null;
  reporter: string | null;
  filmReel: string | null;
  reelSegment: string | null;
  date: string;
  accessCopy: string | null;
  kalturaId: string | null;
  embedCode: string | null;
  viewOnline: string | null;
  startTime: number | null;
  stopTime: number | null;
}

const updateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  series: z.string().nullish(),
  date: z.string().nullish(),
  accessCopy: z.string().nullish(),
  kalturaId: z.string().nullish(),
  embedCode: z.string().nullish(),
  viewOnline: z.string().url("Must be a valid URL").nullish().or(z.literal("")),
  startTime: z.number().int().nonnegative().nullish(),
  stopTime: z.number().int().nonnegative().nullish(),
  filmReel: z.string().nullish(),
  reelSegment: z.string().nullish(),
  reporter: z.string().nullish(),
});

export function RecordEditForm({ record }: { record: RecordData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form state
  const [title, setTitle] = useState(record.title);
  const [series, setSeries] = useState(record.series ?? "");
  const [reporter, setReporter] = useState(record.reporter ?? "");
  const [filmReel, setFilmReel] = useState(record.filmReel ?? "");
  const [reelSegment, setReelSegment] = useState(record.reelSegment ?? "");
  const [date, setDate] = useState(record.date);
  const [accessCopy, setAccessCopy] = useState(record.accessCopy ?? "");
  const [kalturaId, setKalturaId] = useState(record.kalturaId ?? "");
  const [embedCode, setEmbedCode] = useState(record.embedCode ?? "");
  const [viewOnline, setViewOnline] = useState(record.viewOnline ?? "");
  const [startTime, setStartTime] = useState(record.startTime?.toString() ?? "");
  const [stopTime, setStopTime] = useState(record.stopTime?.toString() ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const payload = {
      title,
      series: series || null,
      date: date ? new Date(date).toISOString() : null,
      accessCopy: accessCopy || null,
      kalturaId: kalturaId || null,
      embedCode: embedCode || null,
      viewOnline: viewOnline || null,
      startTime: startTime ? parseInt(startTime, 10) : null,
      stopTime: stopTime ? parseInt(stopTime, 10) : null,
      filmReel: filmReel || null,
      reelSegment: reelSegment || null,
      reporter: reporter || null,
    };

    // Client-side validation
    const result = updateSchema.safeParse(payload);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString();
        if (key) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/hono/records/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push(`/record/${record.id}`);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save changes");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/record/${record.id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Edit Record</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Title — full width */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                {fieldErrors["title"] && (
                  <p className="text-sm text-destructive">{fieldErrors["title"]}</p>
                )}
              </div>

              {/* Series */}
              <div className="space-y-2">
                <Label htmlFor="series">Series</Label>
                <Input
                  id="series"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                />
              </div>

              {/* Reporter */}
              <div className="space-y-2">
                <Label htmlFor="reporter">Reporter</Label>
                <Input
                  id="reporter"
                  value={reporter}
                  onChange={(e) => setReporter(e.target.value)}
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Film Reel */}
              <div className="space-y-2">
                <Label htmlFor="filmReel">Film Reel</Label>
                <Input
                  id="filmReel"
                  value={filmReel}
                  onChange={(e) => setFilmReel(e.target.value)}
                />
              </div>

              {/* Reel Segment */}
              <div className="space-y-2">
                <Label htmlFor="reelSegment">Reel Segment</Label>
                <Input
                  id="reelSegment"
                  value={reelSegment}
                  onChange={(e) => setReelSegment(e.target.value)}
                />
              </div>

              {/* Access Copy */}
              <div className="space-y-2">
                <Label htmlFor="accessCopy">Access Copy</Label>
                <Input
                  id="accessCopy"
                  value={accessCopy}
                  onChange={(e) => setAccessCopy(e.target.value)}
                />
              </div>

              {/* Kaltura ID */}
              <div className="space-y-2">
                <Label htmlFor="kalturaId">Kaltura ID</Label>
                <Input
                  id="kalturaId"
                  value={kalturaId}
                  onChange={(e) => setKalturaId(e.target.value)}
                />
              </div>

              {/* View Online */}
              <div className="space-y-2">
                <Label htmlFor="viewOnline">View Online URL</Label>
                <Input
                  id="viewOnline"
                  type="url"
                  value={viewOnline}
                  onChange={(e) => setViewOnline(e.target.value)}
                  placeholder="https://..."
                />
                {fieldErrors["viewOnline"] && (
                  <p className="text-sm text-destructive">
                    {fieldErrors["viewOnline"]}
                  </p>
                )}
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time (seconds)</Label>
                <Input
                  id="startTime"
                  type="number"
                  min="0"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              {/* Stop Time */}
              <div className="space-y-2">
                <Label htmlFor="stopTime">Stop Time (seconds)</Label>
                <Input
                  id="stopTime"
                  type="number"
                  min="0"
                  value={stopTime}
                  onChange={(e) => setStopTime(e.target.value)}
                />
              </div>

              {/* Embed Code — full width */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="embedCode">Embed Code</Label>
                <Textarea
                  id="embedCode"
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  rows={3}
                  placeholder="<iframe ...>"
                />
              </div>
            </div>

            {/* Error display */}
            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}

            {/* Submit */}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link href={`/record/${record.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
