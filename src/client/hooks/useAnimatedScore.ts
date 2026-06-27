// src/client/hooks/useAnimatedScore.ts — Score counting animation hook
import { useState, useEffect, useRef } from "react";

/**
 * Animates a score value counting up from the previous value to the new value.
 * Duration is configurable; respects prefers-reduced-motion.
 */
export function useAnimatedScore(
  targetValue: number,
  duration: number = 1500,
): number {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const previousValueRef = useRef(targetValue);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setDisplayValue(targetValue);
      previousValueRef.current = targetValue;
      return;
    }

    const startValue = previousValueRef.current;
    const diff = targetValue - startValue;

    if (diff === 0) return;

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
        previousValueRef.current = targetValue;
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration]);

  return displayValue;
}
