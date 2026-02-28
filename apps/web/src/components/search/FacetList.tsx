"use client";

import { useRefinementList } from "react-instantsearch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FacetListProps {
  attribute: string;
  title: string;
}

export function FacetList({ attribute, title }: FacetListProps) {
  const { items, refine } = useRefinementList({ attribute, limit: 20 });

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.value}>
            <button
              type="button"
              onClick={() => refine(item.value)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                item.isRefined && "bg-accent font-medium"
              )}
            >
              <span className="truncate">{item.label}</span>
              <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                {item.count}
              </Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
