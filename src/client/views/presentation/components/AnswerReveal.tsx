// src/client/views/presentation/components/AnswerReveal.tsx — Answer reveal display
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R5.4: Color contrast ≥ 4.5:1 on dark backgrounds.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colors, spacing, radii, shadows } from "../../../styles/theme";

interface AnswerRevealProps {
  /** The correct answer text */
  correctAnswer: string;
  /** Number of correct answers */
  correctCount: number;
  /** Number of incorrect answers */
  incorrectCount: number;
  /** Total number of answers */
  totalAnswers: number;
}

/**
 * Shows the correct answer prominently with correct/incorrect counts.
 * Used during REVIEWING/SCORE_REVEAL states on the presentation view.
 */
export function AnswerReveal({
  correctAnswer,
  correctCount,
  incorrectCount,
  totalAnswers,
}: AnswerRevealProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.01 }
          : { type: "spring", stiffness: 300, damping: 20 }
      }
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
        width: "100%",
        maxWidth: 700,
      }}
    >
      {/* Correct answer display */}
      <div
        style={{
          padding: `${spacing[6]} ${spacing[8]}`,
          backgroundColor: `${colors.correct}15`,
          borderRadius: radii.xl,
          border: `3px solid ${colors.correct}`,
          boxShadow: shadows.glowGreen,
          textAlign: "center",
          width: "100%",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing[2],
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Correct Answer
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 700,
            color: colors.correct,
            margin: 0,
            lineHeight: 1.2,
          }}
          aria-live="polite"
        >
          {correctAnswer}
        </p>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: spacing[6],
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Correct count */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { delay: 0.3, type: "spring", stiffness: 300, damping: 25 }
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[3],
            padding: `${spacing[3]} ${spacing[6]}`,
            backgroundColor: `${colors.correct}15`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.correct}40`,
          }}
          aria-label={`${correctCount} correct answers`}
        >
          <span style={{ fontSize: "var(--text-3xl)" }} aria-hidden="true">✓</span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 700,
              color: colors.correct,
            }}
          >
            {correctCount}
          </span>
          <span style={{ color: colors.textSecondary, fontSize: "var(--text-lg)" }}>
            correct
          </span>
        </motion.div>

        {/* Incorrect count */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { delay: 0.5, type: "spring", stiffness: 300, damping: 25 }
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[3],
            padding: `${spacing[3]} ${spacing[6]}`,
            backgroundColor: `${colors.incorrect}15`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.incorrect}40`,
          }}
          aria-label={`${incorrectCount} incorrect answers`}
        >
          <span style={{ fontSize: "var(--text-3xl)" }} aria-hidden="true">✗</span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 700,
              color: colors.incorrect,
            }}
          >
            {incorrectCount}
          </span>
          <span style={{ color: colors.textSecondary, fontSize: "var(--text-lg)" }}>
            not quite
          </span>
        </motion.div>
      </div>

      {/* Total answered */}
      {totalAnswers > 0 && (
        <p
          style={{
            color: colors.textSecondary,
            fontSize: "var(--text-base)",
            margin: 0,
          }}
        >
          {totalAnswers} {totalAnswers === 1 ? "answer" : "answers"} submitted
        </p>
      )}
    </motion.div>
  );
}
