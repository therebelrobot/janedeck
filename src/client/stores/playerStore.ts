// src/client/stores/playerStore.ts — Zustand: local player state
// Manages the current player's identity, score, answers, and results.
// R1.4: displayName is always the chosen name. R2.1: No demographic data collected.
import { create } from "zustand";
import type { AnswerStatus } from "@/shared/types";
import type { ServerMessage } from "@/shared/messages";

interface AnswerResult {
  questionId: string;
  status: AnswerStatus;
  pointsAwarded: number;
  bonusPoints: number;
  hostNote?: string;
}

interface PlayerStoreState {
  /** Local player ID (from JOIN_ACCEPTED) */
  playerId: string | null;
  /** Player's chosen display name — R1.4 */
  displayName: string | null;
  /** DiceBear avatar seed (set before joining, confirmed by server on JOIN_ACCEPTED) */
  avatarSeed: string | null;
  /** Player's current score */
  score: number;
  /** Player's current rank */
  rank: number | null;
  /** Whether the player has submitted an answer for the current question */
  hasSubmitted: boolean;
  /** Result of the last answer */
  lastAnswerResult: AnswerResult | null;
  /** All answer results keyed by questionId */
  answerHistory: Record<string, AnswerResult>;
  /** Whether the player has been kicked */
  wasKicked: boolean;
  /** Kick reason if kicked */
  kickReason: string | null;
  /** Whether join was rejected */
  joinRejected: boolean;
  /** Join rejection reason */
  joinRejectionReason: string | null;

  // Actions
  setPlayerId: (id: string) => void;
  setDisplayName: (name: string) => void;
  setAvatarSeed: (seed: string) => void;
  setScore: (score: number) => void;
  setRank: (rank: number) => void;
  setHasSubmitted: (submitted: boolean) => void;
  setLastAnswerResult: (result: AnswerResult | null) => void;

  /** Process player-specific server messages */
  handlePlayerMessage: (message: ServerMessage) => void;

  reset: () => void;
}

const initialState = {
  playerId: null as string | null,
  displayName: null as string | null,
  avatarSeed: null as string | null,
  score: 0,
  rank: null as number | null,
  hasSubmitted: false,
  lastAnswerResult: null as AnswerResult | null,
  answerHistory: {} as Record<string, AnswerResult>,
  wasKicked: false,
  kickReason: null as string | null,
  joinRejected: false,
  joinRejectionReason: null as string | null,
};

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  ...initialState,

  setPlayerId: (playerId) => set({ playerId }),
  setDisplayName: (displayName) => set({ displayName }),
  setAvatarSeed: (avatarSeed) => set({ avatarSeed }),
  setScore: (score) => set({ score }),
  setRank: (rank) => set({ rank }),
  setHasSubmitted: (hasSubmitted) => set({ hasSubmitted }),
  setLastAnswerResult: (lastAnswerResult) => set({ lastAnswerResult }),

  handlePlayerMessage: (message: ServerMessage) => {
    switch (message.type) {
      case "JOIN_ACCEPTED":
        set({
          playerId: message.payload.playerId,
          joinRejected: false,
          joinRejectionReason: null,
        });
        break;

      case "JOIN_REJECTED":
        set({
          joinRejected: true,
          joinRejectionReason: message.payload.reason,
        });
        break;

      case "YOUR_ANSWER_RESULT": {
        const result: AnswerResult = {
          questionId: message.payload.questionId,
          status: message.payload.status,
          pointsAwarded: message.payload.pointsAwarded,
          bonusPoints: message.payload.bonusPoints,
          hostNote: message.payload.hostNote,
        };
        set((state) => ({
          lastAnswerResult: result,
          answerHistory: {
            ...state.answerHistory,
            [message.payload.questionId]: result,
          },
        }));
        break;
      }

      case "YOUR_SCORE":
        set({
          score: message.payload.score,
          rank: message.payload.rank,
        });
        break;

      case "KICKED":
        set({
          wasKicked: true,
          kickReason: message.payload.reason,
        });
        break;

      case "GAME_STATE_CHANGED":
        // Reset submission status when a new question starts
        if (
          message.payload.state === "QUESTION_DISPLAY" ||
          message.payload.state === "ANSWERING"
        ) {
          set({ hasSubmitted: false, lastAnswerResult: null });
        }
        break;

      default:
        break;
    }
  },

  reset: () => set(initialState),
}));
