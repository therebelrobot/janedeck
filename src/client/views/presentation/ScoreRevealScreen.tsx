// src/client/views/presentation/ScoreRevealScreen.tsx — Animated score reveal
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R5.4: High contrast colors for screen-sharing.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ScoreEntry, ScoreChange } from "@/shared/types";
import { Leaderboard } from "../../components/Leaderboard";
import { colors, spacing, radii, shadows } from "../../styles/theme";

interface ScoreRevealScreenProps {
  /** Current leaderboard */
  leaderboard: ScoreEntry[];
  /** Score changes for animated indicators */
  scoreChanges: ScoreChange[];
  /** Optional round index for round results */
  roundIndex?: number;
  /** Whether this is a round results view (vs question score reveal) */
  isRoundResults?: boolean;
  /** Round MVP info */
  roundMVP?: {
    displayName: string;
    roundScore: number;
  } | null;
}

/**
 * Score reveal screen for presentation view.
 * Shows animated leaderboard with score change indicators.
 * Used for both per-question score reveals and round results.
 */
export function ScoreRevealScreen({
  leaderboard,
  scoreChanges,
  roundIndex,
  isRoundResults = false,
  roundMVP,
}: ScoreRevealScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[8],
        width: "100%",
        minHeight: "80vh",
      }}
    >
      {/* Header */}
      <motion.h2
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 300, damping: 20 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: 700,
          color: isRoundResults ? colors.accentOrange : colors.accentPurple,
          textAlign: "center",
          margin: 0,
        }}
      >
        {isRoundResults
          ? `🏁 Round ${(roundIndex ?? 0) + 1} Complete`
          : "📊 Scores"}
      </motion.h2>

      {/* Round MVP */}
      {isRoundResults && roundMVP && (
        <motion.div
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { scale: 0.7, opacity: 0 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 200, damping: 15, delay: 0.2 }
          }
          style={{
            textAlign: "center",
            padding: `${spacing[4]} ${spacing[8]}`,
            backgroundColor: `${colors.accentYellow}15`,
            borderRadius: radii.xl,
            border: `2px solid ${colors.accentYellow}40`,
            boxShadow: `0 0 30px rgba(250, 204, 21, 0.2)`,
          }}
        >
          <p
            style={{
              fontSize: "var(--text-lg)",
              color: colors.textSecondary,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Round MVP
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 700,
              color: colors.accentYellow,
              margin: `${spacing[1]} 0`,
            }}
          >
            ⭐ {roundMVP.displayName}
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              color: colors.primaryLight,
              margin: 0,
            }}
          >
            {roundMVP.roundScore} points this round
          </p>
        </motion.div>
      )}

      {/* Leaderboard */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : {
                type: "spring",
                stiffness: 200,
                damping: 25,
                delay: isRoundResults && roundMVP ? 0.4 : 0.2,
              }
        }
        style={{
          width: "100%",
          maxWidth: 700,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Leaderboard
          entries={leaderboard}
          showChanges={!isRoundResults}
          scoreChanges={scoreChanges}
          maxDisplay={10}
        />
      </motion.div>
    </div>
  );
}
