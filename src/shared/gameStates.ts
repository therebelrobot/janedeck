// src/shared/gameStates.ts — Game state enums and transition maps

import type { BingoGameState, GameState, TriviaGameState } from "./types";

/** Valid trivia state transitions: maps each state to the set of states it can transition to */
export const TRIVIA_STATE_TRANSITIONS: Record<TriviaGameState, TriviaGameState[]> = {
  LOBBY: ["ROUND_INTRO"],
  ROUND_INTRO: ["QUESTION_DISPLAY"],
  QUESTION_DISPLAY: ["ANSWERING"],
  ANSWERING: ["REVIEWING"],
  REVIEWING: ["SCORE_REVEAL"],
  SCORE_REVEAL: ["QUESTION_DISPLAY", "ROUND_RESULTS"],
  ROUND_RESULTS: ["ROUND_INTRO", "GAME_OVER"],
  GAME_OVER: ["LOBBY"],
};

/** All possible trivia states as an array */
export const ALL_TRIVIA_STATES: TriviaGameState[] = [
  "LOBBY",
  "ROUND_INTRO",
  "QUESTION_DISPLAY",
  "ANSWERING",
  "REVIEWING",
  "SCORE_REVEAL",
  "ROUND_RESULTS",
  "GAME_OVER",
];

/** Check if a trivia transition from one state to another is valid */
export function isValidTriviaTransition(
  from: TriviaGameState,
  to: TriviaGameState,
): boolean {
  return TRIVIA_STATE_TRANSITIONS[from].includes(to);
}

/** Human-readable labels for each trivia state */
export const TRIVIA_STATE_LABELS: Record<TriviaGameState, string> = {
  LOBBY: "Lobby",
  ROUND_INTRO: "Round Intro",
  QUESTION_DISPLAY: "Question",
  ANSWERING: "Answering",
  REVIEWING: "Reviewing",
  SCORE_REVEAL: "Scores",
  ROUND_RESULTS: "Round Results",
  GAME_OVER: "Game Over",
};

/** Valid bingo state transitions */
export const BINGO_STATE_TRANSITIONS: Record<BingoGameState, BingoGameState[]> = {
  LOBBY: ["BINGO_PLAYING"],
  BINGO_PLAYING: ["BINGO_ENDED"],
  BINGO_ENDED: ["LOBBY"],
};

/** All possible bingo states as an array */
export const ALL_BINGO_STATES: BingoGameState[] = [
  "LOBBY",
  "BINGO_PLAYING",
  "BINGO_ENDED",
];

/** Check if a bingo transition from one state to another is valid */
export function isValidBingoTransition(
  from: BingoGameState,
  to: BingoGameState,
): boolean {
  return BINGO_STATE_TRANSITIONS[from].includes(to);
}

/** Human-readable labels for each bingo state */
export const BINGO_STATE_LABELS: Record<BingoGameState, string> = {
  LOBBY: "Lobby",
  BINGO_PLAYING: "Playing",
  BINGO_ENDED: "Ended",
};

/** Combined label lookup across both game types — for UI that renders a generic GameState */
export const STATE_LABELS: Record<GameState, string> = {
  ...TRIVIA_STATE_LABELS,
  ...BINGO_STATE_LABELS,
};
