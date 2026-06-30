// src/client/components/PlayerAvatar.tsx — Player avatar (DiceBear or initials fallback)
// R1.4: displayName is always the chosen name. R1.2: Unicode-safe.
// R5.8: Accessible label includes connection status.
import React from "react";
import { getAvatarDataUri } from "../utils/avatarUtils";

type AvatarSize = "sm" | "md" | "lg";

interface PlayerAvatarProps {
  /** Player's chosen display name — R1.4 */
  displayName: string;
  /** DiceBear avatar seed — when provided, shows a DiceBear avatar instead of initials */
  avatarSeed?: string | null;
  /** Whether the player is currently connected */
  isConnected?: boolean;
  /** Avatar size */
  size?: AvatarSize;
}

/** Bright, high-contrast avatar background colors (used for initials fallback only) */
const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
  "#F1948A", "#7FB3D8", "#73C6B6", "#F9E79F",
];

const SIZE_PX: Record<AvatarSize, number> = { sm: 32, md: 40, lg: 56 };
const SIZE_STYLES: Record<AvatarSize, { width: number; height: number; fontSize: string }> = {
  sm: { width: 32, height: 32, fontSize: "var(--text-sm)" },
  md: { width: 40, height: 40, fontSize: "var(--text-lg)" },
  lg: { width: 56, height: 56, fontSize: "var(--text-2xl)" },
};

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
 */
export function PlayerAvatar({
  displayName,
  avatarSeed,
  isConnected = true,
  size = "md",
}: PlayerAvatarProps): React.ReactElement {
  const sizeStyle = SIZE_STYLES[size];
  const px = SIZE_PX[size];

  const sharedWrapStyle: React.CSSProperties = {
    width: sizeStyle.width,
    height: sizeStyle.height,
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-full)",
    flexShrink: 0,
    opacity: isConnected ? 1 : 0.4,
    overflow: "hidden",
  };

  const statusDot = (
    <span
      style={{
        position: "absolute",
        bottom: -1,
        insetInlineEnd: -1,
        width: size === "sm" ? 8 : 10,
        height: size === "sm" ? 8 : 10,
        borderRadius: "var(--radius-full)",
        backgroundColor: isConnected ? "var(--color-correct)" : "var(--color-text-secondary)",
        border: "2px solid var(--color-bg)",
        zIndex: 1,
      }}
      aria-hidden="true"
    />
  );

  if (avatarSeed) {
    return (
      <span
        className={`player-avatar ${isConnected ? "" : "player-avatar--disconnected"}`}
        style={{ ...sharedWrapStyle, backgroundColor: "transparent" }}
        role="img"
        aria-label={`${displayName}${isConnected ? "" : " (disconnected)"}`}
      >
        <img
          src={getAvatarDataUri(avatarSeed)}
          alt=""
          width={px}
          height={px}
          style={{ display: "block", borderRadius: "var(--radius-full)" }}
        />
        {statusDot}
      </span>
    );
  }

  return (
    <span
      className={`player-avatar ${isConnected ? "" : "player-avatar--disconnected"}`}
      style={{
        ...sharedWrapStyle,
        backgroundColor: getColorForName(displayName),
        fontSize: sizeStyle.fontSize,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        color: "#000",
      }}
      role="img"
      aria-label={`${displayName}${isConnected ? "" : " (disconnected)"}`}
    >
      {getInitials(displayName)}
      {statusDot}
    </span>
  );
}
