// src/shared/types.ts — Shared TypeScript interfaces for JaneDeck
// Used by both server (PartyKit) and client (React)

// === Game States ===
export type GameState =
  | "LOBBY"
  | "ROUND_INTRO"
  | "QUESTION_DISPLAY"
  | "ANSWERING"
  | "REVIEWING"
  | "SCORE_REVEAL"
  | "ROUND_RESULTS"
  | "GAME_OVER";

// === Player Roles ===
export type PlayerRole = "host" | "player" | "audience" | "presentation";

// === Question Types ===
export type QuestionType = "text" | "multiple-choice" | "true-false";

// === Answer Status ===
export type AnswerStatus = "pending" | "correct" | "incorrect" | "bonus";

// === Game ===
export interface Game {
  /** 6-char alphanumeric game code — also the room ID */
  id: string;
  /** Opaque token identifying the host session */
  hostToken: string;
  /** Current state machine state */
  state: GameState;
  /** Index into rounds[] */
  currentRoundIndex: number;
  /** Index into current round's questions[] */
  currentQuestionIndex: number;
  /** Ordered list of rounds */
  rounds: Round[];
  /** Players keyed by player ID */
  players: Record<string, Player>;
  /** Game configuration */
  settings: GameSettings;
  /** Unix timestamp ms of creation */
  createdAt: number;
  /** Unix timestamp ms when the current timer started (null if no timer active) */
  timerStartedAt: number | null;
  /** Duration in seconds of the current timer (null if no timer active) */
  timerDuration: number | null;
}

// === Game Settings ===
export interface GameSettings {
  /** Maximum number of players allowed (default: 16) */
  maxPlayers: number;
  /** Whether audience mode is enabled (default: true) */
  allowAudience: boolean;
  /** Points audience can earn per question */
  audienceBonusPoints: number;
  /** Default time limit in seconds (default: 30) */
  defaultTimeLimit: number;
  /** After review, show correct answer to players */
  showAnswersToPlayers: boolean;
}

// === Round ===
export interface Round {
  id: string;
  /** Position index in the game */
  index: number;
  /** Display title, e.g., "General Knowledge" */
  title: string;
  /** Questions in this round */
  questions: Question[];
  /** Current round state */
  state: RoundState;
}

export type RoundState = "pending" | "active" | "completed";

// === Question ===
export interface Question {
  id: string;
  /** Question text displayed to players */
  text: string;
  /** The primary correct answer */
  correctAnswer: string;
  /** Additional acceptable answers for fuzzy matching */
  acceptableAnswers?: string[];
  /** Points awarded for a correct answer (default: 100) */
  pointValue: number;
  /** Time limit in seconds — overrides game default */
  timeLimit: number;
  /** Question format */
  type: QuestionType;
  /** Multiple-choice options (only for "multiple-choice" type) */
  choices?: string[];
  /** Optional media URL (image or audio) */
  mediaUrl?: string;
}

// === Player ===
// R1.4: displayName is always the chosen name.
// R2.1/R2.3: No gender or demographic data collected — not needed for game mechanics.
export interface Player {
  /** Unique player ID (nanoid) */
  id: string;
  /** Player's chosen display name — R1.2: Unicode-safe, max 256 bytes, no format validation (R1.6) */
  displayName: string;
  /** Player's role in the game */
  role: "player" | "audience";
  /** Cumulative score */
  score: number;
  /** Whether the player is currently connected */
  isConnected: boolean;
  /** Unix timestamp ms when the player joined */
  joinedAt: number;
  /** Answers keyed by question ID */
  answers: Record<string, Answer>;
}

// === Answer ===
export interface Answer {
  id: string;
  /** ID of the question this answer is for */
  questionId: string;
  /** ID of the player who submitted this answer */
  playerId: string;
  /** The player's submitted answer text */
  text: string;
  /** Unix timestamp ms of submission */
  submittedAt: number;
  /** Fuse.js fuzzy match score (0.0 = perfect match, 1.0 = no match). null if not yet scored. */
  fuzzyScore: number | null;
  /** Current review status */
  status: AnswerStatus;
  /** Total points awarded (base + bonus) */
  pointsAwarded: number;
  /** Extra points awarded by host */
  bonusPoints: number;
  /** Host-added note for funny/creative answers */
  hostNote: string | null;
}

// === Answer Review (sent to host during REVIEWING state) ===
export interface AnswerReview {
  answerId: string;
  playerId: string;
  displayName: string;
  text: string;
  /** 0.0 to 1.0 match score against correctAnswer */
  fuzzyScore: number;
  /** Which correct/acceptable answer it matched against */
  fuzzyMatchedAgainst: string;
  /** Suggested classification based on fuzzy thresholds */
  suggestedStatus: "correct" | "incorrect" | "needs_review";
  submittedAt: number;
}

// === Connection State (tagged on WebSocket connections) ===
export interface ConnectionState {
  role: PlayerRole;
  /** For player/audience connections */
  playerId?: string;
  /** The player's chosen name — R1.4: always the chosen name */
  displayName?: string;
}

// === Score Entry (for leaderboard display) ===
export interface ScoreEntry {
  playerId: string;
  displayName: string;
  score: number;
  rank: number;
}

// === Score Change (for animated score reveals) ===
export interface ScoreChange {
  playerId: string;
  displayName: string;
  previousScore: number;
  newScore: number;
  pointsEarned: number;
  previousRank: number;
  newRank: number;
}

// === Game Stats (shown at game over) ===
export interface GameStats {
  totalQuestions: number;
  totalAnswers: number;
  averageScore: number;
  fastestAnswer: {
    playerId: string;
    displayName: string;
    timeMs: number;
  } | null;
  mostBonusPoints: {
    playerId: string;
    displayName: string;
    bonusTotal: number;
  } | null;
}
