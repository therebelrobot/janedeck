// src/client/stores/hostStore.ts — Zustand: host-only state
// Manages host authentication, answer review pipeline, and host-specific messages.
import { create } from "zustand";
import type { AnswerReview } from "@/shared/types";
import type { ServerMessage } from "@/shared/messages";

interface HostStoreState {
  /** Auth token from login — R9.5: session-scoped */
  token: string | null;
  /** Answers pending review for the current question */
  answersForReview: AnswerReview[];
  /** Historical answers keyed by questionId */
  allAnswers: Record<string, AnswerReview[]>;
  /** Count of submitted answers for the current question */
  answeredCount: number;
  /** Total players in the game */
  totalPlayers: number;
  /** The current question's full data (with correct answer, host-only) */
  currentQuestionFull: {
    questionId: string;
    correctAnswer: string;
    acceptableAnswers: string[];
  } | null;
  /** Game code after creation */
  gameCode: string | null;

  // Actions
  setToken: (token: string | null) => void;
  setAnswersForReview: (answers: AnswerReview[]) => void;
  setAnswerProgress: (answered: number, total: number) => void;
  updateSingleAnswer: (answerId: string, updates: Partial<AnswerReview>) => void;
  setGameCode: (code: string | null) => void;

  /** Process host-specific server messages */
  handleHostMessage: (message: ServerMessage) => void;

  reset: () => void;
}

const initialState = {
  token: null as string | null,
  answersForReview: [] as AnswerReview[],
  allAnswers: {} as Record<string, AnswerReview[]>,
  answeredCount: 0,
  totalPlayers: 0,
  currentQuestionFull: null as HostStoreState["currentQuestionFull"],
  gameCode: null as string | null,
};

export const useHostStore = create<HostStoreState>((set) => ({
  ...initialState,

  setToken: (token) => set({ token }),

  setAnswersForReview: (answersForReview) =>
    set((state) => {
      // Store in allAnswers history if we know the question ID
      const questionId = state.currentQuestionFull?.questionId;
      if (questionId) {
        return {
          answersForReview,
          allAnswers: {
            ...state.allAnswers,
            [questionId]: answersForReview,
          },
        };
      }
      return { answersForReview };
    }),

  setAnswerProgress: (answeredCount, totalPlayers) =>
    set({ answeredCount, totalPlayers }),

  updateSingleAnswer: (answerId, updates) =>
    set((state) => ({
      answersForReview: state.answersForReview.map((a) =>
        a.answerId === answerId ? { ...a, ...updates } : a,
      ),
    })),

  setGameCode: (gameCode) => set({ gameCode }),

  handleHostMessage: (message: ServerMessage) => {
    switch (message.type) {
      case "GAME_CREATED":
        set({ gameCode: message.payload.gameCode });
        break;

      case "QUESTION_SHOW_FULL":
        set({
          currentQuestionFull: {
            questionId: message.payload.questionId,
            correctAnswer: message.payload.correctAnswer,
            acceptableAnswers: message.payload.acceptableAnswers,
          },
          // Reset answer tracking for new question
          answeredCount: 0,
          answersForReview: [],
        });
        break;

      case "ANSWERS_FOR_REVIEW":
        set((state) => {
          const questionId = state.currentQuestionFull?.questionId;
          const answers = message.payload.answers;
          if (questionId) {
            return {
              answersForReview: answers,
              allAnswers: {
                ...state.allAnswers,
                [questionId]: answers,
              },
            };
          }
          return { answersForReview: answers };
        });
        break;

      case "ANSWER_SUBMITTED_NOTIFICATION":
        set({
          answeredCount: message.payload.answeredCount,
          totalPlayers: message.payload.totalPlayers,
        });
        break;

      default:
        break;
    }
  },

  reset: () => set(initialState),
}));
