// src/client/components/TeamMemberAvatars.tsx — Overlapping row of team member avatars
// R1.4: displayName is the chosen name. R5.8: each avatar carries an accessible label.
import React from "react";
import type { TeamMemberInfo } from "@/shared/types";
import { PlayerAvatar } from "./PlayerAvatar";
import { colors } from "../styles/theme";

type AvatarSize = "sm" | "md" | "lg";

interface TeamMemberAvatarsProps {
  members: TeamMemberInfo[];
  size?: AvatarSize;
  maxDisplay?: number;
}

const OVERLAP: Record<AvatarSize, number> = { sm: 10, md: 12, lg: 16 };

/**
 * Overlapping cluster of teammate avatars — the visual identity of a team
 * wherever it appears (leaderboards, podiums, rosters).
 */
export function TeamMemberAvatars({
  members,
  size = "sm",
  maxDisplay = 6,
}: TeamMemberAvatarsProps): React.ReactElement {
  const shown = members.slice(0, maxDisplay);
  const overflow = members.length - shown.length;

  return (
    <div
      style={{ display: "flex", alignItems: "center" }}
      role="group"
      aria-label={`Team members: ${members.map((m) => m.displayName).join(", ")}`}
    >
      {shown.map((member, i) => (
        <div
          key={member.id}
          style={{
            marginInlineStart: i === 0 ? 0 : -OVERLAP[size],
            border: `2px solid ${colors.bg}`,
            borderRadius: "var(--radius-full)",
            lineHeight: 0,
          }}
        >
          <PlayerAvatar displayName={member.displayName} avatarSeed={member.avatarSeed} isConnected size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginInlineStart: -OVERLAP[size],
            width: size === "sm" ? 32 : size === "md" ? 40 : 56,
            height: size === "sm" ? 32 : size === "md" ? 40 : 56,
            borderRadius: "var(--radius-full)",
            border: `2px solid ${colors.bg}`,
            backgroundColor: colors.bgElevated,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "var(--text-xs)",
            fontWeight: 700,
            color: colors.textSecondary,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
