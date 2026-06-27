// src/client/views/player/components/AnswerInput.tsx — Answer submission input
// R5.2: Touch target ≥ 44px. R5.3: Semantic HTML. R5.6: aria-label, autocomplete.
// R5.5: Animations respect prefers-reduced-motion. R1.2: Unicode-safe input.
import React, { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colors, spacing, radii } from "../../../styles/theme";

interface AnswerInputProps {
  /** Called when the player submits an answer */
  onSubmit: (answer: string) => void;
  /** Whether the input is disabled (already submitted or not in answering phase) */
  disabled?: boolean;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
}

/**
 * Large text input for typing answers with a prominent submit button.
 * Mobile-first: large touch targets, auto-focus, submit on Enter.
 */
export function AnswerInput({
  onSubmit,
  disabled = false,
  isSubmitting = false,
}: AnswerInputProps): React.ReactElement {
  const [answer, setAnswer] = useState("");
  const [showPulse, setShowPulse] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Auto-focus when enabled
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = answer.trim();
    if (trimmed.length === 0 || disabled || isSubmitting) return;

    onSubmit(trimmed);

    // Visual feedback pulse
    if (!prefersReducedMotion) {
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        width: "100%",
      }}
    >
      <label
        htmlFor="answer-input"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-lg)",
          fontWeight: 600,
          color: colors.text,
        }}
      >
        Your Answer
      </label>

      {/* R1.2: No regex validation — accept any Unicode text */}
      <input
        ref={inputRef}
        id="answer-input"
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSubmitting}
        placeholder="Type your answer..."
        autoComplete="off"
        aria-label="Your answer"
        aria-describedby="answer-hint"
        style={{
          fontSize: "var(--text-xl)",
          padding: `${spacing[4]} ${spacing[4]}`,
          minHeight: 56,
          borderRadius: radii.lg,
          border: `2px solid ${disabled ? colors.border : colors.primary}`,
          backgroundColor: disabled ? colors.bgElevated : colors.bgCard,
          color: colors.text,
          fontFamily: "var(--font-body)",
          width: "100%",
          opacity: disabled ? 0.6 : 1,
          transition: "border-color 0.15s ease",
        }}
      />

      <p
        id="answer-hint"
        style={{
          fontSize: "var(--text-sm)",
          color: colors.textSecondary,
          margin: 0,
        }}
      >
        Press Enter or tap Submit to send your answer
      </p>

      {/* Submit button — R5.2: ≥ 44px touch target */}
      <motion.div
        animate={
          showPulse && !prefersReducedMotion
            ? { scale: [1, 1.05, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.3 }}
      >
        <button
          type="submit"
          disabled={disabled || isSubmitting || answer.trim().length === 0}
          className="btn-lg btn-success"
          style={{
            width: "100%",
            minHeight: 56,
            fontSize: "var(--text-xl)",
            fontWeight: 700,
          }}
        >
          {isSubmitting ? "Sending..." : "Submit Answer"}
        </button>
      </motion.div>
    </form>
  );
}
