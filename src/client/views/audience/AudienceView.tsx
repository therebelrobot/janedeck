// src/client/views/audience/AudienceView.tsx — Main audience container
// R5.3: Semantic HTML. R5.5: AnimatePresence respects prefers-reduced-motion.
// R1.4: displayName is the chosen name. R2.1: No demographic data collected.
// R1.2: Unicode-safe name input. R1.6: No regex validation beyond empty check.
// R5.2: Touch targets ≥ 44px. R7.4: Non-blame error messages.
import React, { useCallback, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ServerMessage } from "@/shared/messages";
import { MAX_DISPLAY_NAME_BYTES } from "@/shared/constants";
import { usePartySocket } from "../../hooks/usePartySocket";
import { useGameStore } from "../../stores/gameStore";
import { colors, spacing, radii, shadows } from "../../styles/theme";
import { AudienceLeaderboard } from "./AudienceLeaderboard";
import { VoteInput } from "./VoteInput";

const WIN_PATTERN_LABELS: Record<string, string> = {
  line: "a line",
  four_corners: "four corners",
  blackout: "a blackout",
};

interface BingoActivityEntry {
  id: string;
  message: string;
}

/**
 * Get byte length of a string (UTF-8).
 * R1.2: Field length ≥ 256 bytes.
 */
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * AudienceView — optional spectator view.
 * Join with just a display name (game code from URL).
 * Shows current question (view-only), live leaderboard, and reactions.
 */
export function AudienceView(): React.ReactElement {
  const { gameCode } = useParams<{ gameCode: string }>();
  const prefersReducedMotion = useReducedMotion();
  const gameStore = useGameStore();

  // Local state
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVotingActive, setIsVotingActive] = useState(false);
  const [bingoActivity, setBingoActivity] = useState<BingoActivityEntry[]>([]);

  // Handle server messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      gameStore.handleServerMessage(message);

      switch (message.type) {
        case "JOIN_ACCEPTED":
          setHasJoined(true);
          setIsJoining(false);
          setJoinError(null);
          break;

        case "JOIN_REJECTED":
          setIsJoining(false);
          setJoinError(message.payload.reason);
          break;

        case "GAME_STATE_CHANGED":
          // Reset vote on new question
          if (
            message.payload.state === "QUESTION_DISPLAY" ||
            message.payload.state === "ANSWERING"
          ) {
            setHasVoted(false);
          }
          break;

        case "BINGO_SQUARE_MARKED":
          setBingoActivity((prev) => [
            {
              id: `mark-${message.payload.playerId}-${message.payload.squareIndex}-${prev.length}`,
              message: `${message.payload.displayName} marked ${message.payload.label}`,
            },
            ...prev.slice(0, 19),
          ]);
          break;

        case "BINGO_SQUARE_UNMARKED":
          setBingoActivity((prev) => [
            {
              id: `unmark-${message.payload.playerId}-${message.payload.squareIndex}-${prev.length}`,
              message: `${message.payload.displayName} unmarked ${message.payload.label}`,
            },
            ...prev.slice(0, 19),
          ]);
          break;

        case "BINGO_WINNER": {
          const patternLabel =
            WIN_PATTERN_LABELS[message.payload.pattern] || message.payload.pattern;
          setBingoActivity((prev) => [
            {
              id: `win-${message.payload.playerId}-${message.payload.pattern}`,
              message: `🏆 ${message.payload.displayName} got ${patternLabel}!`,
            },
            ...prev.slice(0, 19),
          ]);
          break;
        }

        default:
          break;
      }
    },
    [gameStore],
  );

  const { send, status } = usePartySocket({
    gameCode: gameCode || null,
    role: "audience",
    onMessage: handleMessage,
    onOpen: () => gameStore.setIsConnected(true),
    onClose: () => gameStore.setIsConnected(false),
  });

  useEffect(() => {
    if (gameCode) {
      useGameStore.getState().setGameCode(gameCode);
    }
  }, [gameCode]);

  // Handle join
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();

    // R1.6: Only validate non-empty
    if (trimmed.length === 0) {
      setJoinError("Please enter a display name.");
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    send({
      type: "AUDIENCE_JOIN",
      payload: { displayName: trimmed },
    });
  };

  // Handle name input — R1.2: Unicode-safe, max 256 bytes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (getByteLength(value) <= MAX_DISPLAY_NAME_BYTES) {
      setDisplayName(value);
      setJoinError(null);
    }
  };

  // Handle vote
  const handleVote = (vote: string) => {
    const questionId = gameStore.currentQuestion?.questionId;
    if (!questionId) return;

    setHasVoted(true);
    send({
      type: "AUDIENCE_VOTE",
      payload: { questionId, vote },
    });
  };

  // Derived state
  const { gameState, gameType, currentQuestion, leaderboard, bingoWinners } = gameStore;

  // Join screen
  if (!hasJoined) {
    return (
      <motion.div
        className="view view--player"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 300, damping: 25 }
        }
        style={{ justifyContent: "center" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-3xl)",
            fontWeight: 700,
            color: colors.secondary,
            textAlign: "center",
            marginBottom: spacing[2],
          }}
        >
          JaneDeck
        </h1>
        <p
          style={{
            color: colors.textSecondary,
            textAlign: "center",
            marginBottom: spacing[6],
          }}
        >
          Join as an audience member
        </p>

        <form
          onSubmit={handleJoin}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing[4],
            width: "100%",
            padding: spacing[6],
            backgroundColor: colors.bgCard,
            borderRadius: radii.xl,
            border: `1px solid ${colors.border}`,
            boxShadow: shadows.md,
          }}
        >
          {/* Game code display (from URL) */}
          <div
            style={{
              textAlign: "center",
              padding: spacing[3],
              backgroundColor: `${colors.primary}10`,
              borderRadius: radii.md,
            }}
          >
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: colors.textSecondary,
                margin: 0,
              }}
            >
              Game Code
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                color: colors.accentYellow,
                letterSpacing: "0.15em",
                margin: 0,
              }}
            >
              {gameCode}
            </p>
          </div>

          {/* Display name — R1.4 */}
          <div>
            <label
              htmlFor="audience-name"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-base)",
                fontWeight: 600,
                color: colors.text,
                display: "block",
                marginBottom: spacing[2],
              }}
            >
              Display Name
            </label>
            <input
              id="audience-name"
              type="text"
              value={displayName}
              onChange={handleNameChange}
              disabled={isJoining}
              placeholder="Your name"
              autoComplete="nickname"
              autoFocus
              style={{ fontSize: "var(--text-xl)", minHeight: 56 }}
            />
          </div>

          {/* Error — R7.4: non-blame */}
          {joinError && (
            <p
              role="alert"
              style={{
                color: colors.incorrect,
                fontSize: "var(--text-sm)",
                padding: `${spacing[2]} ${spacing[3]}`,
                backgroundColor: `${colors.incorrect}15`,
                borderRadius: radii.md,
                border: `1px solid ${colors.incorrect}40`,
                margin: 0,
              }}
            >
              {joinError}
            </p>
          )}

          {/* Join button — R5.2 */}
          <button
            type="submit"
            disabled={isJoining}
            className="btn-lg"
            style={{
              width: "100%",
              minHeight: 56,
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              backgroundColor: colors.accentPurple,
            }}
          >
            {isJoining ? "Joining..." : "Watch Game"}
          </button>
        </form>
      </motion.div>
    );
  }

  // Main audience view
  return (
    <motion.div
      className="view view--player"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.3 }}
    >
      {/* Connection status */}
      {status !== "connected" && (
        <div
          style={{
            position: "fixed",
            top: spacing[2],
            left: "50%",
            transform: "translateX(-50%)",
            padding: `${spacing[1]} ${spacing[3]}`,
            backgroundColor: `${colors.accentYellow}20`,
            borderRadius: "var(--radius-full)",
            fontSize: "var(--text-xs)",
            color: colors.accentYellow,
            zIndex: 50,
          }}
          role="status"
          aria-live="polite"
        >
          {status === "connecting" ? "Reconnecting..." : "Connection lost"}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${spacing[2]} ${spacing[3]}`,
          backgroundColor: colors.bgCard,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border}`,
          width: "100%",
          marginBottom: spacing[4],
        }}
      >
        <span
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
          }}
        >
          👁️ Watching
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            color: colors.accentYellow,
          }}
        >
          {gameCode}
        </span>
      </div>

      {/* Content based on state */}
      <AnimatePresence mode="wait">
        <motion.div
          key={gameState}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing[4],
          }}
        >
          {/* LOBBY */}
          {gameState === "LOBBY" && (
            <div style={{ textAlign: "center", padding: `${spacing[8]} 0` }}>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-xl)",
                  color: colors.textSecondary,
                  margin: 0,
                }}
              >
                Waiting for the game to start...
              </p>
            </div>
          )}

          {/* Question display (view-only) */}
          {(gameState === "QUESTION_DISPLAY" ||
            gameState === "ANSWERING" ||
            gameState === "REVIEWING") &&
            currentQuestion && (
              <div
                style={{
                  padding: spacing[4],
                  backgroundColor: colors.bgCard,
                  borderRadius: radii.xl,
                  border: `1px solid ${colors.primary}40`,
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: colors.textSecondary,
                    margin: 0,
                    marginBottom: spacing[2],
                  }}
                >
                  Q{currentQuestion.questionNumber}/{currentQuestion.totalQuestions}
                  {" · "}{currentQuestion.pointValue} pts
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-xl)",
                    fontWeight: 700,
                    color: colors.text,
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {currentQuestion.text}
                </h2>
              </div>
            )}

          {/* ROUND_INTRO */}
          {gameState === "ROUND_INTRO" && (
            <div style={{ textAlign: "center", padding: `${spacing[6]} 0` }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-3xl)",
                  fontWeight: 700,
                  color: colors.accentPurple,
                  margin: 0,
                }}
              >
                Round {gameStore.roundIndex + 1}
              </h2>
            </div>
          )}

          {/* Voting area (when applicable) */}
          {(gameState === "ANSWERING" || gameState === "SCORE_REVEAL") && (
            <VoteInput
              onVote={handleVote}
              isActive={isVotingActive || gameState === "ANSWERING"}
              hasVoted={hasVoted}
            />
          )}

          {/* Score reveal / round results / game over info */}
          {(gameState === "SCORE_REVEAL" ||
            gameState === "ROUND_RESULTS" ||
            gameState === "GAME_OVER") && (
            <div style={{ textAlign: "center", marginBottom: spacing[2] }}>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-xl)",
                  fontWeight: 700,
                  color:
                    gameState === "GAME_OVER"
                      ? colors.secondary
                      : colors.accentPurple,
                  margin: 0,
                }}
              >
                {gameState === "GAME_OVER" ? "🏆 Game Over!" : "📊 Scores"}
              </h3>
            </div>
          )}

          {/* BINGO_PLAYING / BINGO_ENDED — spectate-only: winners + activity feed, no card */}
          {(gameState === "BINGO_PLAYING" || gameState === "BINGO_ENDED") && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-xl)",
                    fontWeight: 700,
                    color: colors.accentPurple,
                    margin: 0,
                  }}
                >
                  {gameState === "BINGO_ENDED" ? "🏁 Bingo Ended" : "🎱 Bingo in Progress"}
                </h2>
              </div>

              <div
                style={{
                  padding: spacing[4],
                  backgroundColor: colors.bgCard,
                  borderRadius: radii.xl,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--text-base)",
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: spacing[2],
                  }}
                >
                  Winners {bingoWinners.length > 0 && `(${bingoWinners.length})`}
                </h3>
                {bingoWinners.length === 0 ? (
                  <p style={{ color: colors.textSecondary, fontSize: "var(--text-sm)", margin: 0 }}>
                    No one has won yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
                    {bingoWinners.map((winner, i) => (
                      <p
                        key={`${winner.playerId}-${winner.pattern}-${i}`}
                        style={{ fontSize: "var(--text-sm)", margin: 0 }}
                      >
                        🏆 {winner.displayName} — {WIN_PATTERN_LABELS[winner.pattern] || winner.pattern}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[1],
                }}
                aria-live="polite"
              >
                <AnimatePresence mode="popLayout">
                  {bingoActivity.map((entry) => (
                    <motion.p
                      key={entry.id}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ fontSize: "var(--text-xs)", color: colors.textSecondary, margin: 0 }}
                    >
                      {entry.message}
                    </motion.p>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Leaderboard — trivia only; bingo uses the winners list above */}
      {gameType !== "bingo" && leaderboard.length > 0 && (
        <div style={{ width: "100%", marginTop: spacing[4] }}>
          <AudienceLeaderboard entries={leaderboard} maxDisplay={15} />
        </div>
      )}
    </motion.div>
  );
}
