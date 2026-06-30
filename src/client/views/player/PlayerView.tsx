// src/client/views/player/PlayerView.tsx — Main player container
// R5.3: Semantic HTML. R5.5: AnimatePresence respects prefers-reduced-motion.
// R1.4: displayName is the chosen name. R2.1: No demographic data.
// R7.4: Non-blame error messages. R5.2: Touch targets ≥ 44px.
import React, { useCallback, useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ServerMessage } from "@/shared/messages";
import type { ScoreEntry } from "@/shared/types";
import { usePartySocket } from "../../hooks/usePartySocket";
import { useGameStore } from "../../stores/gameStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { playMarkSound, playWinSound } from "../../utils/soundEffects";
import { generateAvatarSeed, generateAlternativeSeeds, getAvatarDataUri } from "../../utils/avatarUtils";
import { colors, spacing, radii } from "../../styles/theme";
import { JoinScreen } from "./JoinScreen";
import { PlayerQuestionScreen } from "./QuestionScreen";
import { ResultScreen } from "./ResultScreen";
import { BingoCard } from "./BingoCard";
import { Confetti } from "../../components/Confetti";
import { SoundToggle } from "../../components/SoundToggle";

const WIN_PATTERN_LABELS: Record<string, string> = {
  line: "a line",
  four_corners: "four corners",
  blackout: "a blackout",
};

/**
 * sessionStorage keys for player reconnection — R9.5.
 * Scoped per game code so stale reconnect data from a previous game in the
 * same browser tab never gets auto-replayed against an unrelated game.
 */
function playerIdKey(gameCode: string): string {
  return `janedeck_player_id:${gameCode}`;
}
function playerNameKey(gameCode: string): string {
  return `janedeck_player_name:${gameCode}`;
}

/**
 * PlayerView — the main player container for mobile devices.
 * Handles join flow, game state routing, and reconnection.
 */
export function PlayerView(): React.ReactElement {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  // Stores
  const gameStore = useGameStore();
  const playerStore = usePlayerStore();

  // Avatar seed — generated once on mount, player can change it in the lobby
  const [pendingAvatarSeed] = useState<string>(() => generateAvatarSeed());

  // Local state
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameOverData, setGameOverData] = useState<{
    winner: { playerId: string; displayName: string; score: number } | null;
  } | null>(null);
  const [bingoCelebrate, setBingoCelebrate] = useState(false);
  // Count of OTHER players currently holding each label marked — drives the
  // glow hint on matching unmarked squares on our own card. Using a count
  // (rather than a one-shot flag) means the glow correctly clears if that
  // other player unmarks their square and no one else still has it marked.
  const [otherMarkedLabelCounts, setOtherMarkedLabelCounts] = useState<Record<string, number>>({});

  // Check for reconnection data — scoped to this game code only.
  const [storedPlayerId, setStoredPlayerId] = useState<string | null>(() => {
    try {
      return gameCode ? sessionStorage.getItem(playerIdKey(gameCode)) : null;
    } catch {
      return null;
    }
  });
  const [storedName] = useState<string | null>(() => {
    try {
      return gameCode ? sessionStorage.getItem(playerNameKey(gameCode)) : null;
    } catch {
      return null;
    }
  });

  // Handle server messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      // Route to both stores
      gameStore.handleServerMessage(message);
      playerStore.handlePlayerMessage(message);

      switch (message.type) {
        case "JOIN_ACCEPTED":
          setHasJoined(true);
          setIsJoining(false);
          setJoinError(null);
          // Store for reconnection
          try {
            if (gameCode) {
              sessionStorage.setItem(playerIdKey(gameCode), message.payload.playerId);
              if (playerStore.displayName) {
                sessionStorage.setItem(playerNameKey(gameCode), playerStore.displayName);
              }
            }
          } catch {
            // sessionStorage may be unavailable
          }
          break;

        case "JOIN_REJECTED":
          setIsJoining(false);
          // A "Player not found" rejection only ever comes from our own
          // automatic PLAYER_REJOIN attempt (see usePartySocket's onOpen
          // below) — it means stale reconnect data, not something the
          // player did wrong. Clear it silently instead of showing an
          // error on a join screen they haven't even submitted yet.
          if (message.payload.reason === "Player not found") {
            try {
              if (gameCode) {
                sessionStorage.removeItem(playerIdKey(gameCode));
                sessionStorage.removeItem(playerNameKey(gameCode));
              }
            } catch {
              // sessionStorage may be unavailable
            }
            setStoredPlayerId(null);
            break;
          }
          // R7.4: Server provides non-blame reason text
          setJoinError(message.payload.reason);
          break;

        case "GAME_STATE_CHANGED":
          // Reset submitted answer on new question
          if (
            message.payload.state === "QUESTION_DISPLAY" ||
            message.payload.state === "ANSWERING"
          ) {
            setSubmittedAnswer("");
            setIsSubmitting(false);
          }
          break;

        case "GAME_OVER":
          setGameOverData({
            winner: message.payload.winner,
          });
          break;

        case "KICKED":
          // Clear reconnection data
          try {
            if (gameCode) {
              sessionStorage.removeItem(playerIdKey(gameCode));
              sessionStorage.removeItem(playerNameKey(gameCode));
            }
          } catch {
            // sessionStorage may be unavailable
          }
          break;

        case "BINGO_SQUARE_MARKED": {
          // Notify on this device regardless of whether the presentation
          // screen is being watched — that's the whole point for bingo.
          const isSelf = message.payload.playerId === playerStore.playerId;
          useNotificationStore
            .getState()
            .push(
              "mark",
              isSelf
                ? `You marked ${message.payload.label}`
                : `${message.payload.displayName} marked ${message.payload.label}`,
            );
          playMarkSound();

          // Someone else marked a square — track it so any matching unmarked
          // square on our own card glows as a hint we could mark it too.
          if (!isSelf) {
            const label = message.payload.label;
            setOtherMarkedLabelCounts((prev) => ({ ...prev, [label]: (prev[label] || 0) + 1 }));
          }
          break;
        }

        case "BINGO_SQUARE_UNMARKED": {
          const isSelf = message.payload.playerId === playerStore.playerId;
          useNotificationStore
            .getState()
            .push(
              "mark",
              isSelf
                ? `You unmarked ${message.payload.label}`
                : `${message.payload.displayName} unmarked ${message.payload.label}`,
            );

          // Stop glowing matching squares once nobody else still has it marked.
          if (!isSelf) {
            const label = message.payload.label;
            setOtherMarkedLabelCounts((prev) => {
              const count = (prev[label] || 0) - 1;
              if (count <= 0) {
                const { [label]: _removed, ...rest } = prev;
                return rest;
              }
              return { ...prev, [label]: count };
            });
          }
          break;
        }

        case "BINGO_CARD_ASSIGNED":
          // New/refreshed card — any previously tracked glow hints no longer apply.
          setOtherMarkedLabelCounts({});
          break;

        case "BINGO_WINNER": {
          const patternLabel = WIN_PATTERN_LABELS[message.payload.pattern] || message.payload.pattern;
          useNotificationStore
            .getState()
            .push("win", `${message.payload.displayName} got ${patternLabel}! 🏆`);
          playWinSound();
          setBingoCelebrate(true);
          break;
        }

        default:
          break;
      }
    },
    [gameStore, playerStore, gameCode],
  );

  const { send, status } = usePartySocket({
    gameCode: gameCode || null,
    role: "player",
    onMessage: handleMessage,
    onOpen: () => {
      gameStore.setIsConnected(true);
      // Attempt reconnection if we have stored player data
      if (storedPlayerId && !hasJoined) {
        send({
          type: "PLAYER_REJOIN",
          payload: { playerId: storedPlayerId },
        });
      }
    },
    onClose: () => gameStore.setIsConnected(false),
  });

  // Set game code in store imperatively to avoid the store object itself being
  // a dep (setGameCode → store update → new store ref → effect re-fires → loop).
  useEffect(() => {
    if (gameCode) {
      useGameStore.getState().setGameCode(gameCode);
    }
  }, [gameCode]);

  // Auto-clear the bingo win celebration after the confetti burst finishes
  useEffect(() => {
    if (!bingoCelebrate) return;
    const timer = setTimeout(() => setBingoCelebrate(false), 3000);
    return () => clearTimeout(timer);
  }, [bingoCelebrate]);

  // Handle join
  const handleJoin = useCallback(
    (code: string, displayName: string) => {
      setIsJoining(true);
      setJoinError(null);
      playerStore.setDisplayName(displayName);
      playerStore.setAvatarSeed(pendingAvatarSeed);
      send({
        type: "PLAYER_JOIN",
        payload: { displayName, avatarSeed: pendingAvatarSeed },
      });
    },
    [send, playerStore, pendingAvatarSeed],
  );

  // Handle answer submission
  const handleSubmitAnswer = useCallback(
    (answer: string) => {
      const questionId = gameStore.currentQuestion?.questionId;
      if (!questionId) return;

      setIsSubmitting(true);
      setSubmittedAnswer(answer);
      playerStore.setHasSubmitted(true);

      send({
        type: "PLAYER_SUBMIT_ANSWER",
        payload: { questionId, text: answer },
      });
    },
    [send, gameStore.currentQuestion, playerStore],
  );

  // Handle bingo square marking — tapping a marked (non-free) square unmarks it.
  const handleToggleSquare = useCallback(
    (squareIndex: number) => {
      const isMarked = useGameStore.getState().bingoCard?.marked.includes(squareIndex) ?? false;
      send(
        isMarked
          ? { type: "PLAYER_UNMARK_SQUARE", payload: { squareIndex } }
          : { type: "PLAYER_MARK_SQUARE", payload: { squareIndex } },
      );
    },
    [send],
  );

  // Leave the game — clears reconnection data and local state, then
  // navigates away so the socket disconnects for good (no auto-reconnect).
  const handleLeaveGame = useCallback(() => {
    try {
      if (gameCode) {
        sessionStorage.removeItem(playerIdKey(gameCode));
        sessionStorage.removeItem(playerNameKey(gameCode));
      }
    } catch {
      // sessionStorage may be unavailable
    }
    playerStore.reset();
    gameStore.reset();
    navigate("/", { replace: true });
  }, [navigate, playerStore, gameStore, gameCode]);

  // Derived state
  const {
    gameState,
    gameType,
    currentQuestion,
    timerSeconds,
    timerTotal,
    leaderboard,
    bingoCard,
    bingoWinners,
  } = gameStore;

  // Unmarked squares whose label another player currently has marked — glow hint.
  const suggestedIndices = useMemo(() => {
    if (!bingoCard) return [];
    const markedSet = new Set(bingoCard.marked);
    return bingoCard.squares
      .filter(
        (square) =>
          !square.isFree &&
          !markedSet.has(square.index) &&
          (otherMarkedLabelCounts[square.label] || 0) > 0,
      )
      .map((square) => square.index);
  }, [bingoCard, otherMarkedLabelCounts]);

  const {
    playerId,
    displayName,
    avatarSeed,
    score,
    rank,
    hasSubmitted,
    lastAnswerResult,
    wasKicked,
    kickReason,
  } = playerStore;

  const handleAvatarChange = useCallback(
    (newSeed: string) => {
      playerStore.setAvatarSeed(newSeed);
      send({ type: "PLAYER_UPDATE_AVATAR", payload: { avatarSeed: newSeed } });
    },
    [send, playerStore],
  );

  // Kicked screen
  if (wasKicked) {
    return (
      <div
        className="view view--player"
        style={{
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            color: colors.incorrect,
            marginBottom: spacing[4],
          }}
        >
          Removed from Game
        </h2>
        {/* R7.4: Non-blame language */}
        <p style={{ color: colors.textSecondary, marginBottom: spacing[6] }}>
          {kickReason || "You have been removed from this game session."}
        </p>
        <button
          onClick={() => {
            playerStore.reset();
            gameStore.reset();
            setHasJoined(false);
          }}
          className="btn-lg"
        >
          Return to Join
        </button>
      </div>
    );
  }

  // Not joined yet — show join screen
  if (!hasJoined) {
    return (
      <JoinScreen
        initialGameCode={gameCode || ""}
        onJoin={handleJoin}
        isJoining={isJoining}
        error={joinError}
      />
    );
  }

  // Joined — show game content
  return (
    <motion.div
      className="view view--player"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.01 }
          : { type: "spring", stiffness: 300, damping: 25 }
      }
    >
      {gameType === "bingo" && <Confetti active={bingoCelebrate} />}

      {/* Top bar — sound toggle + leave game */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: spacing[2],
          width: "100%",
        }}
      >
        <SoundToggle />
        <button
          type="button"
          onClick={handleLeaveGame}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            color: colors.textSecondary,
            fontSize: "var(--text-sm)",
          }}
        >
          🚪 Leave game
        </button>
      </div>

      {/* Connection status — subtle indicator */}
      {status !== "connected" && (
        <div
          style={{
            position: "fixed",
            top: spacing[2],
            left: "50%",
            transform: "translateX(-50%)",
            padding: `${spacing[1]} ${spacing[3]}`,
            backgroundColor: status === "connecting" ? `${colors.accentYellow}20` : `${colors.incorrect}20`,
            borderRadius: "var(--radius-full)",
            border: `1px solid ${status === "connecting" ? colors.accentYellow : colors.incorrect}40`,
            fontSize: "var(--text-xs)",
            color: status === "connecting" ? colors.accentYellow : colors.incorrect,
            zIndex: 50,
          }}
          role="status"
          aria-live="polite"
        >
          {status === "connecting" ? "Reconnecting..." : "Connection lost"}
        </div>
      )}

      {/* Main content based on game state */}
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
          {/* LOBBY — waiting for host */}
          {gameState === "LOBBY" && (
            <LobbyWaiting
              displayName={displayName}
              playerCount={gameStore.playerCount}
              gameCode={gameCode || ""}
              avatarSeed={avatarSeed}
              onAvatarChange={handleAvatarChange}
            />
          )}

          {/* ROUND_INTRO */}
          {gameState === "ROUND_INTRO" && (
            <RoundIntroPlayer roundIndex={gameStore.roundIndex} />
          )}

          {/* BINGO_PLAYING — player's tappable card */}
          {gameType === "bingo" && gameState === "BINGO_PLAYING" && bingoCard && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[4], alignItems: "center" }}>
              <p style={{ color: colors.textSecondary, fontSize: "var(--text-sm)", margin: 0 }}>
                Tap a square to mark it, tap again to unmark
              </p>
              <BingoCard
                squares={bingoCard.squares}
                marked={bingoCard.marked}
                suggested={suggestedIndices}
                onMarkSquare={handleToggleSquare}
              />
            </div>
          )}

          {/* BINGO_ENDED — winners recap */}
          {gameType === "bingo" && gameState === "BINGO_ENDED" && (
            <BingoEndedScreen winners={bingoWinners} playerId={playerId} />
          )}

          {/* QUESTION_DISPLAY / ANSWERING / REVIEWING */}
          {(gameState === "QUESTION_DISPLAY" ||
            gameState === "ANSWERING" ||
            gameState === "REVIEWING") &&
            currentQuestion && (
              <PlayerQuestionScreen
                questionText={currentQuestion.text}
                questionType={currentQuestion.type}
                choices={currentQuestion.choices}
                questionNumber={currentQuestion.questionNumber}
                totalQuestions={currentQuestion.totalQuestions}
                pointValue={currentQuestion.pointValue}
                timerSeconds={timerSeconds}
                timerTotal={timerTotal}
                isAnswering={gameState === "ANSWERING"}
                hasSubmitted={hasSubmitted}
                submittedAnswer={submittedAnswer}
                playerScore={score}
                isSubmitting={isSubmitting}
                onSubmitAnswer={handleSubmitAnswer}
                isReviewing={gameState === "REVIEWING"}
              />
            )}

          {/* SCORE_REVEAL / ROUND_RESULTS */}
          {(gameState === "SCORE_REVEAL" || gameState === "ROUND_RESULTS") && (
            <ResultScreen
              answerResult={lastAnswerResult}
              playerScore={score}
              playerRank={rank}
              playerId={playerId}
              leaderboard={leaderboard}
              isGameOver={false}
            />
          )}

          {/* GAME_OVER */}
          {gameState === "GAME_OVER" && (
            <ResultScreen
              answerResult={null}
              playerScore={score}
              playerRank={rank}
              playerId={playerId}
              leaderboard={leaderboard}
              isGameOver
              winner={gameOverData?.winner}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

const PICKER_COUNT = 6;

/** Lobby waiting screen for joined players — shows current avatar + a picker */
function LobbyWaiting({
  displayName,
  playerCount,
  gameCode,
  avatarSeed,
  onAvatarChange,
}: {
  displayName: string | null;
  playerCount: number;
  gameCode: string;
  avatarSeed: string | null;
  onAvatarChange: (seed: string) => void;
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const [alternatives, setAlternatives] = useState<string[]>(() =>
    generateAlternativeSeeds(PICKER_COUNT, avatarSeed ?? ""),
  );

  const refreshAlternatives = useCallback(() => {
    setAlternatives(generateAlternativeSeeds(PICKER_COUNT, avatarSeed ?? ""));
  }, [avatarSeed]);

  const currentSrc = avatarSeed ? getAvatarDataUri(avatarSeed) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
        textAlign: "center",
        padding: `${spacing[8]} 0`,
      }}
    >
      {/* Current avatar */}
      <motion.div
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: [1, 1.04, 1], opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }
        }
        style={{ lineHeight: 0 }}
        aria-hidden="true"
      >
        {currentSrc ? (
          <img
            src={currentSrc}
            alt=""
            width={96}
            height={96}
            style={{ borderRadius: "var(--radius-full)", display: "block" }}
          />
        ) : (
          <span style={{ fontSize: "5rem" }}>🎮</span>
        )}
      </motion.div>

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: colors.text,
          margin: 0,
        }}
      >
        You're in, {displayName}!
      </h2>

      <p style={{ color: colors.textSecondary, fontSize: "var(--text-lg)", margin: 0 }}>
        Waiting for the host to start...
      </p>

      {/* Avatar picker */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing[3],
          padding: spacing[4],
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          border: `1px solid ${colors.border}`,
          width: "100%",
        }}
      >
        <p style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, margin: 0 }}>
          Pick a different avatar:
        </p>
        <div
          style={{ display: "flex", gap: spacing[3], flexWrap: "wrap", justifyContent: "center" }}
          role="group"
          aria-label="Alternative avatars"
        >
          {alternatives.map((seed) => (
            <button
              key={seed}
              type="button"
              onClick={() => onAvatarChange(seed)}
              aria-label="Use this avatar"
              style={{
                padding: 0,
                background: "none",
                border: `2px solid ${colors.border}`,
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                lineHeight: 0,
                transition: "border-color 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary;
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              <img
                src={getAvatarDataUri(seed)}
                alt=""
                width={56}
                height={56}
                style={{ borderRadius: "var(--radius-full)", display: "block" }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refreshAlternatives}
          className="btn-ghost"
          style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}
        >
          ↻ Show more options
        </button>
        <p style={{ fontSize: "var(--text-xs)", color: colors.textSecondary, margin: 0, opacity: 0.6 }}>
          Avatars:{" "}
          <a href="https://www.dicebear.com/styles/lorelei-neutral/" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>Lorelei Neutral</a>
          {" by "}
          <a href="https://www.instagram.com/lischi_art/" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>@lischi_art</a>
          {" · CC BY 4.0"}
        </p>
      </div>

      {/* Game info */}
      <div
        style={{
          padding: `${spacing[3]} ${spacing[6]}`,
          backgroundColor: `${colors.primary}15`,
          borderRadius: radii.lg,
          border: `1px solid ${colors.primary}30`,
        }}
      >
        <p style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, margin: 0 }}>
          Game: <strong style={{ color: colors.accentYellow }}>{gameCode}</strong>
          {" · "}
          <span aria-live="polite">{playerCount} player{playerCount !== 1 ? "s" : ""}</span>
        </p>
      </div>
    </div>
  );
}

/** Recap screen shown after the host ends a bingo game */
function BingoEndedScreen({
  winners,
  playerId,
}: {
  winners: Array<{ playerId: string; displayName: string; pattern: string; achievedAt: number }>;
  playerId: string | null;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[4],
        textAlign: "center",
        padding: `${spacing[8]} 0`,
      }}
    >
      <span style={{ fontSize: "3rem" }} aria-hidden="true">
        🏁
      </span>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: colors.text,
          margin: 0,
        }}
      >
        Game Over
      </h2>
      {winners.length === 0 ? (
        <p style={{ color: colors.textSecondary, margin: 0 }}>No one completed a pattern this game.</p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing[2],
            width: "100%",
            maxWidth: 360,
          }}
        >
          {winners.map((winner, i) => (
            <div
              key={`${winner.playerId}-${winner.pattern}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: `${spacing[2]} ${spacing[3]}`,
                borderRadius: radii.md,
                backgroundColor:
                  winner.playerId === playerId ? `${colors.accentYellow}20` : colors.bgCard,
                border: `1px solid ${winner.playerId === playerId ? colors.accentYellow : colors.border}`,
                fontSize: "var(--text-sm)",
              }}
            >
              <span>{winner.displayName}</span>
              <span style={{ color: colors.textSecondary }}>{winner.pattern.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Round intro for player */
function RoundIntroPlayer({
  roundIndex,
}: {
  roundIndex: number;
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[4],
        textAlign: "center",
        padding: `${spacing[12]} 0`,
      }}
    >
      <motion.h2
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 200, damping: 15 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-4xl)",
          fontWeight: 700,
          color: colors.accentPurple,
          margin: 0,
        }}
      >
        Round {roundIndex + 1}
      </motion.h2>
      <p
        style={{
          color: colors.textSecondary,
          fontSize: "var(--text-lg)",
          margin: 0,
        }}
      >
        Get ready!
      </p>
    </div>
  );
}
