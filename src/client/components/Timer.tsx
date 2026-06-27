// src/client/components/Timer.tsx — Animated countdown ring
// R5.5: Respects prefers-reduced-motion via CSS and Framer Motion.
// R5.6: aria-live for screen reader announcements. R5.8: role="timer".
import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colors } from "../styles/theme";

type TimerSize = "sm" | "md" | "lg";

interface TimerProps {
  /** Seconds remaining in the countdown */
  secondsRemaining: number;
  /** Total seconds for the countdown (used for progress ring) */
  totalSeconds: number;
  /** Timer display size */
  size?: TimerSize;
}

const SIZE_CONFIG: Record<TimerSize, { diameter: number; stroke: number; fontSize: string }> = {
  sm: { diameter: 64, stroke: 4, fontSize: "var(--text-xl)" },
  md: { diameter: 96, stroke: 6, fontSize: "var(--text-3xl)" },
  lg: { diameter: 140, stroke: 8, fontSize: "var(--text-5xl)" },
};

/**
 * Get the ring color based on time remaining ratio.
 * Green → Yellow → Red as time decreases.
 * R5.4: All colors maintain ≥ 4.5:1 contrast on dark background.
 */
function getRingColor(secondsRemaining: number, totalSeconds: number): string {
  if (totalSeconds <= 0) return colors.correct;
  const ratio = secondsRemaining / totalSeconds;
  if (ratio > 0.5) return colors.correct;
  if (ratio > 0.2) return colors.accentYellow;
  return colors.incorrect;
}

/**
 * Countdown timer with animated ring depletion.
 * Uses SVG circle for the progress ring and Framer Motion for pulse animation.
 */
export function Timer({
  secondsRemaining,
  totalSeconds,
  size = "md",
}: TimerProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const isLow = secondsRemaining <= 5 && secondsRemaining > 0;
  const config = SIZE_CONFIG[size];
  const radius = (config.diameter - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = totalSeconds > 0 ? secondsRemaining / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const ringColor = useMemo(
    () => getRingColor(secondsRemaining, totalSeconds),
    [secondsRemaining, totalSeconds],
  );

  return (
    <motion.div
      className="timer-container"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: config.diameter,
        height: config.diameter,
      }}
      animate={
        isLow && !prefersReducedMotion
          ? { scale: [1, 1.08, 1] }
          : { scale: 1 }
      }
      transition={
        isLow
          ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
      role="timer"
      aria-live="assertive"
      aria-label={`${secondsRemaining} seconds remaining`}
    >
      {/* Background ring */}
      <svg
        width={config.diameter}
        height={config.diameter}
        style={{ position: "absolute", transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth={config.stroke}
        />
        {/* Progress */}
        <circle
          cx={config.diameter / 2}
          cy={config.diameter / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: prefersReducedMotion ? "none" : "stroke-dashoffset 0.5s ease-out, stroke 0.3s ease",
          }}
        />
      </svg>

      {/* Seconds display */}
      <span
        className="timer__value"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: config.fontSize,
          fontWeight: 700,
          color: isLow ? colors.incorrect : colors.text,
          zIndex: 1,
          lineHeight: 1,
        }}
      >
        {secondsRemaining}
      </span>
    </motion.div>
  );
}
