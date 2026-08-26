// src/shared/media.ts — Host-uploaded question media: model, catalog, and helpers
//
// Media is deliberately modelled kind-first (`image` | `audio` | `video`) even
// though only images are rendered today. Everything below — the upload
// pipeline, the R2 object layout, the byte sniffer, the range-request support
// in the media route — is already kind-agnostic. Turning on audio or video is
// a matter of adding the kind to ENABLED_MEDIA_KINDS and building the playback
// UI; no storage or protocol change is needed.
//
// The one behavioural difference between kinds is *when* the media is shown:
// images sit alongside the question, audio/video play before it. See
// `mediaTiming()` and the MEDIA_PLAYBACK note in src/shared/gameStates.ts.

// ─── Kinds ────────────────────────────────────────────────────────────────────

export const MEDIA_KINDS = ["image", "audio", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Kinds a host is currently allowed to upload. The server enforces this and
 * the host UI derives its file picker `accept` list from it.
 *
 * To enable audio/video: add the kind here, then build the MEDIA_PLAYBACK
 * state described in src/shared/gameStates.ts. Storage, upload, serving and
 * validation already handle all three kinds.
 */
export const ENABLED_MEDIA_KINDS: readonly MediaKind[] = ["image"];

/** Narrow an arbitrary string to a known media kind, or null */
export function parseKind(value: string): MediaKind | null {
  const normalized = value.trim().toLowerCase();
  return (MEDIA_KINDS as readonly string[]).includes(normalized)
    ? (normalized as MediaKind)
    : null;
}

/** Whether a host may upload this kind of media right now */
export function isMediaKindEnabled(kind: MediaKind): boolean {
  return ENABLED_MEDIA_KINDS.includes(kind);
}

/**
 * When this kind of media is presented relative to the question.
 *
 * - `with-question` — rendered on the same screen as the question text
 *   (presentation + player), for the whole time the question is up.
 * - `before-question` — played to completion first; the question text is only
 *   revealed afterwards. Audio and video use this because a player reading the
 *   question while a clip plays defeats the point of the clip.
 */
export type MediaTiming = "with-question" | "before-question";

export function mediaTiming(kind: MediaKind): MediaTiming {
  return kind === "image" ? "with-question" : "before-question";
}

// ─── Frames ───────────────────────────────────────────────────────────────────

export const MEDIA_FRAMES = [
  "none",
  "polaroid",
  "tv",
  "slide",
  "gallery",
  "phone",
] as const;
export type MediaFrame = (typeof MEDIA_FRAMES)[number];

export interface MediaFrameMeta {
  id: MediaFrame;
  label: string;
  /** One-line description shown in the host's frame picker */
  description: string;
  /** Whether the frame renders a visible caption slot */
  hasCaption: boolean;
  /** Kinds this frame is offered for — audio has no visual surface to frame */
  kinds: readonly MediaKind[];
}

export const MEDIA_FRAME_META: Record<MediaFrame, MediaFrameMeta> = {
  none: {
    id: "none",
    label: "No frame",
    description: "Just the image, softly rounded.",
    hasCaption: false,
    kinds: ["image", "video"],
  },
  polaroid: {
    id: "polaroid",
    label: "Polaroid",
    description: "White instant-film border with a handwritten caption strip.",
    hasCaption: true,
    kinds: ["image", "video"],
  },
  tv: {
    id: "tv",
    label: "TV screen",
    description: "Chunky CRT bezel with a curved screen and a power light.",
    hasCaption: false,
    kinds: ["image", "video"],
  },
  slide: {
    id: "slide",
    label: "35mm slide",
    description: "Black slide mount with a white label strip.",
    hasCaption: true,
    kinds: ["image", "video"],
  },
  gallery: {
    id: "gallery",
    label: "Gallery frame",
    description: "Gilded picture frame with a wide museum mat.",
    hasCaption: true,
    kinds: ["image", "video"],
  },
  phone: {
    id: "phone",
    label: "Phone screen",
    description: "Phone bezel with a notch — good for screenshots and texts.",
    hasCaption: false,
    kinds: ["image", "video"],
  },
};

/** Narrow an arbitrary string to a known frame, or null */
export function parseFrame(value: string): MediaFrame | null {
  const normalized = value.trim().toLowerCase();
  return (MEDIA_FRAMES as readonly string[]).includes(normalized)
    ? (normalized as MediaFrame)
    : null;
}

/** Frames offered for a given media kind, in catalog order */
export function framesForKind(kind: MediaKind): MediaFrameMeta[] {
  return MEDIA_FRAMES.map((f) => MEDIA_FRAME_META[f]).filter((meta) =>
    meta.kinds.includes(kind),
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export const MEDIA_FILTERS = [
  "bw",
  "sepia",
  "halftone",
  "grain",
  "vignette",
  "vhs",
  "blur",
  "pixelate",
] as const;
export type MediaFilter = (typeof MEDIA_FILTERS)[number];

export interface MediaFilterMeta {
  id: MediaFilter;
  label: string;
  description: string;
  /**
   * Filters in the same group are mutually exclusive — picking one clears the
   * others in that group. `null` means the filter stacks freely.
   */
  group: "color" | "obscure" | null;
  /** Whether this filter reads the shared `intensity` value */
  usesIntensity: boolean;
}

export const MEDIA_FILTER_META: Record<MediaFilter, MediaFilterMeta> = {
  bw: {
    id: "bw",
    label: "Black & white",
    description: "Drains all colour.",
    group: "color",
    usesIntensity: false,
  },
  sepia: {
    id: "sepia",
    label: "Sepia",
    description: "Warm brown antique tone.",
    group: "color",
    usesIntensity: false,
  },
  halftone: {
    id: "halftone",
    label: "Halftone",
    description: "Comic-book print dots.",
    group: "color",
    usesIntensity: false,
  },
  grain: {
    id: "grain",
    label: "Film grain",
    description: "Speckled emulsion texture.",
    group: null,
    usesIntensity: false,
  },
  vignette: {
    id: "vignette",
    label: "Vignette",
    description: "Darkened corners drawing the eye in.",
    group: null,
    usesIntensity: false,
  },
  vhs: {
    id: "vhs",
    label: "VHS",
    description: "Scanlines and colour-channel fringing.",
    group: null,
    usesIntensity: false,
  },
  blur: {
    id: "blur",
    label: "Blur",
    description: "Softens the image — good for guess-the-thing rounds.",
    group: "obscure",
    usesIntensity: true,
  },
  pixelate: {
    id: "pixelate",
    label: "Pixelate",
    description: "Chunky blocks — good for guess-the-thing rounds.",
    group: "obscure",
    usesIntensity: true,
  },
};

/** Default intensity (0–100) for the filters that take one */
export const DEFAULT_MEDIA_INTENSITY = 40;

/**
 * Normalize a filter selection: drop unknown entries, dedupe, keep only the
 * last pick within each mutually-exclusive group, and return them in catalog
 * order so rendering is stable regardless of the order the host clicked.
 */
export function normalizeFilters(filters: readonly string[]): MediaFilter[] {
  const claimed = new Map<string, MediaFilter>();
  const free = new Set<MediaFilter>();

  for (const raw of filters) {
    if (!MEDIA_FILTERS.includes(raw as MediaFilter)) continue;
    const filter = raw as MediaFilter;
    const { group } = MEDIA_FILTER_META[filter];
    if (group) {
      claimed.set(group, filter);
    } else {
      free.add(filter);
    }
  }

  const selected = new Set<MediaFilter>([...claimed.values(), ...free]);
  return MEDIA_FILTERS.filter((f) => selected.has(f));
}

// ─── The media record ─────────────────────────────────────────────────────────

/**
 * A piece of host-uploaded media attached to a question.
 *
 * Note there's no URL here: the object is always reachable at
 * `mediaObjectUrl(id)`, so the id is the only thing that needs storing,
 * broadcasting, or round-tripping through a CSV export.
 */
export interface QuestionMedia {
  /** R2 object key suffix — see `mediaObjectKey()` */
  id: string;
  kind: MediaKind;
  /**
   * Sniffed (not client-declared) MIME type. Absent for media that arrived via
   * a hand-written CSV row rather than an upload — only the host editor's file
   * summary reads it, and the bytes are served with the type R2 recorded.
   */
  contentType?: string;
  /** Size in bytes. Absent for the same reason as `contentType`. */
  size?: number;
  /** Original filename, shown in the host editor */
  fileName: string;
  /** Alt text — required for images, read by screen readers (R5.8) */
  alt: string;
  /** Caption text, rendered by frames whose `hasCaption` is true */
  caption?: string;
  frame: MediaFrame;
  filters: MediaFilter[];
  /** 0–100, consumed by whichever of blur/pixelate is active */
  intensity: number;
  /** Intrinsic pixel dimensions, when known — drives aspect-ratio reservation */
  width?: number;
  height?: number;
  /** Duration in seconds for audio/video. Unused by images. */
  duration?: number;
}

/** A brand-new media record with catalog defaults applied */
export function defaultMedia(
  base: Pick<QuestionMedia, "id" | "kind" | "fileName"> & Partial<QuestionMedia>,
): QuestionMedia {
  return {
    alt: "",
    frame: "none",
    filters: [],
    intensity: DEFAULT_MEDIA_INTENSITY,
    ...base,
  };
}

// ─── Storage + routing ────────────────────────────────────────────────────────

/** URL path prefix the Worker serves media from */
export const MEDIA_ROUTE_PREFIX = "/media";

/** R2 key for a media id. Flat namespace — ids are unguessable nanoids. */
export function mediaObjectKey(id: string): string {
  return `media/${id}`;
}

/** Same-origin URL a client fetches a media object from */
export function mediaObjectUrl(id: string): string {
  return `${MEDIA_ROUTE_PREFIX}/${encodeURIComponent(id)}`;
}

/** Length of generated media ids */
export const MEDIA_ID_LENGTH = 24;

/** Media ids are nanoid's default URL-safe alphabet */
export const MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

// ─── Upload limits + accepted types ───────────────────────────────────────────

export const MEDIA_MAX_BYTES: Record<MediaKind, number> = {
  image: 10 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

/** MIME types accepted per kind. The sniffer must also agree — see `sniffMedia()`. */
export const MEDIA_ACCEPTED_TYPES: Record<MediaKind, readonly string[]> = {
  image: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"],
  audio: [
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/flac",
  ],
  video: ["video/mp4", "video/webm", "video/ogg"],
};

/** Maximum alt/caption length, in characters */
export const MEDIA_MAX_TEXT_LENGTH = 500;

/** The `accept` attribute value for a file picker limited to the enabled kinds */
export function acceptAttributeForEnabledKinds(): string {
  return ENABLED_MEDIA_KINDS.flatMap((k) => MEDIA_ACCEPTED_TYPES[k]).join(",");
}

/** Human-readable size, for host-facing limit messages */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

// ─── Byte sniffing ────────────────────────────────────────────────────────────
//
// The uploaded Content-Type header is never trusted: whatever a host uploads
// gets served back to every player, so an HTML file mislabelled as an image
// would be a stored-XSS vector. We sniff the container signature and serve the
// type we detected, not the one we were told.

interface SniffResult {
  kind: MediaKind;
  contentType: string;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

/**
 * Identify a media file from its leading bytes.
 *
 * `declaredType` is only consulted to disambiguate containers that legitimately
 * hold either audio or video (WebM/Matroska, Ogg) — and even then only between
 * two safe values for the same container.
 *
 * Returns null when the bytes match nothing we accept.
 */
export function sniffMedia(
  bytes: Uint8Array,
  declaredType?: string,
): SniffResult | null {
  const declared = (declaredType ?? "").split(";")[0].trim().toLowerCase();

  // ── Images ──
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "image", contentType: "image/png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { kind: "image", contentType: "image/jpeg" };
  }
  const gif = ascii(bytes, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") {
    return { kind: "image", contentType: "image/gif" };
  }
  if (ascii(bytes, 0, 4) === "RIFF") {
    const riffType = ascii(bytes, 8, 4);
    if (riffType === "WEBP") return { kind: "image", contentType: "image/webp" };
    if (riffType === "WAVE") return { kind: "audio", contentType: "audio/wav" };
  }

  // ── ISO base media (MP4 / M4A / AVIF / HEIF) — "ftyp" at offset 4 ──
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).trim().toLowerCase();
    if (brand === "avif" || brand === "avis") {
      return { kind: "image", contentType: "image/avif" };
    }
    if (brand === "m4a" || brand === "m4b" || brand === "f4a") {
      return { kind: "audio", contentType: "audio/mp4" };
    }
    // Everything else in this container family is treated as video/mp4:
    // isom, iso2, iso4, mp41, mp42, avc1, m4v, dash, …
    return { kind: "video", contentType: "video/mp4" };
  }

  // ── Matroska / WebM — container is kind-ambiguous ──
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return declared === "audio/webm"
      ? { kind: "audio", contentType: "audio/webm" }
      : { kind: "video", contentType: "video/webm" };
  }

  // ── Ogg — also kind-ambiguous ──
  if (ascii(bytes, 0, 4) === "OggS") {
    return declared === "video/ogg"
      ? { kind: "video", contentType: "video/ogg" }
      : { kind: "audio", contentType: "audio/ogg" };
  }

  // ── MP3: ID3 tag, or a raw MPEG audio frame sync ──
  if (ascii(bytes, 0, 3) === "ID3") {
    return { kind: "audio", contentType: "audio/mpeg" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { kind: "audio", contentType: "audio/mpeg" };
  }

  // ── FLAC ──
  if (ascii(bytes, 0, 4) === "fLaC") {
    return { kind: "audio", contentType: "audio/flac" };
  }

  return null;
}

/** Bytes the sniffer needs to see. Every signature above lives in the first 16. */
export const MEDIA_SNIFF_BYTES = 32;
