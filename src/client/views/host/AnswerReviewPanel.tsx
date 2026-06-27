// src/client/views/host/AnswerReviewPanel.tsx — Answer review interface
// R5.3: Semantic HTML. R5.6: aria-live regions for dynamic updates.
// R1.4: displayName is the chosen name. R7.4: No blame language.
import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AnswerReview } from "@/shared/types";
import type { ClientMessage } from "@/shared/messages";
import { FUZZY_AUTO_ACCEPT, FUZZY_NEEDS_REVIEW } from "@/shared/constants";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { staggerContainer, staggerItem } from "../../animations/presets";
import { AnswerCard, type ReviewStatus } from "./components/AnswerCard";

interface AnswerReviewPanelProps {
  /** Answers to review */
  answers: AnswerReview[];
  /** Correct answer for this question */
  correctAnswer: string;
  /** Acceptable alternative answers */
  acceptableAnswers: string[];
  /** Default bonus points from game settings */
  defaultBonus: number;
  /** Send a message via WebSocket */
  send: (message: ClientMessage) => void;
}

/**
 * Answer review panel showing all player answers grouped by classification.
 * Auto-accepted (fuzzy ≤ 0.2), needs review (≤ 0.4), auto-rejected (> 0.4).
 * Supports individual and bulk judging.
 */
export function AnswerReviewPanel({
  answers,
  correctAnswer,
  acceptableAnswers,
  defaultBonus,
  send,
}: AnswerReviewPanelProps): React.ReactElement {
  // Track review status and bonus per answer
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
  const [bonusPoints, setBonusPoints] = useState<Record<string, number>>({});

  // Classify answers into groups
  const groups = useMemo(() => {
    const autoAccepted: AnswerReview[] = [];
    const needsReview: AnswerReview[] = [];
    const autoRejected: AnswerReview[] = [];

    for (const answer of answers) {
      if (answer.fuzzyScore <= FUZZY_AUTO_ACCEPT) {
        autoAccepted.push(answer);
      } else if (answer.fuzzyScore <= FUZZY_NEEDS_REVIEW) {
        needsReview.push(answer);
      } else {
        autoRejected.push(answer);
      }
    }

    return { autoAccepted, needsReview, autoRejected };
  }, [answers]);

  // Stats
  const totalAnswers = answers.length;
  const reviewedCount = Object.keys(reviewStatuses).length;
  const allReviewed = reviewedCount === totalAnswers;

  const getReviewStatus = (answerId: string): ReviewStatus =>
    reviewStatuses[answerId] || "pending";

  const getBonus = (answerId: string): number =>
    bonusPoints[answerId] ?? 0;

  // Individual actions
  const handleAccept = useCallback(
    (answerId: string, bonus: number) => {
      setReviewStatuses((prev) => ({ ...prev, [answerId]: "accepted" }));
      send({
        type: "HOST_JUDGE_ANSWER",
        payload: {
          answerId,
          status: "correct",
          bonusPoints: bonus > 0 ? bonus : undefined,
        },
      });
    },
    [send],
  );

  const handleReject = useCallback(
    (answerId: string) => {
      setReviewStatuses((prev) => ({ ...prev, [answerId]: "rejected" }));
      send({
        type: "HOST_JUDGE_ANSWER",
        payload: {
          answerId,
          status: "incorrect",
        },
      });
    },
    [send],
  );

  const handleBonusChange = useCallback(
    (answerId: string, bonus: number) => {
      setBonusPoints((prev) => ({ ...prev, [answerId]: bonus }));
    },
    [],
  );

  // Bulk actions
  const handleBulkAcceptAutoAccepted = useCallback(() => {
    const judgments = groups.autoAccepted
      .filter((a) => getReviewStatus(a.answerId) === "pending")
      .map((a) => ({
        answerId: a.answerId,
        status: "correct" as const,
      }));

    if (judgments.length === 0) return;

    const newStatuses: Record<string, ReviewStatus> = {};
    for (const j of judgments) {
      newStatuses[j.answerId] = "accepted";
    }
    setReviewStatuses((prev) => ({ ...prev, ...newStatuses }));

    send({
      type: "HOST_BULK_JUDGE",
      payload: { judgments },
    });
  }, [groups.autoAccepted, reviewStatuses, send]);

  const handleBulkRejectAutoRejected = useCallback(() => {
    const judgments = groups.autoRejected
      .filter((a) => getReviewStatus(a.answerId) === "pending")
      .map((a) => ({
        answerId: a.answerId,
        status: "incorrect" as const,
      }));

    if (judgments.length === 0) return;

    const newStatuses: Record<string, ReviewStatus> = {};
    for (const j of judgments) {
      newStatuses[j.answerId] = "rejected";
    }
    setReviewStatuses((prev) => ({ ...prev, ...newStatuses }));

    send({
      type: "HOST_BULK_JUDGE",
      payload: { judgments },
    });
  }, [groups.autoRejected, reviewStatuses, send]);

  const handleAcceptAllRemaining = useCallback(() => {
    const pending = answers.filter((a) => getReviewStatus(a.answerId) === "pending");
    if (pending.length === 0) return;

    const judgments = pending.map((a) => ({
      answerId: a.answerId,
      status: "correct" as const,
    }));

    const newStatuses: Record<string, ReviewStatus> = {};
    for (const j of judgments) {
      newStatuses[j.answerId] = "accepted";
    }
    setReviewStatuses((prev) => ({ ...prev, ...newStatuses }));

    send({
      type: "HOST_BULK_JUDGE",
      payload: { judgments },
    });
  }, [answers, reviewStatuses, send]);

  const pendingAutoAccepted = groups.autoAccepted.filter(
    (a) => getReviewStatus(a.answerId) === "pending",
  ).length;
  const pendingAutoRejected = groups.autoRejected.filter(
    (a) => getReviewStatus(a.answerId) === "pending",
  ).length;
  const pendingTotal = answers.filter(
    (a) => getReviewStatus(a.answerId) === "pending",
  ).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[6],
        width: "100%",
      }}
    >
      {/* Header with correct answer */}
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
            Answer Review
          </h3>
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
            }}
            aria-live="polite"
          >
            {reviewedCount}/{totalAnswers} reviewed
          </span>
        </div>

        <div style={{ marginTop: spacing[3], display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
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
            {correctAnswer}
          </span>
          {acceptableAnswers.length > 0 && (
            <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
              Also: {acceptableAnswers.join(", ")}
            </span>
          )}
        </div>

        {/* Bulk action buttons */}
        <div
          style={{
            display: "flex",
            gap: spacing[2],
            marginTop: spacing[4],
            flexWrap: "wrap",
          }}
        >
          {pendingAutoAccepted > 0 && (
            <button
              type="button"
              onClick={handleBulkAcceptAutoAccepted}
              className="btn-sm btn-success"
              style={{ fontSize: "var(--text-sm)" }}
            >
              ✓ Accept All Auto-Accepted ({pendingAutoAccepted})
            </button>
          )}
          {pendingAutoRejected > 0 && (
            <button
              type="button"
              onClick={handleBulkRejectAutoRejected}
              className="btn-sm btn-danger"
              style={{ fontSize: "var(--text-sm)" }}
            >
              ✗ Reject All Auto-Rejected ({pendingAutoRejected})
            </button>
          )}
          {pendingTotal > 0 && (
            <button
              type="button"
              onClick={handleAcceptAllRemaining}
              className="btn-sm btn-ghost"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Accept All Remaining ({pendingTotal})
            </button>
          )}
        </div>
      </div>

      {/* Auto-accepted section */}
      {groups.autoAccepted.length > 0 && (
        <AnswerSection
          title="✅ Auto-Accepted"
          description={`Fuzzy match ≤ ${FUZZY_AUTO_ACCEPT * 100}% distance`}
          color={colors.correct}
          answers={groups.autoAccepted}
          reviewStatuses={reviewStatuses}
          bonusPoints={bonusPoints}
          defaultBonus={defaultBonus}
          onAccept={handleAccept}
          onReject={handleReject}
          onBonusChange={handleBonusChange}
        />
      )}

      {/* Needs review section */}
      {groups.needsReview.length > 0 && (
        <AnswerSection
          title="🔍 Needs Review"
          description="These answers are close but not auto-accepted"
          color={colors.needsReview}
          answers={groups.needsReview}
          reviewStatuses={reviewStatuses}
          bonusPoints={bonusPoints}
          defaultBonus={defaultBonus}
          onAccept={handleAccept}
          onReject={handleReject}
          onBonusChange={handleBonusChange}
        />
      )}

      {/* Auto-rejected section */}
      {groups.autoRejected.length > 0 && (
        <AnswerSection
          title="❌ Auto-Rejected"
          description={`Fuzzy match > ${FUZZY_NEEDS_REVIEW * 100}% distance`}
          color={colors.incorrect}
          answers={groups.autoRejected}
          reviewStatuses={reviewStatuses}
          bonusPoints={bonusPoints}
          defaultBonus={defaultBonus}
          onAccept={handleAccept}
          onReject={handleReject}
          onBonusChange={handleBonusChange}
        />
      )}

      {/* Empty state */}
      {totalAnswers === 0 && (
        <p
          style={{
            textAlign: "center",
            color: colors.textSecondary,
            padding: spacing[8],
          }}
        >
          No answers submitted yet. Waiting for submissions...
        </p>
      )}

      {/* All reviewed indicator */}
      {allReviewed && totalAnswers > 0 && (
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

// ─── Answer Section Sub-component ─────────────────────────────────────────────

interface AnswerSectionProps {
  title: string;
  description: string;
  color: string;
  answers: AnswerReview[];
  reviewStatuses: Record<string, ReviewStatus>;
  bonusPoints: Record<string, number>;
  defaultBonus: number;
  onAccept: (answerId: string, bonusPoints: number) => void;
  onReject: (answerId: string) => void;
  onBonusChange: (answerId: string, bonusPoints: number) => void;
}

function AnswerSection({
  title,
  description,
  color,
  answers,
  reviewStatuses,
  bonusPoints,
  defaultBonus,
  onAccept,
  onReject,
  onBonusChange,
}: AnswerSectionProps): React.ReactElement {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          marginBottom: spacing[3],
        }}
      >
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color,
            margin: 0,
          }}
        >
          {title}
        </h4>
        <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
          ({answers.length}) — {description}
        </span>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[3],
        }}
      >
        <AnimatePresence mode="popLayout">
          {answers.map((answer) => (
            <AnswerCard
              key={answer.answerId}
              answer={answer}
              reviewStatus={reviewStatuses[answer.answerId] || "pending"}
              bonusPoints={bonusPoints[answer.answerId] ?? 0}
              onAccept={onAccept}
              onReject={onReject}
              onBonusChange={onBonusChange}
              defaultBonus={defaultBonus}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
