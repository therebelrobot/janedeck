// src/client/components/Leaderboard.tsx — Animated score list with Framer layout
// R5.3: Uses semantic <ol> for ranked lists.
// R5.8: aria-label for screen readers.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ScoreEntry, ScoreChange } from "@/shared/types";
import { PlayerAvatar } from "./PlayerAvatar";
import { rankRingColors } from "../styles/theme";
import { LEADERBOARD_LADDER } from "../utils/rosterLayouts";
import { useFitToBox } from "../hooks/useFitToBox";

interface LeaderboardProps {
  /** Sorted leaderboard entries */
  entries: ScoreEntry[];
  /** Maximum number of entries to display */
  maxDisplay?: number;
  /** Player ID to highlight (current player) */
  highlightPlayerId?: string;
  /** Whether to show "+X" change indicators */
  showChanges?: boolean;
  /** Score changes for the "+X" indicators */
  scoreChanges?: ScoreChange[];
  /** Avatar size — bump to "lg" on the shared screen, keep "md" on handsets */
  avatarSize?: "md" | "lg";
  /**
   * Shared-screen mode: the board fills the height it's given and shrinks its
   * rows to fit, rather than running off the bottom of a projector. Leave off
   * anywhere the page can simply scroll.
   */
  constrainHeight?: boolean;
}

/**
 * Leaderboard with layout animations for smooth reordering.
 * Uses AnimatePresence for enter/exit and layout prop for reorder.
 */
export function Leaderboard({
  entries,
  maxDisplay = 10,
  highlightPlayerId,
  showChanges = false,
  scoreChanges = [],
  avatarSize = "md",
  constrainHeight = false,
}: LeaderboardProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const displayed = entries.slice(0, maxDisplay);
  // A long board has to fit under its own title on a screen nobody can scroll,
  // so the rows shrink first and the board drops places only as a last resort.
  const fit = useFitToBox<HTMLOListElement>(displayed.length, LEADERBOARD_LADDER.length);
  const laddered = LEADERBOARD_LADDER[Math.min(fit.step, LEADERBOARD_LADDER.length - 1)];
  const rowAvatar =
    LEADERBOARD_LADDER.indexOf(avatarSize as (typeof LEADERBOARD_LADDER)[number]) >
    LEADERBOARD_LADDER.indexOf(laddered)
      ? laddered
      : avatarSize;
  const rows = displayed.slice(0, fit.visibleCount);
  // Everyone off the board, not just the rows the fit pass dropped — maxDisplay
  // has usually cut some before it ever gets measured, and a tile that
  // undercounts them is worse than no tile at all.
  const notShown = entries.length - rows.length;

  // Build a map of playerId → pointsEarned for quick lookup
  const changeMap = new Map<string, number>();
  if (showChanges) {
    for (const change of scoreChanges) {
      if (change.pointsEarned > 0) {
        changeMap.set(change.playerId, change.pointsEarned);
      }
    }
  }

  return (
    <ol
      ref={fit.ref}
      className={`leaderboard${displayed.length > 8 ? " leaderboard--dense" : ""}`}
      style={
        constrainHeight
          ? { flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }
          : undefined
      }
      aria-label="Leaderboard"
    >
      <AnimatePresence mode="popLayout">
        {rows.map((entry) => {
          const isHighlighted = entry.playerId === highlightPlayerId;
          const pointsEarned = changeMap.get(entry.playerId);

          return (
            <motion.li
              key={entry.playerId}
              layout={!prefersReducedMotion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="leaderboard__entry"
              style={{
                ...(isHighlighted && {
                  borderLeft: "3px solid var(--color-primary)",
                  backgroundColor: "var(--color-bg-elevated)",
                }),
              }}
            >
              <span className="leaderboard__rank" aria-label={`Rank ${entry.rank}`}>
                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
              </span>

              <PlayerAvatar
                displayName={entry.displayName}
                avatarSeed={entry.avatarSeed}
                isConnected
                size={rowAvatar}
                ring={entry.rank <= 3 ? rankRingColors[entry.rank - 1] : null}
                hideStatus
              />

              <span className="leaderboard__name">{entry.displayName}</span>

              <span className="leaderboard__score" aria-label={`${entry.score} points`}>
                {entry.score.toLocaleString()}
              </span>

              {/* Score change indicator */}
              {showChanges && pointsEarned !== undefined && pointsEarned > 0 && (
                <motion.span
                  className="leaderboard__change"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -20 }}
                  transition={{ duration: 2, delay: 0.5 }}
                  style={{
                    color: "var(--color-correct)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "var(--text-sm)",
                    marginInlineStart: "var(--space-2)",
                  }}
                  aria-label={`gained ${pointsEarned} points`}
                >
                  +{pointsEarned}
                </motion.span>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>

      {notShown > 0 && (
        <li className="leaderboard__entry" style={{ justifyContent: "center", color: "var(--color-text-secondary)" }}>
          +{notShown} more players
        </li>
      )}
    </ol>
  );
}
