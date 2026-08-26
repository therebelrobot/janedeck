// src/client/utils/csv.ts — CSV import/export utilities for game creator
// R1.2: Unicode-safe. R7.4: Non-blame error messages.

import type { RoundEditorData } from "../views/host/components/RoundEditor";
import type { QuestionEditorData } from "../views/host/components/QuestionEditor";
import type { BingoSettings, BingoPhraseEntry, BingoCardMode, BingoWinPattern } from "@/shared/types";
import type { QuestionMedia } from "@/shared/media";
import {
  DEFAULT_MEDIA_INTENSITY,
  MEDIA_ID_PATTERN,
  normalizeFilters,
  parseFrame,
  parseKind,
} from "@/shared/media";
import { DEFAULT_TIME_LIMIT, DEFAULT_POINT_VALUE } from "@/shared/constants";

// ─── CSV Headers ──────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Round Name",
  "Round Points",
  "Question",
  "Correct Answer",
  "Acceptable Answers",
  "Time Limit (seconds)",
  "Media",
  "Media File",
  "Media ID",
  "Media Kind",
  "Media Frame",
  "Media Filters",
  "Media Intensity",
  "Media Alt",
  "Media Caption",
] as const;

// ─── The media columns ────────────────────────────────────────────────────────
//
// A CSV carries a *reference* to an image, never the bytes — the file itself
// lives in R2 and is addressed by "Media ID". So a round-trip through a
// spreadsheet preserves every presentation setting a host chose, and the host
// control pages are what confirm the referenced upload is still there (see
// useMediaAvailability). Import a CSV onto a server that never had the upload
// and the question keeps its framing but shows as needing the image again.
//
//   Media            yes / no — the switch. "no" imports the row without an
//                    image while leaving the settings in the file, so a host
//                    can turn a picture round back on later.
//   Media File       original filename. Identity for a human reading the sheet.
//   Media ID         the R2 object id. This is the part that actually resolves.
//   Media Kind       image | audio | video (only image renders today).
//   Media Frame      none | polaroid | tv | slide | gallery | phone
//   Media Filters    semicolon-separated: bw; sepia; halftone; grain;
//                    vignette; vhs; blur; pixelate
//   Media Intensity  0-100, used by whichever of blur/pixelate is active
//   Media Alt        screen-reader description
//   Media Caption    text printed on frames that have a caption slot
//
// Every media column is optional. Deleting them all, or hand-writing a sheet
// that never had them, imports exactly as it did before media existed.

// UTF-8 BOM so Excel correctly detects encoding
const UTF8_BOM = "\uFEFF";

// ─── CSV Escaping / Formatting ────────────────────────────────────────────────

/** Escape a single field for CSV output. Wraps in quotes if needed. */
function escapeCSVField(value: string): string {
  // If the field contains a comma, double-quote, newline, or carriage return,
  // wrap it in double-quotes and escape any internal double-quotes.
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV row from an array of string values. */
function toCSVRow(fields: string[]): string {
  return fields.map(escapeCSVField).join(",");
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of rows, each row being an array of field strings.
 * Handles quoted fields, escaped double-quotes, and newlines within quoted fields.
 */
function parseCSV(raw: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  // Strip UTF-8 BOM if present
  const input = raw.startsWith(UTF8_BOM) ? raw.slice(1) : raw;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek at next char: if also a quote, it's an escaped quote
        if (i + 1 < input.length && input[i + 1] === '"') {
          current += '"';
          i++; // skip the escaped quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\r") {
        // Handle \r\n or lone \r as row delimiter
        if (i + 1 < input.length && input[i + 1] === "\n") {
          i++; // skip the \n
        }
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
      } else if (ch === "\n") {
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
  }

  // Push the last field and row if there's any content
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

/** Number of media columns, and a blank run for template rows */
const MEDIA_COLUMN_COUNT = 9;
const EMPTY_MEDIA_CELLS: string[] = Array(MEDIA_COLUMN_COUNT).fill("");

/** Serialize a question's media into its nine columns, in header order */
function mediaCells(media: QuestionMedia | undefined): string[] {
  if (!media) return EMPTY_MEDIA_CELLS;
  return [
    "yes",
    media.fileName,
    media.id,
    media.kind,
    media.frame,
    media.filters.join("; "),
    String(media.intensity),
    media.alt,
    media.caption ?? "",
  ];
}

// ─── Export Functions ─────────────────────────────────────────────────────────

/**
 * Convert game rounds/questions to a CSV string.
 * Acceptable answers are semicolon-separated in the CSV cell
 * (the editor stores them comma-separated).
 */
export function gameToCSV(rounds: RoundEditorData[]): string {
  const lines: string[] = [];

  // Header row
  lines.push(toCSVRow([...CSV_HEADERS]));

  for (const round of rounds) {
    for (const question of round.questions) {
      // Convert comma-separated acceptable answers to semicolon-separated for CSV
      const acceptableAnswers = question.acceptableAnswers
        ? question.acceptableAnswers
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
          .join("; ")
        : "";

      lines.push(
        toCSVRow([
          round.title,
          String(round.pointValue),
          question.text,
          question.correctAnswer,
          acceptableAnswers,
          String(question.timeLimit),
          ...mediaCells(question.media),
        ]),
      );
    }
  }

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Generate a template CSV with headers and 2 example rounds (4 questions total).
 */
export function templateCSV(): string {
  const lines: string[] = [];

  lines.push(toCSVRow([...CSV_HEADERS]));

  // Example Round 1: General Knowledge
  lines.push(
    toCSVRow([
      "General Knowledge",
      "100",
      "What is the capital of France?",
      "Paris",
      "paris; París",
      "30",
      ...EMPTY_MEDIA_CELLS,
    ]),
  );
  lines.push(
    toCSVRow([
      "General Knowledge",
      "100",
      "What year did the moon landing happen?",
      "1969",
      "nineteen sixty-nine",
      "30",
      ...EMPTY_MEDIA_CELLS,
    ]),
  );

  // Example Round 2: Pop Culture
  lines.push(
    toCSVRow([
      "Pop Culture",
      "200",
      "Who directed Jurassic Park?",
      "Steven Spielberg",
      "spielberg; Spielberg",
      "25",
      ...EMPTY_MEDIA_CELLS,
    ]),
  );
  lines.push(
    toCSVRow([
      "Pop Culture",
      "200",
      "What is the highest-grossing film of all time?",
      "Avatar",
      "avatar",
      "30",
      ...EMPTY_MEDIA_CELLS,
    ]),
  );

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Trigger a browser download of a CSV string as a file.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Import Caching ───────────────────────────────────────────────────────────
// Caches the raw text of the last-imported CSV per game type in localStorage,
// so a host doesn't need to keep the original file handy to pick up where
// they left off (a new tab, a refresh, coming back tomorrow, etc).

export type CSVCacheKind = "trivia" | "bingo";

const CSV_CACHE_PREFIX = "janedeck_csv_cache:";

/** Save the raw CSV text so it can be restored without re-uploading the file. */
export function saveCachedCSV(kind: CSVCacheKind, content: string): void {
  try {
    localStorage.setItem(`${CSV_CACHE_PREFIX}${kind}`, content);
  } catch {
    // localStorage may be unavailable — caching is best-effort
  }
}

/** Load the last-cached raw CSV text for this game type, if any. */
export function loadCachedCSV(kind: CSVCacheKind): string | null {
  try {
    return localStorage.getItem(`${CSV_CACHE_PREFIX}${kind}`);
  } catch {
    return null;
  }
}

/** Clear the cached CSV for this game type. */
export function clearCachedCSV(kind: CSVCacheKind): void {
  try {
    localStorage.removeItem(`${CSV_CACHE_PREFIX}${kind}`);
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Import Functions ─────────────────────────────────────────────────────────

/** Result of parsing a CSV file into game data. */
export interface CSVImportResult {
  rounds: RoundEditorData[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse a CSV string into round/question data for the editor.
 *
 * Rules:
 * - Header row is required.
 * - Rows with the same "Round Name" belong to the same round.
 * - "Round Points" only needs to be set on the first row of each round.
 * - "Acceptable Answers" uses semicolons as separators (converted to commas for the editor).
 * - "Time Limit" defaults to DEFAULT_TIME_LIMIT if omitted.
 * - Empty rows are skipped.
 * - Required fields: Round Name, Question, Correct Answer.
 */
export function csvToGame(csvContent: string): CSVImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const roundMap = new Map<
    string,
    { pointValue: number; questions: QuestionEditorData[] }
  >();
  // Track insertion order for stable round ordering
  const roundOrder: string[] = [];

  const rows = parseCSV(csvContent);

  if (rows.length === 0) {
    errors.push("The CSV file appears to be empty.");
    return { rounds: [], errors, warnings };
  }

  // Validate header row
  const headerRow = rows[0];
  const normalizedHeaders = headerRow.map((h) => h.trim().toLowerCase());

  const expectedHeaders = CSV_HEADERS.map((h) => h.toLowerCase());

  // Check that we have at least the required columns by matching header names
  const roundNameIdx = normalizedHeaders.findIndex(
    (h) => h === expectedHeaders[0],
  ); // "round name"
  const roundPointsIdx = normalizedHeaders.findIndex(
    (h) => h === expectedHeaders[1],
  ); // "round points"
  const questionIdx = normalizedHeaders.findIndex(
    (h) => h === expectedHeaders[2],
  ); // "question"
  const correctAnswerIdx = normalizedHeaders.findIndex(
    (h) => h === expectedHeaders[3],
  ); // "correct answer"
  const acceptableAnswersIdx = normalizedHeaders.findIndex(
    (h) => h === expectedHeaders[4],
  ); // "acceptable answers"
  const timeLimitIdx = normalizedHeaders.findIndex(
    (h) => h === expectedHeaders[5],
  ); // "time limit (seconds)"
  // Media columns are all optional — a sheet written before media existed, or
  // by hand, simply has none of them.
  const mediaIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[6]);
  const mediaFileIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[7]);
  const mediaIdIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[8]);
  const mediaKindIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[9]);
  const mediaFrameIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[10]);
  const mediaFiltersIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[11]);
  const mediaIntensityIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[12]);
  const mediaAltIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[13]);
  const mediaCaptionIdx = normalizedHeaders.findIndex((h) => h === expectedHeaders[14]);

  if (roundNameIdx === -1 || questionIdx === -1 || correctAnswerIdx === -1) {
    errors.push(
      'The CSV is missing required headers. Expected at least: "Round Name", "Question", "Correct Answer".',
    );
    return { rounds: [], errors, warnings };
  }

  // Process data rows (skip header)
  let importedRowCount = 0;

  for (let rowNum = 1; rowNum < rows.length; rowNum++) {
    const row = rows[rowNum];
    const csvLineNum = rowNum + 1; // 1-based, accounting for header

    // Skip empty rows (all cells empty or whitespace)
    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }

    // Helper to safely get a cell value by column index
    const getCell = (idx: number): string =>
      idx >= 0 && idx < row.length ? row[idx].trim() : "";

    const roundName = getCell(roundNameIdx);
    const roundPointsStr = getCell(roundPointsIdx);
    const questionText = getCell(questionIdx);
    const correctAnswer = getCell(correctAnswerIdx);
    const acceptableAnswersRaw = getCell(acceptableAnswersIdx);
    const timeLimitStr = getCell(timeLimitIdx);
    const mediaCellValues: MediaCells = {
      enabled: getCell(mediaIdx),
      fileName: getCell(mediaFileIdx),
      id: getCell(mediaIdIdx),
      kind: getCell(mediaKindIdx),
      frame: getCell(mediaFrameIdx),
      filters: getCell(mediaFiltersIdx),
      intensity: getCell(mediaIntensityIdx),
      alt: getCell(mediaAltIdx),
      caption: getCell(mediaCaptionIdx),
    };

    // Validate required fields
    if (!roundName) {
      errors.push(
        `Row ${csvLineNum}: "Round Name" is missing. This row was skipped.`,
      );
      continue;
    }
    if (!questionText) {
      errors.push(
        `Row ${csvLineNum}: "Question" is missing. This row was skipped.`,
      );
      continue;
    }
    if (!correctAnswer) {
      errors.push(
        `Row ${csvLineNum}: "Correct Answer" is missing. This row was skipped.`,
      );
      continue;
    }

    // Parse round points
    let roundPoints = DEFAULT_POINT_VALUE;
    if (roundPointsStr) {
      const parsed = parseInt(roundPointsStr, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        warnings.push(
          `Row ${csvLineNum}: "Round Points" value "${roundPointsStr}" is not a valid number. Using default (${DEFAULT_POINT_VALUE}).`,
        );
      } else {
        roundPoints = parsed;
      }
    }

    // Parse time limit
    let timeLimit = DEFAULT_TIME_LIMIT;
    if (timeLimitStr) {
      const parsed = parseInt(timeLimitStr, 10);
      if (Number.isNaN(parsed) || parsed < 5) {
        warnings.push(
          `Row ${csvLineNum}: "Time Limit" value "${timeLimitStr}" is not valid (minimum 5). Using default (${DEFAULT_TIME_LIMIT}s).`,
        );
      } else {
        timeLimit = Math.min(parsed, 300);
      }
    }

    // Convert semicolon-separated acceptable answers to comma-separated for the editor
    const acceptableAnswers = acceptableAnswersRaw
      ? acceptableAnswersRaw
        .split(";")
        .map((a) => a.trim())
        .filter(Boolean)
        .join(", ")
      : "";

    // Parse the media columns. A bad value costs the question its image (or one
    // setting), never the whole import — the host is told which row and what.
    const mediaResult = parseMediaCells(mediaCellValues, csvLineNum);
    warnings.push(...mediaResult.warnings);
    const media = mediaResult.media;

    // Build question
    const question: QuestionEditorData = {
      text: questionText,
      correctAnswer,
      acceptableAnswers,
      timeLimit,
      media,
    };

    // Group into rounds
    if (!roundMap.has(roundName)) {
      roundMap.set(roundName, { pointValue: roundPoints, questions: [] });
      roundOrder.push(roundName);
    }
    const roundData = roundMap.get(roundName)!;

    // If this is the first row of a round with explicit points, update
    if (roundPointsStr && roundData.questions.length === 0) {
      roundData.pointValue = roundPoints;
    }

    roundData.questions.push(question);
    importedRowCount++;
  }

  if (importedRowCount === 0 && errors.length === 0) {
    errors.push(
      "No valid question rows were found in the CSV. Make sure the file has data rows below the header.",
    );
  }

  // Convert map to array in insertion order
  const rounds: RoundEditorData[] = roundOrder.map((name) => {
    const data = roundMap.get(name)!;
    return {
      title: name,
      pointValue: data.pointValue,
      questions: data.questions,
    };
  });

  return { rounds, errors, warnings };
}

/** The nine media cells of one row, as raw trimmed strings */
interface MediaCells {
  enabled: string;
  fileName: string;
  id: string;
  kind: string;
  frame: string;
  filters: string;
  intensity: string;
  alt: string;
  caption: string;
}

/** Values in the "Media" column that mean "off" */
const MEDIA_OFF_VALUES = new Set(["no", "n", "false", "0", "off"]);
const MEDIA_ON_VALUES = new Set(["yes", "y", "true", "1", "on"]);

/**
 * Build a media record from one row's media columns.
 *
 * The bytes aren't in the CSV — only the R2 object id is — so this produces a
 * *reference*. Whether that reference resolves on this server is a separate
 * question, answered by the host control pages (see useMediaAvailability),
 * which is where a host re-uploads anything the sheet points at but the
 * server doesn't have.
 */
function parseMediaCells(
  cells: MediaCells,
  csvLineNum: number,
): { media?: QuestionMedia; warnings: string[] } {
  const warnings: string[] = [];
  const flag = cells.enabled.toLowerCase();

  // Explicitly switched off — keep the settings in the file, skip the image.
  if (MEDIA_OFF_VALUES.has(flag)) return { warnings };

  // Nothing to do: no id and no switch means this row simply has no media.
  if (!cells.id) {
    if (MEDIA_ON_VALUES.has(flag)) {
      warnings.push(
        `Row ${csvLineNum}: "Media" is set to "${cells.enabled}" but "Media ID" is empty, so this question was imported without an image.`,
      );
    }
    return { warnings };
  }

  if (!MEDIA_ID_PATTERN.test(cells.id)) {
    warnings.push(
      `Row ${csvLineNum}: "Media ID" value "${cells.id}" isn't a valid media reference, so this question was imported without an image.`,
    );
    return { warnings };
  }

  const kind = cells.kind ? parseKind(cells.kind) : "image";
  if (!kind) {
    warnings.push(
      `Row ${csvLineNum}: "Media Kind" value "${cells.kind}" isn't recognised. Using "image".`,
    );
  }

  let frame = parseFrame(cells.frame ?? "");
  if (cells.frame && !frame) {
    warnings.push(
      `Row ${csvLineNum}: "Media Frame" value "${cells.frame}" isn't recognised. Using "none".`,
    );
  }
  frame = frame ?? "none";

  // Semicolon-separated, matching the "Acceptable Answers" convention.
  const requestedFilters = cells.filters
    .split(";")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  const filters = normalizeFilters(requestedFilters);
  const dropped = requestedFilters.filter(
    (f) => !(filters as string[]).includes(f),
  );
  if (dropped.length > 0) {
    warnings.push(
      `Row ${csvLineNum}: these "Media Filters" were skipped — ${dropped.join(", ")}. Filters must be one of: bw, sepia, halftone, grain, vignette, vhs, blur, pixelate (and only one of bw/sepia/halftone, and one of blur/pixelate).`,
    );
  }

  let intensity = DEFAULT_MEDIA_INTENSITY;
  if (cells.intensity) {
    const parsed = parseInt(cells.intensity, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      warnings.push(
        `Row ${csvLineNum}: "Media Intensity" value "${cells.intensity}" is not a number from 0 to 100. Using ${DEFAULT_MEDIA_INTENSITY}.`,
      );
    } else {
      intensity = parsed;
    }
  }

  return {
    media: {
      id: cells.id,
      kind: kind ?? "image",
      fileName: cells.fileName || cells.id,
      alt: cells.alt,
      caption: cells.caption || undefined,
      frame,
      filters,
      intensity,
    },
    warnings,
  };
}

// ─── Results Export (for HostDashboard game-over) ─────────────────────────────

/** Export a player leaderboard as CSV. */
export function leaderboardToCSV(
  entries: Array<{ displayName: string; score: number; rank: number }>,
): string {
  const lines: string[] = [];

  lines.push(toCSVRow(["Player", "Score", "Rank"]));

  for (const entry of entries) {
    lines.push(
      toCSVRow([entry.displayName, String(entry.score), String(entry.rank)]),
    );
  }

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

// ─── Bingo CSV ─────────────────────────────────────────────────────────────
// Single combined file: one row per setting, plus one row per phrase (with an
// optional definition column). This lets a host save/load a complete bingo
// game configuration — not just the phrase list — as one file.

const BINGO_CSV_HEADERS = ["Type", "Name", "Value", "Definition"] as const;

const BINGO_SETTING_KEYS = [
  "maxPlayers",
  "cardMode",
  "numberRange",
  "gridSize",
  "freeSpace",
  "winPatterns",
] as const;

const VALID_CARD_MODES: BingoCardMode[] = ["numbered", "phrasePool"];
const VALID_WIN_PATTERNS: BingoWinPattern[] = ["line", "four_corners", "blackout"];

/** Serialize one BingoSettings field to its CSV string representation. */
function settingValueToString(key: (typeof BINGO_SETTING_KEYS)[number], settings: BingoSettings): string {
  switch (key) {
    case "winPatterns":
      return settings.winPatterns.join(";");
    case "freeSpace":
      return String(settings.freeSpace);
    default:
      return String(settings[key]);
  }
}

/**
 * Export a bingo game's full settings plus its phrase pool (with optional
 * per-phrase definitions) as one CSV file.
 */
export function bingoSettingsAndPhrasesToCSV(settings: BingoSettings): string {
  const lines: string[] = [];
  lines.push(toCSVRow([...BINGO_CSV_HEADERS]));

  for (const key of BINGO_SETTING_KEYS) {
    lines.push(toCSVRow(["Setting", key, settingValueToString(key, settings), ""]));
  }

  if (settings.freeSpacePhrase) {
    lines.push(
      toCSVRow(["FreeSpace", settings.freeSpacePhrase.text, "", settings.freeSpacePhrase.definition || ""]),
    );
  }

  for (const phrase of settings.phrasePool) {
    lines.push(toCSVRow(["Phrase", phrase.text, "", phrase.definition || ""]));
  }

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Generate a ready-to-edit template CSV: a full set of example settings plus
 * enough example phrases to fill a 5×5 card (with a couple of definitions
 * shown as examples of the optional clarification field).
 */
export function bingoTemplateCSV(): string {
  const exampleSettings: BingoSettings = {
    maxPlayers: 16,
    cardMode: "phrasePool",
    numberRange: 75,
    gridSize: 5,
    freeSpace: true,
    freeSpacePhrase: { text: "Someone yells \"BINGO!\" before checking their card", definition: "House rule — they still have to verify it" },
    winPatterns: ["line", "four_corners", "blackout"],
    phrasePool: [],
  };

  const lines: string[] = [];
  lines.push(toCSVRow([...BINGO_CSV_HEADERS]));

  for (const key of BINGO_SETTING_KEYS) {
    lines.push(toCSVRow(["Setting", key, settingValueToString(key, exampleSettings), ""]));
  }

  if (exampleSettings.freeSpacePhrase) {
    lines.push(
      toCSVRow(["FreeSpace", exampleSettings.freeSpacePhrase.text, "", exampleSettings.freeSpacePhrase.definition || ""]),
    );
  }

  const examplePhrases: BingoPhraseEntry[] = [
    { text: "Someone says \"I love this movie\"", definition: "" },
    { text: "A character cries on screen", definition: "A single tear counts" },
    { text: "Someone quotes the movie before it happens", definition: "" },
    { text: "Someone pauses for a bathroom break", definition: "" },
    { text: "A phone rings at the worst possible moment", definition: "" },
    { text: "Someone falls asleep", definition: "" },
    { text: "A jump scare makes someone yell", definition: "Horror movies only" },
    { text: "Someone asks \"wait, what just happened?\"", definition: "" },
    { text: "A character does something obviously stupid", definition: "" },
    { text: "Someone laughs way too hard", definition: "" },
    { text: "A plot hole gets pointed out out loud", definition: "" },
    { text: "Someone checks their phone mid-scene", definition: "" },
    { text: "A villain monologues", definition: "" },
    { text: "Someone predicts the twist correctly", definition: "" },
    { text: "A dramatic slow-motion shot happens", definition: "" },
    { text: "The hero says a one-liner after a fight", definition: "" },
    { text: "Someone says \"that's not how that works\"", definition: "A nod to scientific inaccuracy" },
    { text: "A character has an obvious fake mustache or wig", definition: "" },
    { text: "The music swells before a big reveal", definition: "" },
    { text: "Someone refills their snacks", definition: "" },
    { text: "A callback joke to earlier in the movie lands", definition: "" },
    { text: "Someone says the movie's title out loud", definition: "" },
    { text: "A character ignores obviously good advice", definition: "" },
    { text: "Credits roll and someone asks \"is there a post-credits scene?\"", definition: "" },
  ];

  for (const phrase of examplePhrases) {
    lines.push(toCSVRow(["Phrase", phrase.text, "", phrase.definition || ""]));
  }

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/** Result of parsing a combined bingo settings + phrase pool CSV. */
export interface BingoCSVImportResult {
  settings: Partial<BingoSettings>;
  phrases: BingoPhraseEntry[];
  warnings: string[];
  errors: string[];
}

/**
 * Parse a combined bingo settings + phrase pool CSV produced by
 * bingoSettingsAndPhrasesToCSV / bingoTemplateCSV (or hand-edited in the
 * same "Type,Name,Value,Definition" shape).
 */
export function csvToBingoSettingsAndPhrases(csvContent: string): BingoCSVImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const settings: Partial<BingoSettings> = {};
  const phrases: BingoPhraseEntry[] = [];

  const rows = parseCSV(csvContent);
  if (rows.length === 0) {
    errors.push("The CSV file appears to be empty.");
    return { settings, phrases, warnings, errors };
  }

  // Skip the header row if present
  const firstCell = (rows[0][0] || "").trim().toLowerCase();
  const startIndex = firstCell === "type" ? 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => cell.trim() === "")) continue;

    const rowType = (row[0] || "").trim().toLowerCase();
    const name = (row[1] || "").trim();
    const value = (row[2] || "").trim();
    const definition = (row[3] || "").trim();
    const lineNum = i + 1;

    if (rowType === "setting") {
      switch (name) {
        case "maxPlayers": {
          const parsed = parseInt(value, 10);
          if (Number.isNaN(parsed) || parsed < 1) {
            warnings.push(`Row ${lineNum}: "maxPlayers" value "${value}" is not valid and was skipped.`);
          } else {
            settings.maxPlayers = parsed;
          }
          break;
        }
        case "cardMode": {
          if (VALID_CARD_MODES.includes(value as BingoCardMode)) {
            settings.cardMode = value as BingoCardMode;
          } else {
            warnings.push(`Row ${lineNum}: "cardMode" value "${value}" is not valid and was skipped.`);
          }
          break;
        }
        case "numberRange": {
          const parsed = parseInt(value, 10);
          if (Number.isNaN(parsed) || parsed < 1) {
            warnings.push(`Row ${lineNum}: "numberRange" value "${value}" is not valid and was skipped.`);
          } else {
            settings.numberRange = parsed;
          }
          break;
        }
        case "gridSize": {
          const parsed = parseInt(value, 10);
          if (Number.isNaN(parsed) || parsed < 3 || parsed > 7) {
            warnings.push(`Row ${lineNum}: "gridSize" value "${value}" is not valid and was skipped.`);
          } else {
            settings.gridSize = parsed;
          }
          break;
        }
        case "freeSpace": {
          settings.freeSpace = value.toLowerCase() === "true";
          break;
        }
        case "winPatterns": {
          const patterns = value
            .split(";")
            .map((p) => p.trim())
            .filter(Boolean) as BingoWinPattern[];
          const valid = patterns.filter((p) => VALID_WIN_PATTERNS.includes(p));
          const invalid = patterns.filter((p) => !VALID_WIN_PATTERNS.includes(p));
          if (invalid.length > 0) {
            warnings.push(`Row ${lineNum}: ignored unrecognized win pattern(s): ${invalid.join(", ")}.`);
          }
          if (valid.length > 0) settings.winPatterns = valid;
          break;
        }
        default:
          warnings.push(`Row ${lineNum}: unrecognized setting "${name}" was ignored.`);
      }
    } else if (rowType === "phrase") {
      if (name) {
        phrases.push(definition ? { text: name, definition } : { text: name });
      }
    } else if (rowType === "freespace") {
      if (name) {
        settings.freeSpacePhrase = definition ? { text: name, definition } : { text: name };
      }
    } else {
      warnings.push(`Row ${lineNum}: unrecognized row type "${row[0]}" was skipped.`);
    }
  }

  if (phrases.length === 0 && Object.keys(settings).length === 0) {
    errors.push("No settings or phrases were found in the CSV.");
  }

  return { settings, phrases, warnings, errors };
}

/** Export bingo winners as CSV, with human-readable pattern names and timestamps. */
export function bingoResultsToCSV(
  winners: Array<{ displayName: string; pattern: string; achievedAt: number }>,
): string {
  const lines: string[] = [];
  const patternLabels: Record<string, string> = {
    line: "Line",
    four_corners: "Four Corners",
    blackout: "Blackout",
  };

  lines.push(toCSVRow(["Player", "Pattern", "Achieved At"]));

  for (const winner of winners) {
    lines.push(
      toCSVRow([
        winner.displayName,
        patternLabels[winner.pattern] || winner.pattern,
        new Date(winner.achievedAt).toISOString(),
      ]),
    );
  }

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}
