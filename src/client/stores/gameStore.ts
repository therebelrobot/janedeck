// src/client/stores/gameStore.ts — Zustand: synced game state
// Central store for game state shared across all views (host, player, presentation, audience).
import { create } from "zustand";
import type {
  GameState,
  GameType,
  ScoreEntry,
  ScoreChange,
  BingoSquare,
  BingoWinner,
  PublicTeam,
  TeamScoreEntry,
  TeamScoreChange,
} from "@/shared/types";
import type { ServerMessage } from "@/shared/messages";
import { usePlayerStore } from "./playerStore";

/** Per-team round-answering progress, from TEAM_ANSWER_PROGRESS — shared by host and presentation */
export interface TeamAnswerProgressEntry {
  teamName: string;
  answeredCount: number;
  totalQuestions: number;
}

interface GameStoreState {
  /** Current game state from server */
  gameState: GameState;
  /** Current round index */
  roundIndex: number;
  /** Total number of rounds in this game (trivia only) */
  totalRounds: number;
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
  /** Which game type this room is running */
  gameType: GameType;
  /** Trivia only: whether Team Play is enabled for this game */
  teamPlayEnabled: boolean;
  /** Team Play only: maximum players per team */
  maxTeamSize: number;
  /** The local player's bingo card (player role only) */
  bingoCard: { squares: BingoSquare[]; marked: number[] } | null;
  /** Bingo winners-so-far (across all configured patterns) */
  bingoWinners: BingoWinner[];

  /** Team Play: current team roster */
  teams: PublicTeam[];
  /** Team Play: current team leaderboard */
  teamLeaderboard: TeamScoreEntry[];
  /** Team Play: score changes from the last team score update */
  teamScoreChanges: TeamScoreChange[];
  /** Team Play: the current round's title, from ROUND_SHOW/ROUND_SHOW_FULL */
  roundTitle: string | null;
  /** Team Play: the current round's full question list (ANSWERING shows all at once) */
  roundQuestions: {
    questionId: string;
    text: string;
    type: "text" | "multiple-choice" | "true-false";
    choices?: string[];
    pointValue: number;
  }[] | null;
  /** Team Play: the team's current shared draft answers, keyed by question ID */
  roundAnswerDrafts: Record<string, { text: string; submittedBy: string }>;
  /** Team Play: per-team round-answering progress, keyed by team ID */
  teamAnswerProgress: Record<string, TeamAnswerProgressEntry>;

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
  totalRounds: 0,
  questionIndex: 0,
  leaderboard: [] as ScoreEntry[],
  scoreChanges: [] as ScoreChange[],
  isConnected: false,
  gameCode: null as string | null,
  currentQuestion: null as GameStoreState["currentQuestion"],
  timerSeconds: null as number | null,
  timerTotal: null as number | null,
  playerCount: 0,
  gameType: "trivia" as GameType,
  teamPlayEnabled: false,
  maxTeamSize: 4,
  bingoCard: null as GameStoreState["bingoCard"],
  bingoWinners: [] as BingoWinner[],
  teams: [] as PublicTeam[],
  teamLeaderboard: [] as TeamScoreEntry[],
  teamScoreChanges: [] as TeamScoreChange[],
  roundTitle: null as string | null,
  roundQuestions: null as GameStoreState["roundQuestions"],
  roundAnswerDrafts: {} as Record<string, { text: string; submittedBy: string }>,
  teamAnswerProgress: {} as Record<string, TeamAnswerProgressEntry>,
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
          gameType: message.payload.gameType,
          ...(message.payload.roundIndex !== undefined && {
            roundIndex: message.payload.roundIndex,
          }),
          ...(message.payload.totalRounds !== undefined && {
            totalRounds: message.payload.totalRounds,
          }),
          ...(message.payload.questionIndex !== undefined && {
            questionIndex: message.payload.questionIndex,
          }),
          ...(message.payload.teamPlayEnabled !== undefined && {
            teamPlayEnabled: message.payload.teamPlayEnabled,
          }),
        });
        // Reset timer on state changes away from ANSWERING
        if (message.payload.state !== "ANSWERING") {
          set({ timerSeconds: null });
        }
        // Clear question data when returning to lobby
        if (message.payload.state === "LOBBY") {
          set({
            currentQuestion: null,
            timerSeconds: null,
            timerTotal: null,
            roundTitle: null,
            roundQuestions: null,
            roundAnswerDrafts: {},
          });
        }
        break;

      case "ROUND_SHOW":
      case "ROUND_SHOW_FULL":
        set({
          roundTitle: message.payload.roundTitle,
          roundQuestions: message.payload.questions,
          timerTotal: message.payload.timeLimit,
          timerSeconds: message.payload.timeLimit,
          roundAnswerDrafts: {},
          teamAnswerProgress: {},
        });
        break;

      case "TEAM_ANSWER_PROGRESS":
        set((state) => ({
          teamAnswerProgress: {
            ...state.teamAnswerProgress,
            [message.payload.teamId]: {
              teamName: message.payload.teamName,
              answeredCount: message.payload.answeredCount,
              totalQuestions: message.payload.totalQuestions,
            },
          },
        }));
        break;

      case "TEAM_UPDATED": {
        set({ teams: message.payload.teams });
        // Derive the local player's own team, so playerStore stays in sync
        // even though the server never sends a dedicated "your team" ack.
        const localPlayerId = usePlayerStore.getState().playerId;
        if (localPlayerId) {
          const ownTeam = message.payload.teams.find((t) =>
            t.members.some((m) => m.id === localPlayerId),
          );
          usePlayerStore.getState().setTeamId(ownTeam?.id ?? null);
        }
        break;
      }

      case "TEAM_SCORES_UPDATED":
        set({
          teamLeaderboard: message.payload.leaderboard,
          teamScoreChanges: message.payload.changes,
        });
        break;

      case "TEAM_ANSWER_UPDATED":
        set((state) => ({
          roundAnswerDrafts: {
            ...state.roundAnswerDrafts,
            [message.payload.questionId]: {
              text: message.payload.text,
              submittedBy: message.payload.submittedByName,
            },
          },
        }));
        break;

      case "TEAM_ANSWERS_SNAPSHOT": {
        const drafts: Record<string, { text: string; submittedBy: string }> = {};
        for (const a of message.payload.answers) {
          drafts[a.questionId] = { text: a.text, submittedBy: a.submittedByName };
        }
        set({ roundAnswerDrafts: drafts });
        break;
      }

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

      case "JOIN_ACCEPTED":
        if ("teamPlayEnabled" in message.payload.gameSettings) {
          set({
            teamPlayEnabled: message.payload.gameSettings.teamPlayEnabled,
            maxTeamSize: message.payload.gameSettings.maxTeamSize,
          });
        }
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

      case "BINGO_CARD_ASSIGNED":
        set({
          bingoCard: {
            squares: message.payload.squares,
            marked: message.payload.marked,
          },
        });
        break;

      case "BINGO_SQUARE_MARKED":
        if (message.payload.playerId === usePlayerStore.getState().playerId) {
          set((state) =>
            state.bingoCard
              ? {
                bingoCard: {
                  ...state.bingoCard,
                  marked: [...state.bingoCard.marked, message.payload.squareIndex],
                },
              }
              : {},
          );
        }
        break;

      case "BINGO_SQUARE_UNMARKED":
        if (message.payload.playerId === usePlayerStore.getState().playerId) {
          set((state) =>
            state.bingoCard
              ? {
                bingoCard: {
                  ...state.bingoCard,
                  marked: state.bingoCard.marked.filter(
                    (index) => index !== message.payload.squareIndex,
                  ),
                },
              }
              : {},
          );
        }
        break;

      case "BINGO_WINNER":
        set({ bingoWinners: message.payload.allWinners });
        break;

      case "BINGO_GAME_ENDED":
        set({ bingoWinners: message.payload.winners });
        break;

      default:
        break;
    }
  },

  reset: () => set(initialState),
}));
