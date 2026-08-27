// src/client/components/TeamMemberAvatars.tsx — Overlapping row of team member avatars
// R1.4: displayName is the chosen name. R5.8: each avatar carries an accessible label.
import React from "react";
import type { TeamMemberInfo } from "@/shared/types";
import { PlayerAvatar, AVATAR_SIZE_PX } from "./PlayerAvatar";
import { colors } from "../styles/theme";

type AvatarSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

interface TeamMemberAvatarsProps {
  members: TeamMemberInfo[];
  size?: AvatarSize;
  maxDisplay?: number;
  /** Bold ring + glow around every member — for hero placements (podium, lobby) */
  ring?: string | null;
  /** Center the cluster rather than starting it inline */
  align?: "start" | "center";
}

/** Avatars overlap by ~28% of their width at every size, so the cluster reads the same big or small */
function overlapFor(size: AvatarSize): number {
  return Math.round(AVATAR_SIZE_PX[size] * 0.28);
}

/** The cut-out gap between overlapping avatars scales too, or it vanishes at large sizes */
function cutoutFor(size: AvatarSize): number {
  return Math.max(2, Math.round(AVATAR_SIZE_PX[size] * 0.05));
}

/**
 * Overlapping cluster of teammate avatars — the visual identity of a team
 * wherever it appears (leaderboards, podiums, rosters).
 */
export function TeamMemberAvatars({
  members,
  size = "sm",
  maxDisplay = 6,
  ring = null,
  align = "start",
}: TeamMemberAvatarsProps): React.ReactElement {
  // A "+1" bubble is exactly as wide as the face it replaces, so hiding a
  // single member buys nothing and costs the room a face.
  const shown = members.length === maxDisplay + 1 ? members : members.slice(0, maxDisplay);
  const overflow = members.length - shown.length;
  const overlap = overlapFor(size);
  const cutout = cutoutFor(size);
  const px = AVATAR_SIZE_PX[size];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
      role="group"
      aria-label={`Team members: ${members.map((m) => m.displayName).join(", ")}`}
    >
      {shown.map((member, i) => (
        <div
          key={member.id}
          style={{
            marginInlineStart: i === 0 ? 0 : `calc(${-overlap}px * var(--avatar-scale, 1))`,
            border: `${cutout}px solid ${colors.bg}`,
            borderRadius: "var(--radius-full)",
            lineHeight: 0,
            // Later avatars sit on top of earlier ones, so the cluster reads
            // left-to-right like a stack of cards rather than a muddle.
            zIndex: i,
          }}
        >
          <PlayerAvatar
            displayName={member.displayName}
            avatarSeed={member.avatarSeed}
            isConnected
            size={size}
            ring={ring}
            hideStatus
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginInlineStart: `calc(${-overlap}px * var(--avatar-scale, 1))`,
            width: `calc(${px}px * var(--avatar-scale, 1))`,
            height: `calc(${px}px * var(--avatar-scale, 1))`,
            borderRadius: "var(--radius-full)",
            border: `${cutout}px solid ${colors.bg}`,
            backgroundColor: colors.bgElevated,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: px >= 88 ? "var(--text-2xl)" : px >= 56 ? "var(--text-base)" : "var(--text-xs)",
            fontWeight: 700,
            color: colors.textSecondary,
            flexShrink: 0,
            zIndex: shown.length,
          }}
          aria-hidden="true"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
