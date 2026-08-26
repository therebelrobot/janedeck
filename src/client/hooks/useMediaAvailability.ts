// src/client/hooks/useMediaAvailability.ts — Does this server actually hold that image?
//
// A CSV carries media *references* (an R2 object id), never the bytes. So a
// game restored from a spreadsheet, handed over from another host, or imported
// onto a fresh instance can point at images the server has never seen. This
// resolves those references so the host editor can say so at setup time
// instead of the room finding out on the projector.
//
// Lookups are cached per id for the page's lifetime and coalesced: every
// question editor on the page asks about its own id, and they leave as one
// batched request.

import { useEffect, useState } from "react";
import { MEDIA_ROUTE_PREFIX } from "@/shared/media";

export type MediaAvailability = "unknown" | "checking" | "present" | "missing";

/** id → whether the server holds it. Absent means "not looked up yet". */
const cache = new Map<string, boolean>();
/** ids waiting to go out in the next batch */
const queue = new Set<string>();
/** ids currently in flight, so a re-render doesn't re-request them */
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let getToken: () => string | null = () => null;

/** How long to gather ids before sending them as one request */
const BATCH_DELAY_MS = 60;

function notify(): void {
  for (const listener of listeners) listener();
}

async function flush(): Promise<void> {
  flushTimer = null;
  const ids = [...queue];
  queue.clear();
  if (ids.length === 0) return;

  const token = getToken();
  if (!token) {
    // No host session — leave the ids unresolved rather than claiming they're
    // missing. The editor treats "unknown" as "don't warn".
    return;
  }

  for (const id of ids) inFlight.add(id);
  try {
    const response = await fetch(`${MEDIA_ROUTE_PREFIX}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) return;

    const { present, missing } = (await response.json()) as {
      present: string[];
      missing: string[];
    };
    for (const id of present) cache.set(id, true);
    for (const id of missing) cache.set(id, false);
    notify();
  } catch {
    // A failed lookup leaves the ids unknown, which reads as "no warning" —
    // better than telling a host their images are gone because of a blip.
  } finally {
    for (const id of ids) inFlight.delete(id);
  }
}

function request(id: string): void {
  if (cache.has(id) || inFlight.has(id) || queue.has(id)) return;
  queue.add(id);
  if (flushTimer === null) flushTimer = setTimeout(() => void flush(), BATCH_DELAY_MS);
}

/**
 * Forget every cached answer. Call after uploading or deleting, so an id that
 * was missing a moment ago is looked up again rather than staying stale.
 */
export function invalidateMediaAvailability(id?: string): void {
  if (id) {
    cache.delete(id);
  } else {
    cache.clear();
  }
  notify();
}

/** Synchronous read of what's already known — for validation at submit time. */
export function knownMediaAvailability(id: string): MediaAvailability {
  const cached = cache.get(id);
  if (cached === undefined) return "unknown";
  return cached ? "present" : "missing";
}

/**
 * Resolve one media id. Returns "unknown" while there's no answer yet (which
 * callers should treat as "don't warn"), then settles to present/missing.
 */
export function useMediaAvailability(
  id: string | undefined,
  tokenGetter: () => string | null,
): MediaAvailability {
  const [, forceRender] = useState(0);

  useEffect(() => {
    getToken = tokenGetter;
  }, [tokenGetter]);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (id) request(id);
  }, [id]);

  if (!id) return "unknown";
  const cached = cache.get(id);
  if (cached === undefined) return inFlight.has(id) || queue.has(id) ? "checking" : "unknown";
  return cached ? "present" : "missing";
}
