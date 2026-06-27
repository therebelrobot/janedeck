// src/server/utils/storage.ts — Storage key helpers + serialization
// Durable Object storage is a flat key-value store. Keys are structured as path-like strings.

import type { Game, Player, Answer, ScoreEntry } from "@/shared/types";

// ─── Storage Key Patterns ─────────────────────────────────────────────────────

export const StorageKeys = {
  /** Full game state (the entire Game object) */
  gameState: "game:state" as const,
  /** Host token for this room */
  hostToken: "host:token" as const,
  /** Cached leaderboard */
  leaderboard: "scores:leaderboard" as const,
  /** Timer metadata */
  timerMeta: "timer:meta" as const,

  /** Per-player key */
  player: (playerId: string) => `player:${playerId}` as const,
  /** Per-answer key */
  answer: (questionId: string, playerId: string) =>
    `answer:${questionId}:${playerId}` as const,
} as const;

// ─── Game State ───────────────────────────────────────────────────────────────

/**
 * Save full game state to storage.
 */
export async function saveGame(
  storage: DurableObjectStorage,
  game: Game,
): Promise<void> {
  await storage.put(StorageKeys.gameState, game);
}

/**
 * Load full game state from storage.
 */
export async function loadGame(
  storage: DurableObjectStorage,
): Promise<Game | undefined> {
  return storage.get<Game>(StorageKeys.gameState);
}

/**
 * Delete game state from storage.
 */
export async function deleteGame(
  storage: DurableObjectStorage,
): Promise<void> {
  await storage.delete(StorageKeys.gameState);
}

// ─── Player ───────────────────────────────────────────────────────────────────

/**
 * Save a player to storage.
 */
export async function savePlayer(
  storage: DurableObjectStorage,
  player: Player,
): Promise<void> {
  await storage.put(StorageKeys.player(player.id), player);
}

/**
 * Load a player from storage.
 */
export async function loadPlayer(
  storage: DurableObjectStorage,
  playerId: string,
): Promise<Player | undefined> {
  return storage.get<Player>(StorageKeys.player(playerId));
}

// ─── Answers ──────────────────────────────────────────────────────────────────

/**
 * Save an answer to storage.
 */
export async function saveAnswer(
  storage: DurableObjectStorage,
  answer: Answer,
): Promise<void> {
  await storage.put(
    StorageKeys.answer(answer.questionId, answer.playerId),
    answer,
  );
}

/**
 * Load an answer from storage.
 */
export async function loadAnswer(
  storage: DurableObjectStorage,
  questionId: string,
  playerId: string,
): Promise<Answer | undefined> {
  return storage.get<Answer>(StorageKeys.answer(questionId, playerId));
}

/**
 * Load all answers for a specific question.
 * Uses storage.list with prefix matching.
 */
export async function loadAnswersForQuestion(
  storage: DurableObjectStorage,
  questionId: string,
): Promise<Answer[]> {
  const prefix = `answer:${questionId}:`;
  const entries = await storage.list<Answer>({ prefix });
  return Array.from(entries.values());
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/**
 * Save the leaderboard cache.
 */
export async function saveLeaderboard(
  storage: DurableObjectStorage,
  leaderboard: ScoreEntry[],
): Promise<void> {
  await storage.put(StorageKeys.leaderboard, leaderboard);
}

/**
 * Load the leaderboard cache.
 */
export async function loadLeaderboard(
  storage: DurableObjectStorage,
): Promise<ScoreEntry[] | undefined> {
  return storage.get<ScoreEntry[]>(StorageKeys.leaderboard);
}

// ─── Timer Metadata ───────────────────────────────────────────────────────────

export interface TimerMeta {
  startedAt: number;
  durationSeconds: number;
  questionId: string;
}

/**
 * Save timer metadata so onAlarm knows which question's timer fired.
 */
export async function saveTimerMeta(
  storage: DurableObjectStorage,
  meta: TimerMeta,
): Promise<void> {
  await storage.put(StorageKeys.timerMeta, meta);
}

/**
 * Load timer metadata.
 */
export async function loadTimerMeta(
  storage: DurableObjectStorage,
): Promise<TimerMeta | undefined> {
  return storage.get<TimerMeta>(StorageKeys.timerMeta);
}

/**
 * Delete timer metadata.
 */
export async function deleteTimerMeta(
  storage: DurableObjectStorage,
): Promise<void> {
  await storage.delete(StorageKeys.timerMeta);
}
