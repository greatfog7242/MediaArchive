"use client";

import {
  useCurrentRefinements,
  useClearRefinements,
} from "react-instantsearch";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ActiveFilters() {
  const { items, refine } = useCurrentRefinements();
  const { refine: clearAll } = useClearRefinements();

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) =>
        item.refinements.map((refinement) => (
          <Badge
            key={`${item.attribute}-${refinement.label}`}
            variant="outline"
            className="cursor-pointer gap-1 pr-1"
            onClick={() => refine(refinement)}
          >
            <span className="text-xs text-muted-foreground">
              {item.label}:
            </span>
            {refinement.label}
            <X className="h-3 w-3" />
          </Badge>
        ))
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearAll}
        className="h-6 text-xs text-muted-foreground"
      >
        Clear all
      </Button>
    </div>
  );
}
