"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { InstantSearch, Pagination } from "react-instantsearch";
import { SlidersHorizontal, Plus } from "lucide-react";
import { searchClient } from "@/lib/typesense-adapter";
import { SearchBox } from "@/components/search/SearchBox";
import { FacetPanel } from "@/components/search/FacetPanel";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { HitsDisplay } from "@/components/search/HitsDisplay";
import { ViewToggle, type ViewMode } from "@/components/search/ViewToggle";
import { BulkActionBar } from "@/components/search/BulkActionBar";
import { SelectionProvider } from "@/components/search/SelectionContext";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function SearchPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tile");
  const { canMutate, isLoading } = useRole();
  const searchParams = useSearchParams();

  // Build initial UI state from URL parameters
  const initialUiState = {
    media_records: {
      query: searchParams.get("q") || "",
      refinementList: {
        series: searchParams.get("series")?.split(",").filter(Boolean) || [],
        reporter: searchParams.get("reporter")?.split(",").filter(Boolean) || [],
        filmReel: searchParams.get("filmReel")?.split(",").filter(Boolean) || [],
      },
      page: parseInt(searchParams.get("page") || "1"),
    },
  };

  return (
    <InstantSearch 
      searchClient={searchClient} 
      indexName="media_records"
      initialUiState={initialUiState}
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <SelectionProvider>
        <div className="space-y-4">
          {/* Search bar row */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBox />
            </div>

            {/* Add New Record button (EDITOR+ only) */}
            {!isLoading && canMutate && (
              <Button asChild size="sm">
                <Link href="/record/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add New
                </Link>
              </Button>
            )}

            {/* View toggle */}
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />

            {/* Mobile filter toggle */}
            <div className="lg:hidden">
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="sr-only">Filters</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="mt-4 h-[calc(100vh-8rem)]">
                    <FacetPanel />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Active filters */}
          <ActiveFilters />

          {/* Bulk action bar */}
          <BulkActionBar />

          {/* Content area */}
          <div className="flex gap-6">
            {/* Desktop sidebar */}
            <aside className="hidden w-64 shrink-0 lg:block">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <FacetPanel />
              </ScrollArea>
            </aside>

            {/* Results */}
            <div className="min-w-0 flex-1 space-y-6">
              <HitsDisplay viewMode={viewMode} />
              <div className="flex justify-center">
                <Pagination
                  classNames={{
                    root: "flex items-center gap-1",
                    list: "flex items-center gap-1",
                    item: "rounded-md px-3 py-1.5 text-sm hover:bg-accent",
                    selectedItem:
                      "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground",
                    disabledItem: "opacity-50 pointer-events-none",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </SelectionProvider>
    </InstantSearch>
  );
}
