// src/client/stores/gameStore.ts — Zustand: synced game state
// Central store for game state shared across all views (host, player, presentation, audience).
import { create } from "zustand";
import type { GameState, ScoreEntry, ScoreChange } from "@/shared/types";
import type { ServerMessage } from "@/shared/messages";

interface GameStoreState {
  /** Current game state from server */
  gameState: GameState;
  /** Current round index */
  roundIndex: number;
  /** Current question index */
  questionIndex: number;
  /** Current leaderboard */
  leaderboard: ScoreEntry[];
  /** Score changes from the last score update */
  scoreChanges: ScoreChange[];
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** Game code for the current game */
  gameCode: string | null;
  /** Current question data (from QUESTION_SHOW) */
  currentQuestion: {
    questionId: string;
    text: string;
    type: "text" | "multiple-choice" | "true-false";
    choices?: string[];
    pointValue: number;
    timeLimit: number;
    questionNumber: number;
    totalQuestions: number;
  } | null;
  /** Timer state */
  timerSeconds: number | null;
  /** Total timer duration for progress calculation */
  timerTotal: number | null;
  /** Player count in the game */
  playerCount: number;

  // Actions
  setGameState: (state: GameState) => void;
  setRoundIndex: (index: number) => void;
  setQuestionIndex: (index: number) => void;
  setLeaderboard: (leaderboard: ScoreEntry[]) => void;
  setScoreChanges: (changes: ScoreChange[]) => void;
  setIsConnected: (connected: boolean) => void;
  setGameCode: (code: string | null) => void;
  setTimerSeconds: (seconds: number | null) => void;
  setTimerTotal: (total: number | null) => void;
  setPlayerCount: (count: number) => void;

  /** Process any server message and update relevant state */
  handleServerMessage: (message: ServerMessage) => void;

  reset: () => void;
}

const initialState = {
  gameState: "LOBBY" as GameState,
  roundIndex: 0,
  questionIndex: 0,
  leaderboard: [] as ScoreEntry[],
  scoreChanges: [] as ScoreChange[],
  isConnected: false,
  gameCode: null as string | null,
  currentQuestion: null as GameStoreState["currentQuestion"],
  timerSeconds: null as number | null,
  timerTotal: null as number | null,
  playerCount: 0,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  setGameState: (gameState) => set({ gameState }),
  setRoundIndex: (roundIndex) => set({ roundIndex }),
  setQuestionIndex: (questionIndex) => set({ questionIndex }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setScoreChanges: (scoreChanges) => set({ scoreChanges }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setGameCode: (gameCode) => set({ gameCode }),
  setTimerSeconds: (timerSeconds) => set({ timerSeconds }),
  setTimerTotal: (timerTotal) => set({ timerTotal }),
  setPlayerCount: (playerCount) => set({ playerCount }),

  handleServerMessage: (message: ServerMessage) => {
    switch (message.type) {
      case "GAME_STATE_CHANGED":
        set({
          gameState: message.payload.state,
          ...(message.payload.roundIndex !== undefined && {
            roundIndex: message.payload.roundIndex,
          }),
          ...(message.payload.questionIndex !== undefined && {
            questionIndex: message.payload.questionIndex,
          }),
        });
        // Reset timer on state changes away from ANSWERING
        if (message.payload.state !== "ANSWERING") {
          set({ timerSeconds: null });
        }
        // Clear question data when returning to lobby
        if (message.payload.state === "LOBBY") {
          set({ currentQuestion: null, timerSeconds: null, timerTotal: null });
        }
        break;

      case "QUESTION_SHOW":
        set({
          currentQuestion: {
            questionId: message.payload.questionId,
            text: message.payload.text,
            type: message.payload.type,
            choices: message.payload.choices,
            pointValue: message.payload.pointValue,
            timeLimit: message.payload.timeLimit,
            questionNumber: message.payload.questionNumber,
            totalQuestions: message.payload.totalQuestions,
          },
          timerTotal: message.payload.timeLimit,
          timerSeconds: message.payload.timeLimit,
        });
        break;

      case "QUESTION_SHOW_FULL":
        // Host gets the full question with answers — store the same display data
        set({
          currentQuestion: {
            questionId: message.payload.questionId,
            text: message.payload.text,
            type: message.payload.type,
            choices: message.payload.choices,
            pointValue: message.payload.pointValue,
            timeLimit: message.payload.timeLimit,
            questionNumber: message.payload.questionNumber,
            totalQuestions: message.payload.totalQuestions,
          },
          timerTotal: message.payload.timeLimit,
          timerSeconds: message.payload.timeLimit,
        });
        break;

      case "TIMER_TICK":
        set({ timerSeconds: message.payload.secondsRemaining });
        break;

      case "TIMER_EXPIRED":
        set({ timerSeconds: 0 });
        break;

      case "SCORES_UPDATED":
        set({
          leaderboard: message.payload.leaderboard,
          scoreChanges: message.payload.changes,
        });
        break;

      case "ROUND_RESULTS":
        set({ leaderboard: message.payload.leaderboard });
        break;

      case "GAME_OVER":
        set({ leaderboard: message.payload.finalLeaderboard });
        break;

      case "PLAYER_JOINED":
        set({ playerCount: message.payload.playerCount });
        break;

      case "PLAYER_LEFT":
        set({ playerCount: message.payload.playerCount });
        break;

      default:
        break;
    }
  },

  reset: () => set(initialState),
}));
