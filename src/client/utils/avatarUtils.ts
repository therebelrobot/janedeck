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

export function getAvatarDataUri(seed: string): string {
  return createAvatar(bigSmile, { seed, backgroundColor: BOLD_POP_BACKGROUND_COLORS }).toDataUri();
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
