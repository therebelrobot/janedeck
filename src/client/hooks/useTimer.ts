// src/client/hooks/useTimer.ts — Local timer sync with server
// Provides smooth client-side countdown between server TIMER_TICK messages.
import { useState, useEffect, useRef, useCallback } from "react";

interface UseTimerReturn {
  /** Seconds remaining (null if no timer active) */
  timeRemaining: number | null;
  /** Total seconds for the current timer (null if not set) */
  totalTime: number | null;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Progress from 0 (full time) to 1 (time expired), for progress bars */
  progress: number;
  /** Whether the timer is in the danger zone (≤ 5 seconds) */
  isLow: boolean;
  /** Sync with a server TIMER_TICK message */
  syncFromServer: (secondsRemaining: number) => void;
  /** Set the total time for progress calculation */
  setTotalTime: (total: number) => void;
  /** Stop the timer (e.g., on TIMER_EXPIRED) */
  stop: () => void;
  /** Reset the timer completely */
  reset: () => void;
}

/**
 * Local countdown timer that syncs with server TIMER_TICK messages.
 * Runs a client-side interval for smooth display between server updates.
 * R5.5: Timer pulse animation is handled via CSS class, respecting prefers-reduced-motion.
 */
export function useTimer(): UseTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up interval
  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Client-side countdown for smooth display
  useEffect(() => {
    if (!isRunning || timeRemaining === null || timeRemaining <= 0) {
      clearTimerInterval();
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimerInterval;
  }, [isRunning, timeRemaining === null, clearTimerInterval]);

  const syncFromServer = useCallback((secondsRemaining: number) => {
    setTimeRemaining(secondsRemaining);
    setIsRunning(secondsRemaining > 0);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setTimeRemaining(0);
    clearTimerInterval();
  }, [clearTimerInterval]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeRemaining(null);
    setTotalTime(null);
    clearTimerInterval();
  }, [clearTimerInterval]);

  // Calculate progress (0 = full time, 1 = expired)
  const progress =
    totalTime !== null && totalTime > 0 && timeRemaining !== null
      ? 1 - timeRemaining / totalTime
      : 0;

  const isLow = timeRemaining !== null && timeRemaining <= 5 && timeRemaining > 0;

  // Cleanup on unmount
  useEffect(() => clearTimerInterval, [clearTimerInterval]);

  return {
    timeRemaining,
    totalTime,
    isRunning,
    progress,
    isLow,
    syncFromServer,
    setTotalTime,
    stop,
    reset,
  };
}
