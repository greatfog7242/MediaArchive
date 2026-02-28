"use client";

import { useState } from "react";
import { useSelection } from "@/components/search/SelectionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkEditDialog({ open, onOpenChange }: BulkEditDialogProps) {
  const { selected, clearAll } = useSelection();

  const [series, setSeries] = useState("");
  const [reporter, setReporter] = useState("");
  const [filmReel, setFilmReel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    updated: number;
    errors: Array<{ id: string; error: string }>;
  } | null>(null);

  function resetForm() {
    setSeries("");
    setReporter("");
    setFilmReel("");
    setResult(null);
  }

  async function handleSubmit() {
    // Build updates — only include non-empty fields
    const updates: Record<string, string> = {};
    if (series.trim()) updates.series = series.trim();
    if (reporter.trim()) updates.reporter = reporter.trim();
    if (filmReel.trim()) updates.filmReel = filmReel.trim();

    if (Object.keys(updates).length === 0) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/hono/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds: Array.from(selected),
          updates,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setResult({ updated: 0, errors: [{ id: "-", error: data.error ?? "Request failed" }] });
      }
    } catch {
      setResult({ updated: 0, errors: [{ id: "-", error: "Network error" }] });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (result && result.updated > 0) {
      clearAll();
      // Force a search refresh by triggering a window event
      window.dispatchEvent(new Event("bulk-edit-complete"));
    }
    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Edit ({selected.size} records)</DialogTitle>
          <DialogDescription>
            Only filled fields will be updated. Leave a field blank to skip it.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-series">Series</Label>
                <Input
                  id="bulk-series"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="Leave blank to skip"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-reporter">Reporter</Label>
                <Input
                  id="bulk-reporter"
                  value={reporter}
                  onChange={(e) => setReporter(e.target.value)}
                  placeholder="Leave blank to skip"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-filmreel">Film Reel</Label>
                <Input
                  id="bulk-filmreel"
                  value={filmReel}
                  onChange={(e) => setFilmReel(e.target.value)}
                  placeholder="Leave blank to skip"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || (!series.trim() && !reporter.trim() && !filmReel.trim())}
              >
                {submitting ? "Updating..." : "Update Records"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 py-4">
              <p className="text-sm font-medium">
                Updated {result.updated} record{result.updated !== 1 ? "s" : ""}.
              </p>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}:
                  </p>
                  <ul className="max-h-32 overflow-y-auto text-xs text-muted-foreground">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        {e.id}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
