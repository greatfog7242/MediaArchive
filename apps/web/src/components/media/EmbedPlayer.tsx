"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { MonitorPlay } from "lucide-react";

interface EmbedPlayerProps {
  embedCode: string | null;
  kalturaId?: string | null;
  startTime?: number | null;
  stopTime?: number | null;
  title?: string | null;
}

function generateKalturaEmbedCode(
  kalturaId: string,
  startTime: number = 0,
  stopTime: number | null = null,
  title: string = ""
): string {
  const partnerId = "2370711";
  const uiconfId = "54949472";
  const widgetId = "1_a9d2nted";

  // Ensure startTime is a number (handle null/undefined)
  const safeStartTime = startTime ?? 0;

  let src = `https://cdnapisec.kaltura.com/p/${partnerId}/embedPlaykitJs/uiconf_id/${uiconfId}?iframeembed=true&amp;entry_id=${kalturaId}&amp;kalturaSeekFrom=${safeStartTime}`;

  if (stopTime !== null && stopTime > safeStartTime) {
    src += `&amp;kalturaClipTo=${stopTime}`;
  }

  src += `&amp;kalturaStartTime=0&amp;config[provider]={&quot;widgetId&quot;:&quot;${widgetId}&quot;}`;

  return `<iframe id="kaltura_player_${kalturaId}" src="${src}" style="width: 608px;height: 342px;border: 0;" allowfullscreen="" webkitallowfullscreen="" mozallowfullscreen="" allow="autoplay *; fullscreen *; encrypted-media *" sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation" title="${title}">
                    </iframe>`;
}

export function EmbedPlayer({ embedCode, kalturaId, startTime, stopTime, title }: EmbedPlayerProps) {
  const sanitizedHtml = useMemo(() => {
    // If we have an embed code, use it
    if (embedCode) {
      // Make embed code responsive by removing fixed width/height styles
      let processedCode = embedCode;

      // Remove width and height from style attribute (more robust regex)
      processedCode = processedCode.replace(
        /style="([^"]*)"/gi,
        (match, styleContent) => {
          // Remove width and height properties from style
          let newStyle = styleContent
            .replace(/\b(width|height)\s*:\s*[^;]+;?\s*/gi, '')
            .trim();

          // If style is now empty, remove the entire attribute
          if (!newStyle) {
            return '';
          }
          return `style="${newStyle}"`;
        }
      );

      // Remove width and height attributes (not in style)
      processedCode = processedCode.replace(
        /\s(width|height)\s*=\s*["'][^"']*["']/gi,
        ''
      );

      return DOMPurify.sanitize(processedCode, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: [
          "allow",
          "allowfullscreen",
          "frameborder",
          "src",
          "style",
        ],
      });
    }

    // If no embed code but we have a kalturaId, generate one
    if (kalturaId) {
      const generatedCode = generateKalturaEmbedCode(
        kalturaId,
        startTime || 0,
        stopTime,
        title || ""
      );

      // Process the generated code to make it responsive
      let processedCode = generatedCode.replace(
        /style="([^"]*)"/gi,
        (match, styleContent) => {
          // Remove width and height properties from style
          let newStyle = styleContent
            .replace(/\b(width|height)\s*:\s*[^;]+;?\s*/gi, '')
            .trim();

          // If style is now empty, remove the entire attribute
          if (!newStyle) {
            return '';
          }
          return `style="${newStyle}"`;
        }
      );

      // Remove width and height attributes (not in style)
      processedCode = processedCode.replace(
        /\s(width|height)\s*=\s*["'][^"']*["']/gi,
        ''
      );

      return DOMPurify.sanitize(processedCode, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: [
          "allow",
          "allowfullscreen",
          "frameborder",
          "src",
          "style",
        ],
      });
    }

    return null;
  }, [embedCode, kalturaId, startTime, stopTime, title]);

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
    <div className="w-full max-w-full overflow-hidden rounded-lg border bg-black">
      <div
        className="relative w-full"
        style={{ paddingBottom: "56.25%" }} // 16:9 aspect ratio container
      >
        <div
          className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
    </div>
  );
}
