// src/client/components/TeamLeaderboard.tsx — Team Play leaderboard
// Team equivalent of Leaderboard.tsx — teams are shown by name with their
// member avatars, not folded into a player-shaped row.
// R5.3: Uses semantic <ol> for ranked lists. R5.8: aria-label for screen readers.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { TeamScoreEntry, TeamScoreChange } from "@/shared/types";
import { TeamMemberAvatars } from "./TeamMemberAvatars";
import { colors } from "../styles/theme";

interface TeamLeaderboardProps {
  entries: TeamScoreEntry[];
  maxDisplay?: number;
  highlightTeamId?: string;
  showChanges?: boolean;
  scoreChanges?: TeamScoreChange[];
}

/**
 * Team leaderboard with layout animations for smooth reordering — teams are
 * the primary identity here (name + member cluster), matching Leaderboard's
 * per-player treatment one level up.
 */
export function TeamLeaderboard({
  entries,
  maxDisplay = 10,
  highlightTeamId,
  showChanges = false,
  scoreChanges = [],
}: TeamLeaderboardProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const displayed = entries.slice(0, maxDisplay);

  const changeMap = new Map<string, number>();
  if (showChanges) {
    for (const change of scoreChanges) {
      if (change.pointsEarned > 0) {
        changeMap.set(change.teamId, change.pointsEarned);
      }
    }
  }

  return (
    <ol className="leaderboard" aria-label="Team leaderboard">
      <AnimatePresence mode="popLayout">
        {displayed.map((entry) => {
          const isHighlighted = entry.teamId === highlightTeamId;
          const pointsEarned = changeMap.get(entry.teamId);

          return (
            <motion.li
              key={entry.teamId}
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
                alignItems: "center",
              }}
            >
              <span className="leaderboard__rank" aria-label={`Rank ${entry.rank}`}>
                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
              </span>

              <TeamMemberAvatars members={entry.members} size="sm" />

              <span className="leaderboard__name" style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 700 }}>{entry.teamName}</span>
                <span style={{ fontSize: "var(--text-xs)", color: colors.textSecondary, fontWeight: 400 }}>
                  {entry.members.map((m) => m.displayName).join(", ")}
                </span>
              </span>

              <span className="leaderboard__score" aria-label={`${entry.score} points`}>
                {entry.score.toLocaleString()}
              </span>

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
