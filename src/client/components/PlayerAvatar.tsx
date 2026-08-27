// src/client/components/PlayerAvatar.tsx — Player avatar (DiceBear or initials fallback)
// R1.4: displayName is always the chosen name. R1.2: Unicode-safe.
// R5.8: Accessible label includes connection status.
import React from "react";
import { getAvatarDataUri } from "../utils/avatarUtils";

export type AvatarSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface PlayerAvatarProps {
  /** Player's chosen display name — R1.4 */
  displayName: string;
  /** DiceBear avatar seed — when provided, shows a DiceBear avatar instead of initials */
  avatarSeed?: string | null;
  /** Whether the player is currently connected */
  isConnected?: boolean;
  /** Avatar size */
  size?: AvatarSize;
  /**
   * Bold ring + matching glow around the avatar, in this color. Used where the
   * avatar is the hero of the screen (podium, lobby, top-3 rows) rather than a
   * row-inline identifier.
   */
  ring?: string | null;
  /** Gentle idle bob — for hero placements only. Disabled under reduced motion (CSS). */
  bob?: boolean;
  /** Hide the connection dot — for placements where connection isn't meaningful */
  hideStatus?: boolean;
}

/** Bright, high-contrast avatar background colors (used for initials fallback only) */
const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
  "#F1948A", "#7FB3D8", "#73C6B6", "#F9E79F",
];

/** Pixel size of the avatar circle itself, before any ring */
export const AVATAR_SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 88,
  "2xl": 128,
  "3xl": 176,
};

const FONT_SIZE: Record<AvatarSize, string> = {
  sm: "var(--text-sm)",
  md: "var(--text-lg)",
  lg: "var(--text-2xl)",
  xl: "var(--text-4xl)",
  "2xl": "var(--text-5xl)",
  "3xl": "var(--text-6xl)",
};

/** Ring thickness scales with the avatar so the treatment reads the same at every size */
const RING_PX: Record<AvatarSize, number> = {
  sm: 2, md: 2, lg: 3, xl: 4, "2xl": 5, "3xl": 6,
};

const STATUS_PX: Record<AvatarSize, number> = {
  sm: 8, md: 10, lg: 12, xl: 16, "2xl": 20, "3xl": 26,
};

/**
 * Ring colors for hero avatar placements. Picked deterministically per player so
 * a given person keeps the same halo everywhere they appear on screen.
 */
const RING_PALETTE = [
  "#facc15", "#22c55e", "#3b82f6", "#ec4899",
  "#a855f7", "#f97316", "#4ecdc4", "#f472b6",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/** Stable ring color for a player, keyed on their avatar seed (or name as fallback) */
export function avatarRingColor(key: string): string {
  return RING_PALETTE[hashString(key) % RING_PALETTE.length];
}

function getColorForName(name: string): string {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const chars = Array.from(trimmed);
  const first = chars[0].toUpperCase();
  const words = trimmed.split(/\s+/);
  if (words.length > 1 && words[1].length > 0) {
    return `${first}${Array.from(words[1])[0].toUpperCase()}`;
  }
  return first;
}

/**
 * Player avatar. Shows a DiceBear avatar image when `avatarSeed` is provided,
 * otherwise falls back to a colored-initials circle.
 *
 * `ring` + the larger sizes turn it from a row-inline identifier into the
 * focal point of a screen — the podium, the lobby wall, the top of a board.
 */
export function PlayerAvatar({
  displayName,
  avatarSeed,
  isConnected = true,
  size = "md",
  ring = null,
  bob = false,
  hideStatus = false,
}: PlayerAvatarProps): React.ReactElement {
  const px = AVATAR_SIZE_PX[size];
  const ringPx = ring ? RING_PX[size] : 0;
  const statusPx = STATUS_PX[size];
  const outerPx = px + ringPx * 2;

  // Every dimension is expressed against --avatar-scale so a single custom
  // property on an ancestor (see the TV/projector block in global.css) can size
  // every avatar on a screen at once.
  const scaled = (value: number): string => `calc(${value}px * var(--avatar-scale, 1))`;

  const label = `${displayName}${isConnected ? "" : " (disconnected)"}`;

  const circleStyle: React.CSSProperties = {
    width: scaled(px),
    height: scaled(px),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-full)",
    flexShrink: 0,
    overflow: "hidden",
  };

  const circle = avatarSeed ? (
    <img
      src={getAvatarDataUri(avatarSeed)}
      alt=""
      width={px}
      height={px}
      style={{ ...circleStyle, display: "block", objectFit: "cover" }}
    />
  ) : (
    <span
      style={{
        ...circleStyle,
        backgroundColor: getColorForName(displayName),
        fontSize: FONT_SIZE[size],
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        color: "#000",
      }}
      aria-hidden="true"
    >
      {getInitials(displayName)}
    </span>
  );

  const className = [
    "player-avatar",
    isConnected ? "" : "player-avatar--disconnected",
    bob ? "player-avatar--bob" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: scaled(outerPx),
        height: scaled(outerPx),
        borderRadius: "var(--radius-full)",
        flexShrink: 0,
        opacity: isConnected ? 1 : 0.4,
        backgroundColor: "transparent",
        ...(ring
          ? {
              // The ring is drawn as a filled disc behind a slightly smaller
              // avatar, so the glow reads as light coming off the avatar itself.
              background: ring,
              boxShadow: `0 0 ${Math.round(px / 2)}px ${ring}80, 0 ${Math.max(2, Math.round(px / 14))}px ${Math.round(px / 4)}px rgba(0, 0, 0, 0.35)`,
            }
          : {}),
      }}
      role="img"
      aria-label={label}
    >
      {circle}
      {!hideStatus && (
        <span
          style={{
            position: "absolute",
            bottom: ringPx ? 0 : -1,
            insetInlineEnd: ringPx ? 0 : -1,
            width: scaled(statusPx),
            height: scaled(statusPx),
            borderRadius: "var(--radius-full)",
            backgroundColor: isConnected ? "var(--color-correct)" : "var(--color-text-secondary)",
            border: `${size === "sm" || size === "md" ? 2 : 3}px solid var(--color-bg)`,
            zIndex: 1,
          }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
