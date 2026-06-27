// src/client/views/presentation/components/WinnerReveal.tsx — Podium-style winner display
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R1.4: displayName is the chosen name. R5.4: High contrast colors.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ScoreEntry } from "@/shared/types";
import { PlayerAvatar } from "../../../components/PlayerAvatar";
import { colors, spacing, radii } from "../../../styles/theme";

interface WinnerRevealProps {
  /** Top 3 players (or fewer if not enough players) */
  topPlayers: ScoreEntry[];
  /** Callback when 1st place is revealed (to trigger confetti) */
  onFirstPlaceRevealed?: () => void;
}

/** Podium styling per position */
const PODIUM_CONFIG = [
  {
    // 1st place
    heightPercent: 100,
    bgColor: `${colors.accentYellow}20`,
    borderColor: colors.accentYellow,
    nameColor: colors.accentYellow,
    emoji: "👑",
    label: "1st",
    glowShadow: `0 0 40px rgba(250, 204, 21, 0.4)`,
    delay: 1.2,
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
  },
  {
    // 2nd place
    heightPercent: 75,
    bgColor: `${colors.textSecondary}15`,
    borderColor: colors.textSecondary,
    nameColor: colors.text,
    emoji: "🥈",
    label: "2nd",
    glowShadow: `0 0 20px rgba(148, 163, 184, 0.3)`,
    delay: 0.6,
    fontSize: "clamp(1.2rem, 3vw, 2rem)",
  },
  {
    // 3rd place
    heightPercent: 55,
    bgColor: `${colors.accentOrange}15`,
    borderColor: colors.accentOrange,
    nameColor: colors.accentOrange,
    emoji: "🥉",
    label: "3rd",
    glowShadow: `0 0 20px rgba(249, 115, 22, 0.3)`,
    delay: 0.0,
    fontSize: "clamp(1rem, 2.5vw, 1.75rem)",
  },
];

/**
 * Podium-style winner reveal with dramatic staggered reveals.
 * Reveals in order: 3rd → 2nd → 1st for suspense.
 */
export function WinnerReveal({
  topPlayers,
  onFirstPlaceRevealed,
}: WinnerRevealProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  // Rearrange for display: 2nd, 1st, 3rd (podium layout)
  const podiumOrder = [
    topPlayers[1], // 2nd place (left)
    topPlayers[0], // 1st place (center)
    topPlayers[2], // 3rd place (right)
  ];
  const configOrder = [
    PODIUM_CONFIG[1], // 2nd
    PODIUM_CONFIG[0], // 1st
    PODIUM_CONFIG[2], // 3rd
  ];

  // Trigger confetti when 1st place is revealed
  React.useEffect(() => {
    if (onFirstPlaceRevealed && topPlayers.length > 0) {
      const timeout = setTimeout(
        () => onFirstPlaceRevealed(),
        prefersReducedMotion ? 100 : 1800,
      );
      return () => clearTimeout(timeout);
    }
  }, [onFirstPlaceRevealed, topPlayers.length, prefersReducedMotion]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: spacing[4],
        width: "100%",
        maxWidth: 900,
        minHeight: 300,
        padding: `${spacing[8]} 0`,
      }}
      role="list"
      aria-label="Winner podium"
    >
      {podiumOrder.map((player, displayIndex) => {
        if (!player) return null;
        const config = configOrder[displayIndex];

        return (
          <motion.div
            key={player.playerId}
            role="listitem"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 60, scale: 0.7 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : {
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: config.delay,
                  }
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
              flex: displayIndex === 1 ? "1.3" : "1", // center column wider
              minWidth: 0,
            }}
            aria-label={`${config.label} place: ${player.displayName} with ${player.score} points`}
          >
            {/* Position emoji */}
            <span
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
              aria-hidden="true"
            >
              {config.emoji}
            </span>

            {/* Avatar */}
            <PlayerAvatar
              displayName={player.displayName}
              isConnected
              size="lg"
            />

            {/* Name */}
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
              {player.displayName}
            </span>

            {/* Score */}
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: colors.primaryLight,
              }}
            >
              {player.score.toLocaleString()} pts
            </span>

            {/* Position label */}
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
