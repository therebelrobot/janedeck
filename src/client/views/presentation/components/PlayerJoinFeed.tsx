// src/client/views/presentation/components/PlayerJoinFeed.tsx — Animated player join wall
// R5.3: Semantic <ul>. R5.5: AnimatePresence respects reduced motion.
// R1.4: displayName is always the chosen name. R1.2: Unicode-safe.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PlayerAvatar, avatarRingColor } from "../../../components/PlayerAvatar";
import { colors } from "../../../styles/theme";
import { PLAYER_WALL_LADDER } from "../../../utils/rosterLayouts";
import { useFitToBox } from "../../../hooks/useFitToBox";

interface PlayerJoinEntry {
  playerId: string;
  displayName: string;
  avatarSeed?: string;
}

interface PlayerJoinFeedProps {
  /** List of joined players (most recent first) */
  players: PlayerJoinEntry[];
}

/**
 * Avatar wall showing players as they join the lobby — each face pops in at
 * full size with a colored halo, so the lobby fills up with people rather than
 * with rows of text. Older entries animate out once the wall is full.
 */
export function PlayerJoinFeed({ players }: PlayerJoinFeedProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  // The wall measures itself against the space the join code leaves it: four
  // faces get drawn big, seventy get drawn small, and only if even the smallest
  // face won't fit does the tail become a "+N more" tile. See useFitToBox.
  const { ref, step, visibleCount, hiddenCount } = useFitToBox<HTMLUListElement>(
    players.length,
    PLAYER_WALL_LADDER.length,
  );
  const layout = PLAYER_WALL_LADDER[Math.min(step, PLAYER_WALL_LADDER.length - 1)];
  const displayed = players.slice(0, visibleCount);

  return (
    <ul
      ref={ref}
      style={{
        listStyle: "none",
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(calc(${layout.tilePx}px * var(--avatar-scale, 1)), calc(${layout.tilePx}px * var(--avatar-scale, 1))))`,
        justifyContent: "center",
        alignContent: "center",
        gap: `${layout.gapPx}px ${Math.round(layout.gapPx / 2)}px`,
        width: "100%",
        padding: 0,
        margin: 0,
        // The box useFitToBox measures — see the team grid for the same pattern.
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
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
                : { opacity: 0, scale: 0.3, y: 30 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.4, y: -20 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : {
                    type: "spring",
                    stiffness: 420,
                    damping: 18,
                    layout: { type: "spring", stiffness: 300, damping: 30 },
                  }
            }
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: Math.round(layout.gapPx / 2),
              minWidth: 0,
            }}
          >
            <PlayerAvatar
              displayName={player.displayName}
              avatarSeed={player.avatarSeed}
              isConnected
              size={layout.size}
              ring={avatarRingColor(player.avatarSeed ?? player.displayName)}
              hideStatus
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: layout.namePx,
                fontWeight: 700,
                color: colors.text,
                textAlign: "center",
                maxWidth: "100%",
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

      {hiddenCount > 0 && (
        <li
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: layout.namePx,
            color: colors.textSecondary,
          }}
        >
          +{hiddenCount}
        </li>
      )}
    </ul>
  );
}
