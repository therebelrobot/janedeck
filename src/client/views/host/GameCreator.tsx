// src/client/views/host/GameCreator.tsx — Game setup page
// R5.3: Semantic HTML. R5.6: Proper labels, aria-describedby.
// R5.2: SC 2.5.7 — reorder has single-pointer alternative.
import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useHostStore } from "../../stores/hostStore";
import { usePartySocket } from "../../hooks/usePartySocket";
import type { ServerMessage } from "@/shared/messages";
import {
  DEFAULT_TIME_LIMIT,
  DEFAULT_POINT_VALUE,
  DEFAULT_BONUS_POINTS,
} from "@/shared/constants";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { pageTransition, staggerContainer, staggerItem } from "../../animations/presets";
import { RoundEditor, type RoundEditorData } from "./components/RoundEditor";
import type { QuestionEditorData } from "./components/QuestionEditor";

/** Quick start template with sample trivia */
function getQuickStartTemplate(): {
  title: string;
  rounds: RoundEditorData[];
  settings: { allowAudience: boolean; defaultTimeLimit: number; defaultBonus: number };
} {
  return {
    title: "Quick Start Trivia",
    rounds: [
      {
        title: "General Knowledge",
        pointValue: 100,
        questions: [
          {
            text: "What is the capital of France?",
            correctAnswer: "Paris",
            acceptableAnswers: "paris, París",
            timeLimit: 30,
          },
          {
            text: "What planet is known as the Red Planet?",
            correctAnswer: "Mars",
            acceptableAnswers: "mars",
            timeLimit: 30,
          },
          {
            text: "How many continents are there on Earth?",
            correctAnswer: "7",
            acceptableAnswers: "seven",
            timeLimit: 20,
          },
        ],
      },
      {
        title: "Pop Culture",
        pointValue: 200,
        questions: [
          {
            text: 'Who directed the movie "Jurassic Park"?',
            correctAnswer: "Steven Spielberg",
            acceptableAnswers: "Spielberg, spielberg",
            timeLimit: 30,
          },
          {
            text: "What band performed the song 'Bohemian Rhapsody'?",
            correctAnswer: "Queen",
            acceptableAnswers: "queen",
            timeLimit: 30,
          },
        ],
      },
    ],
    settings: {
      allowAudience: false,
      defaultTimeLimit: 30,
      defaultBonus: DEFAULT_BONUS_POINTS,
    },
  };
}

/**
 * Game creation page. The host sets up rounds, questions, and settings,
 * then sends HOST_CREATE_GAME to the server.
 */
export function GameCreator(): React.ReactElement {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const hostStore = useHostStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/host", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Game settings
  const [allowAudience, setAllowAudience] = useState(false);
  const [defaultTimeLimit, setDefaultTimeLimit] = useState(DEFAULT_TIME_LIMIT);
  const [defaultBonus, setDefaultBonus] = useState(DEFAULT_BONUS_POINTS);

  // Rounds data
  const [rounds, setRounds] = useState<RoundEditorData[]>([
    {
      title: "Round 1",
      pointValue: DEFAULT_POINT_VALUE,
      questions: [
        {
          text: "",
          correctAnswer: "",
          acceptableAnswers: "",
          timeLimit: DEFAULT_TIME_LIMIT,
        },
      ],
    },
  ]);

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [socketGameCode, setSocketGameCode] = useState<string | null>(null);

  // Handle server messages for game creation
  const handleMessage = useCallback(
    (message: ServerMessage) => {
      if (message.type === "GAME_CREATED") {
        hostStore.setGameCode(message.payload.gameCode);
        setSocketGameCode(message.payload.gameCode);
      }
      if (message.type === "ERROR") {
        setIsCreating(false);
        setValidationError(message.payload.message);
      }
    },
    [hostStore],
  );

  // Only connect when we're creating a game — use a placeholder code
  const { send, status } = usePartySocket({
    gameCode: socketGameCode || "create",
    role: "host",
    token: token || undefined,
    onMessage: handleMessage,
  });

  // Navigate once game is created
  useEffect(() => {
    const gameCode = hostStore.gameCode;
    if (gameCode && isCreating) {
      navigate(`/host/${gameCode}`);
    }
  }, [hostStore.gameCode, isCreating, navigate]);

  // Round manipulation handlers
  const handleRoundChange = useCallback(
    (index: number, updated: RoundEditorData) => {
      setRounds((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const handleRoundRemove = useCallback(
    (index: number) => {
      if (rounds.length <= 1) return;
      setRounds((prev) => prev.filter((_, i) => i !== index));
    },
    [rounds.length],
  );

  const handleRoundMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setRounds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleRoundMoveDown = useCallback(
    (index: number) => {
      setRounds((prev) => {
        if (index >= prev.length - 1) return prev;
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      });
    },
    [],
  );

  const handleAddRound = useCallback(() => {
    setRounds((prev) => [
      ...prev,
      {
        title: `Round ${prev.length + 1}`,
        pointValue: DEFAULT_POINT_VALUE,
        questions: [
          {
            text: "",
            correctAnswer: "",
            acceptableAnswers: "",
            timeLimit: defaultTimeLimit,
          },
        ],
      },
    ]);
  }, [defaultTimeLimit]);

  const handleQuickStart = useCallback(() => {
    const template = getQuickStartTemplate();
    setRounds(template.rounds);
    setAllowAudience(template.settings.allowAudience);
    setDefaultTimeLimit(template.settings.defaultTimeLimit);
    setDefaultBonus(template.settings.defaultBonus);
  }, []);

  // Validation
  const validate = (): boolean => {
    for (let ri = 0; ri < rounds.length; ri++) {
      const r = rounds[ri];
      if (!r.title.trim()) {
        setValidationError(`Round ${ri + 1} needs a title.`);
        return false;
      }
      if (r.questions.length === 0) {
        setValidationError(`Round ${ri + 1} needs at least one question.`);
        return false;
      }
      for (let qi = 0; qi < r.questions.length; qi++) {
        const q = r.questions[qi];
        if (!q.text.trim()) {
          setValidationError(
            `Round ${ri + 1}, Question ${qi + 1}: question text is required.`,
          );
          return false;
        }
        if (!q.correctAnswer.trim()) {
          setValidationError(
            `Round ${ri + 1}, Question ${qi + 1}: correct answer is required.`,
          );
          return false;
        }
      }
    }
    setValidationError(null);
    return true;
  };

  const handleCreateGame = useCallback(() => {
    if (!validate()) return;
    if (!token) {
      setValidationError("Authentication token missing. Please log in again.");
      return;
    }

    setIsCreating(true);

    // Build the create message
    send({
      type: "HOST_CREATE_GAME",
      payload: {
        token,
        settings: {
          maxPlayers: 16,
          allowAudience,
          audienceBonusPoints: defaultBonus,
          defaultTimeLimit,
          showAnswersToPlayers: true,
        },
        rounds: rounds.map((r) => ({
          title: r.title,
          questions: r.questions.map((q: QuestionEditorData) => ({
            text: q.text,
            correctAnswer: q.correctAnswer,
            acceptableAnswers: q.acceptableAnswers
              ? q.acceptableAnswers
                  .split(",")
                  .map((a: string) => a.trim())
                  .filter(Boolean)
              : undefined,
            pointValue: r.pointValue,
            timeLimit: q.timeLimit,
            type: "text" as const,
          })),
        })),
      },
    });
  }, [token, allowAudience, defaultBonus, defaultTimeLimit, rounds, send]);

  return (
    <motion.div
      className="view view--host"
      {...pageTransition}
      style={{
        gap: spacing[6],
        paddingBottom: spacing[16],
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          flexWrap: "wrap",
          gap: spacing[3],
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: 0,
            }}
          >
            Create Game
          </h1>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: "var(--text-sm)" }}>
            Set up your trivia rounds and questions
          </p>
        </div>

        {/* Quick Start */}
        <button
          type="button"
          onClick={handleQuickStart}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
          }}
        >
          ⚡ Quick Start
        </button>
      </div>

      {/* Settings panel */}
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[6],
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.sm,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: spacing[4],
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Game Settings
        </h2>

        <div
          style={{
            display: "flex",
            gap: spacing[6],
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {/* Audience toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
            <label
              htmlFor="allow-audience"
              style={{
                fontSize: "var(--text-sm)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: spacing[2],
              }}
            >
              <input
                id="allow-audience"
                type="checkbox"
                checked={allowAudience}
                onChange={(e) => setAllowAudience(e.target.checked)}
                style={{
                  width: 20,
                  height: 20,
                  minHeight: "auto",
                  accentColor: colors.primary,
                }}
              />
              Enable audience participation
            </label>
          </div>

          {/* Time limit */}
          <div style={{ flex: "1 1 200px", maxWidth: 250 }}>
            <label
              htmlFor="default-time"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Default time per question (seconds)
            </label>
            <input
              id="default-time"
              type="number"
              min={10}
              max={120}
              value={defaultTimeLimit}
              onChange={(e) =>
                setDefaultTimeLimit(
                  Math.max(10, Math.min(120, parseInt(e.target.value, 10) || DEFAULT_TIME_LIMIT)),
                )
              }
            />
          </div>

          {/* Bonus points */}
          <div style={{ flex: "1 1 150px", maxWidth: 200 }}>
            <label
              htmlFor="default-bonus"
              style={{ fontSize: "var(--text-sm)" }}
            >
              Default bonus points (1–5)
            </label>
            <input
              id="default-bonus"
              type="number"
              min={1}
              max={5}
              value={defaultBonus}
              onChange={(e) =>
                setDefaultBonus(
                  Math.max(1, Math.min(5, parseInt(e.target.value, 10) || DEFAULT_BONUS_POINTS)),
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Rounds section */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: spacing[4] }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Rounds & Questions
        </h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}
        >
          <AnimatePresence mode="popLayout">
            {rounds.map((round, index) => (
              <RoundEditor
                key={`round-${index}`}
                round={round}
                index={index}
                totalRounds={rounds.length}
                onChange={handleRoundChange}
                onRemove={handleRoundRemove}
                onMoveUp={handleRoundMoveUp}
                onMoveDown={handleRoundMoveDown}
                defaultTimeLimit={defaultTimeLimit}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Add round button */}
        <motion.button
          type="button"
          onClick={handleAddRound}
          className="btn-ghost"
          variants={staggerItem}
          style={{
            width: "100%",
            borderStyle: "dashed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[2],
            fontSize: "var(--text-lg)",
          }}
        >
          + Add Round
        </motion.button>
      </div>

      {/* Validation error */}
      <div
        role="alert"
        aria-live="polite"
        style={{ width: "100%", minHeight: 24 }}
      >
        {validationError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              color: colors.incorrect,
              fontSize: "var(--text-sm)",
              textAlign: "center",
              margin: 0,
              padding: spacing[3],
              backgroundColor: `${colors.incorrect}15`,
              borderRadius: radii.md,
              border: `1px solid ${colors.incorrect}40`,
            }}
          >
            {validationError}
          </motion.p>
        )}
      </div>

      {/* Create game button */}
      <button
        type="button"
        onClick={handleCreateGame}
        disabled={isCreating}
        className="btn-lg"
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: colors.correct,
          fontSize: "var(--text-xl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[3],
        }}
      >
        {isCreating ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 20,
                height: 20,
                border: "3px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
              aria-hidden="true"
            />
            Creating Game...
          </>
        ) : (
          "🚀 Start Game"
        )}
      </button>

      {/* Connection status indicator */}
      {status !== "connected" && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: colors.textSecondary,
            textAlign: "center",
            margin: 0,
          }}
        >
          Connection: {status}
        </p>
      )}

      {/* Back link */}
      <Link
        to="/host"
        style={{
          fontSize: "var(--text-sm)",
          color: colors.textSecondary,
        }}
      >
        ← Back to login
      </Link>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
