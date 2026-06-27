// src/client/views/player/components/MultipleChoice.tsx — Multiple choice answer buttons
// R5.2: Touch targets ≥ 44px. R5.3: Semantic HTML with <button>.
// R5.5: Animations respect prefers-reduced-motion. R5.9: Keyboard accessible.
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { colors, spacing, radii } from "../../../styles/theme";

interface MultipleChoiceProps {
  /** Available answer options */
  choices: string[];
  /** Called when an option is selected */
  onSelect: (choice: string) => void;
  /** Whether selection is disabled (already submitted) */
  disabled?: boolean;
}

/** Color palette for choice buttons */
const CHOICE_COLORS = [
  { bg: colors.primary, hover: colors.primaryDark },
  { bg: colors.secondary, hover: colors.secondaryDark },
  { bg: colors.accentGreen, hover: "#16a34a" },
  { bg: colors.accentOrange, hover: "#ea580c" },
  { bg: colors.accentPurple, hover: "#9333ea" },
  { bg: colors.accentYellow, hover: "#eab308" },
];

/**
 * Grid of answer option buttons for multiple-choice questions.
 * Large touch targets, selected state highlight, keyboard accessible.
 * Placeholder for future multiple-choice support.
 */
export function MultipleChoice({
  choices,
  onSelect,
  disabled = false,
}: MultipleChoiceProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleSelect = (choice: string, index: number) => {
    if (disabled) return;
    setSelectedIndex(index);
    onSelect(choice);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: choices.length <= 2 ? "1fr" : "1fr 1fr",
        gap: spacing[3],
        width: "100%",
      }}
      role="group"
      aria-label="Answer options"
    >
      {choices.map((choice, index) => {
        const colorScheme = CHOICE_COLORS[index % CHOICE_COLORS.length];
        const isSelected = selectedIndex === index;

        return (
          <motion.button
            key={`choice-${index}`}
            type="button"
            onClick={() => handleSelect(choice, index)}
            disabled={disabled}
            whileTap={
              !disabled && !prefersReducedMotion ? { scale: 0.95 } : undefined
            }
            style={{
              minHeight: 64,
              padding: `${spacing[4]} ${spacing[6]}`,
              borderRadius: radii.lg,
              border: isSelected
                ? `3px solid ${colors.text}`
                : `2px solid transparent`,
              backgroundColor: isSelected
                ? colorScheme.hover
                : colorScheme.bg,
              color: index === 5 ? "#000" : colors.textOnPrimary, // Yellow needs dark text
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled && !isSelected ? 0.5 : 1,
              transition: "background-color 0.15s ease, border-color 0.15s ease",
              textAlign: "center",
              wordBreak: "break-word",
            }}
            aria-pressed={isSelected}
            aria-label={`Option ${String.fromCharCode(65 + index)}: ${choice}`}
          >
            <span
              style={{
                display: "inline-block",
                marginInlineEnd: spacing[2],
                opacity: 0.7,
              }}
            >
              {String.fromCharCode(65 + index)}.
            </span>
            {choice}
          </motion.button>
        );
      })}
    </div>
  );
}
