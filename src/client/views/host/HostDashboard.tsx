// src/client/views/host/HostDashboard.tsx — Main game control panel
// R5.3: Semantic HTML. R5.6: aria-live regions for dynamic content.
// R5.9: Keyboard shortcuts (Space = advance, Escape = close).
// R1.4: displayName is the chosen name. R7.4: No blame language.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ServerMessage } from "@/shared/messages";
import type { GameState, ScoreEntry } from "@/shared/types";
import { DEFAULT_BONUS_POINTS } from "@/shared/constants";
import { STATE_LABELS } from "@/shared/gameStates";
import { useAuth } from "../../hooks/useAuth";
import { usePartySocket, type ConnectionStatus } from "../../hooks/usePartySocket";
import { useGameStore } from "../../stores/gameStore";
import { useHostStore } from "../../stores/hostStore";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { pageTransition, slideFromBottom, fadeInOut } from "../../animations/presets";
import { StatusBadge } from "../../components/StatusBadge";
import { Timer } from "../../components/Timer";
import { Leaderboard } from "../../components/Leaderboard";
import { Confetti } from "../../components/Confetti";
import { PlayerList, type PlayerListEntry } from "./components/PlayerList";
import { GameControls } from "./components/GameControls";
import { AnswerReviewPanel } from "./AnswerReviewPanel";

/** Notification for answer submissions */
interface AnswerNotification {
  id: string;
  displayName: string;
  timestamp: number;
}

/**
 * HostDashboard — the host's primary control view during an active game.
 * Shows different controls based on current game state.
 * Connected to the game room via usePartySocket with host role + auth token.
 */
export function HostDashboard(): React.ReactElement {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();

  // Stores
  const gameStore = useGameStore();
  const hostStore = useHostStore();

  // Local state
  const [players, setPlayers] = useState<PlayerListEntry[]>([]);
  const [answerNotifications, setAnswerNotifications] = useState<AnswerNotification[]>([]);
  const [roundInfo, setRoundInfo] = useState<{
    title: string;
    roundNumber: number;
    totalRounds: number;
    questionCount: number;
  } | null>(null);
  const [roundMVP, setRoundMVP] = useState<{
    displayName: string;
    roundScore: number;
  } | null>(null);
  const [gameOverData, setGameOverData] = useState<{
    winner: { displayName: string; score: number } | null;
    finalLeaderboard: ScoreEntry[];
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/host", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Handle all server messages
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      // Route to both stores
      gameStore.handleServerMessage(message);
      hostStore.handleHostMessage(message);

      switch (message.type) {
        case "PLAYER_JOINED":
          setPlayers((prev) => {
            const existing = prev.find((p) => p.id === message.payload.playerId);
            if (existing) {
              return prev.map((p) =>
                p.id === message.payload.playerId
                  ? { ...p, isConnected: true }
                  : p,
              );
            }
            return [
              ...prev,
              {
                id: message.payload.playerId,
                displayName: message.payload.displayName,
                score: 0,
                isConnected: true,
              },
            ];
          });
          break;

        case "PLAYER_LEFT":
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === message.payload.playerId
                ? { ...p, isConnected: false }
                : p,
            ),
          );
          break;

        case "ANSWER_SUBMITTED_NOTIFICATION":
          setAnswerNotifications((prev) => [
            {
              id: `${message.payload.playerId}-${Date.now()}`,
              displayName: message.payload.displayName,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 9), // Keep last 10
          ]);
          break;

        case "SCORES_UPDATED":
          // Update player scores from leaderboard
          setPlayers((prev) =>
            prev.map((p) => {
              const entry = message.payload.leaderboard.find(
                (e) => e.playerId === p.id,
              );
              return entry ? { ...p, score: entry.score } : p;
            }),
          );
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
            winner: message.payload.winner
              ? {
                  displayName: message.payload.winner.displayName,
                  score: message.payload.winner.score,
                }
              : null,
            finalLeaderboard: message.payload.finalLeaderboard,
          });
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
          break;

        case "GAME_STATE_CHANGED":
          // Clear answer notifications on state change
          if (
            message.payload.state === "QUESTION_DISPLAY" ||
            message.payload.state === "ANSWERING"
          ) {
            setAnswerNotifications([]);
          }
          // Store round info when entering ROUND_INTRO
          if (message.payload.state === "ROUND_INTRO") {
            setRoundMVP(null);
          }
          break;
      }
    },
    [gameStore, hostStore],
  );

  const { send, status } = usePartySocket({
    gameCode: gameCode || "",
    role: "host",
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

  // Keyboard shortcuts — R5.9
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        // Trigger primary action button click
        const primaryBtn = document.querySelector<HTMLButtonElement>(
          ".btn-lg:not(:disabled)",
        );
        primaryBtn?.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Kick player
  const handleKickPlayer = useCallback(
    (playerId: string) => {
      send({
        type: "HOST_KICK_PLAYER",
        payload: { playerId },
      });
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    },
    [send],
  );

  // Derived state
  const { gameState, currentQuestion, timerSeconds, timerTotal, leaderboard, scoreChanges } =
    gameStore;
  const { answersForReview, answeredCount, totalPlayers, currentQuestionFull } =
    hostStore;

  const hasMoreQuestions = currentQuestion
    ? currentQuestion.questionNumber < currentQuestion.totalQuestions
    : false;

  // We can't know total rounds from gameStore directly, so assume more rounds available
  // unless we're in ROUND_RESULTS and game server says otherwise
  const hasMoreRounds = gameState !== "GAME_OVER";

  const allAnswersReviewed = answersForReview.length > 0
    ? answersForReview.every((a) => a.suggestedStatus !== "needs_review" || answeredCount === 0)
    : true;

  return (
    <motion.div
      className="view view--host"
      {...pageTransition}
      style={{ gap: spacing[4], paddingBottom: spacing[16] }}
    >
      {/* Confetti for game over */}
      <Confetti active={showConfetti} />

      {/* Status bar */}
      <StatusBar
        gameCode={gameCode || ""}
        gameState={gameState}
        playerCount={players.filter((p) => p.isConnected).length}
        connectionStatus={status}
      />

      {/* Main content area — changes based on game state */}
      <AnimatePresence mode="wait">
        <motion.div
          key={gameState}
          {...fadeInOut}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing[6],
          }}
        >
          {/* LOBBY */}
          {gameState === "LOBBY" && (
            <LobbyView
              gameCode={gameCode || ""}
              players={players}
              onKick={handleKickPlayer}
            />
          )}

          {/* ROUND_INTRO */}
          {gameState === "ROUND_INTRO" && (
            <RoundIntroView
              roundIndex={gameStore.roundIndex}
              currentQuestion={currentQuestion}
            />
          )}

          {/* QUESTION_DISPLAY / ANSWERING */}
          {(gameState === "QUESTION_DISPLAY" || gameState === "ANSWERING") && (
            <QuestionView
              currentQuestion={currentQuestion}
              correctAnswer={currentQuestionFull?.correctAnswer || ""}
              acceptableAnswers={currentQuestionFull?.acceptableAnswers || []}
              timerSeconds={timerSeconds}
              timerTotal={timerTotal}
              answeredCount={answeredCount}
              totalPlayers={totalPlayers || players.filter((p) => p.isConnected).length}
              notifications={answerNotifications}
              isAnswering={gameState === "ANSWERING"}
            />
          )}

          {/* REVIEWING */}
          {gameState === "REVIEWING" && (
            <AnswerReviewPanel
              answers={answersForReview}
              correctAnswer={currentQuestionFull?.correctAnswer || ""}
              acceptableAnswers={currentQuestionFull?.acceptableAnswers || []}
              defaultBonus={DEFAULT_BONUS_POINTS}
              send={send}
            />
          )}

          {/* SCORE_REVEAL */}
          {gameState === "SCORE_REVEAL" && (
            <ScoreRevealView
              leaderboard={leaderboard}
              scoreChanges={scoreChanges}
            />
          )}

          {/* ROUND_RESULTS */}
          {gameState === "ROUND_RESULTS" && (
            <RoundResultsView
              leaderboard={leaderboard}
              roundMVP={roundMVP}
              roundIndex={gameStore.roundIndex}
            />
          )}

          {/* GAME_OVER */}
          {gameState === "GAME_OVER" && (
            <GameOverView
              gameOverData={gameOverData}
              leaderboard={leaderboard}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Game controls — always visible at bottom */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          backgroundColor: colors.bg,
          padding: `${spacing[4]} 0`,
          borderTop: `1px solid ${colors.border}`,
          width: "100%",
          zIndex: 20,
        }}
      >
        <GameControls
          gameState={gameState}
          playerCount={players.filter((p) => p.isConnected).length}
          allAnswersReviewed={allAnswersReviewed}
          hasMoreQuestions={hasMoreQuestions}
          hasMoreRounds={hasMoreRounds}
          send={send}
        />
      </div>
    </motion.div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

/** Status bar at the top showing game code, state, player count, connection */
function StatusBar({
  gameCode,
  gameState,
  playerCount,
  connectionStatus,
}: {
  gameCode: string;
  gameState: GameState;
  playerCount: number;
  connectionStatus: ConnectionStatus;
}): React.ReactElement {
  const connectionColor: Record<ConnectionStatus, string> = {
    connected: colors.correct,
    connecting: colors.accentYellow,
    disconnected: colors.textSecondary,
    error: colors.incorrect,
  };

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[4],
        padding: spacing[3],
        backgroundColor: colors.bgCard,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        width: "100%",
        flexWrap: "wrap",
      }}
    >
      {/* Game code */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
          Game:
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--text-xl)",
            color: colors.accentYellow,
            letterSpacing: "0.1em",
          }}
        >
          {gameCode}
        </span>
      </div>

      {/* State badge */}
      <StatusBadge state={gameState} />

      {/* Player count */}
      <span
        style={{
          fontSize: "var(--text-sm)",
          color: colors.textSecondary,
          display: "flex",
          alignItems: "center",
          gap: spacing[1],
        }}
        aria-live="polite"
      >
        👥 {playerCount} player{playerCount !== 1 ? "s" : ""}
      </span>

      {/* Connection status */}
      <div
        className="connection-status"
        style={{ marginInlineStart: "auto" }}
        aria-live="polite"
      >
        <span
          className={`connection-dot connection-dot--${connectionStatus}`}
          style={{ backgroundColor: connectionColor[connectionStatus] }}
          aria-hidden="true"
        />
        <span>{connectionStatus}</span>
      </div>
    </header>
  );
}

/** Lobby view — game code, player list, presentation link */
function LobbyView({
  gameCode,
  players,
  onKick,
}: {
  gameCode: string;
  players: PlayerListEntry[];
  onKick: (id: string) => void;
}): React.ReactElement {
  return (
    <>
      {/* Large game code display */}
      <motion.div
        {...slideFromBottom}
        className="game-code-display"
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[8],
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.glow,
          textAlign: "center",
        }}
      >
        <p className="game-code-label">Share this code with players:</p>
        <p className="game-code-value">{gameCode}</p>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            marginTop: spacing[4],
            marginBottom: 0,
          }}
        >
          Presentation view:{" "}
          <a
            href={`/present/${gameCode}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: colors.primaryLight }}
          >
            /present/{gameCode}
          </a>
        </p>
      </motion.div>

      {/* Player list */}
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[6],
          border: `1px solid ${colors.border}`,
        }}
      >
        <PlayerList
          players={players}
          onKick={onKick}
          kickEnabled
        />
      </div>
    </>
  );
}

/** Round intro view */
function RoundIntroView({
  roundIndex,
  currentQuestion,
}: {
  roundIndex: number;
  currentQuestion: ReturnType<typeof useGameStore.getState>["currentQuestion"];
}): React.ReactElement {
  return (
    <motion.div
      {...slideFromBottom}
      style={{
        textAlign: "center",
        padding: spacing[8],
        backgroundColor: colors.bgCard,
        borderRadius: radii.xl,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.lg,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-4xl)",
          fontWeight: 700,
          color: colors.accentPurple,
          marginBottom: spacing[4],
        }}
      >
        Round {roundIndex + 1}
      </h2>
      {currentQuestion && (
        <p style={{ color: colors.textSecondary, fontSize: "var(--text-lg)", margin: 0 }}>
          {currentQuestion.totalQuestions} question{currentQuestion.totalQuestions !== 1 ? "s" : ""}
          {" "}· {currentQuestion.pointValue} points each
        </p>
      )}
    </motion.div>
  );
}

/** Question display / answering view */
function QuestionView({
  currentQuestion,
  correctAnswer,
  acceptableAnswers,
  timerSeconds,
  timerTotal,
  answeredCount,
  totalPlayers,
  notifications,
  isAnswering,
}: {
  currentQuestion: ReturnType<typeof useGameStore.getState>["currentQuestion"];
  correctAnswer: string;
  acceptableAnswers: string[];
  timerSeconds: number | null;
  timerTotal: number | null;
  answeredCount: number;
  totalPlayers: number;
  notifications: AnswerNotification[];
  isAnswering: boolean;
}): React.ReactElement {
  if (!currentQuestion) {
    return (
      <p style={{ textAlign: "center", color: colors.textSecondary }}>
        Waiting for question data...
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[4],
        width: "100%",
      }}
    >
      {/* Question info card */}
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[6],
          border: `2px solid ${colors.primary}`,
          boxShadow: shadows.glow,
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: spacing[2],
          }}
        >
          Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
          {" "}· {currentQuestion.pointValue} points
        </p>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            marginBottom: spacing[4],
          }}
        >
          {currentQuestion.text}
        </h2>

        {/* Host sees the correct answer */}
        <div
          style={{
            padding: spacing[3],
            backgroundColor: `${colors.correct}15`,
            borderRadius: radii.md,
            border: `1px solid ${colors.correct}40`,
          }}
        >
          <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
            Answer:{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: colors.correct,
            }}
          >
            {correctAnswer}
          </span>
          {acceptableAnswers.length > 0 && (
            <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
              {" "}(also: {acceptableAnswers.join(", ")})
            </span>
          )}
        </div>
      </div>

      {/* Timer and progress row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          gap: spacing[6],
          flexWrap: "wrap",
        }}
      >
        {/* Timer */}
        {isAnswering && timerSeconds !== null && timerTotal !== null && (
          <Timer
            secondsRemaining={timerSeconds}
            totalSeconds={timerTotal}
            size="lg"
          />
        )}

        {/* Answer progress */}
        <div
          style={{
            textAlign: "center",
          }}
          aria-live="polite"
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-4xl)",
              fontWeight: 700,
              color: colors.primary,
              margin: 0,
            }}
          >
            {answeredCount}
            <span style={{ color: colors.textSecondary, fontSize: "var(--text-xl)" }}>
              /{totalPlayers}
            </span>
          </p>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              margin: 0,
            }}
          >
            players answered
          </p>
        </div>
      </div>

      {/* Answer submission notifications */}
      {isAnswering && notifications.length > 0 && (
        <div
          style={{
            maxHeight: 200,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: spacing[1],
          }}
          aria-live="polite"
          aria-label="Answer submissions"
        >
          <AnimatePresence mode="popLayout">
            {notifications.slice(0, 6).map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{
                  fontSize: "var(--text-sm)",
                  color: colors.textSecondary,
                  padding: `${spacing[1]} ${spacing[3]}`,
                  backgroundColor: `${colors.correct}10`,
                  borderRadius: radii.sm,
                }}
              >
                ✎ {n.displayName} answered
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/** Score reveal view */
function ScoreRevealView({
  leaderboard,
  scoreChanges,
}: {
  leaderboard: ScoreEntry[];
  scoreChanges: ReturnType<typeof useGameStore.getState>["scoreChanges"];
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-3xl)",
          fontWeight: 700,
          textAlign: "center",
          color: colors.accentPurple,
        }}
      >
        📊 Score Update
      </h2>
      <Leaderboard
        entries={leaderboard}
        showChanges
        scoreChanges={scoreChanges}
      />
    </div>
  );
}

/** Round results view */
function RoundResultsView({
  leaderboard,
  roundMVP,
  roundIndex,
}: {
  leaderboard: ScoreEntry[];
  roundMVP: { displayName: string; roundScore: number } | null;
  roundIndex: number;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-3xl)",
          fontWeight: 700,
          textAlign: "center",
          color: colors.accentOrange,
        }}
      >
        🏁 Round {roundIndex + 1} Complete
      </h2>

      {roundMVP && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          style={{
            textAlign: "center",
            padding: spacing[4],
            backgroundColor: `${colors.accentYellow}15`,
            borderRadius: radii.xl,
            border: `1px solid ${colors.accentYellow}40`,
          }}
        >
          <p style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, margin: 0 }}>
            Round MVP
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: colors.accentYellow,
              margin: 0,
            }}
          >
            ⭐ {roundMVP.displayName}
          </p>
          <p style={{ fontSize: "var(--text-base)", color: colors.textSecondary, margin: 0 }}>
            {roundMVP.roundScore} points this round
          </p>
        </motion.div>
      )}

      <Leaderboard entries={leaderboard} />
    </div>
  );
}

/** Game over view */
function GameOverView({
  gameOverData,
  leaderboard,
}: {
  gameOverData: {
    winner: { displayName: string; score: number } | null;
    finalLeaderboard: ScoreEntry[];
  } | null;
  leaderboard: ScoreEntry[];
}): React.ReactElement {
  const displayLeaderboard = gameOverData?.finalLeaderboard || leaderboard;
  const winner = gameOverData?.winner;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-4xl)",
          fontWeight: 700,
          textAlign: "center",
          color: colors.secondary,
        }}
      >
        🏆 Game Over!
      </h2>

      {winner && (
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
          style={{
            textAlign: "center",
            padding: spacing[6],
            backgroundColor: `${colors.accentYellow}15`,
            borderRadius: radii.xl,
            border: `2px solid ${colors.accentYellow}`,
            boxShadow: `0 0 30px ${colors.accentYellow}30`,
          }}
        >
          <p style={{ fontSize: "var(--text-lg)", color: colors.textSecondary, margin: 0 }}>
            Winner
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-4xl)",
              fontWeight: 700,
              color: colors.accentYellow,
              margin: `${spacing[2]} 0`,
            }}
          >
            🎉 {winner.displayName}
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-2xl)",
              fontWeight: 700,
              color: colors.primaryLight,
              margin: 0,
            }}
          >
            {winner.score.toLocaleString()} points
          </p>
        </motion.div>
      )}

      <Leaderboard entries={displayLeaderboard} maxDisplay={20} />
    </div>
  );
}
