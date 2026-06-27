// src/client/hooks/useGameState.ts — Subscribe to game state updates
// Processes server messages and updates the game store accordingly.
import { useCallback } from "react";
import type { ServerMessage } from "@/shared/messages";
import type { GameState } from "@/shared/types";
import { useGameStore } from "../stores/gameStore";

interface UseGameStateReturn {
  /** Current game state */
  gameState: GameState;
  /** Current round index */
  roundIndex: number;
  /** Current question index */
  questionIndex: number;
  /** Whether the game is in the answering phase */
  isAnswering: boolean;
  /** Whether the game is in the reviewing phase */
  isReviewing: boolean;
  /** Whether the game is in the lobby */
  isLobby: boolean;
  /** Whether the game is over */
  isGameOver: boolean;
  /** Process a server message and update the store */
  handleServerMessage: (message: ServerMessage) => void;
}

/**
 * Hook that subscribes to server messages and updates the game store.
 * Processes GAME_STATE_CHANGED, PLAYER_JOINED, SCORES_UPDATED, etc.
 * Provides derived boolean values for current game phase.
 */
export function useGameState(
  onStateChange?: (newState: GameState, prevState: GameState) => void,
): UseGameStateReturn {
  const gameState = useGameStore((s) => s.gameState);
  const roundIndex = useGameStore((s) => s.roundIndex);
  const questionIndex = useGameStore((s) => s.questionIndex);
  const setGameState = useGameStore((s) => s.setGameState);
  const setRoundIndex = useGameStore((s) => s.setRoundIndex);
  const setQuestionIndex = useGameStore((s) => s.setQuestionIndex);
  const setLeaderboard = useGameStore((s) => s.setLeaderboard);

  const handleServerMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "GAME_STATE_CHANGED": {
          const prevState = useGameStore.getState().gameState;
          setGameState(message.payload.state);
          if (message.payload.roundIndex !== undefined) {
            setRoundIndex(message.payload.roundIndex);
          }
          if (message.payload.questionIndex !== undefined) {
            setQuestionIndex(message.payload.questionIndex);
          }
          onStateChange?.(message.payload.state, prevState);
          break;
        }
        case "SCORES_UPDATED":
          setLeaderboard(message.payload.leaderboard);
          break;
        case "ROUND_RESULTS":
          setLeaderboard(message.payload.leaderboard);
          break;
        case "GAME_OVER":
          setLeaderboard(message.payload.finalLeaderboard);
          break;
        default:
          break;
      }
    },
    [setGameState, setRoundIndex, setQuestionIndex, setLeaderboard, onStateChange],
  );

  return {
    gameState,
    roundIndex,
    questionIndex,
    isAnswering: gameState === "ANSWERING",
    isReviewing: gameState === "REVIEWING",
    isLobby: gameState === "LOBBY",
    isGameOver: gameState === "GAME_OVER",
    handleServerMessage,
  };
}
