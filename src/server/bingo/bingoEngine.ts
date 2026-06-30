// src/server/bingo/bingoEngine.ts — Pure functions for bingo card generation and win checking

import type { BingoCard, BingoSettings, BingoSquare, BingoWinPattern } from "@/shared/types";

/** Fisher-Yates shuffle — returns a new shuffled array, does not mutate the input */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function centerIndex(gridSize: number): number {
  const mid = Math.floor(gridSize / 2);
  return mid * gridSize + mid;
}

/**
 * The number of phrases a phrase-pool card needs from the pool
 * (one per square, minus the free space if enabled).
 */
export function requiredPhraseCount(settings: BingoSettings): number {
  const total = settings.gridSize * settings.gridSize;
  return settings.freeSpace ? total - 1 : total;
}

/** Generate one player's card based on the game's bingo settings */
export function generateCard(settings: BingoSettings): BingoSquare[] {
  const { gridSize, freeSpace } = settings;
  const free = freeSpace ? centerIndex(gridSize) : -1;
  const squares: BingoSquare[] = new Array(gridSize * gridSize);

  const freeSquare = (index: number): BingoSquare => ({
    index,
    label: settings.freeSpacePhrase?.text || "FREE",
    isFree: true,
    ...(settings.freeSpacePhrase?.definition && {
      definition: settings.freeSpacePhrase.definition,
    }),
  });

  if (settings.cardMode === "numbered") {
    const columnSize = Math.floor(settings.numberRange / gridSize);
    for (let col = 0; col < gridSize; col++) {
      const low = col * columnSize + 1;
      const high = col === gridSize - 1 ? settings.numberRange : (col + 1) * columnSize;
      const pool = shuffle(
        Array.from({ length: high - low + 1 }, (_, i) => low + i),
      );
      let poolIndex = 0;
      for (let row = 0; row < gridSize; row++) {
        const index = row * gridSize + col;
        if (index === free) {
          squares[index] = freeSquare(index);
          continue;
        }
        const value = pool[poolIndex++];
        squares[index] = { index, label: String(value), isFree: false };
      }
    }
  } else {
    const pool = shuffle(settings.phrasePool);
    let poolIndex = 0;
    for (let index = 0; index < gridSize * gridSize; index++) {
      if (index === free) {
        squares[index] = freeSquare(index);
        continue;
      }
      const entry = pool[poolIndex++];
      squares[index] = {
        index,
        label: entry.text,
        isFree: false,
        ...(entry.definition && { definition: entry.definition }),
      };
    }
  }

  return squares;
}

/** Index-sets that, if fully marked, complete the given win pattern */
export function getPatternLineSets(
  gridSize: number,
  pattern: BingoWinPattern,
): number[][] {
  switch (pattern) {
    case "line": {
      const lines: number[][] = [];
      for (let row = 0; row < gridSize; row++) {
        lines.push(Array.from({ length: gridSize }, (_, col) => row * gridSize + col));
      }
      for (let col = 0; col < gridSize; col++) {
        lines.push(Array.from({ length: gridSize }, (_, row) => row * gridSize + col));
      }
      lines.push(Array.from({ length: gridSize }, (_, i) => i * gridSize + i));
      lines.push(
        Array.from({ length: gridSize }, (_, i) => i * gridSize + (gridSize - 1 - i)),
      );
      return lines;
    }
    case "four_corners": {
      const last = gridSize - 1;
      return [[0, last, last * gridSize, last * gridSize + last]];
    }
    case "blackout": {
      return [Array.from({ length: gridSize * gridSize }, (_, i) => i)];
    }
  }
}

/**
 * Determine which (if any) newly-completed win patterns this card now satisfies,
 * excluding patterns already recorded in card.wonPatterns.
 */
export function checkNewWins(
  card: BingoCard,
  configuredPatterns: BingoWinPattern[],
  gridSize: number,
): BingoWinPattern[] {
  const marked = new Set(card.marked);
  const newWins: BingoWinPattern[] = [];

  for (const pattern of configuredPatterns) {
    if (card.wonPatterns.includes(pattern)) continue;
    const lineSets = getPatternLineSets(gridSize, pattern);
    const completed = lineSets.some((set) => set.every((i) => marked.has(i)));
    if (completed) {
      newWins.push(pattern);
    }
  }

  return newWins;
}
