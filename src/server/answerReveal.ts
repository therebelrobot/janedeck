// src/server/answerReveal.ts — Builds the post-question answer reveal
// Feedback on what everyone said is half the fun of trivia, so once a question
// closes we hand every screen the answer that was wanted plus the full spread
// of what came in: auto-matched, manually saved by the host, and missed.

import { normalizeAnswer } from "@/server/fuzzyMatcher";
import type {
  AnswerStatus,
  Question,
  QuestionReveal,
  RevealedAnswer,
  TriviaGame,
} from "@/shared/types";

/** One person's (or team's) submission, flattened out of wherever it was stored */
interface Submission {
  text: string;
  status: AnswerStatus;
  /** Player display name, or team name in Team Play */
  submitter: string;
}

/**
 * Collapse submissions into distinct answers, grouped by normalized text.
 * The first spelling seen wins as the display text, and submitters accumulate
 * in submission order so the biggest groups can be surfaced first.
 */
function groupSubmissions(submissions: Submission[]): RevealedAnswer[] {
  const groups = new Map<string, RevealedAnswer>();

  for (const submission of submissions) {
    const key = normalizeAnswer(submission.text);
    // A blank submission has nothing to reveal — the submitter simply passed.
    if (!key) continue;

    const existing = groups.get(key);
    if (existing) {
      existing.submitters.push(submission.submitter);
      // One host bonus is enough to mark the whole group as a standout.
      existing.isBonus = existing.isBonus || submission.status === "bonus";
    } else {
      groups.set(key, {
        text: submission.text.trim(),
        submitters: [submission.submitter],
        isBonus: submission.status === "bonus",
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.submitters.length - a.submitters.length || a.text.localeCompare(b.text),
  );
}

/**
 * Build the reveal for one question from the submissions it drew.
 *
 * Accepted answers are the ones the host let through that the question wasn't
 * already configured to accept — i.e. the manual saves worth calling out.
 * Everything else (including answers the host never got to) reads as missed,
 * with host-bonused answers flagged so screens can showcase them.
 */
export function buildQuestionReveal(
  question: Question,
  questionNumber: number,
  submissions: Submission[],
): QuestionReveal {
  const acceptableAnswers = question.acceptableAnswers ?? [];
  const alreadyListed = new Set(
    [question.correctAnswer, ...acceptableAnswers].map(normalizeAnswer),
  );

  const accepted: Submission[] = [];
  const rejected: Submission[] = [];
  for (const submission of submissions) {
    if (submission.status === "correct") {
      if (!alreadyListed.has(normalizeAnswer(submission.text))) {
        accepted.push(submission);
      }
    } else {
      rejected.push(submission);
    }
  }

  return {
    questionId: question.id,
    questionNumber,
    questionText: question.text,
    correctAnswer: question.correctAnswer,
    acceptableAnswers,
    acceptedAnswers: groupSubmissions(accepted),
    rejectedAnswers: groupSubmissions(rejected),
  };
}

/**
 * Build reveals for the given questions of the current round, reading
 * submissions from teams in Team Play and from players otherwise. Audience
 * votes are left out: they're never judged, so they'd all read as misses.
 */
export function buildReveals(
  game: TriviaGame,
  questions: Question[],
): QuestionReveal[] {
  const round = game.rounds[game.currentRoundIndex];
  if (!round) return [];

  return questions.map((question) => {
    const questionNumber = round.questions.findIndex((q) => q.id === question.id) + 1;
    const submissions: Submission[] = [];

    if (game.settings.teamPlayEnabled) {
      for (const team of Object.values(game.teams)) {
        const answer = team.answers[question.id];
        if (answer) {
          submissions.push({
            text: answer.text,
            status: answer.status,
            submitter: team.name,
          });
        }
      }
    } else {
      for (const player of Object.values(game.players)) {
        if (player.role !== "player") continue;
        const answer = player.answers[question.id];
        if (answer) {
          submissions.push({
            text: answer.text,
            status: answer.status,
            submitter: player.displayName,
          });
        }
      }
    }

    return buildQuestionReveal(question, questionNumber, submissions);
  });
}
