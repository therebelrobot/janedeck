// src/server/media.ts — R2-backed media routes for host-uploaded question media
//
// Routes (all under MEDIA_ROUTE_PREFIX, handled before partyserver routing):
//
//   GET    /media/config    → what the host UI is allowed to upload
//   POST   /media/status    → which of these ids this server holds (host only)
//   POST   /media           → upload bytes, returns a QuestionMedia record (host only)
//   GET    /media/:id       → stream an object back (public, cacheable, range-capable)
//   DELETE /media/:id       → remove an object (host only)
//
// Reads are public because every player and the presentation screen need the
// bytes, and none of them hold a host token. Ids are unguessable nanoids and
// media is only broadcast for the question currently on screen, so "public"
// means "public to anyone handed the id", not "enumerable".
//
// Writes inherit host authentication: the same AuthGate token that gates game
// creation gates uploads, validated through the same DO.

import { nanoid } from "nanoid";
import { PARTY_AUTH_GATE } from "@/shared/constants";
import {
  ENABLED_MEDIA_KINDS,
  MEDIA_ACCEPTED_TYPES,
  MEDIA_ID_LENGTH,
  MEDIA_ID_PATTERN,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_TEXT_LENGTH,
  MEDIA_ROUTE_PREFIX,
  MEDIA_SNIFF_BYTES,
  defaultMedia,
  formatBytes,
  isMediaKindEnabled,
  mediaObjectKey,
  mediaObjectUrl,
  sniffMedia,
  type MediaKind,
  type QuestionMedia,
} from "@/shared/media";

/** Cache for a year — ids are content-addressed by upload, never reused */
const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Headers applied to every media byte response. `nosniff` plus a sniffed (not
 * client-declared) Content-Type is what keeps an uploaded file from being
 * interpreted as HTML/script by a browser.
 */
function mediaSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

/** R7.4: non-blaming error bodies, consistent with the rest of the app */
function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/**
 * Decide whether this request is ours. Returns the media id for
 * `/media/:id` style paths, `""` for a bare `/media`, or null if the path
 * isn't under the media prefix at all.
 */
function matchMediaPath(pathname: string): string | null {
  if (pathname === MEDIA_ROUTE_PREFIX) return "";
  if (!pathname.startsWith(`${MEDIA_ROUTE_PREFIX}/`)) return null;
  return decodeURIComponent(pathname.slice(MEDIA_ROUTE_PREFIX.length + 1));
}

/** Pull the host token off an Authorization header, falling back to ?token= */
function readToken(req: Request, url: URL): string | null {
  const header = req.headers.get("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) return token;
  }
  return url.searchParams.get("token");
}

/** Validate a host token against the AuthGate DO — same path handleCreateGame uses */
async function validateHostToken(env: Env, token: string): Promise<boolean> {
  try {
    const authId = env.AuthGate.idFromName("global");
    const authStub = env.AuthGate.get(authId);
    const response = await authStub.fetch(
      new Request(
        `https://auth/parties/${PARTY_AUTH_GATE}/global?token=${encodeURIComponent(token)}`,
      ),
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { valid: boolean };
    return data.valid === true;
  } catch {
    return false;
  }
}

/**
 * The R2 bucket binding, or null when the operator hasn't provisioned one.
 * Media is an optional capability: a JaneDeck instance without an R2 bucket
 * still runs every existing game type, it just can't accept uploads.
 */
function bucket(env: Env): R2Bucket | null {
  return env.MEDIA ?? null;
}

// ─── GET /media/config ────────────────────────────────────────────────────────

interface MediaConfigResponse {
  /** False when no R2 bucket is bound — the host UI hides the uploader */
  enabled: boolean;
  kinds: readonly MediaKind[];
  acceptedTypes: Record<string, readonly string[]>;
  maxBytes: Record<string, number>;
}

function handleConfig(env: Env): Response {
  const acceptedTypes: Record<string, readonly string[]> = {};
  const maxBytes: Record<string, number> = {};
  for (const kind of ENABLED_MEDIA_KINDS) {
    acceptedTypes[kind] = MEDIA_ACCEPTED_TYPES[kind];
    maxBytes[kind] = MEDIA_MAX_BYTES[kind];
  }

  const body: MediaConfigResponse = {
    enabled: bucket(env) !== null,
    kinds: ENABLED_MEDIA_KINDS,
    acceptedTypes,
    maxBytes,
  };

  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

// ─── POST /media/status ───────────────────────────────────────────────────────

/** Most ids one status request will answer for */
const MEDIA_STATUS_MAX_IDS = 500;

/**
 * Which of these media ids this server actually holds.
 *
 * A CSV carries media *references*, not bytes, so a game imported from a
 * spreadsheet (or from another JaneDeck instance) can point at objects this
 * server has never seen. The host editor asks this before the game starts, so
 * a missing image is something the host fixes at setup time rather than
 * discovers on the projector.
 */
async function handleStatus(req: Request, env: Env, url: URL): Promise<Response> {
  const token = readToken(req, url);
  if (!token || !(await validateHostToken(env, token))) {
    return errorResponse(401, "Invalid or expired token");
  }

  let ids: unknown;
  try {
    ({ ids } = (await req.json()) as { ids?: unknown });
  } catch {
    return errorResponse(400, "Expected a JSON body of the form { ids: [...] }");
  }

  if (!Array.isArray(ids)) {
    return errorResponse(400, "Expected a JSON body of the form { ids: [...] }");
  }
  if (ids.length > MEDIA_STATUS_MAX_IDS) {
    return errorResponse(
      413,
      `That's more than ${MEDIA_STATUS_MAX_IDS} ids in one request.`,
    );
  }

  const store = bucket(env);
  const candidates = [
    ...new Set(
      ids.filter(
        (id): id is string => typeof id === "string" && MEDIA_ID_PATTERN.test(id),
      ),
    ),
  ];

  // Without a bucket nothing resolves — report every id missing rather than
  // pretending they're all fine.
  if (!store) {
    return Response.json(
      { present: [], missing: candidates },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const heads = await Promise.all(
    candidates.map(async (id) => [id, (await store.head(mediaObjectKey(id))) !== null] as const),
  );

  return Response.json(
    {
      present: heads.filter(([, ok]) => ok).map(([id]) => id),
      missing: heads.filter(([, ok]) => !ok).map(([id]) => id),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// ─── POST /media ──────────────────────────────────────────────────────────────

/** Clamp a host-supplied text field, treating blank as absent */
function readText(url: URL, param: string): string | undefined {
  const raw = url.searchParams.get(param);
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, MEDIA_MAX_TEXT_LENGTH);
  return trimmed || undefined;
}

/** Read a positive integer query param within bounds, or undefined */
function readInt(url: URL, param: string, max: number): number | undefined {
  const raw = url.searchParams.get(param);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > max) return undefined;
  return parsed;
}

async function handleUpload(req: Request, env: Env, url: URL): Promise<Response> {
  const store = bucket(env);
  if (!store) {
    return errorResponse(
      503,
      "Media uploads aren't available on this server yet. An R2 bucket needs to be bound as MEDIA.",
    );
  }

  const token = readToken(req, url);
  if (!token || !(await validateHostToken(env, token))) {
    return errorResponse(401, "Invalid or expired token");
  }

  // Read the whole body. The kind-specific size cap is enforced after sniffing,
  // but a hard ceiling is applied first so an oversized upload of any kind
  // can't be buffered indefinitely.
  const hardMax = Math.max(...Object.values(MEDIA_MAX_BYTES));
  const declaredLength = Number.parseInt(
    req.headers.get("Content-Length") ?? "",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > hardMax) {
    return errorResponse(
      413,
      `That file is larger than the ${formatBytes(hardMax)} limit.`,
    );
  }

  let bytes: Uint8Array;
  try {
    const buffer = await req.arrayBuffer();
    bytes = new Uint8Array(buffer);
  } catch {
    return errorResponse(400, "Something went wrong reading the upload.");
  }

  if (bytes.byteLength === 0) {
    return errorResponse(400, "That file appears to be empty.");
  }
  if (bytes.byteLength > hardMax) {
    return errorResponse(
      413,
      `That file is larger than the ${formatBytes(hardMax)} limit.`,
    );
  }

  // Never trust the declared Content-Type — sniff the container signature and
  // serve back whatever we actually detected.
  const sniffed = sniffMedia(
    bytes.subarray(0, MEDIA_SNIFF_BYTES),
    req.headers.get("Content-Type") ?? undefined,
  );
  if (!sniffed) {
    return errorResponse(
      415,
      "That file type isn't supported. Try a PNG, JPEG, GIF, WebP, or AVIF image.",
    );
  }

  if (!isMediaKindEnabled(sniffed.kind)) {
    return errorResponse(
      415,
      `${sniffed.kind} uploads aren't enabled yet — images only for now.`,
    );
  }

  const kindMax = MEDIA_MAX_BYTES[sniffed.kind];
  if (bytes.byteLength > kindMax) {
    return errorResponse(
      413,
      `That ${sniffed.kind} is ${formatBytes(bytes.byteLength)} — the limit is ${formatBytes(kindMax)}.`,
    );
  }

  const id = nanoid(MEDIA_ID_LENGTH);
  const fileName = (readText(url, "name") ?? `upload.${sniffed.kind}`).slice(
    0,
    255,
  );

  await store.put(mediaObjectKey(id), bytes, {
    httpMetadata: {
      contentType: sniffed.contentType,
      cacheControl: MEDIA_CACHE_CONTROL,
    },
    customMetadata: {
      kind: sniffed.kind,
      fileName,
      uploadedAt: String(Date.now()),
    },
  });

  const media: QuestionMedia = defaultMedia({
    id,
    kind: sniffed.kind,
    contentType: sniffed.contentType,
    size: bytes.byteLength,
    fileName,
    width: readInt(url, "w", 20000),
    height: readInt(url, "h", 20000),
  });

  return Response.json(
    { media, url: mediaObjectUrl(id) },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

// ─── GET /media/:id ───────────────────────────────────────────────────────────

/**
 * Parse a single-range `Range: bytes=a-b` header against a known object size.
 *
 * Images never need this, but audio and video do — browsers seek by issuing
 * range requests and some refuse to play a source that answers 200 to
 * everything. Wiring it now means enabling A/V needs no change here.
 */
function parseRange(
  header: string | null,
  size: number,
): { offset: number; length: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") return null;

  let start: number;
  let end: number;

  if (startRaw === "") {
    // Suffix range: last N bytes
    const suffix = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(startRaw, 10);
    end = endRaw === "" ? size - 1 : Number.parseInt(endRaw, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    end = Math.min(end, size - 1);
  }

  if (start >= size || start > end) return "unsatisfiable";
  return { offset: start, length: end - start + 1 };
}

async function handleGet(
  req: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const store = bucket(env);
  if (!store) return errorResponse(404, "Not found");
  if (!MEDIA_ID_PATTERN.test(id)) return errorResponse(404, "Not found");

  const key = mediaObjectKey(id);

  // Cheap revalidation path: HEAD the object to answer conditional requests
  // without pulling the body out of R2.
  const ifNoneMatch = req.headers.get("If-None-Match");
  if (ifNoneMatch) {
    const head = await store.head(key);
    if (head && etagMatches(ifNoneMatch, head.httpEtag)) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: head.httpEtag,
          "Cache-Control": MEDIA_CACHE_CONTROL,
          ...mediaSecurityHeaders(),
        },
      });
    }
  }

  const rangeHeader = req.headers.get("Range");
  if (rangeHeader) {
    const head = await store.head(key);
    if (!head) return errorResponse(404, "Not found");

    const range = parseRange(rangeHeader, head.size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${head.size}`,
          "Accept-Ranges": "bytes",
          ...mediaSecurityHeaders(),
        },
      });
    }
    if (range) {
      const object = await store.get(key, { range });
      if (!object || !object.body) return errorResponse(404, "Not found");
      const end = range.offset + range.length - 1;
      return new Response(object.body, {
        status: 206,
        headers: {
          "Content-Type":
            object.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Length": String(range.length),
          "Content-Range": `bytes ${range.offset}-${end}/${head.size}`,
          "Accept-Ranges": "bytes",
          ETag: object.httpEtag,
          "Cache-Control": MEDIA_CACHE_CONTROL,
          ...mediaSecurityHeaders(),
        },
      });
    }
  }

  const object = await store.get(key);
  if (!object || !object.body) return errorResponse(404, "Not found");

  const headers = new Headers(mediaSecurityHeaders());
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream",
  );
  headers.set("Content-Length", String(object.size));
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", MEDIA_CACHE_CONTROL);

  if (req.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

/** RFC-lenient If-None-Match check: `*`, or any (weak-compared) tag in the list */
function etagMatches(ifNoneMatch: string, etag: string): boolean {
  if (ifNoneMatch.trim() === "*") return true;
  const strip = (tag: string) => tag.trim().replace(/^W\//, "");
  const target = strip(etag);
  return ifNoneMatch.split(",").some((tag) => strip(tag) === target);
}

// ─── DELETE /media/:id ────────────────────────────────────────────────────────

async function handleDelete(
  req: Request,
  env: Env,
  url: URL,
  id: string,
): Promise<Response> {
  const store = bucket(env);
  if (!store) return errorResponse(404, "Not found");
  if (!MEDIA_ID_PATTERN.test(id)) return errorResponse(404, "Not found");

  const token = readToken(req, url);
  if (!token || !(await validateHostToken(env, token))) {
    return errorResponse(401, "Invalid or expired token");
  }

  await store.delete(mediaObjectKey(id));
  return new Response(null, { status: 204 });
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Handle a media request, or return null if the URL isn't a media route so the
 * caller can fall through to partyserver.
 */
export async function handleMediaRequest(
  req: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(req.url);
  const id = matchMediaPath(url.pathname);
  if (id === null) return null;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: "GET, HEAD, POST, DELETE, OPTIONS",
        "Cache-Control": "no-store",
      },
    });
  }

  if (id === "config") {
    if (req.method !== "GET") return errorResponse(405, "Method not allowed");
    return handleConfig(env);
  }

  if (id === "status") {
    if (req.method !== "POST") return errorResponse(405, "Method not allowed");
    return handleStatus(req, env, url);
  }

  if (id === "") {
    if (req.method !== "POST") return errorResponse(405, "Method not allowed");
    return handleUpload(req, env, url);
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return handleGet(req, env, id);
  }
  if (req.method === "DELETE") {
    return handleDelete(req, env, url, id);
  }

  return errorResponse(405, "Method not allowed");
}
