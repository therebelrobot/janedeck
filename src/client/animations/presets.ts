// src/client/animations/presets.ts — Reusable Framer Motion animation configs
// R5.5: All animations respect prefers-reduced-motion via ReducedMotion wrapper.
// When reduced motion is preferred, MotionConfig reduces all animations automatically.

import type { Variants, Transition } from "framer-motion";

// ─── Transitions ──────────────────────────────────────────────────────────────

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

export const smoothTween: Transition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.3,
};

// ─── Page Transitions ─────────────────────────────────────────────────────────

/** Slide + fade for page/state transitions */
export const pageTransition = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: springTransition,
};

// ─── Question Reveal ──────────────────────────────────────────────────────────

/** Scale up from center with bounce for question display */
export const questionReveal = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: {
    type: "spring" as const,
    stiffness: 300,
    damping: 20,
  },
};

// ─── Score Counter ────────────────────────────────────────────────────────────

/** Config for score counting animation */
export const scoreCounter = {
  duration: 1.5,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

// ─── Answer Submission ────────────────────────────────────────────────────────

/** Slide up confirmation after answer submission */
export const answerSubmit = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
  transition: { type: "spring" as const, stiffness: 400, damping: 30 },
};

// ─── Pop-in ───────────────────────────────────────────────────────────────────

/** Pop-in for player join feed entries */
export const popIn = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: "spring" as const, stiffness: 400, damping: 25 },
};

// ─── Fade In/Out ──────────────────────────────────────────────────────────────

/** Simple fade in/out */
export const fadeInOut = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3 },
};

// ─── Slide Variants ───────────────────────────────────────────────────────────

/** Slide from left */
export const slideFromLeft = {
  initial: { x: -50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -50, opacity: 0 },
  transition: springTransition,
};

/** Slide from right */
export const slideFromRight = {
  initial: { x: 50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 50, opacity: 0 },
  transition: springTransition,
};

/** Slide from bottom */
export const slideFromBottom = {
  initial: { y: 50, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 50, opacity: 0 },
  transition: springTransition,
};

// ─── Scale Pop ────────────────────────────────────────────────────────────────

/** Scale pop for buttons, cards */
export const scalePop = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
  transition: { type: "spring" as const, stiffness: 500, damping: 30 },
};

// ─── Timer Pulse ──────────────────────────────────────────────────────────────

/** Pulsing red when timer is low (< 5 seconds) */
export const timerPulse: Variants = {
  normal: { scale: 1 },
  low: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ─── Celebration ──────────────────────────────────────────────────────────────

/** Celebration animation for winners */
export const celebration = {
  initial: { scale: 0, rotate: -10 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 15,
      delay: 0.3,
    },
  },
};

// ─── Shake ────────────────────────────────────────────────────────────────────

/** Shake animation for errors/rejections */
export const shake = {
  animate: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.4 },
  },
};

// ─── Pulse/Breathing ──────────────────────────────────────────────────────────

/** Pulse/breathing animation for waiting states */
export const pulse = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

// ─── Float Up ─────────────────────────────────────────────────────────────────

/** Float up and fade for score change badges */
export const floatUp = {
  initial: { y: 0, opacity: 1 },
  animate: { y: -30, opacity: 0 },
  transition: { duration: 1.5, ease: "easeOut" as const },
};

// ─── Stagger Container & Items ────────────────────────────────────────────────

/** Stagger container for animating lists of children */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

/** Individual stagger item */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { opacity: 0, y: -10 },
};

/** Alias for backward compatibility */
export const staggerChild = staggerItem;

// ─── Leaderboard Item ─────────────────────────────────────────────────────────

/** Leaderboard item for layout animations */
export const leaderboardItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};
