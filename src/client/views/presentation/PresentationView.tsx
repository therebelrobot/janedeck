// src/client/views/presentation/PresentationView.tsx — Main presentation container
// Display-only view for screen sharing — no controls, no sensitive data.
// R5.3: Semantic HTML. R5.5: AnimatePresence respects prefers-reduced-motion.
// R5.4: High contrast for screen-sharing visibility.
import React, { useCallback, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ServerMessage } from "@/shared/messages";
import type { ScoreEntry, ScoreChange } from "@/shared/types";
import { usePartySocket } from "../../hooks/usePartySocket";
import { useGameStore } from "../../stores/gameStore";
import { useAuth } from "../../hooks/useAuth";
import { stateColors } from "../../animations/variants";
import { colors, spacing } from "../../styles/theme";
import { LobbyScreen } from "./LobbyScreen";
import { PresentationQuestionScreen } from "./QuestionScreen";
import { ScoreRevealScreen } from "./ScoreRevealScreen";
import { GameOverScreen } from "./GameOverScreen";

interface PlayerEntry {
  playerId: string;
  displayName: string;
}

/**
 * PresentationView — the screen-share display for the game.
 * Connects to the game room with role=presentation.
 * Purely display-only — no interactive controls.
 * Renders different screens based on game state.
 */
export function PresentationView(): React.ReactElement {
  const { gameCode } = useParams<{ gameCode: string }>();
  const prefersReducedMotion = useReducedMotion();
  const { token } = useAuth();
  const gameStore = useGameStore();

  // Local state for presentation-specific data
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [roundMVP, setRoundMVP] = useState<{
    displayName: string;
    roundScore: number;
  } | null>(null);
  const [gameOverData, setGameOverData] = useState<{
    winner: { playerId: string; displayName: string; score: number } | null;
    finalLeaderboard: ScoreEntry[];
  } | null>(null);
  const [roundTitle, setRoundTitle] = useState("Round 1");

  // Handle all server messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      // Route to game store for shared state
      gameStore.handleServerMessage(message);

      switch (message.type) {
        case "PLAYER_JOINED":
          setPlayers((prev) => {
            const existing = prev.find((p) => p.playerId === message.payload.playerId);
            if (existing) return prev;
            return [
              {
                playerId: message.payload.playerId,
                displayName: message.payload.displayName,
              },
              ...prev,
            ];
          });
          setTotalPlayers(message.payload.playerCount);
          break;

        case "PLAYER_LEFT":
          setTotalPlayers(message.payload.playerCount);
          break;

        case "ANSWER_SUBMITTED_NOTIFICATION":
          setAnsweredCount(message.payload.answeredCount);
          setTotalPlayers(message.payload.totalPlayers);
          break;

        case "GAME_STATE_CHANGED":
          // Reset answer count on new question
          if (
            message.payload.state === "QUESTION_DISPLAY" ||
            message.payload.state === "ANSWERING"
          ) {
            setAnsweredCount(0);
          }
          if (message.payload.state === "ROUND_INTRO") {
            setRoundMVP(null);
            // Update round title
            const roundIdx = message.payload.roundIndex ?? gameStore.roundIndex;
            setRoundTitle(`Round ${roundIdx + 1}`);
          }
          break;

        case "ROUND_RESULTS":
          if (message.payload.roundMVP) {
            setRoundMVP({
              displayName: message.payload.roundMVP.displayName,
              roundScore: message.payload.roundMVP.roundScore,
            });
          }
          break;

        case "GAME_OVER":
          setGameOverData({
            winner: message.payload.winner,
            finalLeaderboard: message.payload.finalLeaderboard,
          });
          break;

        default:
          break;
      }
    },
    [gameStore],
  );

  const { status } = usePartySocket({
    gameCode: gameCode || "",
    role: "presentation",
    token: token || undefined,
    onMessage: handleMessage,
    onOpen: () => gameStore.setIsConnected(true),
    onClose: () => gameStore.setIsConnected(false),
  });

  // Set the game code in the store
  useEffect(() => {
    if (gameCode) {
      gameStore.setGameCode(gameCode);
    }
  }, [gameCode, gameStore]);

  // Derived state
  const {
    gameState,
    currentQuestion,
    timerSeconds,
    timerTotal,
    leaderboard,
    scoreChanges,
    playerCount,
    roundIndex,
  } = gameStore;

  // Background color based on game state
  const currentStateColors = stateColors[gameState] || stateColors.LOBBY;

  return (
    <motion.div
      className="view view--presentation"
      animate={{
        backgroundColor: currentStateColors.bg,
      }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
      style={{
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Connection indicator — subtle, top-right */}
      {status !== "connected" && (
        <div
          style={{
            position: "fixed",
            top: spacing[4],
            insetInlineEnd: spacing[4],
            padding: `${spacing[2]} ${spacing[4]}`,
            backgroundColor: status === "connecting" ? `${colors.accentYellow}20` : `${colors.incorrect}20`,
            borderRadius: "var(--radius-full)",
            border: `1px solid ${status === "connecting" ? colors.accentYellow : colors.incorrect}40`,
            fontSize: "var(--text-sm)",
            color: status === "connecting" ? colors.accentYellow : colors.incorrect,
            zIndex: 50,
          }}
          role="status"
          aria-live="polite"
        >
          {status === "connecting" ? "Connecting..." : "Reconnecting..."}
        </div>
      )}

      {/* State-specific accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: currentStateColors.accent,
          transition: prefersReducedMotion ? "none" : "background-color 0.5s ease",
        }}
        aria-hidden="true"
      />

      {/* Main content — animated transitions between states */}
      <AnimatePresence mode="wait">
        <motion.div
          key={gameState}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 50 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -50 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: "tween", ease: "anticipate", duration: 0.3 }
          }
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "90vh",
          }}
        >
          {/* LOBBY */}
          {gameState === "LOBBY" && (
            <LobbyScreen
              gameCode={gameCode || ""}
              players={players}
              playerCount={playerCount}
            />
          )}

          {/* ROUND_INTRO */}
          {gameState === "ROUND_INTRO" && (
            <RoundIntroScreen
              roundIndex={roundIndex}
              currentQuestion={currentQuestion}
            />
          )}

          {/* QUESTION_DISPLAY / ANSWERING */}
          {(gameState === "QUESTION_DISPLAY" || gameState === "ANSWERING") &&
            currentQuestion && (
              <PresentationQuestionScreen
                questionText={currentQuestion.text}
                questionNumber={currentQuestion.questionNumber}
                totalQuestions={currentQuestion.totalQuestions}
                pointValue={currentQuestion.pointValue}
                roundName={roundTitle}
                timerSeconds={timerSeconds}
                timerTotal={timerTotal}
                answeredCount={answeredCount}
                totalPlayers={totalPlayers || playerCount}
                isAnswering={gameState === "ANSWERING"}
              />
            )}

          {/* REVIEWING */}
          {gameState === "REVIEWING" && (
            <ReviewingScreen />
          )}

          {/* SCORE_REVEAL */}
          {gameState === "SCORE_REVEAL" && (
            <ScoreRevealScreen
              leaderboard={leaderboard}
              scoreChanges={scoreChanges}
            />
          )}

          {/* ROUND_RESULTS */}
          {gameState === "ROUND_RESULTS" && (
            <ScoreRevealScreen
              leaderboard={leaderboard}
              scoreChanges={scoreChanges}
              roundIndex={roundIndex}
              isRoundResults
              roundMVP={roundMVP}
            />
          )}

          {/* GAME_OVER */}
          {gameState === "GAME_OVER" && (
            <GameOverScreen
              leaderboard={gameOverData?.finalLeaderboard || leaderboard}
              winner={gameOverData?.winner || null}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

/** Round intro screen */
function RoundIntroScreen({
  roundIndex,
  currentQuestion,
}: {
  roundIndex: number;
  currentQuestion: ReturnType<typeof useGameStore.getState>["currentQuestion"];
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[6],
        minHeight: "60vh",
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
          fontSize: "clamp(3rem, 8vw, 6rem)",
          fontWeight: 700,
          color: colors.accentPurple,
          textShadow: "0 0 40px rgba(168, 85, 247, 0.4)",
          margin: 0,
        }}
      >
        Round {roundIndex + 1}
      </motion.h2>
      {currentQuestion && (
        <motion.p
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { delay: 0.3, type: "spring", stiffness: 200, damping: 20 }
          }
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.25rem, 3vw, 2rem)",
            color: colors.textSecondary,
            margin: 0,
          }}
        >
          {currentQuestion.totalQuestions}{" "}
          {currentQuestion.totalQuestions === 1 ? "question" : "questions"}
          {" · "}
          {currentQuestion.pointValue} points each
        </motion.p>
      )}
    </div>
  );
}

/** Reviewing state screen — waiting for host */
function ReviewingScreen(): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[6],
        minHeight: "60vh",
      }}
    >
      <motion.p
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
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: 700,
          color: colors.accentYellow,
          textAlign: "center",
          margin: 0,
        }}
      >
        ✏️ Reviewing Answers...
      </motion.p>
      <p
        style={{
          fontSize: "clamp(1rem, 2vw, 1.5rem)",
          color: colors.textSecondary,
          margin: 0,
        }}
      >
        The host is checking your answers
      </p>
    </div>
  );
}
