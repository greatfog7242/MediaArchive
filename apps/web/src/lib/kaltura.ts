interface MediaPreviewInput {
  kalturaId?: string | null;
  viewOnline?: string | null;
  embedCode?: string | null;
  startTime?: number | null;
  width?: number;
}

export type MediaResourceKind = "video" | "audio" | "unknown";
export type MediaThumbnailAspectRatio = "16 / 9" | "4 / 3";

interface DerivedMediaMetadata {
  kalturaId: string | null;
  viewOnline: string | null;
  mediaKind: MediaResourceKind;
}

function parseUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getEmbedSrc(embedCode: string | null | undefined): string | null {
  if (!embedCode) return null;
  const match = embedCode.match(/src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function getYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      return url.searchParams.get("v");
    }

    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return null;
}

function getKalturaEntryId(url: URL): string | null {
  const fromQuery = url.searchParams.get("entry_id");
  if (fromQuery) return fromQuery;

  const pathParts = url.pathname.split("/").filter(Boolean);
  const entryIdIndex = pathParts.indexOf("entry_id");
  return entryIdIndex >= 0 ? pathParts[entryIdIndex + 1] ?? null : null;
}

export function deriveMediaMetadata(
  input: Pick<MediaPreviewInput, "kalturaId" | "viewOnline" | "embedCode">
): DerivedMediaMetadata {
  let kalturaId = input.kalturaId ?? null;
  const viewOnline = input.viewOnline ?? null;
  const embedUrl = parseUrl(getEmbedSrc(input.embedCode));

  if (embedUrl) {
    const derivedKalturaId = getKalturaEntryId(embedUrl);
    if (!kalturaId && derivedKalturaId) {
      kalturaId = derivedKalturaId;
    }

    if (kalturaId || getYouTubeVideoId(embedUrl)) {
      return {
        kalturaId,
        viewOnline,
        mediaKind: "video",
      };
    }
  }

  return {
    kalturaId,
    viewOnline,
    mediaKind: kalturaId ? "video" : "unknown",
  };
}

export function getMediaResourceKind(
  input: Pick<MediaPreviewInput, "kalturaId" | "viewOnline" | "embedCode">
): MediaResourceKind {
  return deriveMediaMetadata(input).mediaKind;
}

export function getMediaThumbnailAspectRatio(
  input: Pick<MediaPreviewInput, "kalturaId" | "viewOnline" | "embedCode">
): MediaThumbnailAspectRatio {
  const embedUrl = parseUrl(getEmbedSrc(input.embedCode));
  if (embedUrl && getYouTubeVideoId(embedUrl)) {
    return "16 / 9";
  }

  return "4 / 3";
}

export function getMediaThumbnailUrl({
  kalturaId,
  embedCode,
  startTime,
  width = 320,
}: MediaPreviewInput): string | null {
  const derived = deriveMediaMetadata({ kalturaId, viewOnline: null, embedCode });

  if (derived.kalturaId) {
    const safeStartTime = typeof startTime === "number" && startTime > 0 ? startTime : 3;
    return `https://cdnapisec.kaltura.com/p/2370711/thumbnail/entry_id/${derived.kalturaId}/width/${width}/vid_sec/${safeStartTime}`;
  }

  const embedUrl = parseUrl(getEmbedSrc(embedCode));
  if (!embedUrl) {
    return null;
  }

  const youtubeVideoId = getYouTubeVideoId(embedUrl);
  if (youtubeVideoId) {
    return `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`;
  }

  return null;
}
