// src/server/timer.ts — Alarm-based timer management
// Uses Durable Object alarms instead of setTimeout (survives hibernation).

import {
  saveTimerMeta,
  deleteTimerMeta,
  type TimerMeta,
} from "@/server/utils/storage";

/**
 * Start a countdown timer by setting a Durable Object alarm.
 * Stores metadata about the timer so onAlarm knows context.
 */
export async function startTimer(
  storage: DurableObjectStorage,
  durationSeconds: number,
  questionId: string,
): Promise<void> {
  const meta: TimerMeta = {
    startedAt: Date.now(),
    durationSeconds,
    questionId,
  };

  await saveTimerMeta(storage, meta);
  // Set first alarm at 1 second for tick broadcasts (not full duration)
  // The onAlarm handler checks remaining time and chains 1s tick alarms
  await storage.setAlarm(Date.now() + 1000);
}

/**
 * Cancel any pending alarm and clean up timer metadata.
 */
export async function cancelTimer(
  storage: DurableObjectStorage,
): Promise<void> {
  await storage.deleteAlarm();
  await deleteTimerMeta(storage);
}

/**
 * Calculate remaining seconds for a timer that started at `startedAt`
 * with a total duration of `durationSeconds`.
 */
export function getSecondsRemaining(
  startedAt: number,
  durationSeconds: number,
): number {
  const elapsed = (Date.now() - startedAt) / 1000;
  return Math.max(0, Math.ceil(durationSeconds - elapsed));
}

/**
 * Set a 1-second tick alarm for broadcasting timer updates.
 * Called repeatedly to create a countdown chain.
 */
export async function setTickAlarm(
  storage: DurableObjectStorage,
): Promise<void> {
  await storage.setAlarm(Date.now() + 1000);
}
