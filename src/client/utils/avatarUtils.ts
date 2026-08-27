// Avatars use the Big Smile style by Ashley Seo (www.ashleyseo.com),
// with the "Bold Pop" preset (saturated background colors).
// Style: https://www.dicebear.com/styles/big-smile/
// Artist: https://www.ashleyseo.com/
// License: CC BY 4.0
import { createAvatar } from "@dicebear/core";
import { bigSmile } from "@dicebear/collection";
import { nanoid } from "nanoid";

const BOLD_POP_BACKGROUND_COLORS = ["ff5d8f", "ffb703", "43aa8b", "4d96ff", "b57bff"];

export function generateAvatarSeed(): string {
  return nanoid(10);
}

// Rendering an avatar is ~0.05ms, which is nothing for one face and ~3.5ms a
// paint for a room of 70 — on every re-render, on the screen that re-renders
// most (the host dashboard, on every incoming message). Seeds are stable for
// the life of a game, so the SVG only ever has to be built once.
const dataUriCache = new Map<string, string>();

export function getAvatarDataUri(seed: string): string {
  const cached = dataUriCache.get(seed);
  if (cached !== undefined) return cached;
  const uri = createAvatar(bigSmile, { seed, backgroundColor: BOLD_POP_BACKGROUND_COLORS }).toDataUri();
  dataUriCache.set(seed, uri);
  return uri;
}

/** Generate `count` unique seeds, all different from `exclude`. */
export function generateAlternativeSeeds(count: number, exclude: string): string[] {
  const seeds: string[] = [];
  while (seeds.length < count) {
    const s = nanoid(10);
    if (s !== exclude) seeds.push(s);
  }
  return seeds;
}
