// src/client/views/host/components/GameControls.tsx — State-aware control buttons
// R5.3: Semantic <button> elements. R5.2: Large touch targets.
// R5.9: Keyboard shortcuts for common actions.
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState } from "@/shared/types";
import type { ClientMessage } from "@/shared/messages";
import { colors, radii, spacing } from "../../../styles/theme";
import { scalePop } from "../../../animations/presets";

interface GameControlsProps {
  /** Current game state */
  gameState: GameState;
  /** Number of players currently connected */
  playerCount: number;
  /** Whether all answers have been reviewed */
  allAnswersReviewed: boolean;
  /** Whether there are more questions in the current round */
  hasMoreQuestions: boolean;
  /** Whether there are more rounds */
  hasMoreRounds: boolean;
  /** Send a message via WebSocket */
  send: (message: ClientMessage) => void;
}

/**
 * Context-aware game control buttons.
 * Shows the right primary/secondary actions based on current game state.
 * Includes keyboard shortcut indicators and confirmation for destructive actions.
 */
export function GameControls({
  gameState,
  playerCount,
  allAnswersReviewed,
  hasMoreQuestions,
  hasMoreRounds,
  send,
}: GameControlsProps): React.ReactElement {
  const [confirmEndGame, setConfirmEndGame] = useState(false);

  const handlePrimaryAction = () => {
    switch (gameState) {
      case "LOBBY":
        send({ type: "HOST_START_GAME", payload: {} });
        break;
      case "ROUND_INTRO":
        send({ type: "HOST_START_QUESTION", payload: {} });
        break;
      case "ANSWERING":
        send({ type: "HOST_CLOSE_ANSWERS", payload: {} });
        break;
      case "REVIEWING":
        send({ type: "HOST_REVEAL_SCORES", payload: {} });
        break;
      case "SCORE_REVEAL":
        if (hasMoreQuestions) {
          send({ type: "HOST_NEXT_QUESTION", payload: {} });
        } else if (hasMoreRounds) {
          send({ type: "HOST_NEXT_ROUND", payload: {} });
        } else {
          // Game is complete — trigger game over via next round (server handles)
          send({ type: "HOST_NEXT_ROUND", payload: {} });
        }
        break;
      case "ROUND_RESULTS":
        if (hasMoreRounds) {
          send({ type: "HOST_NEXT_ROUND", payload: {} });
        } else {
          send({ type: "HOST_NEXT_ROUND", payload: {} });
        }
        break;
      case "GAME_OVER":
        send({ type: "HOST_RESET_GAME", payload: {} });
        break;
    }
  };

  const handleEndGame = () => {
    if (confirmEndGame) {
      send({ type: "HOST_RESET_GAME", payload: {} });
      setConfirmEndGame(false);
    } else {
      setConfirmEndGame(true);
    }
  };

  // Determine primary button text and state
  const getPrimaryButton = (): {
    text: string;
    disabled: boolean;
    disabledReason: string;
    shortcut: string;
    style: React.CSSProperties;
  } => {
    switch (gameState) {
      case "LOBBY":
        return {
          text: "🎬 Start Game",
          disabled: playerCount < 1,
          disabledReason: "Need at least 1 player to start",
          shortcut: "Space",
          style: { backgroundColor: colors.correct },
        };
      case "ROUND_INTRO":
        return {
          text: "❓ Start First Question",
          disabled: false,
          disabledReason: "",
          shortcut: "Space",
          style: { backgroundColor: colors.primary },
        };
      case "ANSWERING":
        return {
          text: "⏹ Close Answers",
          disabled: false,
          disabledReason: "",
          shortcut: "Space",
          style: { backgroundColor: colors.accentOrange },
        };
      case "REVIEWING":
        return {
          text: "📊 Reveal Scores",
          disabled: false,
          disabledReason: allAnswersReviewed ? "" : "Some answers have not been reviewed yet",
          shortcut: "Space",
          style: { backgroundColor: colors.accentPurple },
        };
      case "SCORE_REVEAL":
        if (hasMoreQuestions) {
          return {
            text: "➡️ Next Question",
            disabled: false,
            disabledReason: "",
            shortcut: "Space",
            style: { backgroundColor: colors.primary },
          };
        }
        if (hasMoreRounds) {
          return {
            text: "🏁 End Round",
            disabled: false,
            disabledReason: "",
            shortcut: "Space",
            style: { backgroundColor: colors.accentOrange },
          };
        }
        return {
          text: "🏆 End Game",
          disabled: false,
          disabledReason: "",
          shortcut: "Space",
          style: { backgroundColor: colors.secondary },
        };
      case "ROUND_RESULTS":
        if (hasMoreRounds) {
          return {
            text: "➡️ Next Round",
            disabled: false,
            disabledReason: "",
            shortcut: "Space",
            style: { backgroundColor: colors.primary },
          };
        }
        return {
          text: "🏆 End Game",
          disabled: false,
          disabledReason: "",
          shortcut: "Space",
          style: { backgroundColor: colors.secondary },
        };
      case "GAME_OVER":
        return {
          text: "🔄 New Game",
          disabled: false,
          disabledReason: "",
          shortcut: "Space",
          style: { backgroundColor: colors.correct },
        };
      default:
        return {
          text: "Continue",
          disabled: false,
          disabledReason: "",
          shortcut: "Space",
          style: { backgroundColor: colors.primary },
        };
    }
  };

  const primary = getPrimaryButton();

  // Show end game button only during active game states (not lobby, not game over)
  const showEndGame =
    gameState !== "LOBBY" && gameState !== "GAME_OVER";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        width: "100%",
      }}
    >
      {/* Primary action */}
      <AnimatePresence mode="wait">
        <motion.div key={`primary-${gameState}`} {...scalePop}>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={primary.disabled}
            className="btn-lg"
            style={{
              ...primary.style,
              width: "100%",
              fontSize: "var(--text-xl)",
              minHeight: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[3],
              color: "#ffffff",
            }}
            title={primary.disabled ? primary.disabledReason : undefined}
            aria-label={primary.text}
          >
            <span>{primary.text}</span>
            <kbd
              style={{
                fontSize: "var(--text-xs)",
                backgroundColor: "rgba(0,0,0,0.2)",
                padding: `${spacing[1]} ${spacing[2]}`,
                borderRadius: radii.sm,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {primary.shortcut}
            </kbd>
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Disabled reason tooltip */}
      {primary.disabled && primary.disabledReason && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            textAlign: "center",
            margin: 0,
          }}
          role="note"
        >
          {primary.disabledReason}
        </p>
      )}

      {/* Secondary actions */}
      {showEndGame && (
        <div style={{ display: "flex", gap: spacing[2], justifyContent: "center" }}>
          {confirmEndGame ? (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[2],
                  backgroundColor: `${colors.incorrect}15`,
                  padding: spacing[3],
                  borderRadius: radii.lg,
                  border: `1px solid ${colors.incorrect}`,
                }}
              >
                {/* R7.4: non-blame language */}
                <span style={{ fontSize: "var(--text-sm)", color: colors.text }}>
                  End the game early?
                </span>
                <button
                  type="button"
                  onClick={handleEndGame}
                  className="btn-sm btn-danger"
                  style={{ minHeight: 36 }}
                >
                  End Game
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEndGame(false)}
                  className="btn-sm btn-ghost"
                  style={{ minHeight: 36 }}
                >
                  Cancel
                </button>
              </motion.div>
            </AnimatePresence>
          ) : (
            <button
              type="button"
              onClick={handleEndGame}
              className="btn-sm btn-ghost"
              style={{
                color: colors.textSecondary,
                fontSize: "var(--text-sm)",
                minHeight: 36,
              }}
              aria-label="End game early"
            >
              End Game Early
            </button>
          )}
        </div>
      )}
    </div>
  );
}
