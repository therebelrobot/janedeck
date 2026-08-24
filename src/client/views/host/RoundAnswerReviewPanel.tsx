// src/client/views/host/RoundAnswerReviewPanel.tsx — Team Play round review interface
// Batch equivalent of AnswerReviewPanel: one section per question in the round,
// each grouped auto-accepted/needs-review/auto-rejected exactly like the
// per-question flow, reusing AnswerCard via a TeamAnswerReview -> AnswerReview
// field mapping (teamId -> playerId, teamName -> displayName).
import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import type { AnswerReview, TeamAnswerReview } from "@/shared/types";
import type { ClientMessage } from "@/shared/messages";
import type { RoundQuestionReview } from "../../stores/hostStore";
import { FUZZY_AUTO_ACCEPT, FUZZY_NEEDS_REVIEW } from "@/shared/constants";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { staggerContainer, staggerItem } from "../../animations/presets";
import { AnswerCard, type ReviewStatus } from "./components/AnswerCard";

interface RoundAnswerReviewPanelProps {
  questions: RoundQuestionReview[];
  defaultBonus: number;
  send: (message: ClientMessage) => void;
}

/** Adapt a TeamAnswerReview into the AnswerReview shape AnswerCard expects */
function toAnswerReview(t: TeamAnswerReview): AnswerReview {
  return {
    answerId: t.answerId,
    playerId: t.teamId,
    displayName: t.teamName,
    text: t.text,
    fuzzyScore: t.fuzzyScore,
    fuzzyMatchedAgainst: t.fuzzyMatchedAgainst,
    suggestedStatus: t.suggestedStatus,
    submittedAt: t.submittedAt,
  };
}

/**
 * Round-wide answer review panel for Team Play — one question section at a
 * time, each with the same auto-accept/needs-review/auto-reject grouping and
 * bulk actions as the individual-play AnswerReviewPanel.
 */
export function RoundAnswerReviewPanel({
  questions,
  defaultBonus,
  send,
}: RoundAnswerReviewPanelProps): React.ReactElement {
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
  const [bonusPoints, setBonusPoints] = useState<Record<string, number>>({});

  const totalAnswers = useMemo(
    () => questions.reduce((sum, q) => sum + q.teamAnswers.length, 0),
    [questions],
  );
  const reviewedCount = Object.keys(reviewStatuses).length;
  const allReviewed = totalAnswers > 0 && reviewedCount === totalAnswers;

  const getReviewStatus = useCallback(
    (answerId: string): ReviewStatus => reviewStatuses[answerId] || "pending",
    [reviewStatuses],
  );

  const handleAccept = useCallback(
    (answerId: string, bonus: number) => {
      setReviewStatuses((prev) => ({ ...prev, [answerId]: "accepted" }));
      send({
        type: "HOST_JUDGE_ANSWER",
        payload: { answerId, status: "correct", bonusPoints: bonus > 0 ? bonus : undefined },
      });
    },
    [send],
  );

  const handleReject = useCallback(
    (answerId: string) => {
      const bonus = bonusPoints[answerId] ?? 0;
      setReviewStatuses((prev) => ({ ...prev, [answerId]: "rejected" }));
      send({
        type: "HOST_JUDGE_ANSWER",
        payload: {
          answerId,
          status: bonus > 0 ? "bonus" : "incorrect",
          bonusPoints: bonus > 0 ? bonus : undefined,
        },
      });
    },
    [send, bonusPoints],
  );

  const handleBonusChange = useCallback((answerId: string, bonus: number) => {
    setBonusPoints((prev) => ({ ...prev, [answerId]: bonus }));
  }, []);

  const handleAcceptAllRemaining = useCallback(() => {
    const pending = questions
      .flatMap((q) => q.teamAnswers)
      .filter((a) => getReviewStatus(a.answerId) === "pending");
    if (pending.length === 0) return;

    const judgments = pending.map((a) => ({ answerId: a.answerId, status: "correct" as const }));
    const newStatuses: Record<string, ReviewStatus> = {};
    for (const j of judgments) newStatuses[j.answerId] = "accepted";
    setReviewStatuses((prev) => ({ ...prev, ...newStatuses }));

    send({ type: "HOST_BULK_JUDGE", payload: { judgments } });
  }, [questions, getReviewStatus, send]);

  const pendingTotal = totalAnswers - reviewedCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6], width: "100%" }}>
      {/* Round-wide header */}
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[4],
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.sm,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], flexWrap: "wrap" }}>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Round Review
          </h3>
          <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }} aria-live="polite">
            {reviewedCount}/{totalAnswers} reviewed across {questions.length} question
            {questions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {pendingTotal > 0 && (
          <div style={{ marginTop: spacing[4] }}>
            <button
              type="button"
              onClick={handleAcceptAllRemaining}
              className="btn-sm btn-ghost"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Accept All Remaining ({pendingTotal})
            </button>
          </div>
        )}
      </div>

      {/* One section per question */}
      {questions.map((q) => (
        <QuestionSection
          key={q.questionId}
          question={q}
          reviewStatuses={reviewStatuses}
          bonusPoints={bonusPoints}
          defaultBonus={defaultBonus}
          onAccept={handleAccept}
          onReject={handleReject}
          onBonusChange={handleBonusChange}
        />
      ))}

      {questions.length === 0 && (
        <p style={{ textAlign: "center", color: colors.textSecondary, padding: spacing[8] }}>
          No answers submitted yet. Waiting for teams...
        </p>
      )}

      {allReviewed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            textAlign: "center",
            padding: spacing[4],
            backgroundColor: `${colors.correct}15`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.correct}40`,
          }}
        >
          <p
            style={{
              color: colors.correct,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-lg)",
              margin: 0,
            }}
          >
            ✓ All answers reviewed — ready to reveal scores
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Question Section Sub-component ───────────────────────────────────────────

interface QuestionSectionProps {
  question: RoundQuestionReview;
  reviewStatuses: Record<string, ReviewStatus>;
  bonusPoints: Record<string, number>;
  defaultBonus: number;
  onAccept: (answerId: string, bonusPoints: number) => void;
  onReject: (answerId: string) => void;
  onBonusChange: (answerId: string, bonusPoints: number) => void;
}

function QuestionSection({
  question,
  reviewStatuses,
  bonusPoints,
  defaultBonus,
  onAccept,
  onReject,
  onBonusChange,
}: QuestionSectionProps): React.ReactElement {
  const groups = useMemo(() => {
    const autoAccepted: TeamAnswerReview[] = [];
    const needsReview: TeamAnswerReview[] = [];
    const autoRejected: TeamAnswerReview[] = [];
    for (const answer of question.teamAnswers) {
      if (answer.fuzzyScore <= FUZZY_AUTO_ACCEPT) autoAccepted.push(answer);
      else if (answer.fuzzyScore <= FUZZY_NEEDS_REVIEW) needsReview.push(answer);
      else autoRejected.push(answer);
    }
    return { autoAccepted, needsReview, autoRejected };
  }, [question.teamAnswers]);

  return (
    <section
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radii.xl,
        padding: spacing[4],
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ marginBottom: spacing[4] }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {question.questionText}
        </h4>
        <div style={{ marginTop: spacing[2], display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
            Correct answer:
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: colors.correct,
              fontSize: "var(--text-base)",
            }}
          >
            {question.correctAnswer}
          </span>
          {question.acceptableAnswers.length > 0 && (
            <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
              Also: {question.acceptableAnswers.join(", ")}
            </span>
          )}
        </div>
      </div>

      {question.teamAnswers.length === 0 ? (
        <p style={{ textAlign: "center", color: colors.textSecondary, padding: spacing[4] }}>
          No team answered this question.
        </p>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}
        >
          {[...groups.autoAccepted, ...groups.needsReview, ...groups.autoRejected].map((answer) => (
            <motion.div key={answer.answerId} variants={staggerItem}>
              <AnswerCard
                answer={toAnswerReview(answer)}
                reviewStatus={reviewStatuses[answer.answerId] || "pending"}
                bonusPoints={bonusPoints[answer.answerId] ?? 0}
                onAccept={onAccept}
                onReject={onReject}
                onBonusChange={onBonusChange}
                defaultBonus={defaultBonus}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}
