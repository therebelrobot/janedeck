// src/client/views/player/components/SubmittedConfirmation.tsx — Submission confirmation
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R7.4: Positive, non-blame language.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colors, spacing, radii } from "../../../styles/theme";

interface SubmittedConfirmationProps {
  /** The submitted answer text */
  submittedAnswer: string;
  /** Optional timer seconds remaining */
  timerSeconds?: number | null;
}

/**
 * Confirmation display after a player submits their answer.
 * Shows a checkmark animation, their answer, and a waiting message.
 */
export function SubmittedConfirmation({
  submittedAnswer,
  timerSeconds,
}: SubmittedConfirmationProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.01 }
          : { type: "spring", stiffness: 400, damping: 30 }
      }
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[4],
        padding: spacing[6],
        backgroundColor: `${colors.correct}10`,
        borderRadius: radii.xl,
        border: `2px solid ${colors.correct}40`,
        width: "100%",
        textAlign: "center",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Checkmark */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : {
                type: "spring",
                stiffness: 400,
                damping: 15,
                delay: 0.15,
              }
        }
        style={{
          width: 64,
          height: 64,
          borderRadius: "var(--radius-full)",
          backgroundColor: colors.correct,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--text-3xl)",
          color: "#fff",
        }}
        aria-hidden="true"
      >
        ✓
      </motion.div>

      {/* Confirmation text */}
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: colors.correct,
          margin: 0,
        }}
      >
        Answer submitted!
      </h3>

      {/* Their answer */}
      <div
        style={{
          padding: `${spacing[3]} ${spacing[4]}`,
          backgroundColor: colors.bgCard,
          borderRadius: radii.md,
          border: `1px solid ${colors.border}`,
          maxWidth: "100%",
          wordBreak: "break-word",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing[1],
          }}
        >
          Your answer:
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 600,
            color: colors.text,
            margin: 0,
          }}
        >
          {submittedAnswer}
        </p>
      </div>

      {/* Waiting message */}
      <p
        style={{
          fontSize: "var(--text-base)",
          color: colors.textSecondary,
          margin: 0,
          fontStyle: "italic",
        }}
      >
        Waiting for other players...
      </p>

      {/* Timer still visible */}
      {timerSeconds !== null && timerSeconds !== undefined && timerSeconds > 0 && (
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            color: timerSeconds <= 5 ? colors.incorrect : colors.textSecondary,
            margin: 0,
          }}
        >
          {timerSeconds}s remaining
        </p>
      )}
    </motion.div>
  );
}
