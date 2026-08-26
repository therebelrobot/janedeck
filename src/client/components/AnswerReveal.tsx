// src/client/components/AnswerReveal.tsx — "Here's what it was" answer feedback
// Shown once a question closes: individually per question, or for the whole
// round at once in Team Play. Shared by the player and presentation views.
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R5.4: Color contrast ≥ 4.5:1 on dark backgrounds.
// R7.4: Non-blame language — misses read as "didn't count", never "wrong".
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { QuestionReveal, RevealedAnswer } from "@/shared/types";
import { colors, spacing, radii, shadows } from "../styles/theme";

/**
 * How much room the surface has — drives type scale and density.
 * "presentation-dense" is picked automatically for a long round; callers pass
 * "presentation" or "player".
 */
export type RevealVariant = "presentation" | "presentation-dense" | "player";

interface AnswerRevealPanelProps {
  /** One entry per question being revealed, in round order */
  reveals: QuestionReveal[];
  /** Which surface this is rendering on */
  variant?: RevealVariant;
  /**
   * The viewer's own name — their player name, or their team name in Team
   * Play. Their answers get called out so they can find themselves fast.
   */
  highlightSubmitter?: string | null;
}

/** How many submitter names to spell out before collapsing into a count */
const MAX_NAMES = 3;

/** Type scale per surface — the shared screen reads from across the room */
const SCALE: Record<RevealVariant, {
  answer: string;
  question: string;
  label: string;
  chip: string;
  gap: string;
  pad: string;
}> = {
  presentation: {
    answer: "clamp(1.75rem, 3.2vw, 3rem)",
    question: "var(--text-xl)",
    label: "var(--text-sm)",
    chip: "var(--text-base)",
    gap: spacing[4],
    pad: spacing[6],
  },
  // A long Team Play round puts three or more cards on the shared screen at
  // once; at full size the last one runs off the bottom, and a projected
  // screen can't scroll to reach it.
  "presentation-dense": {
    answer: "clamp(1.4rem, 2.4vw, 2.2rem)",
    question: "var(--text-lg)",
    label: "var(--text-xs)",
    chip: "var(--text-sm)",
    gap: spacing[3],
    pad: spacing[4],
  },
  player: {
    answer: "var(--text-2xl)",
    question: "var(--text-base)",
    label: "var(--text-xs)",
    chip: "var(--text-sm)",
    gap: spacing[3],
    pad: spacing[4],
  },
};

/** Render a group's submitters as "Aster, Sam +2 more" */
function submitterLine(submitters: string[]): string {
  if (submitters.length <= MAX_NAMES) return submitters.join(", ");
  const shown = submitters.slice(0, MAX_NAMES).join(", ");
  return `${shown} +${submitters.length - MAX_NAMES} more`;
}

/** One submitted answer with the names behind it */
function AnswerChip({
  answer,
  accent,
  scale,
  isMine,
}: {
  answer: RevealedAnswer;
  accent: string;
  scale: (typeof SCALE)[RevealVariant];
  isMine: boolean;
}): React.ReactElement {
  // Host-bonused answers were misses worth celebrating anyway — give them
  // their own color so they read as a prize, not a mistake.
  const color = answer.isBonus ? colors.bonus : accent;

  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[1],
        padding: `${spacing[2]} ${spacing[3]}`,
        backgroundColor: `${color}12`,
        border: isMine ? `2px solid ${color}` : `1px solid ${color}35`,
        borderRadius: radii.md,
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: scale.chip,
          fontWeight: 600,
          color,
          overflowWrap: "anywhere",
        }}
      >
        {answer.isBonus && <span aria-hidden="true">⭐ </span>}
        {answer.text}
      </span>
      <span
        style={{
          fontSize: "var(--text-xs)",
          color: colors.textSecondary,
          overflowWrap: "anywhere",
        }}
      >
        {submitterLine(answer.submitters)}
        {isMine && (
          <span style={{ color, fontWeight: 600 }}> · you</span>
        )}
      </span>
    </li>
  );
}

/** A titled row of answer chips — renders nothing when the group is empty */
function ChipGroup({
  title,
  answers,
  accent,
  scale,
  highlightSubmitter,
}: {
  title: string;
  answers: RevealedAnswer[];
  accent: string;
  scale: (typeof SCALE)[RevealVariant];
  highlightSubmitter?: string | null;
}): React.ReactElement | null {
  if (answers.length === 0) return null;

  return (
    <section style={{ width: "100%" }}>
      <h4
        style={{
          fontSize: scale.label,
          fontWeight: 600,
          color: colors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: `0 0 ${spacing[2]}`,
        }}
      >
        {title}
      </h4>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[2],
        }}
      >
        {answers.map((answer) => (
          <AnswerChip
            key={answer.text}
            answer={answer}
            accent={accent}
            scale={scale}
            isMine={
              !!highlightSubmitter && answer.submitters.includes(highlightSubmitter)
            }
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * One question's reveal: the question, the answer that was wanted, the
 * alternates it was set up to take, and everything people actually said.
 */
export function AnswerRevealCard({
  reveal,
  variant = "presentation",
  highlightSubmitter,
  index = 0,
}: {
  reveal: QuestionReveal;
  variant?: RevealVariant;
  highlightSubmitter?: string | null;
  /** Position in the list — staggers the entrance */
  index?: number;
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const scale = SCALE[variant];

  return (
    <motion.article
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.01 }
          : {
              type: "spring",
              stiffness: 260,
              damping: 24,
              delay: Math.min(index * 0.08, 0.6),
            }
      }
      style={{
        display: "flex",
        flexDirection: "column",
        gap: scale.gap,
        padding: scale.pad,
        backgroundColor: colors.bgCard,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.xl,
        boxShadow: shadows.md,
        width: "100%",
        textAlign: "left",
      }}
    >
      {/* Question */}
      <header style={{ display: "flex", gap: spacing[3], alignItems: "baseline" }}>
        <span
          style={{
            flexShrink: 0,
            fontFamily: "var(--font-display)",
            fontSize: scale.label,
            fontWeight: 700,
            color: colors.primaryLight,
            padding: `${spacing[1]} ${spacing[2]}`,
            backgroundColor: `${colors.primary}20`,
            borderRadius: radii.sm,
          }}
        >
          Q{reveal.questionNumber}
        </span>
        <h3
          style={{
            fontSize: scale.question,
            fontWeight: 500,
            color: colors.textOnDark,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {reveal.questionText}
        </h3>
      </header>

      {/* The answer everyone was after */}
      <div
        style={{
          padding: `${spacing[3]} ${spacing[4]}`,
          backgroundColor: `${colors.correct}15`,
          border: `2px solid ${colors.correct}`,
          borderRadius: radii.lg,
          boxShadow: shadows.glowGreen,
        }}
      >
        <p
          style={{
            fontSize: scale.label,
            color: colors.textSecondary,
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Correct answer
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: scale.answer,
            fontWeight: 700,
            color: colors.correct,
            margin: `${spacing[1]} 0 0`,
            lineHeight: 1.15,
            overflowWrap: "anywhere",
          }}
          aria-live="polite"
        >
          {reveal.correctAnswer}
        </p>

        {reveal.acceptableAnswers.length > 0 && (
          <p
            style={{
              fontSize: scale.chip,
              color: colors.textSecondary,
              margin: `${spacing[2]} 0 0`,
              overflowWrap: "anywhere",
            }}
          >
            <span style={{ color: colors.correct }}>Also accepted:</span>{" "}
            {reveal.acceptableAnswers.join(" · ")}
          </p>
        )}
      </div>

      <ChipGroup
        title="Host let these through too"
        answers={reveal.acceptedAnswers}
        accent={colors.correct}
        scale={scale}
        highlightSubmitter={highlightSubmitter}
      />

      <ChipGroup
        title="Didn't count"
        answers={reveal.rejectedAnswers}
        accent={colors.incorrect}
        scale={scale}
        highlightSubmitter={highlightSubmitter}
      />
    </motion.article>
  );
}

/**
 * The full reveal for whatever just closed — a single question in individual
 * play, or every question of the round in Team Play.
 */
export function AnswerRevealPanel({
  reveals,
  variant = "presentation",
  highlightSubmitter,
}: AnswerRevealPanelProps): React.ReactElement | null {
  if (reveals.length === 0) return null;

  // A round's worth of questions tiles into columns where there's room; a lone
  // question keeps the full width and stays the hero. The track floor drops
  // for longer rounds so a three-question round still lands on one row beside
  // the leaderboard at 1280 wide rather than wrapping and pushing it offscreen.
  const columnFloor = reveals.length > 2 ? 220 : 300;
  const cardVariant: RevealVariant =
    variant === "presentation" && reveals.length > 2 ? "presentation-dense" : variant;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          reveals.length > 1
            ? `repeat(auto-fit, minmax(min(100%, ${columnFloor}px), 1fr))`
            : "1fr",
        gap: spacing[4],
        width: "100%",
        alignItems: "start",
      }}
    >
      {reveals.map((reveal, index) => (
        <AnswerRevealCard
          key={reveal.questionId}
          reveal={reveal}
          variant={cardVariant}
          highlightSubmitter={highlightSubmitter}
          index={index}
        />
      ))}
    </div>
  );
}
