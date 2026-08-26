// src/client/views/presentation/QuestionScreen.tsx — Question display for presentation
// R5.3: Semantic HTML. R5.5: Animations via ReducedMotionProvider.
// R5.4: High contrast for screen-sharing. R5.8: aria-live for timer.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Timer } from "../../components/Timer";
import { QuestionMedia } from "../../components/QuestionMedia";
import type { QuestionMedia as QuestionMediaData } from "@/shared/media";
import { colors, spacing, radii, shadows } from "../../styles/theme";

interface PresentationQuestionScreenProps {
  /** Question text */
  questionText: string;
  /** Question number (1-based) */
  questionNumber: number;
  /** Total questions in the round */
  totalQuestions: number;
  /** Point value */
  pointValue: number;
  /** Round name or index */
  roundName: string;
  /** Timer seconds remaining (null if not active) */
  timerSeconds: number | null;
  /** Timer total seconds */
  timerTotal: number | null;
  /** Count of players who have answered */
  answeredCount: number;
  /** Total players */
  totalPlayers: number;
  /** Whether we're in the answering phase (vs question display) */
  isAnswering: boolean;
  /** Optional host-uploaded image shown with the question */
  media?: QuestionMediaData;
}

/**
 * Presentation question screen — shows question prominently with timer
 * and live answer count for a screen-share audience.
 */
export function PresentationQuestionScreen({
  questionText,
  questionNumber,
  totalQuestions,
  pointValue,
  roundName,
  timerSeconds,
  timerTotal,
  answeredCount,
  totalPlayers,
  isAnswering,
  media,
}: PresentationQuestionScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  // With an image on screen the headline gives up some of its size so both
  // still fit above the timer row on a 16:9 projector.
  const hasMedia = Boolean(media);

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
      {/* Round info bar */}
      <motion.p
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 300, damping: 25 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.25rem, 2.5vw, 2rem)",
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          margin: 0,
        }}
      >
        <span style={{ color: colors.accentPurple }}>{roundName}</span>
        {" · "}
        Question {questionNumber} of {totalQuestions}
        {" · "}
        <span style={{ color: colors.accentYellow }}>{pointValue} points</span>
      </motion.p>

      {/* Question text, with the image beside it on wide screens */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[8],
          width: "100%",
        }}
      >
        {media && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 250, damping: 20, delay: 0.1 }
            }
          >
            <QuestionMedia
              media={media}
              size="lg"
              questionNumber={questionNumber}
            />
          </motion.div>
        )}

        <motion.h2
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
              : { type: "spring", stiffness: 250, damping: 18, delay: 0.15 }
          }
          style={{
            fontFamily: "var(--font-display)",
            fontSize: hasMedia
              ? "clamp(1.5rem, 3.4vw, 3.25rem)"
              : "clamp(2rem, 6vw, 5.5rem)",
            fontWeight: 700,
            color: colors.text,
            textAlign: "center",
            lineHeight: 1.25,
            flex: hasMedia ? "1 1 380px" : undefined,
            maxWidth: hasMedia ? "min(640px, 90vw)" : "min(1400px, 90vw)",
            margin: 0,
            padding: hasMedia
              ? `clamp(1rem, 2vw, 2rem) clamp(1.25rem, 3vw, 3rem)`
              : `clamp(1.5rem, 3vw, 3rem) clamp(2rem, 5vw, 5rem)`,
            backgroundColor: `${colors.bgCard}cc`,
            borderRadius: radii.xl,
            border: `2px solid ${colors.primary}`,
            boxShadow: `0 0 40px rgba(59, 130, 246, 0.4), 0 0 80px rgba(59, 130, 246, 0.15)`,
            backdropFilter: "blur(12px)",
          }}
        >
          {questionText}
        </motion.h2>
      </div>

      {/* Timer and answer count row */}
      {isAnswering && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 300, damping: 25, delay: 0.3 }
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[12],
            flexWrap: "wrap",
          }}
        >
          {/* Timer */}
          {timerSeconds !== null && timerTotal !== null && (
            <Timer
              secondsRemaining={timerSeconds}
              totalSeconds={timerTotal}
              size="lg"
            />
          )}

          {/* Answer count */}
          <div
            style={{ textAlign: "center" }}
            aria-live="polite"
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3rem, 8vw, 7rem)",
                fontWeight: 700,
                color: colors.primary,
                margin: 0,
                lineHeight: 1,
              }}
            >
              {answeredCount}
              <span
                style={{
                  color: colors.textSecondary,
                  fontSize: "clamp(1rem, 3vw, 2.5rem)",
                }}
              >
                /{totalPlayers}
              </span>
            </p>
            <p
              style={{
                fontSize: "clamp(0.875rem, 1.5vw, 1.25rem)",
                color: colors.textSecondary,
                margin: 0,
              }}
            >
              players answered
            </p>
          </div>
        </motion.div>
      )}

      {/* Pre-answering state: "Get ready!" */}
      {!isAnswering && (
        <motion.p
          initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : {
                  scale: [1, 1.05, 1],
                  opacity: 1,
                }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : {
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  opacity: { duration: 0.3 },
                }
          }
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
            fontWeight: 700,
            color: colors.accentGreen,
            margin: 0,
          }}
        >
          Get ready to answer!
        </motion.p>
      )}
    </div>
  );
}
