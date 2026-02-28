"use client";

import { useHits, useInstantSearch } from "react-instantsearch";
import { useRole } from "@/hooks/use-role";
import { useSelection } from "@/components/search/SelectionContext";
import { HitTile } from "@/components/search/HitTile";
import { Skeleton } from "@/components/ui/skeleton";

export function HitsGrid() {
  const { items } = useHits();
  const { status } = useInstantSearch();
  const { canMutate } = useRole();
  const { selected, toggle } = useSelection();

  if (status === "loading" || status === "stalled") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          No records found. Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((hit) => (
        <HitTile
          key={hit.objectID}
          hit={{
            id: hit.objectID,
            title: hit.title as string,
            date: hit.date as number | null,
            series: hit.series as string | null,
            reporter: hit.reporter as string | null,
            filmReel: hit.filmReel as string | null,
          }}
          selectable={canMutate}
          selected={selected.has(hit.objectID)}
          onToggleSelect={toggle}
        />
      ))}
    </div>
  );
}
