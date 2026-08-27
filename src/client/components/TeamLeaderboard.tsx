// src/client/components/TeamLeaderboard.tsx — Team Play leaderboard
// Team equivalent of Leaderboard.tsx — teams are shown by name with their
// member avatars, not folded into a player-shaped row.
// R5.3: Uses semantic <ol> for ranked lists. R5.8: aria-label for screen readers.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { TeamScoreEntry, TeamScoreChange } from "@/shared/types";
import { TeamMemberAvatars } from "./TeamMemberAvatars";
import { colors, rankRingColors } from "../styles/theme";
import { LEADERBOARD_LADDER } from "../utils/rosterLayouts";
import { useFitToBox } from "../hooks/useFitToBox";

interface TeamLeaderboardProps {
  entries: TeamScoreEntry[];
  maxDisplay?: number;
  highlightTeamId?: string;
  showChanges?: boolean;
  scoreChanges?: TeamScoreChange[];
  /** Avatar size — bump to "lg" on the shared screen, keep "sm" on handsets */
  avatarSize?: "sm" | "md" | "lg";
  /**
   * Shared-screen mode: the board fills the height it's given and shrinks its
   * rows to fit, rather than running off the bottom of a projector. Leave off
   * anywhere the page can simply scroll.
   */
  constrainHeight?: boolean;
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
  avatarSize = "sm",
  constrainHeight = false,
}: TeamLeaderboardProps): React.ReactElement {
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

  const changeMap = new Map<string, number>();
  if (showChanges) {
    for (const change of scoreChanges) {
      if (change.pointsEarned > 0) {
        changeMap.set(change.teamId, change.pointsEarned);
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
      aria-label="Team leaderboard"
    >
      <AnimatePresence mode="popLayout">
        {rows.map((entry) => {
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

              <TeamMemberAvatars
                members={entry.members}
                size={rowAvatar}
                // The row still has to fit a team name and a score — a big
                // roster gets clipped to "+N" rather than eating the name, and
                // a dense board gives up another face for the same reason.
                maxDisplay={displayed.length > 8 ? 3 : 4}
                ring={entry.rank <= 3 ? rankRingColors[entry.rank - 1] : null}
              />

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

      {notShown > 0 && (
        <li className="leaderboard__entry" style={{ justifyContent: "center", color: "var(--color-text-secondary)" }}>
          +{notShown} more teams
        </li>
      )}
    </ol>
  );
}
