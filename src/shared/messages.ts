// src/shared/messages.ts — WebSocket message type definitions for JaneDeck
// All messages use a discriminated union on the `type` field.

import type {
  AnswerReview,
  AnswerStatus,
  GameSettings,
  GameState,
  ScoreChange,
  ScoreEntry,
  GameStats,
} from "./types";

// ─── Client → Server Messages ────────────────────────────────────────────────

// Host messages
export interface HostCreateGameMessage {
  type: "HOST_CREATE_GAME";
  payload: {
    token: string;
    settings: GameSettings;
    rounds: Array<{
      title: string;
      questions: Array<{
        text: string;
        correctAnswer: string;
        acceptableAnswers?: string[];
        pointValue: number;
        timeLimit: number;
        type: "text" | "multiple-choice" | "true-false";
        choices?: string[];
        mediaUrl?: string;
      }>;
    }>;
  };
}

export interface HostStartGameMessage {
  type: "HOST_START_GAME";
  payload: Record<string, never>;
}

export interface HostStartQuestionMessage {
  type: "HOST_START_QUESTION";
  payload: Record<string, never>;
}

export interface HostCloseAnswersMessage {
  type: "HOST_CLOSE_ANSWERS";
  payload: Record<string, never>;
}

export interface HostJudgeAnswerMessage {
  type: "HOST_JUDGE_ANSWER";
  payload: {
    answerId: string;
    status: AnswerStatus;
    bonusPoints?: number;
    hostNote?: string;
  };
}

export interface HostBulkJudgeMessage {
  type: "HOST_BULK_JUDGE";
  payload: {
    judgments: Array<{
      answerId: string;
      status: AnswerStatus;
    }>;
  };
}

export interface HostRevealScoresMessage {
  type: "HOST_REVEAL_SCORES";
  payload: Record<string, never>;
}

export interface HostNextQuestionMessage {
  type: "HOST_NEXT_QUESTION";
  payload: Record<string, never>;
}

export interface HostNextRoundMessage {
  type: "HOST_NEXT_ROUND";
  payload: Record<string, never>;
}

export interface HostResetGameMessage {
  type: "HOST_RESET_GAME";
  payload: Record<string, never>;
}

export interface HostKickPlayerMessage {
  type: "HOST_KICK_PLAYER";
  payload: {
    playerId: string;
  };
}

export interface HostUpdateSettingsMessage {
  type: "HOST_UPDATE_SETTINGS";
  payload: {
    settings: Partial<GameSettings>;
  };
}

// Player messages
export interface PlayerJoinMessage {
  type: "PLAYER_JOIN";
  payload: {
    displayName: string;
  };
}

export interface PlayerRejoinMessage {
  type: "PLAYER_REJOIN";
  payload: {
    playerId: string;
  };
}

export interface PlayerSubmitAnswerMessage {
  type: "PLAYER_SUBMIT_ANSWER";
  payload: {
    questionId: string;
    text: string;
  };
}

export interface PlayerBuzzerMessage {
  type: "PLAYER_BUZZER";
  payload: {
    questionId: string;
  };
}

// Audience messages
export interface AudienceJoinMessage {
  type: "AUDIENCE_JOIN";
  payload: {
    displayName: string;
  };
}

export interface AudienceVoteMessage {
  type: "AUDIENCE_VOTE";
  payload: {
    questionId: string;
    vote: string;
  };
}

// Presentation messages
export interface PresentationConnectMessage {
  type: "PRESENTATION_CONNECT";
  payload: {
    token: string;
  };
}

/** Union of all client → server messages */
export type ClientMessage =
  | HostCreateGameMessage
  | HostStartGameMessage
  | HostStartQuestionMessage
  | HostCloseAnswersMessage
  | HostJudgeAnswerMessage
  | HostBulkJudgeMessage
  | HostRevealScoresMessage
  | HostNextQuestionMessage
  | HostNextRoundMessage
  | HostResetGameMessage
  | HostKickPlayerMessage
  | HostUpdateSettingsMessage
  | PlayerJoinMessage
  | PlayerRejoinMessage
  | PlayerSubmitAnswerMessage
  | PlayerBuzzerMessage
  | AudienceJoinMessage
  | AudienceVoteMessage
  | PresentationConnectMessage;

// ─── Server → Client Messages ────────────────────────────────────────────────

// Broadcast messages
export interface GameStateChangedMessage {
  type: "GAME_STATE_CHANGED";
  payload: {
    state: GameState;
    roundIndex?: number;
    questionIndex?: number;
  };
  timestamp: number;
}

export interface PlayerJoinedMessage {
  type: "PLAYER_JOINED";
  payload: {
    playerId: string;
    displayName: string;
    playerCount: number;
  };
  timestamp: number;
}

export interface PlayerLeftMessage {
  type: "PLAYER_LEFT";
  payload: {
    playerId: string;
    playerCount: number;
  };
  timestamp: number;
}

export interface TimerTickMessage {
  type: "TIMER_TICK";
  payload: {
    secondsRemaining: number;
  };
  timestamp: number;
}

export interface TimerExpiredMessage {
  type: "TIMER_EXPIRED";
  payload: Record<string, never>;
  timestamp: number;
}

export interface ScoresUpdatedMessage {
  type: "SCORES_UPDATED";
  payload: {
    leaderboard: ScoreEntry[];
    changes: ScoreChange[];
  };
  timestamp: number;
}

export interface RoundResultsMessage {
  type: "ROUND_RESULTS";
  payload: {
    roundIndex: number;
    leaderboard: ScoreEntry[];
    roundMVP: {
      playerId: string;
      displayName: string;
      roundScore: number;
    } | null;
  };
  timestamp: number;
}

export interface GameOverMessage {
  type: "GAME_OVER";
  payload: {
    finalLeaderboard: ScoreEntry[];
    winner: {
      playerId: string;
      displayName: string;
      score: number;
    } | null;
    stats: GameStats;
  };
  timestamp: number;
}

// Question display messages
export interface QuestionShowMessage {
  type: "QUESTION_SHOW";
  payload: {
    questionId: string;
    text: string;
    type: "text" | "multiple-choice" | "true-false";
    choices?: string[];
    pointValue: number;
    timeLimit: number;
    questionNumber: number;
    totalQuestions: number;
  };
  timestamp: number;
}

export interface QuestionShowFullMessage {
  type: "QUESTION_SHOW_FULL";
  payload: {
    questionId: string;
    text: string;
    type: "text" | "multiple-choice" | "true-false";
    choices?: string[];
    pointValue: number;
    timeLimit: number;
    questionNumber: number;
    totalQuestions: number;
    correctAnswer: string;
    acceptableAnswers: string[];
  };
  timestamp: number;
}

// Host-only messages
export interface AnswersForReviewMessage {
  type: "ANSWERS_FOR_REVIEW";
  payload: {
    answers: AnswerReview[];
  };
  timestamp: number;
}

export interface AnswerSubmittedNotificationMessage {
  type: "ANSWER_SUBMITTED_NOTIFICATION";
  payload: {
    playerId: string;
    displayName: string;
    answeredCount: number;
    totalPlayers: number;
  };
  timestamp: number;
}

export interface GameCreatedMessage {
  type: "GAME_CREATED";
  payload: {
    gameCode: string;
  };
  timestamp: number;
}

// Player-specific messages
export interface JoinAcceptedMessage {
  type: "JOIN_ACCEPTED";
  payload: {
    playerId: string;
    gameSettings: GameSettings;
  };
  timestamp: number;
}

export interface JoinRejectedMessage {
  type: "JOIN_REJECTED";
  payload: {
    reason: string;
  };
  timestamp: number;
}

export interface YourAnswerResultMessage {
  type: "YOUR_ANSWER_RESULT";
  payload: {
    questionId: string;
    status: AnswerStatus;
    pointsAwarded: number;
    bonusPoints: number;
    hostNote?: string;
  };
  timestamp: number;
}

export interface YourScoreMessage {
  type: "YOUR_SCORE";
  payload: {
    score: number;
    rank: number;
  };
  timestamp: number;
}

export interface KickedMessage {
  type: "KICKED";
  payload: {
    reason: string;
  };
  timestamp: number;
}

export interface ErrorMessage {
  type: "ERROR";
  payload: {
    code: string;
    message: string;
  };
  timestamp: number;
}

/** Union of all server → client messages */
export type ServerMessage =
  | GameStateChangedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | TimerTickMessage
  | TimerExpiredMessage
  | ScoresUpdatedMessage
  | RoundResultsMessage
  | GameOverMessage
  | QuestionShowMessage
  | QuestionShowFullMessage
  | AnswersForReviewMessage
  | AnswerSubmittedNotificationMessage
  | GameCreatedMessage
  | JoinAcceptedMessage
  | JoinRejectedMessage
  | YourAnswerResultMessage
  | YourScoreMessage
  | KickedMessage
  | ErrorMessage;
