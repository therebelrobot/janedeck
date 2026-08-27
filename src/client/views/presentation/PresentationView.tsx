// src/client/views/presentation/PresentationView.tsx — Main presentation container
// Display-only view for screen sharing — no controls, no sensitive data.
// R5.3: Semantic HTML. R5.5: AnimatePresence respects prefers-reduced-motion.
// R5.4: High contrast for screen-sharing visibility.
import React, { useCallback, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import QRCode from "react-qr-code";
import type { ServerMessage } from "@/shared/messages";
import type { ScoreEntry, ScoreChange, BingoWinner, TeamScoreEntry, PublicTeam } from "@/shared/types";
import { usePartySocket } from "../../hooks/usePartySocket";
import { useGameStore, type RoundQuestion } from "../../stores/gameStore";
import { useAuth } from "../../hooks/useAuth";
import { stateColors } from "../../animations/variants";
import { colors, spacing, radii } from "../../styles/theme";
import { Confetti } from "../../components/Confetti";
import { Timer } from "../../components/Timer";
import { TeamMemberAvatars } from "../../components/TeamMemberAvatars";
import { TEAM_PROGRESS_LADDER } from "../../utils/rosterLayouts";
import { useFitToBox } from "../../hooks/useFitToBox";
import { QuestionMedia } from "../../components/QuestionMedia";
import { LobbyScreen } from "./LobbyScreen";
import { PresentationQuestionScreen } from "./QuestionScreen";
import { ScoreRevealScreen } from "./ScoreRevealScreen";
import { GameOverScreen } from "./GameOverScreen";

/** How many bingo winners the shared screen names before it starts counting */
const BINGO_WINNERS_SHOWN = 8;

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
  avatarSeed: string;
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
    teamLeaderboard?: TeamScoreEntry[];
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
                avatarSeed: message.payload.avatarSeed ?? "",
              },
              ...prev,
            ];
          });
          setTotalPlayers(message.payload.playerCount);
          break;

        case "PLAYER_LEFT":
          setTotalPlayers(message.payload.playerCount);
          break;

        case "PLAYER_AVATAR_UPDATED":
          setPlayers((prev) =>
            prev.map((p) =>
              p.playerId === message.payload.playerId
                ? { ...p, avatarSeed: message.payload.avatarSeed }
                : p,
            ),
          );
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
          } else if (message.payload.roundMVPTeam) {
            setRoundMVP({
              displayName: message.payload.roundMVPTeam.teamName,
              roundScore: message.payload.roundMVPTeam.roundScore,
            });
          }
          break;

        case "GAME_OVER":
          setGameOverData({
            winner: message.payload.winner,
            finalLeaderboard: message.payload.finalLeaderboard,
            teamLeaderboard: message.payload.teamLeaderboard,
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
    teamPlayEnabled,
    teams,
    teamLeaderboard,
    teamScoreChanges,
    teamAnswerProgress,
    roundTitle: teamRoundTitle,
    roundQuestions,
    roundTotalQuestions,
    answerReveal,
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
        minHeight: "100vh",
      }}
    >
      {/* Dynamic animated orb background */}
      <DynamicBackground
        orbColors={currentStateColors.orbColors}
        prefersReducedMotion={!!prefersReducedMotion}
      />

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
            // Fill the view rather than demanding a full viewport of its own —
            // .view is already exactly one screen tall, so a 100vh child plus
            // .view's padding put every presentation screen off the bottom.
            flex: 1,
            minHeight: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* LOBBY */}
          {gameState === "LOBBY" && (
            <LobbyScreen
              gameCode={gameCode || ""}
              players={players}
              playerCount={playerCount}
              teamPlayEnabled={teamPlayEnabled}
              teams={teams}
            />
          )}

          {/* ROUND_INTRO */}
          {gameState === "ROUND_INTRO" && (
            <RoundIntroScreen
              roundIndex={roundIndex}
              currentQuestion={currentQuestion}
              teamPlayEnabled={teamPlayEnabled}
              teamCount={teams.length}
            />
          )}

          {/* ANSWERING — Team Play: the question the host just revealed */}
          {teamPlayEnabled && gameState === "ANSWERING" && (
            <TeamAnsweringScreen
              roundTitle={teamRoundTitle ?? `Round ${roundIndex + 1}`}
              questions={roundQuestions ?? []}
              totalQuestions={roundTotalQuestions || (roundQuestions?.length ?? 0)}
              timerSeconds={timerSeconds}
              timerTotal={timerTotal}
              teams={teams}
              teamProgress={teamAnswerProgress}
            />
          )}

          {/* QUESTION_DISPLAY / ANSWERING — individual play */}
          {!teamPlayEnabled &&
            (gameState === "QUESTION_DISPLAY" || gameState === "ANSWERING") &&
            currentQuestion && (
              <PresentationQuestionScreen
                questionText={currentQuestion.text}
                questionNumber={currentQuestion.questionNumber}
                totalQuestions={currentQuestion.totalQuestions}
                pointValue={currentQuestion.pointValue}
                media={currentQuestion.media}
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
              teamLeaderboard={teamPlayEnabled ? teamLeaderboard : undefined}
              teamScoreChanges={teamPlayEnabled ? teamScoreChanges : undefined}
              answerReveal={answerReveal}
            />
          )}

          {/* ROUND_RESULTS */}
          {gameState === "ROUND_RESULTS" && (
            <ScoreRevealScreen
              leaderboard={leaderboard}
              scoreChanges={scoreChanges}
              teamLeaderboard={teamPlayEnabled ? teamLeaderboard : undefined}
              teamScoreChanges={teamPlayEnabled ? teamScoreChanges : undefined}
              roundIndex={roundIndex}
              isRoundResults
              roundMVP={roundMVP}
              // Team Play judges the round as a whole, so its answers belong to
              // this screen too. Individual play already showed each answer at
              // its own SCORE_REVEAL — repeating the last one here would read
              // as if it were the round's only question.
              answerReveal={teamPlayEnabled ? answerReveal : null}
            />
          )}

          {/* GAME_OVER */}
          {gameState === "GAME_OVER" && (
            <GameOverScreen
              leaderboard={gameOverData?.finalLeaderboard || leaderboard}
              winner={gameOverData?.winner || null}
              teamLeaderboard={
                teamPlayEnabled ? (gameOverData?.teamLeaderboard ?? teamLeaderboard) : undefined
              }
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
      <FullscreenButton />
    </motion.div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

/** Round intro screen */
function RoundIntroScreen({
  roundIndex,
  currentQuestion,
  teamPlayEnabled,
  teamCount,
}: {
  roundIndex: number;
  currentQuestion: ReturnType<typeof useGameStore.getState>["currentQuestion"];
  teamPlayEnabled: boolean;
  teamCount: number;
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
      {currentQuestion && !teamPlayEnabled && (
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
      {teamPlayEnabled && (
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
          {teamCount} {teamCount === 1 ? "team" : "teams"} competing
        </motion.p>
      )}
    </div>
  );
}

/**
 * Team Play screen during ANSWERING. The host reveals the round's questions
 * one at a time, so the newest one gets the big treatment the individual-play
 * question screen gives its question; earlier ones stay listed underneath,
 * since teams can still be working on them.
 */
function TeamAnsweringScreen({
  roundTitle,
  questions,
  totalQuestions,
  timerSeconds,
  timerTotal,
  teams,
  teamProgress,
}: {
  roundTitle: string;
  questions: RoundQuestion[];
  totalQuestions: number;
  timerSeconds: number | null;
  timerTotal: number | null;
  teams: PublicTeam[];
  teamProgress: Record<string, { teamName: string; answeredCount: number; totalQuestions: number }>;
}): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  // The progress grid takes whatever the question and timer leave it and
  // tightens until every team fits — see useFitToBox.
  const fit = useFitToBox(sortedTeams.length, TEAM_PROGRESS_LADDER.length);
  const progressLayout = TEAM_PROGRESS_LADDER[Math.min(fit.step, TEAM_PROGRESS_LADDER.length - 1)];
  const currentIndex = questions.length - 1;
  const current = questions[currentIndex];
  const earlier = questions.slice(0, currentIndex);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[3],
        width: "100%",
        maxWidth: "min(1400px, 92vw)",
        padding: `${spacing[4]} 0`,
        // Fill the view so the progress grid below can measure what's left.
        flex: 1,
        minHeight: 0,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1rem, 2vw, 1.5rem)",
          color: colors.textSecondary,
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          textAlign: "center",
        }}
      >
        <span style={{ color: colors.accentPurple }}>{roundTitle}</span>
        {current && (
          <>
            {" · "}
            Question {currentIndex + 1} of {totalQuestions}
            {" · "}
            <span style={{ color: colors.accentYellow }}>{current.pointValue} points</span>
          </>
        )}
      </p>

      {/* The question just revealed — the whole room is looking at this */}
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.questionId}
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.7, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 250, damping: 18 }
            }
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[6],
              width: "100%",
              margin: 0,
              padding: `clamp(1.5rem, 3vw, 3rem) clamp(2rem, 5vw, 5rem)`,
              backgroundColor: `${colors.bgCard}cc`,
              borderRadius: radii.xl,
              border: `2px solid ${colors.primary}`,
              boxShadow: `0 0 40px rgba(59, 130, 246, 0.4), 0 0 80px rgba(59, 130, 246, 0.15)`,
              backdropFilter: "blur(12px)",
              // The question itself never gives up space — it's what the room
              // is reading.
              flexShrink: 0,
            }}
          >
            {current.media && (
              <QuestionMedia media={current.media} size="lg" />
            )}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: current.media
                  ? "clamp(1.4rem, 3vw, 3rem)"
                  : "clamp(1.75rem, 5vw, 4.5rem)",
                fontWeight: 700,
                color: colors.text,
                textAlign: "center",
                lineHeight: 1.25,
                flex: current.media ? "1 1 340px" : "1 1 100%",
                maxWidth: current.media ? "min(620px, 90vw)" : "100%",
                margin: 0,
              }}
            >
              {current.text}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      {timerSeconds !== null && timerTotal !== null && (
        <Timer secondsRemaining={timerSeconds} totalSeconds={timerTotal} size="lg" />
      )}

      {/* Questions still on the table from earlier in the round */}
      {earlier.length > 0 && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing[2],
            padding: spacing[4],
            // On a short screen something has to give, and this recap is the
            // least of it — every player has these questions on their own
            // phone. It shrinks so the live roster below never disappears.
            flexShrink: 1,
            minHeight: 0,
            overflow: "hidden",
            backgroundColor: `${colors.bgCard}99`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.border}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.75rem, 1.2vw, 1rem)",
              color: colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Still open
          </p>
          {earlier.map((q, i) => (
            <p
              key={q.questionId}
              style={{
                margin: 0,
                fontSize: "clamp(0.9rem, 1.6vw, 1.4rem)",
                color: colors.textSecondary,
              }}
            >
              <span style={{ color: colors.primaryLight, fontWeight: 700 }}>{i + 1}.</span> {q.text}
            </p>
          ))}
        </div>
      )}

      {/* Live per-team progress */}
      {sortedTeams.length > 0 && (
        <div
          ref={fit.ref}
          style={{
            // Wider than the question above it: the question wants a readable
            // measure, the roster wants every column it can get. Centred by the
            // parent's align-items, capped so it never scrolls sideways.
            width: "min(1800px, 96vw)",
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(calc(${progressLayout.cardPx}px * var(--avatar-scale, 1)), 1fr))`,
            gap: spacing[2],
            alignContent: "center",
            // The box useFitToBox measures: whatever the question above leaves,
            // but never nothing — a roster squeezed to zero height is a screen
            // that silently stops showing who's answering.
            flex: 1,
            minHeight: "min(32%, 260px)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {sortedTeams.slice(0, fit.visibleCount).map((team) => {
            const progress = teamProgress[team.id];
            const answered = progress?.answeredCount ?? 0;
            const total = progress?.totalQuestions ?? questions.length;
            const done = total > 0 && answered >= total;

            return (
              <div
                key={team.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: progressLayout.gapPx,
                  padding: progressLayout.padPx,
                  minWidth: 0,
                  backgroundColor: done ? `${colors.correct}15` : colors.bgCard,
                  borderRadius: radii.lg,
                  border: `1px solid ${done ? colors.correct : colors.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing[2] }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: progressLayout.namePx,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {team.name}
                  </span>
                  {/* The answered count is the point of this screen — it
                      survives every rung, including the one with no faces. */}
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: done ? colors.correct : colors.primaryLight,
                      fontSize: "var(--text-sm)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {answered}/{total}
                  </span>
                </div>
                {progressLayout.size && (
                  <TeamMemberAvatars members={team.members} size={progressLayout.size} maxDisplay={5} />
                )}
              </div>
            );
          })}

          {fit.hiddenCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: progressLayout.padPx,
                borderRadius: radii.lg,
                border: `1px dashed ${colors.border}`,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: progressLayout.namePx,
                color: colors.textSecondary,
              }}
            >
              +{fit.hiddenCount} more
            </div>
          )}
        </div>
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
  const joinUrl = `${window.location.origin}/play/${gameCode}`;

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

      {/* Join QR + code — latecomers can still scan in during an active game */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[4],
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div
          style={{ padding: spacing[2], backgroundColor: "#ffffff", borderRadius: radii.lg, lineHeight: 0 }}
          aria-hidden="true"
        >
          <QRCode value={joinUrl} size={100} fgColor="#000000" bgColor="#ffffff" />
        </div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            color: colors.textSecondary,
            letterSpacing: "0.15em",
            margin: 0,
          }}
        >
          Game Code:{" "}
          <span style={{ color: colors.accentYellow }}>{gameCode}</span>
          <br />
          <span style={{ fontSize: "var(--text-sm)", letterSpacing: "normal", color: colors.primaryLight }}>
            {window.location.origin}/play/{gameCode}
          </span>
        </p>
      </div>

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
            {/* A blackout round can produce a lot of winners at once, and the
                shared screen can't scroll — so the newest few show by name and
                the rest are counted. The header already carries the total. */}
            {winners.slice(-BINGO_WINNERS_SHOWN).map((winner, i) => (
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
            {winners.length > BINGO_WINNERS_SHOWN && (
              <p style={{ fontSize: "var(--text-sm)", color: colors.textSecondary, margin: 0 }}>
                + {winners.length - BINGO_WINNERS_SHOWN} more winner
                {winners.length - BINGO_WINNERS_SHOWN === 1 ? "" : "s"}
              </p>
            )}
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

/** Animated orb background that shifts colors based on game state */
function DynamicBackground({
  orbColors,
  prefersReducedMotion,
}: {
  orbColors: [string, string, string];
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const [c1, c2, c3] = orbColors;
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 1.8, ease: "easeInOut" as const };

  return (
    <div className="presentation-bg" aria-hidden="true">
      <div className="presentation-bg__grid" />
      <motion.div
        className="presentation-bg__orb presentation-bg__orb--1"
        animate={{ backgroundColor: c1 }}
        transition={transition}
      />
      <motion.div
        className="presentation-bg__orb presentation-bg__orb--2"
        animate={{ backgroundColor: c2 }}
        transition={transition}
      />
      <motion.div
        className="presentation-bg__orb presentation-bg__orb--3"
        animate={{ backgroundColor: c3 }}
        transition={transition}
      />
    </div>
  );
}

/** Fullscreen toggle button — fixed bottom-right, fades in on hover */
function FullscreenButton(): React.ReactElement {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const update = () =>
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      const el = document.documentElement;
      (el.requestFullscreen ?? (el as any).webkitRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen ?? (document as any).webkitExitFullscreen)?.call(document);
    }
  };

  return (
    <button
      onClick={toggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      style={{
        position: "fixed",
        bottom: spacing[4],
        right: spacing[4],
        zIndex: 50,
        width: 40,
        height: 40,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        backgroundColor: `${colors.bgCard}${isHovered ? "cc" : "55"}`,
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.35,
        transition: "opacity 0.2s ease, background-color 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        color: colors.textSecondary,
      }}
    >
      {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
    </button>
  );
}

function ExpandIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function CompressIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
  );
}
