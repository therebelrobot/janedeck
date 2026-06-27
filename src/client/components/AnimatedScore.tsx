// src/client/components/AnimatedScore.tsx — Counting-up number animation
// R5.5: Respects prefers-reduced-motion. R5.8: aria-live for score announcements.
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type ScoreSize = "sm" | "md" | "lg";

interface AnimatedScoreProps {
  /** The target score value */
  score: number;
  /** Whether to show "+X" flyout for score changes */
  showChange?: boolean;
  /** Display size */
  size?: ScoreSize;
  /** Accessible label */
  label?: string;
}

const SIZE_STYLES: Record<ScoreSize, React.CSSProperties> = {
  sm: { fontSize: "var(--text-lg)", fontWeight: 700 },
  md: { fontSize: "var(--text-3xl)", fontWeight: 700 },
  lg: { fontSize: "var(--text-5xl)", fontWeight: 700 },
};

/**
 * Score display that counts up from the previous value to the new value
 * using requestAnimationFrame for smooth counting.
 * Shows a "+X" flyout animation when score increases.
 */
export function AnimatedScore({
  score,
  showChange = false,
  size = "md",
  label,
}: AnimatedScoreProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(score);
  const [changeAmount, setChangeAmount] = useState<number | null>(null);
  const previousScoreRef = useRef(score);
  const animationRef = useRef<number | null>(null);
  const changeKeyRef = useRef(0);

  useEffect(() => {
    const startValue = previousScoreRef.current;
    const diff = score - startValue;

    if (diff === 0) return;

    // Track score change for the "+X" flyout
    if (showChange && diff > 0) {
      setChangeAmount(diff);
      changeKeyRef.current += 1;
    }

    // If user prefers reduced motion, skip animation
    if (prefersReducedMotion) {
      setDisplayValue(score);
      previousScoreRef.current = score;
      return;
    }

    const duration = 1500;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + diff * eased);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousScoreRef.current = score;
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [score, showChange, prefersReducedMotion]);

  return (
    <span
      className="animated-score"
      style={{
        ...SIZE_STYLES[size],
        fontFamily: "var(--font-display)",
        color: "var(--color-primary-light)",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
      aria-live="polite"
      aria-label={label ?? `Score: ${score}`}
    >
      <span>{displayValue.toLocaleString()}</span>

      {/* "+X" flyout animation */}
      <AnimatePresence>
        {showChange && changeAmount !== null && changeAmount > 0 && (
          <motion.span
            key={changeKeyRef.current}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -30 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, delay: 0.3 }}
            style={{
              position: "absolute",
              top: "-0.5em",
              insetInlineEnd: "-2em",
              color: "var(--color-correct)",
              fontSize: "0.6em",
              fontWeight: 700,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            +{changeAmount}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
