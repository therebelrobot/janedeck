// src/server/utils/gameCode.ts — Game code generation
// Uses nanoid with a custom alphabet to avoid ambiguous characters (R7.1 compliant).

import { customAlphabet } from "nanoid";
import { GAME_CODE_LENGTH, GAME_CODE_CHARS } from "@/shared/constants";

/**
 * Generate a random game code using nanoid with a custom alphabet.
 * Avoids ambiguous characters: 0/O, 1/I/L.
 */
export const generateGameCode: () => string = customAlphabet(
  GAME_CODE_CHARS,
  GAME_CODE_LENGTH,
);
