"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useHits, useInstantSearch } from "react-instantsearch";
import { AudioLines, ExternalLink, Video } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { formatDateOnlyUTC } from "@/lib/format";
import { getMediaResourceKind, getMediaThumbnailUrl } from "@/lib/kaltura";
import { useSelection } from "@/components/search/SelectionContext";
import { HitTile } from "@/components/search/HitTile";
import type { ViewMode } from "@/components/search/ViewToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchHit {
  objectID: string;
  title?: string;
  date?: number | null;
  series?: string | null;
  reporter?: string | null;
  filmReel?: string | null;
  reelSegment?: string | null;
  accessCopy?: string | null;
  kalturaId?: string | null;
  viewOnline?: string | null;
  startTime?: number | null;
}

interface DisplayHit {
  id: string;
  title: string;
  date: number | null;
  series: string | null;
  reporter: string | null;
  filmReel: string | null;
  reelSegment: string | null;
  accessCopy: string | null;
  kalturaId: string | null;
  viewOnline: string | null;
  startTime: number | null;
}

function buildSearchQuery(searchParams: URLSearchParams) {
  return Object.fromEntries(Array.from(searchParams.entries()).filter(([_, value]) => value));
}

function mapHit(hit: SearchHit): DisplayHit {
  return {
    id: hit.objectID,
    title: hit.title ?? "Untitled record",
    date: hit.date ?? null,
    series: hit.series ?? null,
    reporter: hit.reporter ?? null,
    filmReel: hit.filmReel ?? null,
    reelSegment: hit.reelSegment ?? null,
    accessCopy: hit.accessCopy ?? null,
    kalturaId: hit.kalturaId ?? null,
    viewOnline: hit.viewOnline ?? null,
    startTime: hit.startTime ?? null,
  };
}

function EmptyState() {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">
        No records found. Try adjusting your search or filters.
      </p>
    </div>
  );
}

function LoadingState({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "tile") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

function DetailHitRow({
  hit,
  selectable,
  selected,
  onToggleSelect,
}: {
  hit: DisplayHit;
  selectable: boolean;
  selected: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const searchParams = useSearchParams();
  const query = buildSearchQuery(searchParams);
  const thumbnailUrl = getMediaThumbnailUrl({
    kalturaId: hit.kalturaId,
    viewOnline: hit.viewOnline,
    startTime: hit.startTime,
    width: 320,
  });
  const mediaKind = getMediaResourceKind({
    kalturaId: hit.kalturaId,
    viewOnline: hit.viewOnline,
  });
  const formattedDate = hit.date ? formatDateOnlyUTC(hit.date * 1000) : "";

  return (
    <Card className={selected ? "ring-2 ring-primary" : undefined}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex items-start gap-3 md:min-w-0 md:flex-1">
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect?.(hit.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                aria-label={`Select ${hit.title}`}
              />
            )}
            <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-md bg-muted md:w-44 md:shrink-0">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={`Thumbnail for ${hit.title}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : mediaKind === "audio" ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <AudioLines className="h-10 w-10" />
                  <span className="text-xs font-medium uppercase tracking-wide">Audio</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Video className="h-10 w-10" />
                  <span className="text-xs font-medium uppercase tracking-wide">Media</span>
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <Link
                  href={{ pathname: `/record/${hit.id}`, query }}
                  className="text-lg font-semibold hover:underline"
                >
                  {hit.title}
                </Link>
                {formattedDate && <p className="text-sm text-muted-foreground">{formattedDate}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {hit.series && <Badge variant="secondary">{hit.series}</Badge>}
                {hit.reporter && <Badge variant="secondary">{hit.reporter}</Badge>}
                {hit.filmReel && <Badge variant="outline">{hit.filmReel}</Badge>}
                {hit.reelSegment && <Badge variant="outline">Segment {hit.reelSegment}</Badge>}
              </div>
              <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {hit.accessCopy && (
                  <div>
                    <dt className="font-medium text-foreground">Access Copy</dt>
                    <dd>{hit.accessCopy}</dd>
                  </div>
                )}
                {hit.viewOnline && (
                  <div>
                    <dt className="font-medium text-foreground">Online</dt>
                    <dd>
                      <a
                        href={hit.viewOnline}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View original
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactHitRow({
  hit,
  selectable,
  selected,
  onToggleSelect,
}: {
  hit: DisplayHit;
  selectable: boolean;
  selected: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const searchParams = useSearchParams();
  const query = buildSearchQuery(searchParams);
  const formattedDate = hit.date ? formatDateOnlyUTC(hit.date * 1000) : "";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${selected ? "border-primary ring-1 ring-primary" : "border-border"}`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(hit.id)}
          className="h-4 w-4 shrink-0 rounded border-gray-300"
          aria-label={`Select ${hit.title}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <Link href={{ pathname: `/record/${hit.id}`, query }} className="truncate font-medium hover:underline">
            {hit.title}
          </Link>
          {formattedDate && <span className="text-xs text-muted-foreground">{formattedDate}</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {hit.series && <span>{hit.series}</span>}
          {hit.reporter && <span>{hit.reporter}</span>}
          {hit.filmReel && <span>{hit.filmReel}</span>}
          {hit.reelSegment && <span>Segment {hit.reelSegment}</span>}
        </div>
      </div>
    </div>
  );
}

export function HitsDisplay({ viewMode }: { viewMode: ViewMode }) {
  const { items } = useHits<SearchHit>();
  const { status } = useInstantSearch();
  const { canMutate } = useRole();
  const { selected, toggle } = useSelection();

  if (status === "loading" || status === "stalled") {
    return <LoadingState viewMode={viewMode} />;
  }

  if (items.length === 0) {
    return <EmptyState />;
  }

  const hits = items.map(mapHit);

  if (viewMode === "tile") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hits.map((hit) => (
          <HitTile
            key={hit.id}
            hit={hit}
            selectable={canMutate}
            selected={selected.has(hit.id)}
            onToggleSelect={toggle}
          />
        ))}
      </div>
    );
  }

  if (viewMode === "detail") {
    return (
      <div className="space-y-4">
        {hits.map((hit) => (
          <DetailHitRow
            key={hit.id}
            hit={hit}
            selectable={canMutate}
            selected={selected.has(hit.id)}
            onToggleSelect={toggle}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hits.map((hit) => (
        <CompactHitRow
          key={hit.id}
          hit={hit}
          selectable={canMutate}
          selected={selected.has(hit.id)}
          onToggleSelect={toggle}
        />
      ))}
    </div>
  );
}
