// src/client/views/host/components/QuestionMediaEditor.tsx — Attach an image to a question
//
// Upload, then choose the frame it's presented in and stack filters over it.
// The preview uses the same <QuestionMedia> component the presentation screen
// does, so what the host sees here is exactly what the room will see.
//
// R5.2: 44px touch targets. R5.3: real fieldset/legend/radio/checkbox semantics
// behind the chip styling, so keyboard and screen-reader behaviour comes for
// free. R5.8: alt text is prompted for, with a visible nudge when it's missing.

import React, { useCallback, useRef, useState } from "react";
import {
  DEFAULT_MEDIA_INTENSITY,
  MEDIA_FILTERS,
  MEDIA_FILTER_META,
  MEDIA_MAX_TEXT_LENGTH,
  framesForKind,
  normalizeFilters,
  formatBytes,
  type MediaFilter,
  type MediaFrame,
  type QuestionMedia,
} from "@/shared/media";
import { QuestionMedia as QuestionMediaPreview } from "../../../components/QuestionMedia";
import { useMediaUpload } from "../../../hooks/useMediaUpload";
import {
  invalidateMediaAvailability,
  useMediaAvailability,
} from "../../../hooks/useMediaAvailability";
import { useAuth } from "../../../hooks/useAuth";
import { colors, radii, spacing } from "../../../styles/theme";

interface QuestionMediaEditorProps {
  /** Current media on the question, if any */
  media: QuestionMedia | undefined;
  /** Called with the new media record, or undefined when it's removed */
  onChange: (media: QuestionMedia | undefined) => void;
  /** Unique id prefix for label/input association */
  idPrefix: string;
}

export function QuestionMediaEditor({
  media,
  onChange,
  idPrefix,
}: QuestionMediaEditorProps): React.ReactElement | null {
  const { config, accept, isUploading, progress, upload, remove } =
    useMediaUpload();
  const { getToken } = useAuth();
  // A CSV only carries the reference — confirm the server still has the bytes.
  const availability = useMediaAvailability(media?.id, getToken);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);

      const previousId = media?.id;
      const result = await upload(file);

      if (result.error || !result.media) {
        setError(result.error ?? "Something went wrong on our end.");
        return;
      }

      // Carry the host's existing framing/filters across a replacement — they
      // were choosing a look, not a look tied to one specific file.
      onChange(
        media
          ? {
              ...result.media,
              frame: media.frame,
              filters: media.filters,
              intensity: media.intensity,
              alt: media.alt,
              caption: media.caption,
            }
          : result.media,
      );

      invalidateMediaAvailability(result.media.id);
      if (previousId) {
        invalidateMediaAvailability(previousId);
        void remove(previousId);
      }
    },
    [media, onChange, remove, upload],
  );

  const handleRemove = useCallback(() => {
    if (!media) return;
    setError(null);
    invalidateMediaAvailability(media.id);
    void remove(media.id);
    onChange(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [media, onChange, remove]);

  const patch = useCallback(
    (changes: Partial<QuestionMedia>) => {
      if (!media) return;
      onChange({ ...media, ...changes });
    },
    [media, onChange],
  );

  const toggleFilter = useCallback(
    (filter: MediaFilter, on: boolean) => {
      if (!media) return;
      const without = media.filters.filter((f) => f !== filter);
      // Appending the newly-picked filter last matters: normalizeFilters keeps
      // the last pick within a mutually-exclusive group, so turning on sepia
      // while black & white is active swaps them rather than stacking.
      patch({ filters: normalizeFilters(on ? [...without, filter] : without) });
    },
    [media, patch],
  );

  // No R2 bucket bound on this server — GameCreator shows a single explanatory
  // banner instead of repeating one per question.
  if (config && !config.enabled) return null;

  const frames = framesForKind(media?.kind ?? "image");
  const activeFrame = frames.find((f) => f.id === media?.frame);
  const showIntensity = (media?.filters ?? []).some(
    (f) => MEDIA_FILTER_META[f]?.usesIntensity,
  );
  const intensityFor = (media?.filters ?? []).find(
    (f) => MEDIA_FILTER_META[f]?.usesIntensity,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        paddingTop: spacing[3],
        borderTop: `1px dashed ${colors.border}`,
      }}
    >
      <input
        ref={fileInputRef}
        id={`${idPrefix}-media-file`}
        type="file"
        accept={accept || "image/*"}
        className="sr-only"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!media ? (
        <button
          type="button"
          className={`qm-dropzone${isDragging ? " qm-dropzone--active" : ""}`}
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <span style={{ fontSize: "var(--text-lg)" }} aria-hidden="true">
            🖼️
          </span>
          <span>
            {isUploading
              ? `Uploading… ${progress ?? 0}%`
              : "Add an image — drop one here or choose a file"}
          </span>
          <span style={{ fontSize: "var(--text-xs)" }}>
            PNG, JPEG, GIF, WebP or AVIF
          </span>
        </button>
      ) : (
        <>
          {/* A CSV round-trip, or a game handed over from another host, can
              reference an image this server doesn't hold. Say so here, at
              setup time, and keep every setting so re-uploading restores the
              look exactly. */}
          {availability === "missing" && (
            <p
              role="alert"
              style={{
                margin: 0,
                padding: spacing[3],
                fontSize: "var(--text-sm)",
                color: colors.text,
                backgroundColor: `${colors.accentYellow}18`,
                border: `1px solid ${colors.accentYellow}55`,
                borderRadius: radii.lg,
              }}
            >
              <strong>This image isn't on the server.</strong> The question
              still has its frame and filters — choose the file again to
              restore it. (Looking for <code>{media.fileName}</code>.)
            </p>
          )}

          {/* Preview — identical rendering to the presentation screen */}
          <div style={{ display: "flex", gap: spacing[4], flexWrap: "wrap" }}>
            {availability === "missing" ? (
              <div
                style={{
                  width: 200,
                  aspectRatio: "4 / 3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.lg,
                  border: `2px dashed ${colors.border}`,
                  color: colors.textSecondary,
                  fontSize: "var(--text-sm)",
                  textAlign: "center",
                  padding: spacing[3],
                }}
              >
                Image not found
              </div>
            ) : (
              <QuestionMediaPreview media={media} size="md" />
            )}

            <div
              style={{
                flex: "1 1 220px",
                display: "flex",
                flexDirection: "column",
                gap: spacing[2],
                minWidth: 200,
              }}
            >
              <p
                style={{
                  fontSize: "var(--text-xs)",
                  color: colors.textSecondary,
                  margin: 0,
                  wordBreak: "break-all",
                }}
              >
                {/* Size and dimensions come from the upload. A question that
                    arrived via a CSV row has the reference but not those, so
                    only show what's actually known. */}
                {[
                  media.fileName,
                  media.size !== undefined ? formatBytes(media.size) : null,
                  media.width && media.height
                    ? `${media.width}×${media.height}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              <div style={{ display: "flex", gap: spacing[2], flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-sm btn-ghost"
                  style={{ minHeight: 36 }}
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading
                    ? `Uploading… ${progress ?? 0}%`
                    : availability === "missing"
                      ? "Upload this image"
                      : "Replace"}
                </button>
                <button
                  type="button"
                  className="btn-sm btn-ghost"
                  style={{ minHeight: 36, color: colors.incorrect }}
                  onClick={handleRemove}
                >
                  Remove image
                </button>
              </div>
            </div>
          </div>

          {/* Frame — single choice */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Frame</legend>
            <div className="qm-picker">
              {frames.map((frame) => (
                <label
                  key={frame.id}
                  className={`qm-chip${media.frame === frame.id ? " qm-chip--on" : ""}`}
                  title={frame.description}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={`${idPrefix}-media-frame`}
                    value={frame.id}
                    checked={media.frame === frame.id}
                    onChange={() => patch({ frame: frame.id as MediaFrame })}
                  />
                  {frame.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Filters — stackable, with mutually-exclusive groups */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Filters</legend>
            <div className="qm-picker">
              {MEDIA_FILTERS.map((filter) => {
                const meta = MEDIA_FILTER_META[filter];
                const on = media.filters.includes(filter);
                return (
                  <label
                    key={filter}
                    className={`qm-chip${on ? " qm-chip--on" : ""}`}
                    title={meta.description}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) => toggleFilter(filter, e.target.checked)}
                    />
                    {meta.label}
                  </label>
                );
              })}
            </div>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: colors.textSecondary,
                margin: `${spacing[2]} 0 0`,
              }}
            >
              Filters stack. Colour treatments replace each other, as do blur and
              pixelate.
            </p>
          </fieldset>

          {/* Intensity — only meaningful for blur/pixelate */}
          {showIntensity && (
            <div style={{ maxWidth: 320 }}>
              <label
                htmlFor={`${idPrefix}-media-intensity`}
                style={{ fontSize: "var(--text-sm)" }}
              >
                {intensityFor ? MEDIA_FILTER_META[intensityFor].label : "Filter"}{" "}
                strength: {media.intensity}%
              </label>
              <input
                id={`${idPrefix}-media-intensity`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={media.intensity ?? DEFAULT_MEDIA_INTENSITY}
                onChange={(e) =>
                  patch({ intensity: parseInt(e.target.value, 10) })
                }
                style={{ width: "100%" }}
              />
            </div>
          )}

          {/* Alt text — R5.8 */}
          <div>
            <label
              htmlFor={`${idPrefix}-media-alt`}
              style={{ fontSize: "var(--text-sm)" }}
            >
              Image description (alt text)
            </label>
            <input
              id={`${idPrefix}-media-alt`}
              type="text"
              maxLength={MEDIA_MAX_TEXT_LENGTH}
              value={media.alt}
              onChange={(e) => patch({ alt: e.target.value })}
              placeholder="Describe the image for players using a screen reader"
              aria-describedby={`${idPrefix}-media-alt-hint`}
            />
            <span
              id={`${idPrefix}-media-alt-hint`}
              style={{
                fontSize: "var(--text-xs)",
                color: media.alt.trim() ? colors.textSecondary : colors.accentYellow,
                marginTop: spacing[1],
                display: "block",
              }}
            >
              {media.alt.trim()
                ? "Read aloud to players using a screen reader."
                : "Without a description, players using a screen reader won't know what the image shows. Careful not to give the answer away."}
            </span>
          </div>

          {/* Caption — only frames with a caption slot */}
          {activeFrame?.hasCaption && (
            <div>
              <label
                htmlFor={`${idPrefix}-media-caption`}
                style={{ fontSize: "var(--text-sm)" }}
              >
                Caption ({activeFrame.label} label — optional)
              </label>
              <input
                id={`${idPrefix}-media-caption`}
                type="text"
                maxLength={MEDIA_MAX_TEXT_LENGTH}
                value={media.caption ?? ""}
                onChange={(e) =>
                  patch({ caption: e.target.value || undefined })
                }
                placeholder="Written on the frame itself"
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}

const fieldsetStyle: React.CSSProperties = {
  border: "none",
  padding: 0,
  margin: 0,
  minWidth: 0,
};

const legendStyle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: colors.textSecondary,
  padding: 0,
  marginBottom: spacing[2],
  fontWeight: 600,
};
