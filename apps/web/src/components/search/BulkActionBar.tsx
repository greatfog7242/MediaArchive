"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useSelection } from "@/components/search/SelectionContext";
import { BulkEditDialog } from "@/components/search/BulkEditDialog";
import { Button } from "@/components/ui/button";

export function BulkActionBar() {
  const { count, clearAll } = useSelection();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium">
          {count} selected
        </span>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Pencil className="mr-1.5 h-3 w-3" />
          Bulk Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={clearAll}>
          <X className="mr-1.5 h-3 w-3" />
          Clear Selection
        </Button>
      </div>
      <BulkEditDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
