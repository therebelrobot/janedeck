// src/client/views/presentation/components/TeamWinnerReveal.tsx — Podium-style team winner display
// Team equivalent of WinnerReveal.tsx — top 3 teams by name + member cluster, not folded
// into a single player-shaped card.
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion. R5.4: High contrast.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { TeamScoreEntry } from "@/shared/types";
import { TeamMemberAvatars } from "../../../components/TeamMemberAvatars";
import type { AvatarSize } from "../../../components/PlayerAvatar";
import { colors, spacing, radii } from "../../../styles/theme";
import { useCompactHeight } from "../../../hooks/useCompactHeight";

/** See WinnerReveal.tsx — same threshold, same reasoning. */
const COMPACT_HEIGHT_PX = 850;

interface TeamWinnerRevealProps {
  /** Top 3 teams (or fewer if not enough teams) */
  topTeams: TeamScoreEntry[];
  /** Callback when 1st place is revealed (to trigger confetti) */
  onFirstPlaceRevealed?: () => void;
}

interface PodiumStyle {
  bgColor: string;
  borderColor: string;
  nameColor: string;
  emoji: string;
  label: string;
  glowShadow: string;
  delay: number;
  fontSize: string;
  avatarSize: AvatarSize;
  badgeSize: string;
}

const PODIUM_CONFIG: PodiumStyle[] = [
  {
    bgColor: `${colors.accentYellow}20`,
    borderColor: colors.accentYellow,
    nameColor: colors.accentYellow,
    emoji: "👑",
    label: "1st",
    glowShadow: `0 0 60px rgba(250, 204, 21, 0.5), 0 0 120px rgba(250, 204, 21, 0.2)`,
    delay: 1.2,
    fontSize: "clamp(1.75rem, 4.5vw, 3rem)",
    avatarSize: "2xl",
    badgeSize: "clamp(2.5rem, 5vw, 4rem)",
  },
  {
    bgColor: `${colors.textSecondary}15`,
    borderColor: colors.textSecondary,
    nameColor: colors.text,
    emoji: "🥈",
    label: "2nd",
    glowShadow: `0 0 30px rgba(148, 163, 184, 0.35)`,
    delay: 0.6,
    fontSize: "clamp(1.4rem, 3.2vw, 2.4rem)",
    avatarSize: "xl",
    badgeSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
  },
  {
    bgColor: `${colors.accentOrange}15`,
    borderColor: colors.accentOrange,
    nameColor: colors.accentOrange,
    emoji: "🥉",
    label: "3rd",
    glowShadow: `0 0 30px rgba(249, 115, 22, 0.35)`,
    delay: 0.0,
    fontSize: "clamp(1.15rem, 2.7vw, 2rem)",
    avatarSize: "xl",
    badgeSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
  },
];

/** Same three places, sized for a short screen — see WinnerReveal.tsx. */
const COMPACT_PODIUM_CONFIG: PodiumStyle[] = [
  {
    ...PODIUM_CONFIG[0],
    fontSize: "clamp(1rem, 2.4vw, 1.5rem)",
    avatarSize: "lg",
    badgeSize: "clamp(1.4rem, 2.8vw, 1.9rem)",
  },
  {
    ...PODIUM_CONFIG[1],
    fontSize: "clamp(0.95rem, 1.9vw, 1.2rem)",
    avatarSize: "md",
    badgeSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
  },
  {
    ...PODIUM_CONFIG[2],
    fontSize: "clamp(0.95rem, 1.9vw, 1.2rem)",
    avatarSize: "md",
    badgeSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
  },
];

/**
 * Podium-style winner reveal for teams — same staggered-reveal choreography
 * as WinnerReveal, with team identity (name + member cluster) front and center.
 */
export function TeamWinnerReveal({
  topTeams,
  onFirstPlaceRevealed,
}: TeamWinnerRevealProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const compact = useCompactHeight(COMPACT_HEIGHT_PX);
  const activeConfig = compact ? COMPACT_PODIUM_CONFIG : PODIUM_CONFIG;

  const podiumOrder = [topTeams[1], topTeams[0], topTeams[2]];
  const configOrder = [activeConfig[1], activeConfig[0], activeConfig[2]];

  React.useEffect(() => {
    if (onFirstPlaceRevealed && topTeams.length > 0) {
      const timeout = setTimeout(
        () => onFirstPlaceRevealed(),
        prefersReducedMotion ? 100 : 1800,
      );
      return () => clearTimeout(timeout);
    }
  }, [onFirstPlaceRevealed, topTeams.length, prefersReducedMotion]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: compact ? spacing[3] : spacing[6],
        width: "100%",
        maxWidth: "min(1400px, 90vw)",
        // The podium takes a fixed share and no more: the final standings below
        // need a budget that doesn't move, or the board measuring itself into
        // that space never settles. Compact sizing above is what actually
        // shrinks the podium's real height to fit that share on a short screen.
        minHeight: compact ? "clamp(150px, 20vh, 220px)" : "clamp(240px, 26vh, 400px)",
        flexShrink: 0,
        padding: compact ? `${spacing[3]} 0` : `${spacing[6]} 0`,
      }}
      role="list"
      aria-label="Winning teams podium"
    >
      {podiumOrder.map((team, displayIndex) => {
        if (!team) return null;
        const config = configOrder[displayIndex];

        return (
          <motion.div
            key={team.teamId}
            role="listitem"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.7 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 200, damping: 15, delay: config.delay }
            }
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: compact ? spacing[1] : spacing[3],
              padding: compact ? spacing[3] : spacing[6],
              backgroundColor: config.bgColor,
              borderRadius: radii.xl,
              border: `2px solid ${config.borderColor}`,
              boxShadow: config.glowShadow,
              flex: displayIndex === 1 ? "1.3" : "1",
              minWidth: 0,
            }}
            aria-label={`${config.label} place: ${team.teamName} with ${team.score} points`}
          >
            {/* The team's faces are the trophy; the medal rides along as a badge */}
            <div style={{ position: "relative", lineHeight: 0, maxWidth: "100%" }}>
              <TeamMemberAvatars
                members={team.members}
                size={!compact && team.members.length > 3 ? "xl" : config.avatarSize}
                maxDisplay={4}
                ring={config.borderColor}
                align="center"
              />
              <span
                style={{
                  position: "absolute",
                  top: "-0.4em",
                  insetInlineStart: "-0.3em",
                  fontSize: config.badgeSize,
                  lineHeight: 1,
                  transform: "rotate(-15deg)",
                  filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5))",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
                aria-hidden="true"
              >
                {config.emoji}
              </span>
            </div>

            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: config.fontSize,
                fontWeight: 700,
                color: config.nameColor,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {team.teamName}
            </span>

            {/* Member names — the faces above already carry identity on a
                short screen, so this is the first line to go. */}
            {!compact && (
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: colors.textSecondary,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {team.members.map((m) => m.displayName).join(", ")}
              </span>
            )}

            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: compact ? "clamp(0.9rem, 1.8vw, 1.3rem)" : "clamp(1.25rem, 2.5vw, 2rem)",
                fontWeight: 700,
                color: colors.primaryLight,
              }}
            >
              {team.score.toLocaleString()} pts
            </span>

            {!compact && (
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {config.label} Place
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
