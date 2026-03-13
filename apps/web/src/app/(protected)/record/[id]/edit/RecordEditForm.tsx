"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  console.error('DEBUG ERROR: RecordEditForm component mounting with record kalturaId:', record.kalturaId);
  console.log('DEBUG: RecordEditForm component mounting with full record:', record);
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Debug initial state
  useEffect(() => {
    console.log('DEBUG: Initial record data:', {
      kalturaId: record.kalturaId,
      embedCode: record.embedCode,
      startTime: record.startTime,
      stopTime: record.stopTime,
      title: record.title
    });
    console.log('DEBUG: Form initial state:', {
      kalturaId,
      embedCode,
      startTime,
      stopTime,
      title
    });
  }, []);

  // Function to generate Kaltura embed code
  function generateKalturaEmbedCode(
    kalturaId: string,
    startTime: number = 0,
    stopTime: number | null = null,
    title: string = ""
  ): string {
    const partnerId = "2370711";
    const uiconfId = "54949472";
    const widgetId = "1_a9d2nted";

    // Ensure startTime is a number (handle null/undefined)
    const safeStartTime = startTime ?? 0;

    let src = `https://cdnapisec.kaltura.com/p/${partnerId}/embedPlaykitJs/uiconf_id/${uiconfId}?iframeembed=true&amp;entry_id=${kalturaId}&amp;kalturaSeekFrom=${safeStartTime}`;

    if (stopTime !== null && stopTime > safeStartTime) {
      src += `&amp;kalturaClipTo=${stopTime}`;
    }

    src += `&amp;kalturaStartTime=0&amp;config[provider]={&quot;widgetId&quot;:&quot;${widgetId}&quot;}`;

    return `<iframe id="kaltura_player_${kalturaId}" src="${src}" style="width: 608px;height: 342px;border: 0;" allowfullscreen="" webkitallowfullscreen="" mozallowfullscreen="" allow="autoplay *; fullscreen *; encrypted-media *" sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation" title="${title}">
                    </iframe>`;
  }

  // Update embed code when kalturaId, startTime, stopTime, or title changes
  useEffect(() => {
    console.log('DEBUG: useEffect triggered with:', { kalturaId, startTime, stopTime, title });
    if (kalturaId.trim()) {
      console.log('DEBUG: kalturaId is not empty, generating embed code');
      // Parse start time, default to 0 if empty or invalid
      const startTimeNum = startTime ? parseInt(startTime, 10) : 0;
      const safeStartTime = isNaN(startTimeNum) ? 0 : startTimeNum;

      // Parse stop time, default to null if empty or invalid
      let stopTimeNum = null;
      if (stopTime) {
        const parsed = parseInt(stopTime, 10);
        if (!isNaN(parsed)) {
          stopTimeNum = parsed;
        }
      }

      console.log('DEBUG: Parsed values:', { safeStartTime, stopTimeNum });

      // Always generate embed code - the function handles invalid stop times
      const generatedEmbedCode = generateKalturaEmbedCode(
        kalturaId,
        safeStartTime,
        stopTimeNum,
        title
      );
      console.log('DEBUG: Generated embed code (first 100 chars):', generatedEmbedCode.substring(0, 100));
      setEmbedCode(generatedEmbedCode);
    } else {
      console.log('DEBUG: kalturaId is empty or whitespace');
    }
  }, [kalturaId, startTime, stopTime, title]);

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
        router.push({
          pathname: `/record/${record.id}`,
          query: Object.fromEntries(
            Array.from(searchParams.entries()).filter(([_, value]) => value)
          )
        });
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
          <Link href={{
            pathname: `/record/${record.id}`,
            query: Object.fromEntries(
              Array.from(searchParams.entries()).filter(([_, value]) => value)
            )
          }}>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="embedCode">Embed Code</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (kalturaId.trim()) {
                        // Parse start time, default to 0 if empty or invalid
                        const startTimeNum = startTime ? parseInt(startTime, 10) : 0;
                        const safeStartTime = isNaN(startTimeNum) ? 0 : startTimeNum;

                        // Parse stop time, default to null if empty or invalid
                        let stopTimeNum = null;
                        if (stopTime) {
                          const parsed = parseInt(stopTime, 10);
                          if (!isNaN(parsed)) {
                            stopTimeNum = parsed;
                          }
                        }

                        // Always generate embed code - the function handles invalid stop times
                        const generatedEmbedCode = generateKalturaEmbedCode(
                          kalturaId,
                          safeStartTime,
                          stopTimeNum,
                          title
                        );
                        setEmbedCode(generatedEmbedCode);
                      }
                    }}
                    disabled={!kalturaId.trim()}
                  >
                    Generate from Kaltura ID
                  </Button>
                </div>
                <Textarea
                  id="embedCode"
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  rows={3}
                  placeholder="<iframe ...>"
                />
                <p className="text-xs text-muted-foreground">
                  Embed code will be automatically generated when Kaltura ID is entered.
                  Invalid stop times (≤ start time) will be ignored. You can also edit
                  it manually or use the button above to regenerate.
                </p>
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
