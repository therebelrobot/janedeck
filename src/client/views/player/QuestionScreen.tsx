// src/client/views/player/QuestionScreen.tsx — Player question + answer screen
// R5.3: Semantic HTML. R5.5: Animations via ReducedMotionProvider.
// R5.6: aria-live for timer updates. R5.2: Large touch targets.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Timer } from "../../components/Timer";
import { AnimatedScore } from "../../components/AnimatedScore";
import { AnswerInput } from "./components/AnswerInput";
import { MultipleChoice } from "./components/MultipleChoice";
import { SubmittedConfirmation } from "./components/SubmittedConfirmation";
import { colors, spacing, radii } from "../../styles/theme";

interface PlayerQuestionScreenProps {
  /** Question text */
  questionText: string;
  /** Question type */
  questionType: "text" | "multiple-choice" | "true-false";
  /** Multiple choice options (if applicable) */
  choices?: string[];
  /** Question number (1-based) */
  questionNumber: number;
  /** Total questions */
  totalQuestions: number;
  /** Point value */
  pointValue: number;
  /** Timer seconds remaining */
  timerSeconds: number | null;
  /** Timer total seconds */
  timerTotal: number | null;
  /** Whether we're in ANSWERING phase (vs QUESTION_DISPLAY) */
  isAnswering: boolean;
  /** Whether the player has submitted */
  hasSubmitted: boolean;
  /** The submitted answer text (if submitted) */
  submittedAnswer: string;
  /** Player's current score */
  playerScore: number;
  /** Whether answer is being sent */
  isSubmitting: boolean;
  /** Called when the player submits an answer */
  onSubmitAnswer: (answer: string) => void;
  /** Whether we're in REVIEWING phase */
  isReviewing: boolean;
}

/**
 * Player's question screen — shows question text, timer, and answer input.
 * After submission, shows confirmation. During REVIEWING, shows waiting state.
 */
export function PlayerQuestionScreen({
  questionText,
  questionType,
  choices,
  questionNumber,
  totalQuestions,
  pointValue,
  timerSeconds,
  timerTotal,
  isAnswering,
  hasSubmitted,
  submittedAnswer,
  playerScore,
  isSubmitting,
  onSubmitAnswer,
  isReviewing,
}: PlayerQuestionScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[4],
        width: "100%",
      }}
    >
      {/* Score header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing[2]} ${spacing[3]}`,
          backgroundColor: colors.bgCard,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
          }}
        >
          Q{questionNumber}/{totalQuestions} · {pointValue} pts
        </span>

        {/* Timer */}
        {isAnswering && timerSeconds !== null && timerTotal !== null && (
          <Timer
            secondsRemaining={timerSeconds}
            totalSeconds={timerTotal}
            size="sm"
          />
        )}

        {/* Score */}
        <AnimatedScore score={playerScore} size="sm" label={`Your score: ${playerScore}`} />
      </div>

      {/* Question text */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 300, damping: 25 }
        }
        style={{
          padding: spacing[4],
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          border: `2px solid ${colors.primary}`,
          boxShadow: "var(--shadow-glow)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: colors.text,
            margin: 0,
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          {questionText}
        </h2>
      </motion.div>

      {/* Answer area */}
      <AnimatePresence mode="wait">
        {/* Not yet answering — waiting */}
        {!isAnswering && !hasSubmitted && !isReviewing && (
          <motion.p
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              textAlign: "center",
              color: colors.accentGreen,
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Get ready...
          </motion.p>
        )}

        {/* Answering phase — show input */}
        {isAnswering && !hasSubmitted && (
          <motion.div
            key="input"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 300, damping: 25 }
            }
          >
            {questionType === "multiple-choice" && choices && choices.length > 0 ? (
              <MultipleChoice
                choices={choices}
                onSelect={onSubmitAnswer}
                disabled={isSubmitting}
              />
            ) : (
              <AnswerInput
                onSubmit={onSubmitAnswer}
                disabled={isSubmitting}
                isSubmitting={isSubmitting}
              />
            )}
          </motion.div>
        )}

        {/* Submitted — show confirmation */}
        {hasSubmitted && !isReviewing && (
          <motion.div
            key="submitted"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 300, damping: 25 }
            }
          >
            <SubmittedConfirmation
              submittedAnswer={submittedAnswer}
              timerSeconds={timerSeconds}
            />
          </motion.div>
        )}

        {/* Reviewing phase */}
        {isReviewing && (
          <motion.div
            key="reviewing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              textAlign: "center",
              padding: spacing[6],
              backgroundColor: `${colors.accentYellow}10`,
              borderRadius: radii.xl,
              border: `1px solid ${colors.accentYellow}30`,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: colors.accentYellow,
                margin: 0,
              }}
            >
              ✏️ Host is reviewing answers...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
