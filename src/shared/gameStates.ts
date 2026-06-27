// src/shared/gameStates.ts — Game state enum and transition map

import type { GameState } from "./types";

/** Valid state transitions: maps each state to the set of states it can transition to */
export const STATE_TRANSITIONS: Record<GameState, GameState[]> = {
  LOBBY: ["ROUND_INTRO"],
  ROUND_INTRO: ["QUESTION_DISPLAY"],
  QUESTION_DISPLAY: ["ANSWERING"],
  ANSWERING: ["REVIEWING"],
  REVIEWING: ["SCORE_REVEAL"],
  SCORE_REVEAL: ["QUESTION_DISPLAY", "ROUND_RESULTS"],
  ROUND_RESULTS: ["ROUND_INTRO", "GAME_OVER"],
  GAME_OVER: ["LOBBY"],
};

/** All possible game states as an array */
export const ALL_GAME_STATES: GameState[] = [
  "LOBBY",
  "ROUND_INTRO",
  "QUESTION_DISPLAY",
  "ANSWERING",
  "REVIEWING",
  "SCORE_REVEAL",
  "ROUND_RESULTS",
  "GAME_OVER",
];

/** Check if a transition from one state to another is valid */
export function isValidTransition(
  from: GameState,
  to: GameState,
): boolean {
  return STATE_TRANSITIONS[from].includes(to);
}

/** Human-readable labels for each game state */
export const STATE_LABELS: Record<GameState, string> = {
  LOBBY: "Lobby",
  ROUND_INTRO: "Round Intro",
  QUESTION_DISPLAY: "Question",
  ANSWERING: "Answering",
  REVIEWING: "Reviewing",
  SCORE_REVEAL: "Scores",
  ROUND_RESULTS: "Round Results",
  GAME_OVER: "Game Over",
};
