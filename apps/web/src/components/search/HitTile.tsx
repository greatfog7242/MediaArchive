"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AudioLines, Pencil, Trash2, Video } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { formatDateOnlyUTC } from "@/lib/format";
import {
  getMediaResourceKind,
  getMediaThumbnailAspectRatio,
  getMediaThumbnailUrl,
} from "@/lib/kaltura";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface HitTileProps {
  hit: {
    id: string;
    title: string;
    date?: number | null;
    series?: string | null;
    reporter?: string | null;
    filmReel?: string | null;
    kalturaId?: string | null;
    startTime?: number | null;
    viewOnline?: string | null;
  };
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function HitTile({ hit, selectable, selected, onToggleSelect }: HitTileProps) {
  const { canMutate, isAdmin } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deleting, setDeleting] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const formattedDate = hit.date ? formatDateOnlyUTC(hit.date * 1000) : null;
  const mediaKind = getMediaResourceKind({
    kalturaId: hit.kalturaId,
    viewOnline: hit.viewOnline,
  });
  const thumbnailUrl = getMediaThumbnailUrl({
    kalturaId: hit.kalturaId,
    viewOnline: hit.viewOnline,
    startTime: hit.startTime,
    width: 240,
  });
  const thumbnailAspectRatio = getMediaThumbnailAspectRatio({
    kalturaId: hit.kalturaId,
    viewOnline: hit.viewOnline,
  });

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/hono/records/${hit.id}`, {
        method: "DELETE",
      });

      if (res.ok || res.status === 404) {
        setRemoved(true);
        setDeleteDialogOpen(false);
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? "Failed to delete record.");
    } catch {
      setDeleteError("Network error while deleting record.");
    } finally {
      setDeleting(false);
    }
  }

  if (removed) {
    return null;
  }

  return (
    <Card className={`flex flex-col ${selected ? "ring-2 ring-primary" : ""}`}>
      <div
        className="relative w-full overflow-hidden rounded-t-lg bg-muted"
        style={{ aspectRatio: thumbnailAspectRatio }}
      >
        {thumbnailUrl && !thumbnailError ? (
          <img
            src={thumbnailUrl}
            alt={`Thumbnail for ${hit.title}`}
            className="h-full w-full bg-black object-contain"
            onError={() => setThumbnailError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {mediaKind === "audio" ? (
              <AudioLines className="h-12 w-12" />
            ) : (
              <Video className="h-12 w-12" />
            )}
            <span className="text-xs font-medium uppercase tracking-wide">
              {mediaKind === "audio" ? "Audio" : "Media"}
            </span>
          </div>
        )}
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={() => onToggleSelect?.(hit.id)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
              aria-label={`Select ${hit.title}`}
            />
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              <Link
                href={{
                  pathname: `/record/${hit.id}`,
                  query: Object.fromEntries(
                    Array.from(searchParams.entries()).filter(([_, value]) => value)
                  ),
                }}
                className="hover:underline"
              >
                {hit.title}
              </Link>
            </CardTitle>
            {formattedDate && <p className="text-xs text-muted-foreground">{formattedDate}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {hit.series && (
            <Badge variant="secondary" className="text-[10px]">
              {hit.series}
            </Badge>
          )}
          {hit.reporter && (
            <Badge variant="secondary" className="text-[10px]">
              {hit.reporter}
            </Badge>
          )}
          {hit.filmReel && (
            <Badge variant="outline" className="text-[10px]">
              {hit.filmReel}
            </Badge>
          )}
        </div>
      </CardContent>
      {(canMutate || isAdmin) && (
        <CardFooter className="gap-2 pt-0">
          {canMutate && (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={{
                  pathname: `/record/${hit.id}/edit`,
                  query: Object.fromEntries(
                    Array.from(searchParams.entries()).filter(([_, value]) => value)
                  ),
                }}
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                Edit
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" onClick={() => setDeleteError(null)}>
                  <Trash2 className="mr-1.5 h-3 w-3" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Record</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &quot;{hit.title}&quot;? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
