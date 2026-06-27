// src/client/components/Leaderboard.tsx — Animated score list with Framer layout
// R5.3: Uses semantic <ol> for ranked lists.
// R5.8: aria-label for screen readers.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ScoreEntry, ScoreChange } from "@/shared/types";
import { PlayerAvatar } from "./PlayerAvatar";

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
}: LeaderboardProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const displayed = entries.slice(0, maxDisplay);

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
    <ol className="leaderboard" aria-label="Leaderboard">
      <AnimatePresence mode="popLayout">
        {displayed.map((entry) => {
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

              <PlayerAvatar displayName={entry.displayName} isConnected />

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
    </ol>
  );
}
