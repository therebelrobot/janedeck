// src/client/views/host/components/QuestionEditor.tsx — Question form component
// R5.3: Semantic HTML with <label for>. R5.6: autocomplete, aria-describedby.
// R5.2: SC 2.5.8 — all inputs meet 44px touch target minimum.
import React from "react";
import { motion } from "framer-motion";
import { colors, radii, spacing } from "../../../styles/theme";
import { DEFAULT_TIME_LIMIT } from "@/shared/constants";

/** Data shape for a question in the editor */
export interface QuestionEditorData {
  text: string;
  correctAnswer: string;
  acceptableAnswers: string;
  timeLimit: number;
}

interface QuestionEditorProps {
  /** Current question data */
  question: QuestionEditorData;
  /** Index within the round */
  index: number;
  /** Callback when any field changes */
  onChange: (index: number, updated: QuestionEditorData) => void;
  /** Callback to remove this question */
  onRemove: (index: number) => void;
  /** Unique ID prefix for accessible labels */
  idPrefix: string;
  /** Whether this is the only question (disable remove) */
  isOnly: boolean;
}

/**
 * Compact question form for the round editor.
 * Includes question text, correct answer, acceptable alternates, and optional time override.
 */
export function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  idPrefix,
  isOnly,
}: QuestionEditorProps): React.ReactElement {
  const qId = `${idPrefix}-q${index}`;

  const handleChange = (field: keyof QuestionEditorData, value: string | number) => {
    onChange(index, { ...question, [field]: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        padding: spacing[4],
        border: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            fontWeight: 600,
          }}
        >
          Q{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={isOnly}
          className="btn-sm btn-ghost"
          aria-label={`Remove question ${index + 1}`}
          title={isOnly ? "At least one question is required" : `Remove question ${index + 1}`}
          style={{
            minHeight: 36,
            minWidth: 36,
            padding: "var(--space-1) var(--space-2)",
            fontSize: "var(--text-sm)",
            color: isOnly ? colors.textSecondary : colors.incorrect,
          }}
        >
          ✕
        </button>
      </div>

      {/* Question text */}
      <div>
        <label htmlFor={`${qId}-text`} style={{ fontSize: "var(--text-sm)" }}>
          Question
        </label>
        <input
          id={`${qId}-text`}
          type="text"
          value={question.text}
          onChange={(e) => handleChange("text", e.target.value)}
          placeholder="Enter the question..."
          required
          aria-required="true"
        />
      </div>

      {/* Answer row */}
      <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor={`${qId}-answer`} style={{ fontSize: "var(--text-sm)" }}>
            Correct Answer
          </label>
          <input
            id={`${qId}-answer`}
            type="text"
            value={question.correctAnswer}
            onChange={(e) => handleChange("correctAnswer", e.target.value)}
            placeholder="The correct answer"
            required
            aria-required="true"
          />
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label
            htmlFor={`${qId}-alts`}
            style={{ fontSize: "var(--text-sm)" }}
          >
            Also Accept (comma-separated)
          </label>
          <input
            id={`${qId}-alts`}
            type="text"
            value={question.acceptableAnswers}
            onChange={(e) => handleChange("acceptableAnswers", e.target.value)}
            placeholder="alt1, alt2, alt3"
            aria-describedby={`${qId}-alts-hint`}
          />
          <span
            id={`${qId}-alts-hint`}
            style={{
              fontSize: "var(--text-xs)",
              color: colors.textSecondary,
              marginTop: spacing[1],
              display: "block",
            }}
          >
            Optional alternate accepted answers
          </span>
        </div>
      </div>

      {/* Time override */}
      <div style={{ maxWidth: 180 }}>
        <label htmlFor={`${qId}-time`} style={{ fontSize: "var(--text-sm)" }}>
          Time Limit (seconds)
        </label>
        <input
          id={`${qId}-time`}
          type="number"
          min={5}
          max={300}
          value={question.timeLimit}
          onChange={(e) =>
            handleChange(
              "timeLimit",
              Math.max(5, Math.min(300, parseInt(e.target.value, 10) || DEFAULT_TIME_LIMIT)),
            )
          }
        />
      </div>
    </motion.div>
  );
}
