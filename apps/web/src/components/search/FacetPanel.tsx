"use client";

import { FacetList } from "@/components/search/FacetList";
import { Separator } from "@/components/ui/separator";

export function FacetPanel() {
  return (
    <div className="space-y-4">
      <FacetList attribute="series" title="Series" />
      <Separator />
      <FacetList attribute="reporter" title="Reporter" />
      <Separator />
      <FacetList attribute="filmReel" title="Film Reel" />
    </div>
  );
}
