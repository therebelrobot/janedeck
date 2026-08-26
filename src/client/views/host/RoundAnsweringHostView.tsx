// src/client/views/host/RoundAnsweringHostView.tsx — Team Play round-answering host view
// The host reveals the round's questions one at a time. This shows the
// question just revealed (with its answer, to read out), what was revealed
// before it, the round timer, and per-team answered counts — in place of the
// single-question timer/progress used by individual play's QuestionView.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Timer } from "../../components/Timer";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { QuestionMedia } from "../../components/QuestionMedia";
import { INSTANT_TRANSITION } from "../../animations/presets";
import type { RoundQuestion, TeamAnswerProgressEntry } from "../../stores/gameStore";

interface RoundAnsweringHostViewProps {
  roundTitle: string;
  roundIndex: number;
  /** Questions revealed so far this round, in round order */
  questions: RoundQuestion[];
  /** How many questions the round holds in total */
  totalQuestions: number;
  timerSeconds: number | null;
  timerTotal: number | null;
  /** Per-team progress, keyed by team ID */
  teamProgress: Record<string, TeamAnswerProgressEntry>;
  teamCount: number;
}

/**
 * Host view during a Team Play round's ANSWERING phase.
 */
export function RoundAnsweringHostView({
  roundTitle,
  roundIndex,
  questions,
  totalQuestions,
  timerSeconds,
  timerTotal,
  teamProgress,
  teamCount,
}: RoundAnsweringHostViewProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const teams = Object.entries(teamProgress).sort(([, a], [, b]) =>
    a.teamName.localeCompare(b.teamName),
  );
  const currentIndex = questions.length - 1;
  const current = questions[currentIndex];
  const earlier = questions.slice(0, currentIndex).reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[4], width: "100%" }}>
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[4],
          border: `1px solid ${colors.border}`,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: 0,
          }}
        >
          Round {roundIndex + 1} · {questions.length} of {totalQuestions} revealed
        </p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            margin: `${spacing[1]} 0 0`,
          }}
        >
          {roundTitle}
        </h2>
      </div>

      {/* The question the room is looking at right now */}
      {current && (
        <AnimatePresence mode="wait">
          <motion.div
            key={current.questionId}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? INSTANT_TRANSITION
                : { type: "spring", stiffness: 300, damping: 26 }
            }
            style={{
              backgroundColor: colors.bgCard,
              borderRadius: radii.xl,
              padding: spacing[6],
              border: `2px solid ${colors.primary}`,
              boxShadow: shadows.glow,
              display: "flex",
              flexDirection: "column",
              gap: spacing[3],
            }}
          >
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: colors.primaryLight,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: 0,
              }}
            >
              Question {currentIndex + 1} of {totalQuestions} · {current.pointValue} pts
            </p>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                margin: 0,
              }}
            >
              {current.text}
            </h3>
            {current.media && (
              <QuestionMedia
                media={current.media}
                size="md"
                questionNumber={currentIndex + 1}
              />
            )}
            <AnswerLine question={current} />
          </motion.div>
        </AnimatePresence>
      )}

      {/* Round timer */}
      {timerSeconds !== null && timerTotal !== null && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Timer secondsRemaining={timerSeconds} totalSeconds={timerTotal} size="lg" />
        </div>
      )}

      {/* Per-team progress */}
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[4],
          border: `1px solid ${colors.border}`,
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            marginBottom: spacing[3],
          }}
          aria-live="polite"
        >
          {teams.length}/{teamCount} team{teamCount !== 1 ? "s" : ""} answering
        </p>

        {teams.length === 0 ? (
          <p style={{ color: colors.textSecondary, textAlign: "center", padding: spacing[4] }}>
            Waiting for teams to start answering...
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {teams.map(([teamId, progress]) => {
              const done = progress.answeredCount >= progress.totalQuestions;
              return (
                <div
                  key={teamId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: `${spacing[2]} ${spacing[3]}`,
                    borderRadius: radii.md,
                    backgroundColor: done ? `${colors.correct}15` : colors.bgElevated,
                    border: `1px solid ${done ? colors.correct : colors.border}`,
                  }}
                >
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                    {progress.teamName}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: done ? colors.correct : colors.primaryLight,
                    }}
                  >
                    {progress.answeredCount}/{progress.totalQuestions}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Already-revealed questions, kept to hand — teams can still edit these */}
      {earlier.length > 0 && (
        <details
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: radii.xl,
            padding: spacing[4],
            border: `1px solid ${colors.border}`,
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: colors.textSecondary,
            }}
          >
            Already revealed ({earlier.length}) — still open for edits
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3], marginTop: spacing[3] }}>
            {earlier.map((q) => (
              <div key={q.questionId} style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {questions.indexOf(q) + 1}. {q.text}
                </p>
                <AnswerLine question={q} />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** The correct answer (plus any alternates) for a question — host eyes only */
function AnswerLine({ question }: { question: RoundQuestion }): React.ReactElement | null {
  if (!question.correctAnswer) return null;
  const alternates = question.acceptableAnswers ?? [];

  return (
    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: colors.textSecondary }}>
      <span style={{ color: colors.correct, fontWeight: 700 }}>
        ✓ {question.correctAnswer}
      </span>
      {alternates.length > 0 && <> · also accepts: {alternates.join(", ")}</>}
    </p>
  );
}
