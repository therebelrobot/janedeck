// src/client/views/presentation/components/TeamWinnerReveal.tsx — Podium-style team winner display
// Team equivalent of WinnerReveal.tsx — top 3 teams by name + member cluster, not folded
// into a single player-shaped card.
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion. R5.4: High contrast.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { TeamScoreEntry } from "@/shared/types";
import { TeamMemberAvatars } from "../../../components/TeamMemberAvatars";
import { colors, spacing, radii } from "../../../styles/theme";

interface TeamWinnerRevealProps {
  /** Top 3 teams (or fewer if not enough teams) */
  topTeams: TeamScoreEntry[];
  /** Callback when 1st place is revealed (to trigger confetti) */
  onFirstPlaceRevealed?: () => void;
}

const PODIUM_CONFIG = [
  {
    bgColor: `${colors.accentYellow}20`,
    borderColor: colors.accentYellow,
    nameColor: colors.accentYellow,
    emoji: "👑",
    label: "1st",
    glowShadow: `0 0 60px rgba(250, 204, 21, 0.5), 0 0 120px rgba(250, 204, 21, 0.2)`,
    delay: 1.2,
    fontSize: "clamp(1.75rem, 4.5vw, 3rem)",
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

  const podiumOrder = [topTeams[1], topTeams[0], topTeams[2]];
  const configOrder = [PODIUM_CONFIG[1], PODIUM_CONFIG[0], PODIUM_CONFIG[2]];

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
        gap: spacing[6],
        width: "100%",
        maxWidth: "min(1400px, 90vw)",
        minHeight: "clamp(300px, 35vh, 500px)",
        padding: `${spacing[8]} 0`,
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
              gap: spacing[3],
              padding: spacing[6],
              backgroundColor: config.bgColor,
              borderRadius: radii.xl,
              border: `2px solid ${config.borderColor}`,
              boxShadow: config.glowShadow,
              flex: displayIndex === 1 ? "1.3" : "1",
              minWidth: 0,
            }}
            aria-label={`${config.label} place: ${team.teamName} with ${team.score} points`}
          >
            <span style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }} aria-hidden="true">
              {config.emoji}
            </span>

            <TeamMemberAvatars members={team.members} size="md" maxDisplay={5} />

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

            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.25rem, 2.5vw, 2rem)",
                fontWeight: 700,
                color: colors.primaryLight,
              }}
            >
              {team.score.toLocaleString()} pts
            </span>

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
          </motion.div>
        );
      })}
    </div>
  );
}
