// src/client/views/audience/AudienceLeaderboard.tsx — Live leaderboard for audience
// R5.3: Semantic <ol>. R5.5: Animations respect prefers-reduced-motion.
// R1.4: displayName is the chosen name.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ScoreEntry } from "@/shared/types";
import { PlayerAvatar } from "../../components/PlayerAvatar";
import { colors, spacing, radii } from "../../styles/theme";

interface AudienceLeaderboardProps {
  /** Sorted leaderboard entries */
  entries: ScoreEntry[];
  /** Maximum entries to display */
  maxDisplay?: number;
}

/**
 * Compact leaderboard for audience view.
 * Always visible, animated updates with highlighted changes.
 */
export function AudienceLeaderboard({
  entries,
  maxDisplay = 20,
}: AudienceLeaderboardProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const displayed = entries.slice(0, maxDisplay);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: spacing[2],
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-lg)",
          fontWeight: 700,
          color: colors.textSecondary,
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        📊 Leaderboard
      </h3>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: spacing[1],
        }}
        aria-label="Leaderboard"
      >
        <AnimatePresence mode="popLayout">
          {displayed.map((entry) => (
            <motion.li
              key={entry.playerId}
              layout={!prefersReducedMotion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[2],
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: colors.bgCard,
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
                fontSize: "var(--text-sm)",
              }}
            >
              {/* Rank */}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  minWidth: "2em",
                  textAlign: "center",
                  color: colors.accentYellow,
                  fontSize: "var(--text-base)",
                }}
                aria-label={`Rank ${entry.rank}`}
              >
                {entry.rank <= 3
                  ? ["🥇", "🥈", "🥉"][entry.rank - 1]
                  : `#${entry.rank}`}
              </span>

              {/* Avatar */}
              <PlayerAvatar displayName={entry.displayName} avatarSeed={entry.avatarSeed} isConnected size="sm" />

              {/* Name */}
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: colors.text,
                }}
              >
                {entry.displayName}
              </span>

              {/* Score */}
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: colors.primaryLight,
                  whiteSpace: "nowrap",
                }}
                aria-label={`${entry.score} points`}
              >
                {entry.score.toLocaleString()}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {entries.length === 0 && (
        <p
          style={{
            color: colors.textSecondary,
            fontSize: "var(--text-sm)",
            textAlign: "center",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          No scores yet
        </p>
      )}
    </div>
  );
}
