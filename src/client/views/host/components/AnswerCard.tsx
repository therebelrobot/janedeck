// src/client/views/host/components/AnswerCard.tsx — Individual answer card for review
// R5.2: Large touch targets (≥ 44px). R5.3: Semantic HTML with <button>.
// R1.4: displayName is the chosen name. R7.4: No blame language.
import React, { useState } from "react";
import { motion } from "framer-motion";
import type { AnswerReview } from "@/shared/types";
import { PlayerAvatar } from "../../../components/PlayerAvatar";
import { colors, radii, spacing } from "../../../styles/theme";
import { staggerItem } from "../../../animations/presets";

/** Status of an answer in the review process */
export type ReviewStatus = "pending" | "accepted" | "rejected";

interface AnswerCardProps {
  /** The answer review data */
  answer: AnswerReview;
  /** Current review status */
  reviewStatus: ReviewStatus;
  /** Current bonus points value */
  bonusPoints: number;
  /** Callback when host accepts an answer */
  onAccept: (answerId: string, bonusPoints: number) => void;
  /** Callback when host rejects an answer */
  onReject: (answerId: string) => void;
  /** Callback when bonus points change */
  onBonusChange: (answerId: string, bonusPoints: number) => void;
  /** Default bonus points value from game settings */
  defaultBonus: number;
}

/**
 * Get the background color for the fuzzy score bar.
 */
function getScoreColor(score: number): string {
  if (score <= 0.2) return colors.correct;
  if (score <= 0.4) return colors.needsReview;
  return colors.incorrect;
}

/**
 * Individual answer card showing player answer, fuzzy match score,
 * and accept/reject controls with bonus point adjustment.
 */
export function AnswerCard({
  answer,
  reviewStatus,
  bonusPoints,
  onAccept,
  onReject,
  onBonusChange,
  defaultBonus,
}: AnswerCardProps): React.ReactElement {
  const [localBonus, setLocalBonus] = useState(bonusPoints);
  const scoreColor = getScoreColor(answer.fuzzyScore);

  const statusBg =
    reviewStatus === "accepted"
      ? `${colors.correct}15`
      : reviewStatus === "rejected"
        ? `${colors.incorrect}15`
        : "transparent";

  const statusBorder =
    reviewStatus === "accepted"
      ? colors.correct
      : reviewStatus === "rejected"
        ? colors.incorrect
        : colors.border;

  const handleBonusIncrement = () => {
    const newVal = localBonus + 1;
    setLocalBonus(newVal);
    onBonusChange(answer.answerId, newVal);
  };

  const handleBonusDecrement = () => {
    const newVal = Math.max(0, localBonus - 1);
    setLocalBonus(newVal);
    onBonusChange(answer.answerId, newVal);
  };

  return (
    <motion.div
      variants={staggerItem}
      layout
      style={{
        backgroundColor: statusBg || colors.bgCard,
        borderRadius: radii.lg,
        padding: spacing[4],
        border: `2px solid ${statusBorder}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
      role="article"
      aria-label={`Answer from ${answer.displayName}: ${answer.text}`}
    >
      {/* Player info row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
        }}
      >
        <PlayerAvatar displayName={answer.displayName} avatarSeed={answer.avatarSeed} isConnected size="sm" />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--text-base)",
            flex: 1,
          }}
        >
          {/* R1.4: displayName is the chosen name */}
          {answer.displayName}
        </span>

        {/* Review status indicator */}
        {reviewStatus !== "pending" && (
          <span
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              color: reviewStatus === "accepted" ? colors.correct : colors.incorrect,
              textTransform: "uppercase",
            }}
            aria-live="polite"
          >
            {reviewStatus === "accepted" ? "✓ Accepted" : "✗ Rejected"}
          </span>
        )}
      </div>

      {/* Answer text */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-xl)",
          fontWeight: 700,
          color: colors.text,
          padding: `${spacing[2]} 0`,
          wordBreak: "break-word",
        }}
      >
        &ldquo;{answer.text}&rdquo;
      </div>

      {/* Fuzzy score bar */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
        <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, whiteSpace: "nowrap" }}>
          Match: {((1 - answer.fuzzyScore) * 100).toFixed(0)}%
        </span>
        <div
          style={{
            flex: 1,
            height: 8,
            backgroundColor: colors.bgElevated,
            borderRadius: radii.full,
            overflow: "hidden",
          }}
          role="progressbar"
          aria-valuenow={Math.round((1 - answer.fuzzyScore) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Fuzzy match score: ${((1 - answer.fuzzyScore) * 100).toFixed(0)}%`}
        >
          <div
            style={{
              width: `${(1 - answer.fuzzyScore) * 100}%`,
              height: "100%",
              backgroundColor: scoreColor,
              borderRadius: radii.full,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        {answer.fuzzyMatchedAgainst && (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: colors.textSecondary,
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={`Matched against: ${answer.fuzzyMatchedAgainst}`}
          >
            vs &ldquo;{answer.fuzzyMatchedAgainst}&rdquo;
          </span>
        )}
      </div>

      {/* Action buttons row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          flexWrap: "wrap",
        }}
      >
        {/* Accept button — R5.2: min 44px touch target */}
        <button
          type="button"
          onClick={() => onAccept(answer.answerId, localBonus)}
          disabled={reviewStatus === "accepted"}
          className="btn-success"
          style={{
            minHeight: 44,
            minWidth: 44,
            flex: "1 1 100px",
            opacity: reviewStatus === "accepted" ? 0.5 : 1,
          }}
          aria-label={`Accept answer from ${answer.displayName}`}
        >
          ✓ Accept
        </button>

        {/* Reject button */}
        <button
          type="button"
          onClick={() => onReject(answer.answerId)}
          disabled={reviewStatus === "rejected"}
          className="btn-danger"
          style={{
            minHeight: 44,
            minWidth: 44,
            flex: "1 1 100px",
            opacity: reviewStatus === "rejected" ? 0.5 : 1,
          }}
          aria-label={`Reject answer from ${answer.displayName}`}
        >
          ✗ Reject
        </button>

        {/* Bonus points adjuster */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            marginInlineStart: "auto",
          }}
        >
          <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
            Bonus:
          </span>
          <button
            type="button"
            onClick={handleBonusDecrement}
            disabled={localBonus <= 0}
            className="btn-sm btn-ghost"
            aria-label="Decrease bonus points"
            style={{ minHeight: 36, minWidth: 36 }}
          >
            −
          </button>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-lg)",
              color: localBonus > 0 ? colors.bonus : colors.textSecondary,
              minWidth: 24,
              textAlign: "center",
            }}
          >
            {localBonus}
          </span>
          <button
            type="button"
            onClick={handleBonusIncrement}
            className="btn-sm btn-ghost"
            aria-label="Increase bonus points"
            style={{ minHeight: 36, minWidth: 36 }}
          >
            +
          </button>
        </div>
      </div>
    </motion.div>
  );
}
