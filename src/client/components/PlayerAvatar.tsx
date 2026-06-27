// src/client/components/PlayerAvatar.tsx — Color-coded player indicator
// R1.4: displayName is always the chosen name. R1.2: Unicode-safe.
// R5.8: Accessible label includes connection status.
import React from "react";

type AvatarSize = "sm" | "md" | "lg";

interface PlayerAvatarProps {
  /** Player's chosen display name — R1.4 */
  displayName: string;
  /** Whether the player is currently connected */
  isConnected?: boolean;
  /** Avatar size */
  size?: AvatarSize;
}

/** Bright, high-contrast avatar background colors */
const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
  "#F1948A", "#7FB3D8", "#73C6B6", "#F9E79F",
];

const SIZE_STYLES: Record<AvatarSize, { width: number; height: number; fontSize: string }> = {
  sm: { width: 32, height: 32, fontSize: "var(--text-sm)" },
  md: { width: 40, height: 40, fontSize: "var(--text-lg)" },
  lg: { width: 56, height: 56, fontSize: "var(--text-2xl)" },
};

/**
 * Generate a deterministic color from a name string.
 * Uses a simple hash to map any Unicode string to a color index.
 */
function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Get the initial letter(s) for display.
 * Handles Unicode properly — uses the first grapheme cluster.
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";

  // Use Array.from to handle multi-byte Unicode characters properly — R1.2
  const chars = Array.from(trimmed);
  const first = chars[0].toUpperCase();

  // If the name has multiple words, show first letter of each (max 2)
  const words = trimmed.split(/\s+/);
  if (words.length > 1 && words[1].length > 0) {
    const second = Array.from(words[1])[0].toUpperCase();
    return `${first}${second}`;
  }

  return first;
}

/**
 * Player avatar with deterministic color from name hash.
 * Shows initials and optional connection status indicator.
 */
export function PlayerAvatar({
  displayName,
  isConnected = true,
  size = "md",
}: PlayerAvatarProps): React.ReactElement {
  const color = getColorForName(displayName);
  const initials = getInitials(displayName);
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      className={`player-avatar ${isConnected ? "" : "player-avatar--disconnected"}`}
      style={{
        backgroundColor: color,
        width: sizeStyle.width,
        height: sizeStyle.height,
        fontSize: sizeStyle.fontSize,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-full)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        color: "#000",
        flexShrink: 0,
        opacity: isConnected ? 1 : 0.4,
      }}
      role="img"
      aria-label={`${displayName}${isConnected ? "" : " (disconnected)"}`}
    >
      {initials}

      {/* Connection status dot */}
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
        }}
        aria-hidden="true"
      />
    </span>
  );
}
