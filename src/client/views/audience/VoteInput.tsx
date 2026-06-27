// src/client/views/audience/VoteInput.tsx — Audience participation voting
// R5.2: Touch targets ≥ 44px. R5.3: Semantic HTML with <button>.
// R5.5: Animations respect prefers-reduced-motion.
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colors, spacing, radii } from "../../styles/theme";

interface VoteInputProps {
  /** Called when the audience member votes */
  onVote: (vote: string) => void;
  /** Whether voting is currently enabled */
  isActive: boolean;
  /** Whether the audience member has already voted */
  hasVoted: boolean;
}

/** Reaction options for audience voting */
const REACTIONS = [
  { emoji: "👍", label: "Thumbs up", value: "thumbs_up" },
  { emoji: "😂", label: "Laugh", value: "laugh" },
  { emoji: "😮", label: "Wow", value: "wow" },
  { emoji: "🎉", label: "Celebration", value: "celebration" },
];

/**
 * Simple voting/reaction buttons for audience participation.
 * Large touch targets, disabled after voting.
 */
export function VoteInput({
  onVote,
  isActive,
  hasVoted,
}: VoteInputProps): React.ReactElement {
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleVote = (value: string) => {
    if (!isActive || hasVoted) return;
    setSelectedVote(value);
    onVote(value);
  };

  if (!isActive) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: spacing[4],
          color: colors.textSecondary,
          fontSize: "var(--text-sm)",
        }}
      >
        <p style={{ margin: 0 }}>Audience participation will appear here when enabled</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        width: "100%",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-base)",
          fontWeight: 700,
          color: colors.textSecondary,
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          textAlign: "center",
        }}
      >
        {hasVoted ? "Vote submitted!" : "React!"}
      </h3>

      <div
        style={{
          display: "flex",
          gap: spacing[3],
          justifyContent: "center",
          flexWrap: "wrap",
        }}
        role="group"
        aria-label="Audience reactions"
      >
        {REACTIONS.map((reaction) => {
          const isSelected = selectedVote === reaction.value;

          return (
            <motion.button
              key={reaction.value}
              type="button"
              onClick={() => handleVote(reaction.value)}
              disabled={hasVoted}
              whileTap={
                !hasVoted && !prefersReducedMotion ? { scale: 0.9 } : undefined
              }
              animate={
                isSelected && !prefersReducedMotion
                  ? { scale: [1, 1.2, 1] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.3 }}
              style={{
                width: 64,
                height: 64,
                minHeight: 44,
                minWidth: 44,
                borderRadius: radii.xl,
                border: isSelected
                  ? `3px solid ${colors.primary}`
                  : `2px solid ${colors.border}`,
                backgroundColor: isSelected
                  ? `${colors.primary}20`
                  : colors.bgCard,
                fontSize: "var(--text-3xl)",
                cursor: hasVoted ? "default" : "pointer",
                opacity: hasVoted && !isSelected ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "border-color 0.15s ease, opacity 0.15s ease",
              }}
              aria-label={reaction.label}
              aria-pressed={isSelected}
            >
              {reaction.emoji}
            </motion.button>
          );
        })}
      </div>

      {hasVoted && (
        <p
          style={{
            textAlign: "center",
            fontSize: "var(--text-sm)",
            color: colors.correct,
            margin: 0,
          }}
          role="status"
        >
          ✓ Thanks for your reaction!
        </p>
      )}
    </div>
  );
}
