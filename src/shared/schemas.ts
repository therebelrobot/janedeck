// src/shared/schemas.ts — Zod schemas for runtime validation of WebSocket messages

import { z } from "zod";

// ─── Shared Enums ─────────────────────────────────────────────────────────────

export const GameStateSchema = z.enum([
  "LOBBY",
  "ROUND_INTRO",
  "QUESTION_DISPLAY",
  "ANSWERING",
  "REVIEWING",
  "SCORE_REVEAL",
  "ROUND_RESULTS",
  "GAME_OVER",
  "BINGO_PLAYING",
  "BINGO_ENDED",
]);

export const GameTypeSchema = z.enum(["trivia", "bingo"]);

export const PlayerRoleSchema = z.enum([
  "host",
  "player",
  "audience",
  "presentation",
]);

export const QuestionTypeSchema = z.enum([
  "text",
  "multiple-choice",
  "true-false",
]);

export const AnswerStatusSchema = z.enum([
  "pending",
  "correct",
  "incorrect",
  "bonus",
]);

// ─── Shared Data Schemas ──────────────────────────────────────────────────────

export const GameSettingsSchema = z.object({
  maxPlayers: z.number().int().min(1).max(50),
  allowAudience: z.boolean(),
  audienceBonusPoints: z.number().int().min(0),
  defaultTimeLimit: z.number().int().min(5).max(300),
  showAnswersToPlayers: z.boolean(),
});

export const ScoreEntrySchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  score: z.number(),
  rank: z.number().int(),
});

export const ScoreChangeSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  previousScore: z.number(),
  newScore: z.number(),
  pointsEarned: z.number(),
  previousRank: z.number().int(),
  newRank: z.number().int(),
});

export const AnswerReviewSchema = z.object({
  answerId: z.string(),
  playerId: z.string(),
  displayName: z.string(),
  text: z.string(),
  fuzzyScore: z.number(),
  fuzzyMatchedAgainst: z.string(),
  suggestedStatus: z.enum(["correct", "incorrect", "needs_review"]),
  submittedAt: z.number(),
});

export const BingoCardModeSchema = z.enum(["numbered", "phrasePool"]);

export const BingoWinPatternSchema = z.enum([
  "line",
  "four_corners",
  "blackout",
]);

export const BingoPhraseEntrySchema = z.object({
  text: z.string().min(1),
  definition: z.string().optional(),
});

export const BingoSettingsSchema = z.object({
  maxPlayers: z.number().int().min(1).max(50),
  cardMode: BingoCardModeSchema,
  numberRange: z.number().int().min(1),
  phrasePool: z.array(BingoPhraseEntrySchema),
  gridSize: z.number().int().min(3).max(7),
  freeSpace: z.boolean(),
  freeSpacePhrase: BingoPhraseEntrySchema.optional(),
  winPatterns: z.array(BingoWinPatternSchema).min(1),
});

export const BingoSquareSchema = z.object({
  index: z.number().int().min(0),
  label: z.string(),
  isFree: z.boolean(),
  definition: z.string().optional(),
});

export const BingoWinnerSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  pattern: BingoWinPatternSchema,
  achievedAt: z.number(),
});

export const GameStatsSchema = z.object({
  totalQuestions: z.number().int(),
  totalAnswers: z.number().int(),
  averageScore: z.number(),
  fastestAnswer: z
    .object({
      playerId: z.string(),
      displayName: z.string(),
      timeMs: z.number(),
    })
    .nullable(),
  mostBonusPoints: z
    .object({
      playerId: z.string(),
      displayName: z.string(),
      bonusTotal: z.number(),
    })
    .nullable(),
});

// ─── Client → Server Message Schemas ──────────────────────────────────────────

export const HostCreateGameSchema = z.object({
  type: z.literal("HOST_CREATE_GAME"),
  payload: z.object({
    token: z.string(),
    settings: GameSettingsSchema,
    rounds: z.array(
      z.object({
        title: z.string().min(1),
        questions: z.array(
          z.object({
            text: z.string().min(1),
            correctAnswer: z.string().min(1),
            acceptableAnswers: z.array(z.string()).optional(),
            pointValue: z.number().int().min(1),
            timeLimit: z.number().int().min(5).max(300),
            type: QuestionTypeSchema,
            choices: z.array(z.string()).optional(),
            mediaUrl: z.string().url().optional(),
          }),
        ),
      }),
    ),
  }),
});

const EmptyPayload = z.object({}).strict();

export const HostStartGameSchema = z.object({
  type: z.literal("HOST_START_GAME"),
  payload: EmptyPayload,
});

export const HostStartQuestionSchema = z.object({
  type: z.literal("HOST_START_QUESTION"),
  payload: EmptyPayload,
});

export const HostCloseAnswersSchema = z.object({
  type: z.literal("HOST_CLOSE_ANSWERS"),
  payload: EmptyPayload,
});

export const HostJudgeAnswerSchema = z.object({
  type: z.literal("HOST_JUDGE_ANSWER"),
  payload: z.object({
    answerId: z.string(),
    status: AnswerStatusSchema,
    bonusPoints: z.number().int().min(0).optional(),
    hostNote: z.string().optional(),
  }),
});

export const HostBulkJudgeSchema = z.object({
  type: z.literal("HOST_BULK_JUDGE"),
  payload: z.object({
    judgments: z.array(
      z.object({
        answerId: z.string(),
        status: AnswerStatusSchema,
      }),
    ),
  }),
});

export const HostRevealScoresSchema = z.object({
  type: z.literal("HOST_REVEAL_SCORES"),
  payload: EmptyPayload,
});

export const HostNextQuestionSchema = z.object({
  type: z.literal("HOST_NEXT_QUESTION"),
  payload: EmptyPayload,
});

export const HostNextRoundSchema = z.object({
  type: z.literal("HOST_NEXT_ROUND"),
  payload: EmptyPayload,
});

export const HostResetGameSchema = z.object({
  type: z.literal("HOST_RESET_GAME"),
  payload: EmptyPayload,
});

export const HostEndGameSchema = z.object({
  type: z.literal("HOST_END_GAME"),
  payload: EmptyPayload,
});

export const HostKickPlayerSchema = z.object({
  type: z.literal("HOST_KICK_PLAYER"),
  payload: z.object({
    playerId: z.string(),
  }),
});

export const HostUpdateSettingsSchema = z.object({
  type: z.literal("HOST_UPDATE_SETTINGS"),
  payload: z.object({
    settings: GameSettingsSchema.partial(),
  }),
});

// R1.2: display name accepts full Unicode, no regex validation (R1.6)
// R1.6: reject only empty strings and strings > 256 bytes
export const PlayerJoinSchema = z.object({
  type: z.literal("PLAYER_JOIN"),
  payload: z.object({
    displayName: z.string().min(1).max(256),
    avatarSeed: z.string().min(1).max(64).default("default"),
  }),
});

export const PlayerRejoinSchema = z.object({
  type: z.literal("PLAYER_REJOIN"),
  payload: z.object({
    playerId: z.string(),
  }),
});

export const PlayerSubmitAnswerSchema = z.object({
  type: z.literal("PLAYER_SUBMIT_ANSWER"),
  payload: z.object({
    questionId: z.string(),
    text: z.string(),
  }),
});

export const PlayerBuzzerSchema = z.object({
  type: z.literal("PLAYER_BUZZER"),
  payload: z.object({
    questionId: z.string(),
  }),
});

export const AudienceJoinSchema = z.object({
  type: z.literal("AUDIENCE_JOIN"),
  payload: z.object({
    displayName: z.string().min(1).max(256),
  }),
});

export const AudienceVoteSchema = z.object({
  type: z.literal("AUDIENCE_VOTE"),
  payload: z.object({
    questionId: z.string(),
    vote: z.string(),
  }),
});

export const PresentationConnectSchema = z.object({
  type: z.literal("PRESENTATION_CONNECT"),
  payload: z.object({
    token: z.string(),
  }),
});

// ─── Bingo Message Schemas (Client → Server) ──────────────────────────────────

export const HostCreateBingoGameSchema = z.object({
  type: z.literal("HOST_CREATE_BINGO_GAME"),
  payload: z.object({
    token: z.string(),
    settings: BingoSettingsSchema,
  }),
});

export const HostStartBingoGameSchema = z.object({
  type: z.literal("HOST_START_BINGO_GAME"),
  payload: EmptyPayload,
});

export const HostEndBingoGameSchema = z.object({
  type: z.literal("HOST_END_BINGO_GAME"),
  payload: EmptyPayload,
});

export const HostResetBingoGameSchema = z.object({
  type: z.literal("HOST_RESET_BINGO_GAME"),
  payload: EmptyPayload,
});

export const PlayerMarkSquareSchema = z.object({
  type: z.literal("PLAYER_MARK_SQUARE"),
  payload: z.object({
    squareIndex: z.number().int().min(0),
  }),
});

export const PlayerUnmarkSquareSchema = z.object({
  type: z.literal("PLAYER_UNMARK_SQUARE"),
  payload: z.object({
    squareIndex: z.number().int().min(0),
  }),
});

export const PlayerUpdateAvatarSchema = z.object({
  type: z.literal("PLAYER_UPDATE_AVATAR"),
  payload: z.object({
    avatarSeed: z.string().min(1).max(64),
  }),
});

/** Discriminated union schema for all client → server messages */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  HostCreateGameSchema,
  HostStartGameSchema,
  HostStartQuestionSchema,
  HostCloseAnswersSchema,
  HostJudgeAnswerSchema,
  HostBulkJudgeSchema,
  HostRevealScoresSchema,
  HostNextQuestionSchema,
  HostNextRoundSchema,
  HostResetGameSchema,
  HostEndGameSchema,
  HostKickPlayerSchema,
  HostUpdateSettingsSchema,
  PlayerJoinSchema,
  PlayerRejoinSchema,
  PlayerSubmitAnswerSchema,
  PlayerBuzzerSchema,
  AudienceJoinSchema,
  AudienceVoteSchema,
  PresentationConnectSchema,
  HostCreateBingoGameSchema,
  HostStartBingoGameSchema,
  HostEndBingoGameSchema,
  HostResetBingoGameSchema,
  PlayerMarkSquareSchema,
  PlayerUnmarkSquareSchema,
  PlayerUpdateAvatarSchema,
]);

// ─── Server → Client Message Schemas ──────────────────────────────────────────

export const GameStateChangedSchema = z.object({
  type: z.literal("GAME_STATE_CHANGED"),
  payload: z.object({
    gameType: GameTypeSchema,
    state: GameStateSchema,
    roundIndex: z.number().int().optional(),
    questionIndex: z.number().int().optional(),
  }),
  timestamp: z.number(),
});

export const PlayerJoinedSchema = z.object({
  type: z.literal("PLAYER_JOINED"),
  payload: z.object({
    playerId: z.string(),
    displayName: z.string(),
    playerCount: z.number().int(),
  }),
  timestamp: z.number(),
});

export const PlayerLeftSchema = z.object({
  type: z.literal("PLAYER_LEFT"),
  payload: z.object({
    playerId: z.string(),
    playerCount: z.number().int(),
  }),
  timestamp: z.number(),
});

export const TimerTickSchema = z.object({
  type: z.literal("TIMER_TICK"),
  payload: z.object({
    secondsRemaining: z.number().int(),
  }),
  timestamp: z.number(),
});

export const TimerExpiredSchema = z.object({
  type: z.literal("TIMER_EXPIRED"),
  payload: z.object({}),
  timestamp: z.number(),
});

export const ScoresUpdatedSchema = z.object({
  type: z.literal("SCORES_UPDATED"),
  payload: z.object({
    leaderboard: z.array(ScoreEntrySchema),
    changes: z.array(ScoreChangeSchema),
  }),
  timestamp: z.number(),
});

export const RoundResultsSchema = z.object({
  type: z.literal("ROUND_RESULTS"),
  payload: z.object({
    roundIndex: z.number().int(),
    leaderboard: z.array(ScoreEntrySchema),
    roundMVP: z
      .object({
        playerId: z.string(),
        displayName: z.string(),
        roundScore: z.number(),
      })
      .nullable(),
  }),
  timestamp: z.number(),
});

export const GameOverSchema = z.object({
  type: z.literal("GAME_OVER"),
  payload: z.object({
    finalLeaderboard: z.array(ScoreEntrySchema),
    winner: z
      .object({
        playerId: z.string(),
        displayName: z.string(),
        score: z.number(),
      })
      .nullable(),
    stats: GameStatsSchema,
  }),
  timestamp: z.number(),
});

export const QuestionShowSchema = z.object({
  type: z.literal("QUESTION_SHOW"),
  payload: z.object({
    questionId: z.string(),
    text: z.string(),
    type: QuestionTypeSchema,
    choices: z.array(z.string()).optional(),
    pointValue: z.number().int(),
    timeLimit: z.number().int(),
    questionNumber: z.number().int(),
    totalQuestions: z.number().int(),
  }),
  timestamp: z.number(),
});

export const QuestionShowFullSchema = z.object({
  type: z.literal("QUESTION_SHOW_FULL"),
  payload: z.object({
    questionId: z.string(),
    text: z.string(),
    type: QuestionTypeSchema,
    choices: z.array(z.string()).optional(),
    pointValue: z.number().int(),
    timeLimit: z.number().int(),
    questionNumber: z.number().int(),
    totalQuestions: z.number().int(),
    correctAnswer: z.string(),
    acceptableAnswers: z.array(z.string()),
  }),
  timestamp: z.number(),
});

export const AnswersForReviewSchema = z.object({
  type: z.literal("ANSWERS_FOR_REVIEW"),
  payload: z.object({
    answers: z.array(AnswerReviewSchema),
  }),
  timestamp: z.number(),
});

export const AnswerSubmittedNotificationSchema = z.object({
  type: z.literal("ANSWER_SUBMITTED_NOTIFICATION"),
  payload: z.object({
    playerId: z.string(),
    displayName: z.string(),
    answeredCount: z.number().int(),
    totalPlayers: z.number().int(),
  }),
  timestamp: z.number(),
});

export const GameCreatedSchema = z.object({
  type: z.literal("GAME_CREATED"),
  payload: z.object({
    gameCode: z.string(),
  }),
  timestamp: z.number(),
});

export const JoinAcceptedSchema = z.object({
  type: z.literal("JOIN_ACCEPTED"),
  payload: z.object({
    playerId: z.string(),
    gameSettings: z.union([GameSettingsSchema, BingoSettingsSchema]),
  }),
  timestamp: z.number(),
});

export const JoinRejectedSchema = z.object({
  type: z.literal("JOIN_REJECTED"),
  payload: z.object({
    reason: z.string(),
  }),
  timestamp: z.number(),
});

export const YourAnswerResultSchema = z.object({
  type: z.literal("YOUR_ANSWER_RESULT"),
  payload: z.object({
    questionId: z.string(),
    status: AnswerStatusSchema,
    pointsAwarded: z.number(),
    bonusPoints: z.number(),
    hostNote: z.string().optional(),
  }),
  timestamp: z.number(),
});

export const YourScoreSchema = z.object({
  type: z.literal("YOUR_SCORE"),
  payload: z.object({
    score: z.number(),
    rank: z.number().int(),
  }),
  timestamp: z.number(),
});

export const KickedSchema = z.object({
  type: z.literal("KICKED"),
  payload: z.object({
    reason: z.string(),
  }),
  timestamp: z.number(),
});

export const ErrorSchema = z.object({
  type: z.literal("ERROR"),
  payload: z.object({
    code: z.string(),
    message: z.string(),
  }),
  timestamp: z.number(),
});

// ─── Bingo Message Schemas (Server → Client) ──────────────────────────────────

export const BingoCardAssignedSchema = z.object({
  type: z.literal("BINGO_CARD_ASSIGNED"),
  payload: z.object({
    squares: z.array(BingoSquareSchema),
    marked: z.array(z.number().int()),
  }),
  timestamp: z.number(),
});

export const BingoSquareMarkedSchema = z.object({
  type: z.literal("BINGO_SQUARE_MARKED"),
  payload: z.object({
    playerId: z.string(),
    displayName: z.string(),
    squareIndex: z.number().int(),
    label: z.string(),
    totalMarked: z.number().int(),
  }),
  timestamp: z.number(),
});

export const BingoSquareUnmarkedSchema = z.object({
  type: z.literal("BINGO_SQUARE_UNMARKED"),
  payload: z.object({
    playerId: z.string(),
    displayName: z.string(),
    squareIndex: z.number().int(),
    label: z.string(),
    totalMarked: z.number().int(),
  }),
  timestamp: z.number(),
});

export const BingoWinnerMessageSchema = z.object({
  type: z.literal("BINGO_WINNER"),
  payload: z.object({
    playerId: z.string(),
    displayName: z.string(),
    pattern: BingoWinPatternSchema,
    allWinners: z.array(BingoWinnerSchema),
  }),
  timestamp: z.number(),
});

export const BingoGameEndedSchema = z.object({
  type: z.literal("BINGO_GAME_ENDED"),
  payload: z.object({
    winners: z.array(BingoWinnerSchema),
  }),
  timestamp: z.number(),
});

/** Discriminated union schema for all server → client messages */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  GameStateChangedSchema,
  PlayerJoinedSchema,
  PlayerLeftSchema,
  TimerTickSchema,
  TimerExpiredSchema,
  ScoresUpdatedSchema,
  RoundResultsSchema,
  GameOverSchema,
  QuestionShowSchema,
  QuestionShowFullSchema,
  AnswersForReviewSchema,
  AnswerSubmittedNotificationSchema,
  GameCreatedSchema,
  JoinAcceptedSchema,
  JoinRejectedSchema,
  YourAnswerResultSchema,
  YourScoreSchema,
  KickedSchema,
  ErrorSchema,
  BingoCardAssignedSchema,
  BingoSquareMarkedSchema,
  BingoSquareUnmarkedSchema,
  BingoWinnerMessageSchema,
  BingoGameEndedSchema,
]);
