// src/client/components/QuestionMedia.tsx — Framed + filtered question media
//
// One component renders host-uploaded media everywhere it appears: the
// presentation screen, the player's phone, the audience view, the host
// dashboard, and the live preview in the question editor. Everything visual is
// driven by the QuestionMedia record, so all five surfaces agree by
// construction.
//
// R5.8: the image carries host-authored alt text, with a generic fallback so a
// screen reader never meets an unlabelled image. Decorative effect layers and
// the duplicated VHS channel copies are aria-hidden.

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { mediaObjectUrl, type QuestionMedia } from "@/shared/media";
import { mediaAltText, mediaRenderSpec } from "../utils/mediaStyles";

export type QuestionMediaSize = "sm" | "md" | "lg";

interface QuestionMediaProps {
  media: QuestionMedia;
  /** Surface this is rendering on — drives the size caps in media.css */
  size: QuestionMediaSize;
  /** Used for the alt-text fallback when the host left alt blank */
  questionNumber?: number;
  /** Extra class names for layout placement by the caller */
  className?: string;
}

/**
 * Colour-channel isolation matrices for the VHS split. Scoped per instance via
 * useId so several framed images can share a page without clashing filter ids.
 */
function ChannelFilterDefs({ idPrefix }: { idPrefix: string }): React.ReactElement {
  const channels: Array<[string, string]> = [
    ["r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
    ["g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
    ["b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"],
  ];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        {channels.map(([channel, values]) => (
          <filter
            key={channel}
            id={`${idPrefix}-chan-${channel}`}
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix type="matrix" values={values} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

export function QuestionMedia({
  media,
  size,
  questionNumber,
  className,
}: QuestionMediaProps): React.ReactElement | null {
  const instanceId = useId().replace(/:/g, "");
  // Uploads normally carry their dimensions, but anything that arrived without
  // them gets measured on load so the aspect-ratio box stops guessing 4:3.
  const [measuredRatio, setMeasuredRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pixelate = mediaRenderSpec(media).pixelate;

  /**
   * Redraw the pixelated copy: the image is drawn into a canvas at 1/N of the
   * displayed size, and the browser upscales that tiny bitmap with
   * nearest-neighbour sampling. See the note in media.css for why the obvious
   * CSS-only version silently does nothing.
   */
  const drawPixelated = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !pixelate) return;
    if (!img.complete || img.naturalWidth === 0) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width / pixelate));
    const height = Math.max(1, Math.round(rect.height / pixelate));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    // Smooth on the way *down* so each block averages its source pixels; the
    // blocky look comes from the browser's nearest-neighbour upscale.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, width, height);
  }, [pixelate]);

  // Redraw on mount (covers a cached image that fires no load event), whenever
  // the block size changes, and whenever the box is resized.
  useEffect(() => {
    if (!pixelate) return;
    drawPixelated();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => drawPixelated());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawPixelated, pixelate]);

  // Audio and video are stored, served and validated already, but they play
  // before the question rather than beside it — a different surface entirely.
  // See mediaTiming() in src/shared/media.ts.
  if (media.kind !== "image") return null;

  const spec = mediaRenderSpec(media);
  const ratio = measuredRatio ?? spec.ratio;
  const src = mediaObjectUrl(media.id);
  const alt = mediaAltText(media, questionNumber);
  const caption = spec.hasCaption ? media.caption?.trim() : undefined;

  const style: React.CSSProperties & Record<string, string | number> = {
    "--qm-ratio": ratio,
    "--qm-filter": spec.filter,
  };
  if (spec.pixelate) style["--qm-px"] = spec.pixelate;
  if (spec.vhs) style["--qm-vhs-shift"] = `${spec.vhsShift}px`;

  const classes = [
    "qm",
    `qm--${media.frame}`,
    `qm--${size}`,
    spec.pixelate ? "qm--pixelate" : "",
    spec.vhs ? "qm--vhs" : "",
    caption ? "qm--captioned" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!media.width || !media.height) {
      if (naturalWidth > 0 && naturalHeight > 0) {
        setMeasuredRatio(naturalWidth / naturalHeight);
      }
    }
    drawPixelated();
  };

  // Under VHS the main image becomes the green channel and two shifted copies
  // supply red and blue, screen-blended back together. The main image keeps the
  // alt text either way.
  const baseFilter = spec.vhs
    ? `${spec.filter === "none" ? "" : `${spec.filter} `}url(#${instanceId}-chan-g)`
    : undefined;

  return (
    <figure className={classes} style={style}>
      {spec.vhs && <ChannelFilterDefs idPrefix={instanceId} />}

      <div className="qm__frame">
        <div className="qm__mat">
          <div className="qm__viewport">
            <img
              ref={imgRef}
              className="qm__img"
              src={src}
              alt={alt}
              onLoad={handleLoad}
              decoding="async"
              draggable={false}
              style={baseFilter ? { filter: baseFilter } : undefined}
            />

            {spec.vhs && (
              <>
                <img
                  className="qm__img qm__img--chan qm__img--chan-r"
                  src={src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    filter: `${spec.filter === "none" ? "" : `${spec.filter} `}url(#${instanceId}-chan-r)`,
                  }}
                />
                <img
                  className="qm__img qm__img--chan qm__img--chan-b"
                  src={src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{
                    filter: `${spec.filter === "none" ? "" : `${spec.filter} `}url(#${instanceId}-chan-b)`,
                  }}
                />
              </>
            )}

            {spec.pixelate && (
              <canvas ref={canvasRef} className="qm__pixel" aria-hidden="true" />
            )}

            {spec.overlays.map((overlay) => (
              <span
                key={overlay}
                className={`qm__fx qm__fx--${overlay}`}
                aria-hidden="true"
              />
            ))}
          </div>

          {caption && (
            <div className="qm__caption" aria-hidden="true">
              {caption}
            </div>
          )}
        </div>
      </div>

      {/* The visible caption is aria-hidden above so it isn't announced twice */}
      {caption && <figcaption className="sr-only">{caption}</figcaption>}
    </figure>
  );
}
