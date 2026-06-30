// Avatars use the Lorelei Neutral style by Lisa Wischofsky (@lischi_art).
// Style: https://www.dicebear.com/styles/lorelei-neutral/
// Artist: https://www.instagram.com/lischi_art/
// License: CC BY 4.0
import { createAvatar } from "@dicebear/core";
import { loreleiNeutral } from "@dicebear/collection";
import { nanoid } from "nanoid";

export function generateAvatarSeed(): string {
  return nanoid(10);
}

export function getAvatarDataUri(seed: string): string {
  return createAvatar(loreleiNeutral, { seed }).toDataUri();
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
