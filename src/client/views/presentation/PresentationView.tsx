// src/client/views/presentation/PresentationView.tsx — Main presentation container
// Display-only view for screen sharing — no controls, no sensitive data.
// R5.3: Semantic HTML. R5.5: AnimatePresence respects prefers-reduced-motion.
// R5.4: High contrast for screen-sharing visibility.
import React, { useCallback, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ServerMessage } from "@/shared/messages";
import type { ScoreEntry, ScoreChange, BingoWinner } from "@/shared/types";
import { usePartySocket } from "../../hooks/usePartySocket";
import { useGameStore } from "../../stores/gameStore";
import { useAuth } from "../../hooks/useAuth";
import { stateColors } from "../../animations/variants";
import { colors, spacing, radii } from "../../styles/theme";
import { Confetti } from "../../components/Confetti";
import { LobbyScreen } from "./LobbyScreen";
import { PresentationQuestionScreen } from "./QuestionScreen";
import { ScoreRevealScreen } from "./ScoreRevealScreen";
import { GameOverScreen } from "./GameOverScreen";

const WIN_PATTERN_LABELS: Record<string, string> = {
  line: "a line",
  four_corners: "four corners",
  blackout: "a blackout",
};

interface BingoActivityEntry {
  id: string;
  message: string;
}

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
  const [bingoActivity, setBingoActivity] = useState<BingoActivityEntry[]>([]);
  const [bingoCelebrate, setBingoCelebrate] = useState(false);

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
          setBingoCelebrate(true);
          break;
        }

        default:
          break;
      }
    },
    [gameStore],
  );

  // Auto-clear the celebration flag after the confetti burst finishes
  useEffect(() => {
    if (!bingoCelebrate) return;
    const timeout = setTimeout(() => setBingoCelebrate(false), 3000);
    return () => clearTimeout(timeout);
  }, [bingoCelebrate]);

  const { status } = usePartySocket({
    gameCode: gameCode || null,
    role: "presentation",
    token: token || undefined,
    onMessage: handleMessage,
    onOpen: () => gameStore.setIsConnected(true),
    onClose: () => gameStore.setIsConnected(false),
  });

  useEffect(() => {
    if (gameCode) {
      useGameStore.getState().setGameCode(gameCode);
    }
  }, [gameCode]);

  // Derived state
  const {
    gameState,
    gameType,
    currentQuestion,
    timerSeconds,
    timerTotal,
    leaderboard,
    scoreChanges,
    playerCount,
    roundIndex,
    bingoWinners,
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

          {/* BINGO_PLAYING / BINGO_ENDED — ambient only, not load-bearing */}
          {(gameState === "BINGO_PLAYING" || gameState === "BINGO_ENDED") && (
            <BingoPresentationScreen
              gameCode={gameCode || ""}
              ended={gameState === "BINGO_ENDED"}
              winners={bingoWinners}
              activity={bingoActivity}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {gameType === "bingo" && <Confetti active={bingoCelebrate} />}
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

/** Ambient bingo screen — game code + live winners + activity feed. Not load-bearing: players self-mark on their own devices regardless of whether this is being watched. */
function BingoPresentationScreen({
  gameCode,
  ended,
  winners,
  activity,
}: {
  gameCode: string;
  ended: boolean;
  winners: BingoWinner[];
  activity: BingoActivityEntry[];
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
        width: "100%",
        maxWidth: 720,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
          fontWeight: 700,
          color: colors.accentPurple,
          textShadow: "0 0 40px rgba(168, 85, 247, 0.4)",
          margin: 0,
          textAlign: "center",
        }}
      >
        {ended ? "🏁 Bingo Ended" : "🎱 Bingo"}
      </h2>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-xl)",
          color: colors.textSecondary,
          letterSpacing: "0.15em",
          margin: 0,
        }}
      >
        Game Code: <span style={{ color: colors.accentYellow }}>{gameCode}</span>
      </p>

      <div
        style={{
          width: "100%",
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          border: `1px solid ${colors.border}`,
          padding: spacing[6],
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            margin: 0,
            marginBottom: spacing[3],
          }}
        >
          Winners {winners.length > 0 && `(${winners.length})`}
        </h3>
        {winners.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: "var(--text-base)", margin: 0 }}>
            No one has won yet — keep marking!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {winners.map((winner, i) => (
              <p
                key={`${winner.playerId}-${winner.pattern}-${i}`}
                style={{
                  fontSize: "var(--text-base)",
                  color: colors.text,
                  margin: 0,
                }}
              >
                🏆 {winner.displayName} — {WIN_PATTERN_LABELS[winner.pattern] || winner.pattern}
              </p>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          width: "100%",
          maxHeight: 200,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: spacing[1],
        }}
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {activity.map((entry) => (
            <motion.p
              key={entry.id}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: "var(--text-sm)",
                color: colors.textSecondary,
                margin: 0,
                textAlign: "center",
              }}
            >
              {entry.message}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
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
