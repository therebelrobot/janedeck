// src/client/views/player/RoundAnsweringScreen.tsx — Team Play round-answering screen
// R5.2: Touch targets ≥ 44px. R5.3: Semantic HTML. R5.6: aria-live for timer/sync state.
// The host reveals the round's questions one at a time. The newest one takes
// the focus; every question revealed earlier stays open below it, and any
// teammate can edit any of them until the host closes the round — edits are
// debounced and synced live via TEAM_ANSWER_SUBMIT / TEAM_ANSWER_UPDATED.
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Timer } from "../../components/Timer";
import { colors, spacing, radii, shadows } from "../../styles/theme";
import { QuestionMedia } from "../../components/QuestionMedia";
import type { QuestionMedia as QuestionMediaData } from "@/shared/media";
import { INSTANT_TRANSITION } from "../../animations/presets";

interface RoundQuestion {
  questionId: string;
  text: string;
  type: "text" | "multiple-choice" | "true-false";
  choices?: string[];
  pointValue: number;
  /** Optional host-uploaded image shown with this question */
  media?: QuestionMediaData;
}

interface RoundAnsweringScreenProps {
  roundTitle: string;
  /** Only the questions revealed so far, in round order */
  questions: RoundQuestion[];
  /** How many questions the round holds in total */
  totalQuestions: number;
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
  totalQuestions,
  drafts,
  timerSeconds,
  timerTotal,
  teamName,
  onAnswerChange,
}: RoundAnsweringScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const currentIndex = questions.length - 1;
  const current = questions[currentIndex];
  // Newest first — the question just revealed sits at the top, and earlier
  // ones stay reachable underneath without pushing it off screen.
  const earlier = questions.slice(0, currentIndex).reverse();
  const focusRef = useRef<HTMLDivElement | null>(null);

  // Pull the newly revealed question into view — a teammate who had scrolled
  // down to fix an earlier answer would otherwise miss it entirely.
  useEffect(() => {
    if (!current) return;
    focusRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [current?.questionId, prefersReducedMotion]);

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

      {/* Newly revealed question — the focus */}
      {current && (
        <div ref={focusRef} style={{ scrollMarginTop: spacing[4] }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={current.questionId}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              transition={
                prefersReducedMotion
                  ? INSTANT_TRANSITION
                  : { type: "spring", stiffness: 300, damping: 26 }
              }
            >
              <QuestionRow
                question={current}
                index={currentIndex}
                totalQuestions={totalQuestions}
                draft={drafts[current.questionId]}
                onAnswerChange={onAnswerChange}
                isCurrent
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <p
        style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, margin: 0 }}
        aria-live="polite"
      >
        {questions.length < totalQuestions
          ? `Question ${questions.length} of ${totalQuestions} — more to come. Any teammate can edit any answer until the host closes the round.`
          : "That's every question. Any teammate can edit any answer until the host closes the round."}
      </p>

      {/* Everything revealed earlier — still editable, just out of the spotlight */}
      {earlier.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
          <h3
            style={{
              margin: 0,
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Earlier questions
          </h3>
          {earlier.map((q) => (
            <QuestionRow
              key={q.questionId}
              question={q}
              index={questions.indexOf(q)}
              totalQuestions={totalQuestions}
              draft={drafts[q.questionId]}
              onAnswerChange={onAnswerChange}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function QuestionRow({
  question,
  index,
  totalQuestions,
  draft,
  onAnswerChange,
  isCurrent = false,
}: {
  question: RoundQuestion;
  index: number;
  totalQuestions: number;
  draft: { text: string; submittedBy: string } | undefined;
  onAnswerChange: (questionId: string, text: string) => void;
  isCurrent?: boolean;
}): React.ReactElement {
  const [text, setText] = useState(draft?.text ?? "");
  const isFocusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Edit typed but not yet sent — null once it has been */
  const pendingRef = useRef<string | null>(null);
  const flushRef = useRef<() => void>(() => {});

  // Sync in a teammate's remote edit, but never while the player is actively
  // typing here themselves — that would clobber their in-progress keystrokes.
  useEffect(() => {
    if (isFocusedRef.current) return;
    setText(draft?.text ?? "");
  }, [draft?.text]);

  flushRef.current = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (pendingRef.current === null) return;
    onAnswerChange(question.questionId, pendingRef.current);
    pendingRef.current = null;
  };

  // A question moves out of the focus slot when the next one is revealed,
  // which remounts this row — send whatever the debounce still owes first,
  // or those keystrokes vanish.
  useEffect(() => () => flushRef.current(), []);

  const scheduleSubmit = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingRef.current = value;
    debounceRef.current = setTimeout(() => {
      pendingRef.current = null;
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
    pendingRef.current = null;
    onAnswerChange(question.questionId, value);
  };

  return (
    <div
      style={{
        padding: isCurrent ? spacing[6] : spacing[4],
        backgroundColor: isCurrent ? colors.bgCard : colors.bgElevated,
        borderRadius: radii.xl,
        border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? colors.primary : colors.border}`,
        boxShadow: isCurrent ? shadows.glow : undefined,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing[3] }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: isCurrent ? colors.primaryLight : colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Question {index + 1} of {totalQuestions}
        </p>
        <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, whiteSpace: "nowrap" }}>
          {question.pointValue} pts
        </span>
      </div>

      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: isCurrent ? "var(--text-xl)" : "var(--text-base)",
          fontWeight: 700,
          margin: 0,
        }}
      >
        {question.text}
      </h3>

      {question.media && (
        <QuestionMedia
          media={question.media}
          size="sm"
          questionNumber={index + 1}
        />
      )}

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
            border: `2px solid ${isCurrent ? colors.primary : colors.border}`,
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
