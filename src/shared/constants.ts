// src/shared/constants.ts — Shared constants for JaneDeck

/** Length of the game code (alphanumeric characters) */
export const GAME_CODE_LENGTH = 6;

/** Characters used for game code generation (ambiguous chars removed) */
export const GAME_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Maximum number of players per game */
export const MAX_PLAYERS = 50;

/** Maximum number of audience members per game */
export const MAX_AUDIENCE = 200;

/** Default time limit for questions in seconds */
export const DEFAULT_TIME_LIMIT = 30;

/** Default point value per question */
export const DEFAULT_POINT_VALUE = 100;

/** Default bonus points for audience participation */
export const DEFAULT_BONUS_POINTS = 1;

/** Fuzzy match score threshold for auto-accept (0.0 = perfect match) */
export const FUZZY_AUTO_ACCEPT = 0.2;

/** Fuzzy match score threshold for needs-review zone */
export const FUZZY_NEEDS_REVIEW = 0.4;

/** Auth token time-to-live: 4 hours in milliseconds */
export const AUTH_TOKEN_TTL = 4 * 60 * 60 * 1000;

/** Party name for the auth gate — must match kebab-case of DO binding "AuthGate" */
export const PARTY_AUTH_GATE = "auth-gate";

/** Party name for the game room — must match kebab-case of DO binding "GameRoom" */
export const PARTY_GAME_ROOM = "game-room";

/** Delay in ms before QUESTION_DISPLAY transitions to ANSWERING */
export const QUESTION_DISPLAY_DELAY = 3000;

/** Maximum display name length in bytes — R1.2: ≥ 256 bytes */
export const MAX_DISPLAY_NAME_BYTES = 256;

/** Minimum display name length (empty strings rejected) */
export const MIN_DISPLAY_NAME_LENGTH = 1;

/** Default game settings */
export const DEFAULT_GAME_SETTINGS = {
  maxPlayers: 16,
  allowAudience: true,
  audienceBonusPoints: 1,
  defaultTimeLimit: DEFAULT_TIME_LIMIT,
  showAnswersToPlayers: true,
} as const;
