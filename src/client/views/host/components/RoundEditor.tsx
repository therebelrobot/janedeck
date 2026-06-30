// src/client/views/host/components/RoundEditor.tsx — Round form component
// R5.2: SC 2.5.7 — drag-to-reorder has single-pointer alternative (up/down buttons).
// R5.3: Semantic HTML. R5.6: Proper labels.
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { colors, radii, spacing } from "../../../styles/theme";
import { staggerItem } from "../../../animations/presets";
import { DEFAULT_POINT_VALUE, DEFAULT_TIME_LIMIT } from "@/shared/constants";
import { QuestionEditor, type QuestionEditorData } from "./QuestionEditor";

/** Data shape for a round in the editor */
export interface RoundEditorData {
  title: string;
  pointValue: number;
  questions: QuestionEditorData[];
}

interface RoundEditorProps {
  /** Current round data */
  round: RoundEditorData;
  /** Index of this round */
  index: number;
  /** Total number of rounds */
  totalRounds: number;
  /** Callback when round data changes */
  onChange: (index: number, updated: RoundEditorData) => void;
  /** Callback to remove this round */
  onRemove: (index: number) => void;
  /** Callback to move round up */
  onMoveUp: (index: number) => void;
  /** Callback to move round down */
  onMoveDown: (index: number) => void;
  /** Default time limit from game settings */
  defaultTimeLimit: number;
}

/**
 * Collapsible round editor with embedded question editors.
 * Supports reorder via up/down buttons (R5.2 SC 2.5.7 single-pointer alternative).
 */
export function RoundEditor({
  round,
  index,
  totalRounds,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  defaultTimeLimit,
}: RoundEditorProps): React.ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const roundId = `round-${index}`;

  const handleFieldChange = useCallback(
    (field: keyof Omit<RoundEditorData, "questions">, value: string | number) => {
      onChange(index, { ...round, [field]: value });
    },
    [index, round, onChange],
  );

  const handleQuestionChange = useCallback(
    (qIndex: number, updated: QuestionEditorData) => {
      const newQuestions = [...round.questions];
      newQuestions[qIndex] = updated;
      onChange(index, { ...round, questions: newQuestions });
    },
    [index, round, onChange],
  );

  const handleQuestionRemove = useCallback(
    (qIndex: number) => {
      const newQuestions = round.questions.filter((_, i) => i !== qIndex);
      onChange(index, { ...round, questions: newQuestions });
    },
    [index, round, onChange],
  );

  const handleAddQuestion = useCallback(() => {
    const newQuestion: QuestionEditorData = {
      text: "",
      correctAnswer: "",
      acceptableAnswers: "",
      timeLimit: defaultTimeLimit,
    };
    onChange(index, { ...round, questions: [...round.questions, newQuestion] });
  }, [index, round, onChange, defaultTimeLimit]);

  return (
    <motion.div
      variants={staggerItem}
      layout
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radii.xl,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    >
      {/* Round header — always visible */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          padding: spacing[4],
          backgroundColor: colors.bgCard,
          flexWrap: "wrap",
        }}
      >
        {/* Reorder buttons — R5.2 SC 2.5.7: single-pointer alternative to drag */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing[1],
          }}
        >
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            aria-label={`Move round ${index + 1} up`}
            className="btn-sm btn-ghost"
            style={{
              minHeight: 28,
              minWidth: 28,
              padding: "2px 6px",
              fontSize: "var(--text-sm)",
            }}
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === totalRounds - 1}
            aria-label={`Move round ${index + 1} down`}
            className="btn-sm btn-ghost"
            style={{
              minHeight: 28,
              minWidth: 28,
              padding: "2px 6px",
              fontSize: "var(--text-sm)",
            }}
          >
            ▼
          </button>
        </div>

        {/* Round number badge */}
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: colors.accentPurple,
            backgroundColor: `${colors.accentPurple}22`,
            padding: `${spacing[1]} ${spacing[3]}`,
            borderRadius: radii.full,
            whiteSpace: "nowrap",
          }}
        >
          Round {index + 1}
        </span>

        {/* Title input */}
        <div style={{ flex: "1 1 200px" }}>
          <label htmlFor={`${roundId}-title`} className="sr-only">
            Round {index + 1} title
          </label>
          <input
            id={`${roundId}-title`}
            type="text"
            value={round.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            placeholder={`Round ${index + 1} title...`}
            required
            aria-required="true"
            style={{ minHeight: 40 }}
          />
        </div>

        {/* Points input */}
        <div style={{ width: 110 }}>
          <label htmlFor={`${roundId}-points`} className="sr-only">
            Point value for round {index + 1}
          </label>
          <input
            id={`${roundId}-points`}
            type="number"
            min={1}
            max={1000}
            value={round.pointValue}
            onChange={(e) =>
              handleFieldChange(
                "pointValue",
                Math.max(1, parseInt(e.target.value, 10) || DEFAULT_POINT_VALUE),
              )
            }
            aria-label={`Points per question in round ${index + 1}`}
            style={{ minHeight: 40 }}
          />
        </div>
        <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
          pts
        </span>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          aria-controls={`${roundId}-body`}
          className="btn-sm btn-ghost"
          style={{ minHeight: 36, minWidth: 36 }}
        >
          {isCollapsed ? "▸" : "▾"}
        </button>

        {/* Remove round */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={totalRounds <= 1}
          aria-label={`Remove round ${index + 1}`}
          title={totalRounds <= 1 ? "At least one round is required" : `Remove round ${index + 1}`}
          className="btn-sm"
          style={{
            minHeight: 36,
            minWidth: 36,
            backgroundColor: totalRounds <= 1 ? colors.bgElevated : colors.incorrect,
            color: totalRounds <= 1 ? colors.textSecondary : "#ffffff",
          }}
        >
          ✕
        </button>
      </div>

      {/* Collapsible body — questions */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            id={`${roundId}-body`}
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
          >
            <div
              style={{
                padding: `0 ${spacing[4]} ${spacing[4]}`,
                display: "flex",
                flexDirection: "column",
                gap: spacing[3],
              }}
            >
              {/* Question count summary */}
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: colors.textSecondary,
                }}
              >
                {round.questions.length} question{round.questions.length !== 1 ? "s" : ""}
              </span>

              {/* Question list */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}
              >
                <AnimatePresence mode="popLayout">
                  {round.questions.map((q, qIndex) => (
                    <QuestionEditor
                      key={`${roundId}-q-${qIndex}`}
                      question={q}
                      index={qIndex}
                      onChange={handleQuestionChange}
                      onRemove={handleQuestionRemove}
                      idPrefix={roundId}
                      isOnly={round.questions.length <= 1}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Add question button */}
              <button
                type="button"
                onClick={handleAddQuestion}
                className="btn-ghost"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing[2],
                  width: "100%",
                  borderStyle: "dashed",
                }}
              >
                + Add Question
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
