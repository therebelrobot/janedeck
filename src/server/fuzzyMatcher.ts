// src/server/fuzzyMatcher.ts — Fuse.js answer matching logic
// Runs server-side for consistent, authoritative scoring.

import Fuse, { type IFuseOptions } from "fuse.js";
import {
  FUZZY_AUTO_ACCEPT,
  FUZZY_NEEDS_REVIEW,
} from "@/shared/constants";
import type { Answer, AnswerReview, Question, Player } from "@/shared/types";

/** Fuse.js configuration for answer matching */
const FUSE_OPTIONS: IFuseOptions<string> = {
  includeScore: true,
  threshold: 0.4,
  distance: 100,
  minMatchCharLength: 2,
  shouldSort: true,
};

/** Result of matching a single answer */
export interface MatchResult {
  /** Fuzzy score (0.0 = perfect match, 1.0 = no match) */
  score: number;
  /** Whether the answer matched within the threshold */
  matched: boolean;
  /** Which correct/acceptable answer it matched against */
  matchedAgainst: string;
  /** Auto-classification based on thresholds */
  classification: "auto-accept" | "needs-review" | "auto-reject";
}

/**
 * Normalize an answer string before fuzzy matching.
 * Pipeline:
 * - Normalize Unicode (NFC form)
 * - Trim and collapse whitespace
 * - Lowercase
 * - Strip leading articles ("the", "a", "an")
 * - Strip punctuation except hyphens within words
 */
export function normalizeAnswer(raw: string): string {
  let normalized = raw
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  // Strip leading articles
  normalized = normalized.replace(/^(the|a|an)\s+/i, "");

  // Strip punctuation except hyphens within words
  // Keep word characters, whitespace, and hyphens between word chars
  normalized = normalized.replace(/[^\w\s-]/g, "");

  // Clean up any remaining edge whitespace
  return normalized.trim();
}

/**
 * Match a player's answer against the correct answer and acceptable alternatives.
 * Returns the best fuzzy score and classification.
 */
export function matchAnswer(
  submitted: string,
  correctAnswer: string,
  acceptableAnswers: string[] = [],
): MatchResult {
  const normalizedSubmitted = normalizeAnswer(submitted);

  // Build the list of correct answers to match against
  const allCorrect = [correctAnswer, ...acceptableAnswers];
  const normalizedCorrect = allCorrect.map(normalizeAnswer);

  // Check for exact match first
  for (let i = 0; i < normalizedCorrect.length; i++) {
    if (normalizedSubmitted === normalizedCorrect[i]) {
      return {
        score: 0,
        matched: true,
        matchedAgainst: allCorrect[i],
        classification: "auto-accept",
      };
    }
  }

  // Handle edge case: empty or very short normalized answer
  if (normalizedSubmitted.length < 1) {
    return {
      score: 1,
      matched: false,
      matchedAgainst: correctAnswer,
      classification: "auto-reject",
    };
  }

  // Fuzzy match using Fuse.js
  const fuse = new Fuse(normalizedCorrect, FUSE_OPTIONS);
  const results = fuse.search(normalizedSubmitted);

  if (results.length === 0) {
    return {
      score: 1,
      matched: false,
      matchedAgainst: correctAnswer,
      classification: "auto-reject",
    };
  }

  const bestMatch = results[0];
  const score = bestMatch.score ?? 1;
  const matchIndex = bestMatch.refIndex;

  let classification: MatchResult["classification"];
  if (score <= FUZZY_AUTO_ACCEPT) {
    classification = "auto-accept";
  } else if (score <= FUZZY_NEEDS_REVIEW) {
    classification = "needs-review";
  } else {
    classification = "auto-reject";
  }

  return {
    score,
    matched: score <= FUZZY_NEEDS_REVIEW,
    matchedAgainst: allCorrect[matchIndex],
    classification,
  };
}

/**
 * Batch match all player answers for a question.
 * Returns AnswerReview objects for the host review panel.
 */
export function batchMatch(
  answers: Answer[],
  question: Question,
  players: Record<string, Player>,
): AnswerReview[] {
  return answers.map((answer) => {
    const result = matchAnswer(
      answer.text,
      question.correctAnswer,
      question.acceptableAnswers,
    );

    const player = players[answer.playerId];

    let suggestedStatus: AnswerReview["suggestedStatus"];
    switch (result.classification) {
      case "auto-accept":
        suggestedStatus = "correct";
        break;
      case "needs-review":
        suggestedStatus = "needs_review";
        break;
      case "auto-reject":
        suggestedStatus = "incorrect";
        break;
    }

    return {
      answerId: answer.id,
      playerId: answer.playerId,
      displayName: player?.displayName ?? "Unknown",
      text: answer.text,
      fuzzyScore: result.score,
      fuzzyMatchedAgainst: result.matchedAgainst,
      suggestedStatus,
      submittedAt: answer.submittedAt,
    };
  });
}
