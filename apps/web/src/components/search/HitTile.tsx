"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
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
  };
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function HitTile({ hit, selectable, selected, onToggleSelect }: HitTileProps) {
  const { canMutate, isAdmin } = useRole();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const formattedDate = hit.date
    ? new Date(hit.date * 1000).toLocaleDateString()
    : null;

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/hono/records/${hit.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className={`flex flex-col ${selected ? "ring-2 ring-primary" : ""}`}>
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
                href={`/record/${hit.id}`}
                className="hover:underline"
              >
                {hit.title}
              </Link>
            </CardTitle>
            {formattedDate && (
              <p className="text-xs text-muted-foreground">{formattedDate}</p>
            )}
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
              <Link href={`/record/${hit.id}/edit`}>
                <Pencil className="mr-1.5 h-3 w-3" />
                Edit
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-1.5 h-3 w-3" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Record</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &quot;{hit.title}&quot;? This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
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
