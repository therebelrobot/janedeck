// src/client/views/presentation/components/PlayerJoinFeed.tsx — Animated player join list
// R5.3: Semantic <ul>. R5.5: AnimatePresence respects reduced motion.
// R1.4: displayName is always the chosen name. R1.2: Unicode-safe.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PlayerAvatar } from "../../../components/PlayerAvatar";
import { colors, spacing, radii } from "../../../styles/theme";

interface PlayerJoinEntry {
  playerId: string;
  displayName: string;
  avatarSeed?: string;
}

interface PlayerJoinFeedProps {
  /** List of joined players (most recent first) */
  players: PlayerJoinEntry[];
  /** Maximum entries to display */
  maxDisplay?: number;
}

/**
 * Animated feed showing players as they join the lobby.
 * Each name slides in from the right with a pop animation.
 * Shows the most recent 8-10 players, older ones animate out.
 */
export function PlayerJoinFeed({
  players,
  maxDisplay = 10,
}: PlayerJoinFeedProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const displayed = players.slice(0, maxDisplay);

  return (
    <ul
      style={{
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: spacing[2],
        width: "100%",
        maxWidth: 500,
        padding: 0,
        margin: 0,
      }}
      aria-label="Players who have joined"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {displayed.map((player) => (
          <motion.li
            key={player.playerId}
            layout={!prefersReducedMotion}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 80, scale: 0.8 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, x: 0, scale: 1 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, x: -40, scale: 0.8 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : {
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                  }
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              padding: `${spacing[2]} ${spacing[4]}`,
              backgroundColor: `${colors.bgCard}`,
              borderRadius: radii.lg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <PlayerAvatar displayName={player.displayName} avatarSeed={player.avatarSeed} isConnected size="md" />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                fontWeight: 600,
                color: colors.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {player.displayName}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
