// src/client/views/player/BingoCard.tsx — Tappable 5×5 bingo card grid
// R5.2: Touch targets ≥ 44px. R5.3: Semantic <button> elements per square.
import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { BingoSquare } from "@/shared/types";
import { colors, radii, spacing, shadows } from "../../styles/theme";

interface BingoCardProps {
  squares: BingoSquare[];
  marked: number[];
  /** Indices another player just marked the same phrase for — glow as a hint. */
  suggested?: number[];
  onMarkSquare: (index: number) => void;
  gridSize?: number;
}

/** Player's bingo card — tap an unmarked square to self-mark it. */
export function BingoCard({
  squares,
  marked,
  suggested = [],
  onMarkSquare,
  gridSize = 5,
}: BingoCardProps): React.ReactElement {
  const markedSet = new Set(marked);
  const suggestedSet = new Set(suggested);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      role="grid"
      aria-label="Bingo card"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gap: spacing[2],
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {squares.map((square) => {
        const isMarked = markedSet.has(square.index);
        const isSuggested = !isMarked && suggestedSet.has(square.index);
        // The free square auto-marks on card generation and can't be toggled;
        // every other square can be tapped again to unmark it.
        const isLocked = isMarked && square.isFree;
        const isExpanded = expandedIndex === square.index;
        return (
          <motion.button
            // Key includes marked state so React remounts the element on the
            // unmarked→marked transition, replaying the pop-in entrance once
            // instead of re-animating every already-marked square on re-render.
            key={`${square.index}-${isMarked}`}
            type="button"
            role="gridcell"
            disabled={isLocked}
            onClick={() => onMarkSquare(square.index)}
            aria-pressed={isMarked}
            aria-label={`${square.label}${
              isMarked
                ? isLocked
                  ? ", marked"
                  : ", marked — tap to unmark"
                : isSuggested
                  ? ", another player has this — tap to mark"
                  : ""
            }`}
            whileTap={isLocked ? undefined : { scale: 0.92 }}
            initial={isMarked ? { scale: 0.7, opacity: 0.6 } : false}
            animate={
              isSuggested && !prefersReducedMotion
                ? { scale: [1, 1.04, 1], opacity: 1 }
                : { scale: 1, opacity: 1 }
            }
            transition={
              isSuggested && !prefersReducedMotion
                ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                : { type: "spring", stiffness: 400, damping: 25 }
            }
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              minHeight: 44,
              minWidth: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: spacing[1],
              borderRadius: radii.md,
              border: `1px solid ${isMarked ? colors.accentGreen : isSuggested ? colors.accentYellow : colors.border}`,
              backgroundColor: isMarked
                ? `${colors.accentGreen}30`
                : isSuggested
                  ? `${colors.accentYellow}20`
                  : colors.bgCard,
              color: isMarked ? colors.accentGreen : isSuggested ? colors.accentYellow : colors.text,
              fontWeight: square.isFree ? 700 : 500,
              fontSize: square.label.length > 12 ? "var(--text-xs)" : "var(--text-sm)",
              boxShadow: isMarked ? shadows.glowGreen : isSuggested ? shadows.glowYellow : "none",
              cursor: isLocked ? "default" : "pointer",
              wordBreak: "break-word",
              lineHeight: 1.2,
            }}
          >
            {square.isFree ? `★ ${square.label}` : square.label}

            {square.definition && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Show clarification for ${square.label}`}
                aria-expanded={isExpanded}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIndex(isExpanded ? null : square.index);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpandedIndex(isExpanded ? null : square.index);
                  }
                }}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  fontSize: 11,
                  lineHeight: 1,
                  fontWeight: 700,
                  backgroundColor: colors.bgCard,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  cursor: "pointer",
                }}
              >
                i
              </span>
            )}

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 4 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "max-content",
                    maxWidth: 200,
                    padding: spacing[2],
                    borderRadius: radii.md,
                    backgroundColor: colors.bgCard,
                    border: `1px solid ${colors.border}`,
                    boxShadow: shadows.md,
                    color: colors.text,
                    fontSize: "var(--text-xs)",
                    fontWeight: 400,
                    textAlign: "left",
                    zIndex: 10,
                    cursor: "default",
                  }}
                >
                  {square.definition}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
