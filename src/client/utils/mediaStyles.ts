// src/client/utils/mediaStyles.ts — Turn a QuestionMedia record into CSS
//
// Filters split into two mechanisms:
//   • a CSS `filter:` chain applied to the image itself (colour, blur)
//   • overlay layers stacked on top (grain, vignette, scanlines, halftone dots)
//
// Pixelate and VHS are structural rather than filter-chain effects — they need
// extra DOM — so they surface here as flags the component reads.
// See src/client/styles/media.css for the rules these values feed.

import {
  MEDIA_FRAME_META,
  normalizeFilters,
  type MediaFilter,
  type QuestionMedia,
} from "@/shared/media";

/** Overlay layers, in paint order (first = closest to the image) */
export const MEDIA_OVERLAYS = [
  "halftone",
  "scanlines",
  "grain",
  "vignette",
] as const;
export type MediaOverlay = (typeof MEDIA_OVERLAYS)[number];

export interface MediaRenderSpec {
  /** Value for the `filter` property on the image layers */
  filter: string;
  /** Overlay layers to render, in paint order */
  overlays: MediaOverlay[];
  /** Nearest-neighbour downscale factor, or null when pixelate is off */
  pixelate: number | null;
  /** Whether to render the RGB channel-split layers */
  vhs: boolean;
  /** Horizontal channel offset in px, when `vhs` */
  vhsShift: number;
  /** Whether the active frame renders a visible caption slot */
  hasCaption: boolean;
  /** width / height, defaulting to 4:3 when the upload didn't report dimensions */
  ratio: number;
}

/** Clamp a host-supplied intensity into the 0–1 range this module works in */
function normalizedIntensity(intensity: number): number {
  if (!Number.isFinite(intensity)) return 0;
  return Math.min(100, Math.max(0, intensity)) / 100;
}

/**
 * Blur radius in px. Starts at 1px so switching the filter on is always
 * visible, tops out around 24px which fully obscures a projected image.
 */
export function blurRadius(intensity: number): number {
  return Math.round((1 + normalizedIntensity(intensity) * 23) * 10) / 10;
}

/**
 * Nearest-neighbour downscale factor. The image is laid out at 1/N of the
 * viewport and scaled back up N times, so larger N means chunkier blocks.
 */
export function pixelateFactor(intensity: number): number {
  return 2 + Math.round(normalizedIntensity(intensity) * 30);
}

/** Build everything the renderer needs from a media record */
export function mediaRenderSpec(media: QuestionMedia): MediaRenderSpec {
  const filters = new Set<MediaFilter>(normalizeFilters(media.filters ?? []));
  const chain: string[] = [];

  // Colour treatments — mutually exclusive by catalog group, so at most one
  // of these branches contributes.
  if (filters.has("bw")) {
    chain.push("grayscale(1)", "contrast(1.05)");
  } else if (filters.has("sepia")) {
    chain.push("sepia(0.85)", "saturate(1.1)", "contrast(1.02)");
  } else if (filters.has("halftone")) {
    // The dots come from an overlay; the image underneath is flattened to
    // high-contrast greyscale so the dot pattern reads as print, not noise.
    chain.push("grayscale(1)", "contrast(1.25)", "brightness(1.08)");
  }

  if (filters.has("vhs")) {
    chain.push("saturate(1.15)", "contrast(1.05)");
  }

  if (filters.has("blur")) {
    chain.push(`blur(${blurRadius(media.intensity)}px)`);
  }

  const overlays = MEDIA_OVERLAYS.filter((overlay) => {
    if (overlay === "scanlines") return filters.has("vhs");
    return filters.has(overlay as MediaFilter);
  });

  const ratio =
    media.width && media.height && media.height > 0
      ? media.width / media.height
      : 4 / 3;

  return {
    filter: chain.length > 0 ? chain.join(" ") : "none",
    overlays,
    pixelate: filters.has("pixelate")
      ? pixelateFactor(media.intensity)
      : null,
    vhs: filters.has("vhs"),
    vhsShift: 3,
    hasCaption: MEDIA_FRAME_META[media.frame]?.hasCaption ?? false,
    ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 4 / 3,
  };
}

/**
 * Alt text for the rendered image. Hosts are asked for one in the editor;
 * this is the fallback for media that predates that or was left blank, so a
 * screen reader still announces that there's a picture rather than nothing.
 */
export function mediaAltText(media: QuestionMedia, questionNumber?: number): string {
  const alt = media.alt?.trim();
  if (alt) return alt;
  return questionNumber
    ? `Image shown with question ${questionNumber}`
    : "Image shown with this question";
}
