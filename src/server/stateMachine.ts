// src/server/stateMachine.ts — Game state transition logic

import type { Game, GameState } from "@/shared/types";
import { isValidTransition } from "@/shared/gameStates";

export interface TransitionResult {
  success: boolean;
  from: GameState;
  to: GameState;
  error?: string;
}

/**
 * Check if a transition from one state to another is valid.
 */
export function canTransition(
  from: GameState,
  to: GameState,
): boolean {
  return isValidTransition(from, to);
}

/**
 * Attempt a state transition. Returns success/failure with context.
 */
export function validateTransition(
  currentState: GameState,
  targetState: GameState,
): TransitionResult {
  if (!isValidTransition(currentState, targetState)) {
    return {
      success: false,
      from: currentState,
      to: targetState,
      error: `Invalid transition from ${currentState} to ${targetState}`,
    };
  }

  return {
    success: true,
    from: currentState,
    to: targetState,
  };
}

/**
 * Apply a state transition to the game, including side effects.
 * Returns a new Game object with updated state.
 */
export function transition(game: Game, to: GameState): Game {
  const updatedGame = { ...game, state: to };

  switch (to) {
    case "ROUND_INTRO": {
      // When entering ROUND_INTRO, mark the current round as active
      const rounds = updatedGame.rounds.map((round, i) => {
        if (i === updatedGame.currentRoundIndex) {
          return { ...round, state: "active" as const };
        }
        return round;
      });
      updatedGame.rounds = rounds;
      break;
    }

    case "QUESTION_DISPLAY": {
      // When entering QUESTION_DISPLAY, clear timer info
      // (the actual timer starts on ANSWERING)
      updatedGame.timerStartedAt = null;
      updatedGame.timerDuration = null;
      break;
    }

    case "ANSWERING": {
      // Start timer for the current question
      const round = updatedGame.rounds[updatedGame.currentRoundIndex];
      const question = round?.questions[updatedGame.currentQuestionIndex];
      if (question) {
        updatedGame.timerStartedAt = Date.now();
        updatedGame.timerDuration = question.timeLimit;
      }
      break;
    }

    case "REVIEWING": {
      // Stop the timer
      updatedGame.timerStartedAt = null;
      updatedGame.timerDuration = null;
      break;
    }

    case "SCORE_REVEAL": {
      // Scores have been calculated — no additional side effects needed
      break;
    }

    case "ROUND_RESULTS": {
      // Mark the current round as completed
      const rounds = updatedGame.rounds.map((round, i) => {
        if (i === updatedGame.currentRoundIndex) {
          return { ...round, state: "completed" as const };
        }
        return round;
      });
      updatedGame.rounds = rounds;
      break;
    }

    case "GAME_OVER": {
      // No special side effects — final rankings are computed by the caller
      break;
    }

    case "LOBBY": {
      // Reset for a new game (GAME_OVER → LOBBY)
      // Clear answers, reset scores, keep players
      const players = { ...updatedGame.players };
      for (const playerId of Object.keys(players)) {
        players[playerId] = {
          ...players[playerId],
          score: 0,
          answers: {},
        };
      }
      updatedGame.players = players;
      updatedGame.currentRoundIndex = 0;
      updatedGame.currentQuestionIndex = 0;
      updatedGame.timerStartedAt = null;
      updatedGame.timerDuration = null;

      // Reset all rounds to pending
      updatedGame.rounds = updatedGame.rounds.map((round) => ({
        ...round,
        state: "pending" as const,
      }));
      break;
    }
  }

  return updatedGame;
}

/**
 * Determine the next state based on the current state and game context.
 * Used for SCORE_REVEAL → next and ROUND_RESULTS → next decisions.
 */
export function getNextState(
  currentState: GameState,
  context: {
    hasMoreQuestions: boolean;
    hasMoreRounds: boolean;
  },
): GameState | null {
  switch (currentState) {
    case "SCORE_REVEAL":
      return context.hasMoreQuestions ? "QUESTION_DISPLAY" : "ROUND_RESULTS";
    case "ROUND_RESULTS":
      return context.hasMoreRounds ? "ROUND_INTRO" : "GAME_OVER";
    default:
      return null;
  }
}
