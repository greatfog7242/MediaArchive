"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { MonitorPlay } from "lucide-react";

interface EmbedPlayerProps {
  embedCode: string | null;
}

export function EmbedPlayer({ embedCode }: EmbedPlayerProps) {
  const sanitizedHtml = useMemo(() => {
    if (!embedCode) return null;

    return DOMPurify.sanitize(embedCode, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: [
        "allow",
        "allowfullscreen",
        "frameborder",
        "src",
        "width",
        "height",
        "style",
      ],
    });
  }, [embedCode]);

  if (!sanitizedHtml) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/50">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MonitorPlay className="h-10 w-10" />
          <p className="text-sm">No media available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="aspect-video overflow-hidden rounded-lg border [&>iframe]:h-full [&>iframe]:w-full"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
