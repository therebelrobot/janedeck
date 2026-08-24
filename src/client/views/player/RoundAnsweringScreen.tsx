// src/client/views/player/RoundAnsweringScreen.tsx — Team Play round-answering screen
// R5.2: Touch targets ≥ 44px. R5.3: Semantic HTML. R5.6: aria-live for timer/sync state.
// Shows every question in the round at once. Any teammate can edit any
// answer at any time until the host closes the round — edits are debounced
// and synced live via TEAM_ANSWER_SUBMIT / TEAM_ANSWER_UPDATED.
import React, { useEffect, useRef, useState } from "react";
import { Timer } from "../../components/Timer";
import { colors, spacing, radii } from "../../styles/theme";

interface RoundQuestion {
  questionId: string;
  text: string;
  type: "text" | "multiple-choice" | "true-false";
  choices?: string[];
  pointValue: number;
}

interface RoundAnsweringScreenProps {
  roundTitle: string;
  questions: RoundQuestion[];
  drafts: Record<string, { text: string; submittedBy: string }>;
  timerSeconds: number | null;
  timerTotal: number | null;
  teamName: string | null;
  onAnswerChange: (questionId: string, text: string) => void;
}

const DEBOUNCE_MS = 500;

export function RoundAnsweringScreen({
  roundTitle,
  questions,
  drafts,
  timerSeconds,
  timerTotal,
  teamName,
  onAnswerChange,
}: RoundAnsweringScreenProps): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[4], width: "100%" }}>
      {/* Header — round title, team, timer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing[3]} ${spacing[4]}`,
          backgroundColor: colors.bgCard,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border}`,
          flexWrap: "wrap",
          gap: spacing[3],
        }}
      >
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)" }}>
            {roundTitle}
          </p>
          {teamName && (
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: colors.textSecondary }}>
              Team: {teamName}
            </p>
          )}
        </div>
        {timerSeconds !== null && timerTotal !== null && (
          <Timer secondsRemaining={timerSeconds} totalSeconds={timerTotal} size="sm" />
        )}
      </div>

      <p style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, margin: 0 }}>
        Any teammate can edit any answer until the host closes the round.
      </p>

      {/* Every question, all at once */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
        {questions.map((q, i) => (
          <QuestionRow
            key={q.questionId}
            question={q}
            index={i}
            draft={drafts[q.questionId]}
            onAnswerChange={onAnswerChange}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  index,
  draft,
  onAnswerChange,
}: {
  question: RoundQuestion;
  index: number;
  draft: { text: string; submittedBy: string } | undefined;
  onAnswerChange: (questionId: string, text: string) => void;
}): React.ReactElement {
  const [text, setText] = useState(draft?.text ?? "");
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync in a teammate's remote edit, but never while the player is actively
  // typing here themselves — that would clobber their in-progress keystrokes.
  useEffect(() => {
    if (isFocusedRef.current) return;
    setText(draft?.text ?? "");
  }, [draft?.text]);

  const scheduleSubmit = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onAnswerChange(question.questionId, value);
    }, DEBOUNCE_MS);
  };

  const handleTextChange = (value: string) => {
    setText(value);
    scheduleSubmit(value);
  };

  const handleChoiceSelect = (value: string) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onAnswerChange(question.questionId, value);
  };

  return (
    <div
      style={{
        padding: spacing[4],
        backgroundColor: colors.bgCard,
        borderRadius: radii.xl,
        border: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing[3] }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {index + 1}. {question.text}
        </h3>
        <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, whiteSpace: "nowrap" }}>
          {question.pointValue} pts
        </span>
      </div>

      {question.type === "text" ? (
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          placeholder="Your team's answer..."
          autoComplete="off"
          aria-label={`Answer for question ${index + 1}`}
          style={{
            fontSize: "var(--text-lg)",
            minHeight: 48,
            padding: `${spacing[2]} ${spacing[3]}`,
            borderRadius: radii.md,
            border: `2px solid ${colors.primary}`,
            backgroundColor: colors.bg,
            color: colors.text,
            width: "100%",
          }}
        />
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}
          role="group"
          aria-label={`Answer options for question ${index + 1}`}
        >
          {(question.choices ?? ["True", "False"]).map((choice) => {
            const selected = text === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => handleChoiceSelect(choice)}
                aria-pressed={selected}
                style={{
                  minHeight: 44,
                  padding: `${spacing[2]} ${spacing[4]}`,
                  borderRadius: radii.md,
                  border: `2px solid ${selected ? colors.primary : colors.border}`,
                  backgroundColor: selected ? `${colors.primary}20` : colors.bg,
                  color: colors.text,
                  fontWeight: selected ? 700 : 400,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {choice}
              </button>
            );
          })}
        </div>
      )}

      {draft?.submittedBy && (
        <p
          style={{ margin: 0, fontSize: "var(--text-xs)", color: colors.textSecondary }}
          aria-live="polite"
        >
          Last edited by {draft.submittedBy}
        </p>
      )}
    </div>
  );
}
