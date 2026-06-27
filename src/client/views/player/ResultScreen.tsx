// src/client/views/player/ResultScreen.tsx — Score/result display for player
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R7.4: Non-blame language for incorrect answers ("Not quite..." not "Wrong!").
// R1.4: displayName is the chosen name.
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AnswerStatus, ScoreEntry } from "@/shared/types";
import { AnimatedScore } from "../../components/AnimatedScore";
import { Confetti } from "../../components/Confetti";
import { Leaderboard } from "../../components/Leaderboard";
import { colors, spacing, radii } from "../../styles/theme";

interface AnswerResult {
  questionId: string;
  status: AnswerStatus;
  pointsAwarded: number;
  bonusPoints: number;
  hostNote?: string;
}

interface ResultScreenProps {
  /** The answer result for the current question */
  answerResult: AnswerResult | null;
  /** Player's current total score */
  playerScore: number;
  /** Player's current rank */
  playerRank: number | null;
  /** Player's ID for highlighting on leaderboard */
  playerId: string | null;
  /** Current leaderboard */
  leaderboard: ScoreEntry[];
  /** Whether this is the game-over screen */
  isGameOver: boolean;
  /** Winner info (for game over) */
  winner?: { playerId: string; displayName: string; score: number } | null;
}

/** Status display config */
const STATUS_DISPLAY: Record<AnswerStatus, {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}> = {
  correct: {
    label: "Correct!",
    emoji: "🎉",
    color: colors.correct,
    bgColor: `${colors.correct}15`,
  },
  incorrect: {
    // R7.4: gentle language
    label: "Not quite...",
    emoji: "😊",
    color: colors.incorrect,
    bgColor: `${colors.incorrect}10`,
  },
  bonus: {
    label: "Bonus points!",
    emoji: "⭐",
    color: colors.bonus,
    bgColor: `${colors.bonus}15`,
  },
  pending: {
    label: "Checking...",
    emoji: "⏳",
    color: colors.textSecondary,
    bgColor: `${colors.bgElevated}`,
  },
};

/**
 * Player result screen — shows after each question's score reveal.
 * Displays answer result, score change, and rank.
 * Also handles game-over display.
 */
export function ResultScreen({
  answerResult,
  playerScore,
  playerRank,
  playerId,
  leaderboard,
  isGameOver,
  winner,
}: ResultScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);

  // Check if current player is the winner
  const isWinner = isGameOver && winner && playerId && winner.playerId === playerId;

  // Show confetti for winner
  React.useEffect(() => {
    if (isWinner) {
      setShowConfetti(true);
      const timeout = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timeout);
    }
  }, [isWinner]);

  // Game over screen
  if (isGameOver) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing[6],
          width: "100%",
        }}
      >
        <Confetti active={showConfetti} />

        {/* Game over title */}
        <motion.h2
          initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 200, damping: 15 }
          }
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-3xl)",
            fontWeight: 700,
            color: isWinner ? colors.accentYellow : colors.secondary,
            textAlign: "center",
            margin: 0,
          }}
        >
          {isWinner ? "🏆 You won!" : "🏆 Game Over!"}
        </motion.h2>

        {/* Final score */}
        <div
          style={{
            textAlign: "center",
            padding: spacing[4],
            backgroundColor: colors.bgCard,
            borderRadius: radii.xl,
            border: `1px solid ${colors.border}`,
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Final Score
          </p>
          <AnimatedScore score={playerScore} size="lg" showChange />
          {playerRank && (
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                color: colors.textSecondary,
                margin: `${spacing[2]} 0 0`,
              }}
            >
              {playerRank <= 3
                ? ["🥇", "🥈", "🥉"][playerRank - 1]
                : `#${playerRank}`}
              {" "}
              {playerRank === 1 ? "1st" : playerRank === 2 ? "2nd" : playerRank === 3 ? "3rd" : `${playerRank}th`} place
            </p>
          )}
        </div>

        {/* Leaderboard */}
        <Leaderboard
          entries={leaderboard}
          highlightPlayerId={playerId || undefined}
          maxDisplay={10}
        />

        {/* Thanks message */}
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            color: colors.textSecondary,
            textAlign: "center",
            margin: 0,
          }}
        >
          Thanks for playing! 🎉
        </p>
      </div>
    );
  }

  // Per-question result screen
  const status = answerResult?.status || "pending";
  const display = STATUS_DISPLAY[status];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[4],
        width: "100%",
      }}
    >
      {/* Result card */}
      {answerResult && (
        <motion.div
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { scale: 0.8, opacity: 0 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 300, damping: 20 }
          }
          style={{
            textAlign: "center",
            padding: spacing[6],
            backgroundColor: display.bgColor,
            borderRadius: radii.xl,
            border: `2px solid ${display.color}40`,
            width: "100%",
          }}
          role="status"
          aria-live="polite"
        >
          {/* Emoji */}
          <p
            style={{ fontSize: "var(--text-4xl)", margin: 0 }}
            aria-hidden="true"
          >
            {display.emoji}
          </p>

          {/* Status label */}
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: display.color,
              margin: `${spacing[2]} 0`,
            }}
          >
            {display.label}
          </h3>

          {/* Points awarded */}
          {answerResult.pointsAwarded > 0 && (
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: colors.correct,
                margin: 0,
              }}
            >
              +{answerResult.pointsAwarded} points
            </p>
          )}

          {/* Bonus points */}
          {answerResult.bonusPoints > 0 && (
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: colors.bonus,
                margin: `${spacing[1]} 0 0`,
              }}
            >
              +{answerResult.bonusPoints} bonus points!
            </p>
          )}

          {/* Host note */}
          {answerResult.hostNote && (
            <p
              style={{
                fontSize: "var(--text-base)",
                color: colors.textSecondary,
                fontStyle: "italic",
                margin: `${spacing[3]} 0 0`,
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: `${colors.bgCard}80`,
                borderRadius: radii.md,
              }}
            >
              💬 {answerResult.hostNote}
            </p>
          )}
        </motion.div>
      )}

      {/* Current score and rank */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          width: "100%",
          padding: `${spacing[3]} ${spacing[4]}`,
          backgroundColor: colors.bgCard,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              margin: 0,
            }}
          >
            Total Score
          </p>
          <AnimatedScore score={playerScore} size="md" showChange />
        </div>
        {playerRank && (
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: colors.textSecondary,
                margin: 0,
              }}
            >
              Your Rank
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-3xl)",
                fontWeight: 700,
                color: colors.accentYellow,
                margin: 0,
              }}
            >
              {playerRank <= 3
                ? ["🥇", "🥈", "🥉"][playerRank - 1]
                : `#${playerRank}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
