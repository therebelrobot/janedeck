// src/client/animations/variants.ts — Named animation variants for game states
// State-specific animation variants with color schemes per game phase.
// R5.5: All animations respect prefers-reduced-motion via ReducedMotion wrapper.

import type { Variants } from "framer-motion";
import { colors } from "../styles/theme";

// ─── Page Transitions ─────────────────────────────────────────────────────────

/** Page transition variants used with AnimatePresence */
export const pageVariants: Variants = {
  initial: { opacity: 0, x: 50 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -50 },
};

export const pageTransition = {
  type: "tween" as const,
  ease: "anticipate" as const,
  duration: 0.3,
};

// ─── Score Variants ───────────────────────────────────────────────────────────

/** Score counter variants */
export const scoreVariants: Variants = {
  idle: { scale: 1 },
  counting: {
    scale: [1, 1.1, 1],
    transition: { duration: 0.3 },
  },
};

// ─── Answer Submission Variants ───────────────────────────────────────────────

/** Answer submission state variants */
export const answerSubmitVariants: Variants = {
  editing: { scale: 1, opacity: 1 },
  submitted: {
    scale: 0.95,
    opacity: 0.8,
    transition: { duration: 0.3 },
  },
};

// ─── Winner Reveal ────────────────────────────────────────────────────────────

/** Winner reveal variants */
export const winnerVariants: Variants = {
  hidden: { scale: 0, rotate: -10 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 15,
      delay: 0.5,
    },
  },
};

// ─── State-Specific Color Schemes ─────────────────────────────────────────────

/** Color scheme per game state for backgrounds, accents, etc. */
export const stateColors: Record<string, { bg: string; accent: string; text: string }> = {
  LOBBY: {
    bg: colors.bg,
    accent: colors.primary,
    text: colors.text,
  },
  ROUND_INTRO: {
    bg: colors.bg,
    accent: colors.accentPurple,
    text: colors.text,
  },
  QUESTION_DISPLAY: {
    bg: colors.bg,
    accent: colors.primary,
    text: colors.text,
  },
  ANSWERING: {
    bg: colors.bg,
    accent: colors.primary,
    text: colors.text,
  },
  REVIEWING: {
    bg: colors.bg,
    accent: colors.accentYellow,
    text: colors.text,
  },
  SCORE_REVEAL: {
    bg: colors.bg,
    accent: colors.accentGreen,
    text: colors.text,
  },
  ROUND_RESULTS: {
    bg: colors.bg,
    accent: colors.accentPurple,
    text: colors.text,
  },
  GAME_OVER: {
    bg: colors.bg,
    accent: colors.secondary,
    text: colors.text,
  },
  BINGO_PLAYING: {
    bg: colors.bg,
    accent: colors.accentPurple,
    text: colors.text,
  },
  BINGO_ENDED: {
    bg: colors.bg,
    accent: colors.secondary,
    text: colors.text,
  },
};

// ─── Answer Result Variants ───────────────────────────────────────────────────

/** Variants for correct/incorrect answer feedback */
export const answerResultVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  correct: {
    opacity: 1,
    scale: 1,
    backgroundColor: colors.correct,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  incorrect: {
    opacity: 1,
    scale: 1,
    backgroundColor: colors.incorrect,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  bonus: {
    opacity: 1,
    scale: 1,
    backgroundColor: colors.bonus,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  pending: {
    opacity: 1,
    scale: 1,
    backgroundColor: colors.bgElevated,
    transition: { duration: 0.3 },
  },
};

// ─── Background Pulse ─────────────────────────────────────────────────────────

/** Background pulse effect variants */
export const bgPulseVariants: Variants = {
  idle: { opacity: 0.3 },
  active: {
    opacity: [0.3, 0.5, 0.3],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ─── Round Intro Variants ─────────────────────────────────────────────────────

/** Round intro text reveal */
export const roundIntroVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
      staggerChildren: 0.15,
    },
  },
};

/** Round intro child elements */
export const roundIntroChildVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
};

// ─── Lobby Variants ───────────────────────────────────────────────────────────

/** Player joining the lobby */
export const lobbyJoinVariants: Variants = {
  initial: { scale: 0, opacity: 0, y: 20 },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.2 },
  },
};
