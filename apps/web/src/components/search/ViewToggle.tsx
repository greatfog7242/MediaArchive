"use client";

import { LayoutGrid, List, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "tile" | "detail" | "compact";

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
}

const OPTIONS: Array<{
  value: ViewMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: "tile", label: "Tile view", icon: LayoutGrid },
  { value: "detail", label: "Detail view", icon: Rows3 },
  { value: "compact", label: "Compact view", icon: List },
];

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="hidden items-center gap-1 md:flex" aria-label="Search result view modes">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = viewMode === value;

        return (
          <Button
            key={value}
            type="button"
            variant={active ? "default" : "outline"}
            size="icon"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => onViewModeChange(value)}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
