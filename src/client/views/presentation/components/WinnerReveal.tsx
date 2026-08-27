// src/client/views/presentation/components/WinnerReveal.tsx — Podium-style winner display
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R1.4: displayName is the chosen name. R5.4: High contrast colors.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ScoreEntry } from "@/shared/types";
import { PlayerAvatar, type AvatarSize } from "../../../components/PlayerAvatar";
import { colors, spacing, radii } from "../../../styles/theme";
import { useCompactHeight } from "../../../hooks/useCompactHeight";

/**
 * Below this viewport height (a 768px conference display, a 800px laptop
 * share), the podium's width-driven type scale (vw clamps) no longer leaves
 * room for the final-standings board underneath it — the podium doesn't
 * shrink on its own just because the screen got shorter. This steps every
 * size down a notch instead.
 */
const COMPACT_HEIGHT_PX = 850;

interface WinnerRevealProps {
  /** Top 3 players (or fewer if not enough players) */
  topPlayers: ScoreEntry[];
  /** Callback when 1st place is revealed (to trigger confetti) */
  onFirstPlaceRevealed?: () => void;
}

interface PodiumStyle {
  heightPercent: number;
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

/** Podium styling per position */
const PODIUM_CONFIG: PodiumStyle[] = [
  {
    // 1st place
    heightPercent: 100,
    bgColor: `${colors.accentYellow}20`,
    borderColor: colors.accentYellow,
    nameColor: colors.accentYellow,
    emoji: "👑",
    label: "1st",
    glowShadow: `0 0 60px rgba(250, 204, 21, 0.5), 0 0 120px rgba(250, 204, 21, 0.2)`,
    delay: 1.2,
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    avatarSize: "2xl",
    badgeSize: "clamp(2.5rem, 5vw, 4rem)",
  },
  {
    // 2nd place
    heightPercent: 75,
    bgColor: `${colors.textSecondary}15`,
    borderColor: colors.textSecondary,
    nameColor: colors.text,
    emoji: "🥈",
    label: "2nd",
    glowShadow: `0 0 30px rgba(148, 163, 184, 0.35)`,
    delay: 0.6,
    fontSize: "clamp(1.5rem, 3.5vw, 2.75rem)",
    avatarSize: "xl",
    badgeSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
  },
  {
    // 3rd place
    heightPercent: 55,
    bgColor: `${colors.accentOrange}15`,
    borderColor: colors.accentOrange,
    nameColor: colors.accentOrange,
    emoji: "🥉",
    label: "3rd",
    glowShadow: `0 0 30px rgba(249, 115, 22, 0.35)`,
    delay: 0.0,
    fontSize: "clamp(1.25rem, 3vw, 2.25rem)",
    avatarSize: "xl",
    badgeSize: "clamp(1.75rem, 3.5vw, 2.75rem)",
  },
];

/** Same three places, sized for a short screen — smaller faces and type, so
 *  the final-standings board below the podium keeps a real share of the room. */
const COMPACT_PODIUM_CONFIG: PodiumStyle[] = [
  {
    ...PODIUM_CONFIG[0],
    fontSize: "clamp(1.1rem, 2.6vw, 1.6rem)",
    avatarSize: "lg",
    badgeSize: "clamp(1.4rem, 2.8vw, 1.9rem)",
  },
  {
    ...PODIUM_CONFIG[1],
    fontSize: "clamp(1rem, 2vw, 1.3rem)",
    avatarSize: "md",
    badgeSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
  },
  {
    ...PODIUM_CONFIG[2],
    fontSize: "clamp(1rem, 2vw, 1.3rem)",
    avatarSize: "md",
    badgeSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
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
  const compact = useCompactHeight(COMPACT_HEIGHT_PX);
  const activeConfig = compact ? COMPACT_PODIUM_CONFIG : PODIUM_CONFIG;

  // Rearrange for display: 2nd, 1st, 3rd (podium layout)
  const podiumOrder = [
    topPlayers[1], // 2nd place (left)
    topPlayers[0], // 1st place (center)
    topPlayers[2], // 3rd place (right)
  ];
  const configOrder = [
    activeConfig[1], // 2nd
    activeConfig[0], // 1st
    activeConfig[2], // 3rd
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
        gap: compact ? spacing[3] : spacing[6],
        width: "100%",
        maxWidth: "min(1400px, 90vw)",
        // The podium takes a fixed share and no more: the final standings below
        // need a budget that doesn't move, or the board measuring itself into
        // that space never settles. The compact sizing above is what actually
        // brings the podium's real height down to that share on a short screen —
        // this floor alone can't shrink content that's driven by vw clamps.
        minHeight: compact ? "clamp(150px, 20vh, 220px)" : "clamp(240px, 26vh, 400px)",
        flexShrink: 0,
        padding: compact ? `${spacing[3]} 0` : `${spacing[6]} 0`,
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
              gap: compact ? spacing[1] : spacing[3],
              padding: compact ? spacing[3] : spacing[6],
              backgroundColor: config.bgColor,
              borderRadius: radii.xl,
              border: `2px solid ${config.borderColor}`,
              boxShadow: config.glowShadow,
              flex: displayIndex === 1 ? "1.3" : "1", // center column wider
              minWidth: 0,
            }}
            aria-label={`${config.label} place: ${player.displayName} with ${player.score} points`}
          >
            {/* Avatar — the face is the trophy here; the medal rides along as a badge */}
            <div style={{ position: "relative", lineHeight: 0 }}>
              <PlayerAvatar
                displayName={player.displayName}
                avatarSeed={player.avatarSeed}
                isConnected
                size={config.avatarSize}
                ring={config.borderColor}
                bob={displayIndex === 1}
                hideStatus
              />
              <span
                style={{
                  position: "absolute",
                  top: "-0.35em",
                  insetInlineStart: "-0.25em",
                  fontSize: config.badgeSize,
                  lineHeight: 1,
                  transform: "rotate(-15deg)",
                  filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5))",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              >
                {config.emoji}
              </span>
            </div>

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
                fontSize: compact ? "clamp(0.9rem, 1.8vw, 1.3rem)" : "clamp(1.25rem, 2.5vw, 2rem)",
                fontWeight: 700,
                color: colors.primaryLight,
              }}
            >
              {player.score.toLocaleString()} pts
            </span>

            {/* Position label — the podium's position already carries this on a
                short screen, so it's the first thing to go. */}
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
