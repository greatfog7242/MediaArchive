"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ImportState = "idle" | "uploading" | "polling" | "complete" | "failed";

interface ImportResult {
  imported?: number;
  total?: number;
  importErrors?: Array<{ row?: number; error?: string }>;
  validationErrors?: Array<{ row?: number; error?: string }>;
  error?: string;
}

interface PollProgress {
  jobId: string;
  status: "queued" | "processing" | "complete" | "failed";
  total: number;
  processed: number;
  errors: Array<{ row?: number; error?: string }>;
}

export function ImportDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ImportState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Poll for job progress
  useEffect(() => {
    if (state !== "polling" || !jobId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/hono/csv/import/${jobId}/status`);
        if (!res.ok) {
          setPollError("Failed to fetch job status");
          setState("failed");
          stopPolling();
          return;
        }

        const data: PollProgress = await res.json();
        setProgress({ processed: data.processed, total: data.total });

        if (data.status === "complete") {
          setState("complete");
          setResult({
            imported: data.processed,
            total: data.total,
            importErrors: data.errors,
          });
          stopPolling();
        } else if (data.status === "failed") {
          setState("failed");
          setPollError("Import job failed");
          setResult({ importErrors: data.errors });
          stopPolling();
        }
      } catch {
        setPollError("Network error while polling");
        setState("failed");
        stopPolling();
      }
    }

    pollIntervalRef.current = setInterval(poll, 2000);
    // Fire immediately as well
    poll();

    return stopPolling;
  }, [state, jobId, stopPolling]);

  function resetState() {
    setState("idle");
    setJobId(null);
    setProgress({ processed: 0, total: 0 });
    setResult(null);
    setPollError(null);
    stopPolling();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setState("uploading");
    setResult(null);
    setPollError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/hono/csv/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.status === 202) {
        // Queued — start polling
        setJobId(data.jobId);
        setProgress({ processed: 0, total: data.total });
        setState("polling");
      } else if (res.ok) {
        // Inline result
        setState("complete");
        setResult({
          imported: data.imported,
          total: data.total,
          importErrors: data.importErrors,
          validationErrors: data.validationErrors,
        });
      } else {
        setState("failed");
        setResult({ error: data.error });
      }
    } catch {
      setState("failed");
      setResult({ error: "Network error during upload" });
    }
  }

  function handleClose() {
    if (state === "complete") {
      router.refresh();
    }
    resetState();
    setOpen(false);
  }

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  const allErrors = [
    ...(result?.validationErrors ?? []),
    ...(result?.importErrors ?? []),
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(v); }}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-1.5 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import media records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input — shown in idle state */}
          {state === "idle" && (
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="text-sm"
            />
          )}

          {/* Uploading state */}
          {state === "uploading" && (
            <p className="text-sm text-muted-foreground">Uploading file...</p>
          )}

          {/* Progress bar — shown during polling */}
          {state === "polling" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Processing: {progress.processed} / {progress.total} rows
              </p>
              <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progressPercent}%</p>
            </div>
          )}

          {/* Complete state */}
          {state === "complete" && result && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600">
                Import complete: {result.imported ?? 0} record{(result.imported ?? 0) !== 1 ? "s" : ""} imported.
              </p>
            </div>
          )}

          {/* Failed state */}
          {state === "failed" && (
            <p className="text-sm font-medium text-destructive">
              {result?.error ?? pollError ?? "Import failed"}
            </p>
          )}

          {/* Error list */}
          {allErrors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                {allErrors.length} error{allErrors.length !== 1 ? "s" : ""}:
              </p>
              <ul className="max-h-40 overflow-y-auto rounded border p-2 text-xs text-muted-foreground">
                {allErrors.map((e, i) => (
                  <li key={i}>
                    {e.row != null ? `Row ${e.row}: ` : ""}{e.error ?? "Unknown error"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          {state === "idle" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>
                <Upload className="mr-1.5 h-4 w-4" />
                Upload
              </Button>
            </>
          )}
          {(state === "complete" || state === "failed") && (
            <Button onClick={handleClose}>Close</Button>
          )}
          {state === "uploading" && (
            <Button disabled>Uploading...</Button>
          )}
          {state === "polling" && (
            <Button disabled>Processing...</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
