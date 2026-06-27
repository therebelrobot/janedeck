// src/client/components/StatusBadge.tsx — Game state indicator
// R5.3: Semantic HTML with role="status".
// R5.4: Color contrast ≥ 4.5:1 maintained for all badge variants.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { GameState } from "@/shared/types";
import { STATE_LABELS } from "@/shared/gameStates";

interface StatusBadgeProps {
  /** Current game state */
  state: GameState;
}

/** Color and style mapping for each game state */
const STATE_STYLES: Record<
  GameState,
  { backgroundColor: string; color: string; borderColor?: string }
> = {
  LOBBY: {
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
  },
  ROUND_INTRO: {
    backgroundColor: "var(--color-accent-purple)",
    color: "#ffffff",
  },
  QUESTION_DISPLAY: {
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
  },
  ANSWERING: {
    backgroundColor: "var(--color-accent-green)",
    color: "#000000",
  },
  REVIEWING: {
    backgroundColor: "var(--color-needs-review)",
    color: "#000000",
  },
  SCORE_REVEAL: {
    backgroundColor: "var(--color-accent-purple)",
    color: "#ffffff",
  },
  ROUND_RESULTS: {
    backgroundColor: "var(--color-accent-orange)",
    color: "#000000",
  },
  GAME_OVER: {
    backgroundColor: "var(--color-secondary)",
    color: "#ffffff",
  },
};

/**
 * Displays the current game state as a styled badge.
 * Color-coded per state with smooth transition animations.
 */
export function StatusBadge({ state }: StatusBadgeProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const styles = STATE_STYLES[state];

  return (
    <motion.span
      className="status-badge"
      style={{
        display: "inline-block",
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-sm)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        fontFamily: "var(--font-display)",
        ...styles,
      }}
      role="status"
      aria-label={`Game status: ${STATE_LABELS[state]}`}
      initial={false}
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : {
              scale: [1, 1.05, 1],
              transition: { duration: 0.3 },
            }
      }
      key={state}
    >
      {STATE_LABELS[state]}
    </motion.span>
  );
}
