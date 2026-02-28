"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
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
import { EmbedPlayer } from "@/components/media/EmbedPlayer";
import { MetadataPanel } from "@/components/media/MetadataPanel";

interface RecordData {
  id: string;
  title: string;
  series: string | null;
  reporter: string | null;
  filmReel: string | null;
  reelSegment: string | null;
  date: string | null;
  accessCopy: string | null;
  kalturaId: string | null;
  embedCode: string | null;
  viewOnline: string | null;
  startTime: number | null;
  stopTime: number | null;
  updatedAt: string | null;
  lastModifiedById: string | null;
}

export function RecordDetailClient({ record }: { record: RecordData }) {
  const { canMutate, isAdmin } = useRole();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/hono/records/${record.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/search");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/search">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {canMutate && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/record/${record.id}/edit`}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Record</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &quot;{record.title}&quot;?
                    This action cannot be undone.
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
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left: Player */}
        <div className="space-y-4">
          <EmbedPlayer embedCode={record.embedCode} />
          <h1 className="text-xl font-semibold">{record.title}</h1>
        </div>

        {/* Right: Metadata */}
        <aside>
          <MetadataPanel record={record} />
        </aside>
      </div>
    </div>
  );
}
