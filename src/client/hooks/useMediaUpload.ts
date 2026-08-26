// src/client/hooks/useMediaUpload.ts — Host-side upload of question media to R2
//
// Uploads inherit host authentication: the same sessionStorage token that gates
// game creation is sent as a bearer token, and the server re-validates it
// against the AuthGate DO on every request.
//
// R7.4: every failure path returns a non-blaming, actionable message.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MEDIA_ROUTE_PREFIX,
  defaultMedia,
  formatBytes,
  mediaObjectUrl,
  type MediaKind,
  type QuestionMedia,
} from "@/shared/media";
import { useAuth } from "./useAuth";

export interface MediaConfig {
  /** False when the server has no R2 bucket bound — the uploader hides itself */
  enabled: boolean;
  kinds: MediaKind[];
  acceptedTypes: Partial<Record<MediaKind, string[]>>;
  maxBytes: Partial<Record<MediaKind, number>>;
}

/** Module-level cache — the config is static per deployment, so fetch it once */
let configPromise: Promise<MediaConfig | null> | null = null;

function fetchConfig(): Promise<MediaConfig | null> {
  if (!configPromise) {
    configPromise = fetch(`${MEDIA_ROUTE_PREFIX}/config`)
      .then((res) => (res.ok ? (res.json() as Promise<MediaConfig>) : null))
      .catch(() => null);
  }
  return configPromise;
}

/** Every MIME type the server will accept right now, flattened */
function acceptedTypeList(config: MediaConfig | null): string[] {
  if (!config) return [];
  return config.kinds.flatMap((kind) => config.acceptedTypes[kind] ?? []);
}

/** Read an image's intrinsic size so the layout can reserve the right box */
async function measureImage(
  file: File,
): Promise<{ width: number; height: number } | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number } | null>(
      (resolve) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = objectUrl;
      },
    );
    return dimensions?.width && dimensions.height ? dimensions : null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface UploadResult {
  media?: QuestionMedia;
  error?: string;
}

interface UseMediaUploadReturn {
  /** null while the config request is still in flight */
  config: MediaConfig | null;
  /** Value for a file input's `accept` attribute */
  accept: string;
  /** True while an upload is in progress */
  isUploading: boolean;
  /** 0–100, or null when the browser can't report progress */
  progress: number | null;
  upload: (file: File) => Promise<UploadResult>;
  /** Delete an object from R2. Best-effort — a failure isn't surfaced. */
  remove: (id: string) => Promise<void>;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const { getToken } = useAuth();
  const [config, setConfig] = useState<MediaConfig | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void fetchConfig().then((loaded) => {
      if (mountedRef.current) setConfig(loaded);
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      const token = getToken();
      if (!token) {
        return { error: "Your host session expired. Please sign in again." };
      }

      const loaded = config ?? (await fetchConfig());
      if (!loaded?.enabled) {
        return {
          error:
            "Media uploads aren't available on this server. An R2 bucket needs to be bound as MEDIA.",
        };
      }

      // Pre-flight the obvious rejections so the host gets an instant answer
      // instead of waiting out an upload the server will refuse.
      const accepted = acceptedTypeList(loaded);
      if (accepted.length > 0 && file.type && !accepted.includes(file.type)) {
        return {
          error: `${file.name} isn't a supported file type. Try a PNG, JPEG, GIF, WebP, or AVIF image.`,
        };
      }

      const kind: MediaKind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "image";
      const limit = loaded.maxBytes[kind];
      if (limit && file.size > limit) {
        return {
          error: `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(limit)}.`,
        };
      }

      const dimensions = kind === "image" ? await measureImage(file) : null;

      const params = new URLSearchParams({ name: file.name });
      if (dimensions) {
        params.set("w", String(dimensions.width));
        params.set("h", String(dimensions.height));
      }

      setIsUploading(true);
      setProgress(0);

      try {
        const response = await xhrUpload(
          `${MEDIA_ROUTE_PREFIX}?${params.toString()}`,
          file,
          token,
          (percent) => {
            if (mountedRef.current) setProgress(percent);
          },
        );

        if (response.status === 201 && response.body) {
          const parsed = JSON.parse(response.body) as { media: QuestionMedia };
          // Belt and braces: fill in catalog defaults if an older server ever
          // returns a partial record.
          return { media: defaultMedia(parsed.media) };
        }

        const message = parseErrorBody(response.body);
        return {
          error:
            message ??
            "Something went wrong on our end while uploading. Please try again.",
        };
      } catch {
        return {
          error:
            "The upload didn't go through. Please check your connection and try again.",
        };
      } finally {
        if (mountedRef.current) {
          setIsUploading(false);
          setProgress(null);
        }
      }
    },
    [config, getToken],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const token = getToken();
      if (!token) return;
      try {
        await fetch(mediaObjectUrl(id), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Orphaned objects are harmless — the host has already moved on and
        // nothing references the id any more.
      }
    },
    [getToken],
  );

  return {
    config,
    accept: acceptedTypeList(config).join(","),
    isUploading,
    progress,
    upload,
    remove,
  };
}

/** Pull the server's `error` field out of a JSON body, if there is one */
function parseErrorBody(body: string | null): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { error?: string };
    return parsed.error ?? null;
  } catch {
    return null;
  }
}

/**
 * POST a file with upload progress. `fetch` can't report request progress, and
 * a 10 MB image over a phone tether is slow enough that a host deserves a bar
 * rather than a spinner.
 */
function xhrUpload(
  url: string,
  file: File,
  token: string,
  onProgress: (percent: number) => void,
): Promise<{ status: number; body: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
}
