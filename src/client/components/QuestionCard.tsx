// src/client/components/QuestionCard.tsx — Question display with type variants
// R5.3: Semantic HTML. R5.8: alt text for media. R5.5: Motion-safe animations.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface QuestionCardProps {
  /** Question text */
  text: string;
  /** Current question number (1-based) */
  questionNumber: number;
  /** Total questions in the round */
  totalQuestions: number;
  /** Point value for this question */
  pointValue: number;
  /** Optional media URL (image) */
  mediaUrl?: string;
  /** Round name for display */
  roundName?: string;
}

/**
 * Question display component with scale-up reveal animation.
 * Shows question text, round info, and point value.
 */
export function QuestionCard({
  text,
  questionNumber,
  totalQuestions,
  pointValue,
  mediaUrl,
  roundName,
}: QuestionCardProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="question-card"
      initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.15 }
          : { type: "spring", stiffness: 300, damping: 20 }
      }
      role="article"
      aria-label={`Question ${questionNumber} of ${totalQuestions}: ${text}`}
    >
      {/* Meta info */}
      <p className="question-card__meta">
        {roundName && (
          <span className="question-card__round">{roundName} · </span>
        )}
        <span>
          Question {questionNumber} of {totalQuestions}
        </span>
        <span className="question-card__points" aria-label={`${pointValue} points`}>
          {" "}
          — {pointValue} {pointValue === 1 ? "point" : "points"}
        </span>
      </p>

      {/* Question text */}
      <h2 className="question-card__text">{text}</h2>

      {/* Optional media — R5.8: informative alt text */}
      {mediaUrl && (
        <div className="question-card__media">
          <img
            src={mediaUrl}
            alt={`Visual clue for question ${questionNumber}`}
            className="question-card__image"
            loading="lazy"
          />
        </div>
      )}
    </motion.div>
  );
}
