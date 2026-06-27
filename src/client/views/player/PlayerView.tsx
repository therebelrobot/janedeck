// src/client/views/player/PlayerView.tsx — Main player container
// R5.3: Semantic HTML. R5.5: AnimatePresence respects prefers-reduced-motion.
// R1.4: displayName is the chosen name. R2.1: No demographic data.
// R7.4: Non-blame error messages. R5.2: Touch targets ≥ 44px.
import React, { useCallback, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ServerMessage } from "@/shared/messages";
import type { ScoreEntry } from "@/shared/types";
import { usePartySocket } from "../../hooks/usePartySocket";
import { useGameStore } from "../../stores/gameStore";
import { usePlayerStore } from "../../stores/playerStore";
import { colors, spacing, radii } from "../../styles/theme";
import { JoinScreen } from "./JoinScreen";
import { PlayerQuestionScreen } from "./QuestionScreen";
import { ResultScreen } from "./ResultScreen";

/** sessionStorage key for player reconnection — R9.5 */
const PLAYER_ID_KEY = "janedeck_player_id";
const PLAYER_NAME_KEY = "janedeck_player_name";

/**
 * PlayerView — the main player container for mobile devices.
 * Handles join flow, game state routing, and reconnection.
 */
export function PlayerView(): React.ReactElement {
  const { gameCode } = useParams<{ gameCode: string }>();
  const prefersReducedMotion = useReducedMotion();

  // Stores
  const gameStore = useGameStore();
  const playerStore = usePlayerStore();

  // Local state
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameOverData, setGameOverData] = useState<{
    winner: { playerId: string; displayName: string; score: number } | null;
  } | null>(null);

  // Check for reconnection data
  const [storedPlayerId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PLAYER_ID_KEY);
    } catch {
      return null;
    }
  });
  const [storedName] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(PLAYER_NAME_KEY);
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
            sessionStorage.setItem(PLAYER_ID_KEY, message.payload.playerId);
            if (playerStore.displayName) {
              sessionStorage.setItem(PLAYER_NAME_KEY, playerStore.displayName);
            }
          } catch {
            // sessionStorage may be unavailable
          }
          break;

        case "JOIN_REJECTED":
          setIsJoining(false);
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
            sessionStorage.removeItem(PLAYER_ID_KEY);
            sessionStorage.removeItem(PLAYER_NAME_KEY);
          } catch {
            // sessionStorage may be unavailable
          }
          break;

        default:
          break;
      }
    },
    [gameStore, playerStore],
  );

  const { send, status } = usePartySocket({
    gameCode: gameCode || "",
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

  // Set game code in store
  useEffect(() => {
    if (gameCode) {
      gameStore.setGameCode(gameCode);
    }
  }, [gameCode, gameStore]);

  // Handle join
  const handleJoin = useCallback(
    (code: string, displayName: string) => {
      setIsJoining(true);
      setJoinError(null);
      playerStore.setDisplayName(displayName);
      send({
        type: "PLAYER_JOIN",
        payload: { displayName },
      });
    },
    [send, playerStore],
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

  // Derived state
  const {
    gameState,
    currentQuestion,
    timerSeconds,
    timerTotal,
    leaderboard,
  } = gameStore;
  const {
    playerId,
    displayName,
    score,
    rank,
    hasSubmitted,
    lastAnswerResult,
    wasKicked,
    kickReason,
  } = playerStore;

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
            />
          )}

          {/* ROUND_INTRO */}
          {gameState === "ROUND_INTRO" && (
            <RoundIntroPlayer roundIndex={gameStore.roundIndex} />
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

/** Lobby waiting screen for joined players */
function LobbyWaiting({
  displayName,
  playerCount,
  gameCode,
}: {
  displayName: string | null;
  playerCount: number;
  gameCode: string;
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

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
      <motion.div
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                scale: [1, 1.05, 1],
                opacity: 1,
              }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : {
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              }
        }
        style={{
          fontSize: "4rem",
        }}
        aria-hidden="true"
      >
        🎮
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

      <p
        style={{
          color: colors.textSecondary,
          fontSize: "var(--text-lg)",
          margin: 0,
        }}
      >
        Waiting for the host to start the game...
      </p>

      <div
        style={{
          padding: `${spacing[3]} ${spacing[6]}`,
          backgroundColor: `${colors.primary}15`,
          borderRadius: radii.lg,
          border: `1px solid ${colors.primary}30`,
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            margin: 0,
          }}
        >
          Game: <strong style={{ color: colors.accentYellow }}>{gameCode}</strong>
          {" · "}
          <span aria-live="polite">{playerCount} player{playerCount !== 1 ? "s" : ""}</span>
        </p>
      </div>
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
