// src/client/views/host/GameCreator.tsx — Game setup page
// R5.3: Semantic HTML. R5.6: Proper labels, aria-describedby.
// R5.2: SC 2.5.7 — reorder has single-pointer alternative.
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { customAlphabet } from "nanoid";
import { useAuth } from "../../hooks/useAuth";
import { useHostStore } from "../../stores/hostStore";
import { usePartySocket } from "../../hooks/usePartySocket";
import type { ClientMessage, ServerMessage } from "@/shared/messages";
import {
  DEFAULT_TIME_LIMIT,
  DEFAULT_POINT_VALUE,
  DEFAULT_BONUS_POINTS,
  GAME_CODE_CHARS,
  GAME_CODE_LENGTH,
} from "@/shared/constants";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { pageTransition, staggerContainer, staggerItem } from "../../animations/presets";
import { LogoutButton } from "../../components/LogoutButton";
import { RoundEditor, type RoundEditorData } from "./components/RoundEditor";
import type { QuestionEditorData } from "./components/QuestionEditor";
import {
  gameToCSV,
  templateCSV,
  downloadCSV,
  csvToGame,
} from "../../utils/csv";

/** Generate a game code client-side using the same alphabet as the server */
const generateGameCode = customAlphabet(GAME_CODE_CHARS, GAME_CODE_LENGTH);

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
  const { isAuthenticated, token, logout } = useAuth();
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

  // Pending create message — sent once the socket to the new room opens
  const pendingCreateRef = useRef<ClientMessage | null>(null);

  // CSV import state
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvFeedback, setCsvFeedback] = useState<{
    type: "success" | "warning" | "error";
    messages: string[];
  } | null>(null);

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
        if (message.payload.code === "AUTH_FAILED") {
          // Stale/invalid token — clear it automatically instead of leaving
          // the host stuck reconnecting with a token the server keeps rejecting.
          logout();
          navigate("/host", { replace: true });
        }
      }
    },
    [hostStore, logout, navigate],
  );

  // Only connect once the host clicks Start Game and socketGameCode is set.
  // Passing null keeps the hook dormant and avoids a premature connection to a
  // placeholder room (which would trigger unnecessary auth validation on the server).
  const { send, status } = usePartySocket({
    gameCode: socketGameCode,
    role: "host",
    token: token || undefined,
    onMessage: handleMessage,
  });

  // Once the socket to the new game-code room opens, send the pending
  // HOST_CREATE_GAME message that was queued by handleCreateGame.
  useEffect(() => {
    if (status === "connected" && socketGameCode && pendingCreateRef.current) {
      send(pendingCreateRef.current);
      pendingCreateRef.current = null;
    }
  }, [status, socketGameCode, send]);

  // Navigate once game is created — guard with socketGameCode so a stale
  // hostStore.gameCode from a previous session can't trigger early navigation.
  useEffect(() => {
    const gameCode = hostStore.gameCode;
    if (gameCode && isCreating && gameCode === socketGameCode) {
      navigate(`/host/${gameCode}`);
    }
  }, [hostStore.gameCode, isCreating, navigate, socketGameCode]);

  // Safety timeout: if GAME_CREATED hasn't arrived within 15 s, reset the
  // spinner so the host can try again instead of waiting forever.
  useEffect(() => {
    if (!isCreating) return;
    const timer = setTimeout(() => {
      setIsCreating(false);
      setSocketGameCode(null);
      pendingCreateRef.current = null;
      setValidationError("Game creation timed out. Please check your connection and try again.");
    }, 15000);
    return () => clearTimeout(timer);
  }, [isCreating]);

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

  // ── CSV Handlers ──────────────────────────────────────────────────────

  /** Check whether the form has meaningful data (non-empty questions). */
  const hasExistingData = rounds.some((r) =>
    r.questions.some((q) => q.text.trim() || q.correctAnswer.trim()),
  );

  /** Export current game as CSV download */
  const handleExportCSV = useCallback(() => {
    const csv = gameToCSV(rounds);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `janedeck-game-${date}.csv`);
  }, [rounds]);

  /** Download empty template CSV */
  const handleDownloadTemplate = useCallback(() => {
    const csv = templateCSV();
    downloadCSV(csv, "janedeck-template.csv");
  }, []);

  /** Trigger file picker for CSV import */
  const handleImportClick = useCallback(() => {
    csvFileInputRef.current?.click();
  }, []);

  /** Process imported CSV file */
  const handleCSVFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Confirm replacement if form has existing data
      if (hasExistingData) {
        const confirmed = window.confirm(
          "This will replace your current game data. Continue?",
        );
        if (!confirmed) {
          // Reset file input so the same file can be re-selected
          if (csvFileInputRef.current) csvFileInputRef.current.value = "";
          return;
        }
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const csvContent = event.target?.result;
        if (typeof csvContent !== "string") {
          setCsvFeedback({
            type: "error",
            messages: ["Unable to read the file. Please try again with a .csv file."],
          });
          return;
        }

        const result = csvToGame(csvContent);

        if (result.errors.length > 0 && result.rounds.length === 0) {
          // Only errors, no usable data
          setCsvFeedback({ type: "error", messages: result.errors });
        } else if (result.rounds.length > 0) {
          // Successfully imported — apply to form
          setRounds(result.rounds);
          setValidationError(null);

          const allMessages: string[] = [];
          const totalQuestions = result.rounds.reduce(
            (sum, r) => sum + r.questions.length,
            0,
          );
          allMessages.push(
            `Imported ${result.rounds.length} round${result.rounds.length !== 1 ? "s" : ""} with ${totalQuestions} question${totalQuestions !== 1 ? "s" : ""}.`,
          );

          if (result.warnings.length > 0) {
            allMessages.push(...result.warnings);
          }
          if (result.errors.length > 0) {
            allMessages.push(...result.errors);
          }

          setCsvFeedback({
            type:
              result.errors.length > 0 || result.warnings.length > 0
                ? "warning"
                : "success",
            messages: allMessages,
          });
        }

        // Reset file input for re-import
        if (csvFileInputRef.current) csvFileInputRef.current.value = "";
      };

      reader.onerror = () => {
        setCsvFeedback({
          type: "error",
          messages: ["Unable to read the file. Please check the file and try again."],
        });
        if (csvFileInputRef.current) csvFileInputRef.current.value = "";
      };

      reader.readAsText(file, "UTF-8");
    },
    [hasExistingData],
  );

  /** Whether export button should be enabled (at least 1 round with 1 filled question) */
  const canExport = rounds.some((r) =>
    r.questions.some((q) => q.text.trim() && q.correctAnswer.trim()),
  );

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

    // Generate a game code client-side so the PartySocket connects to the
    // correct Durable Object room. The server uses `this.name` (the room
    // name) as the game ID — connecting to "create" would make the game
    // code literally "create" and navigation would loop back here.
    const code = generateGameCode();

    // Build the create message and store it — it will be sent once the
    // socket to the new room opens (via handleOpen / onOpen callback).
    pendingCreateRef.current = {
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
    };

    // Trigger reconnect to the real game-code room
    setSocketGameCode(code);
  }, [token, allowAudience, defaultBonus, defaultTimeLimit, rounds]);

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

        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
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

          <LogoutButton />
        </div>
      </div>

      {/* CSV Import/Export toolbar — R5.3: semantic <button> elements */}
      {/* R5.2: SC 2.5.8 — buttons ≥ 44px touch targets */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          flexWrap: "wrap",
          width: "100%",
        }}
        role="toolbar"
        aria-label="CSV import and export"
      >
        {/* Hidden file input for CSV import — R5.6: accessible label */}
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCSVFileChange}
          aria-label="Import CSV file"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
          tabIndex={-1}
        />

        <button
          type="button"
          onClick={handleImportClick}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            minHeight: 44,
            minWidth: 44,
            fontSize: "var(--text-sm)",
          }}
        >
          📥 Import CSV
        </button>

        <button
          type="button"
          onClick={handleExportCSV}
          disabled={!canExport}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            minHeight: 44,
            minWidth: 44,
            fontSize: "var(--text-sm)",
            opacity: canExport ? 1 : 0.5,
          }}
          title={
            canExport
              ? "Export current game as CSV"
              : "Add at least one question with text and an answer to export"
          }
        >
          📤 Export CSV
        </button>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[2],
            minHeight: 44,
            minWidth: 44,
            fontSize: "var(--text-sm)",
          }}
        >
          📋 Download Template
        </button>
      </div>

      {/* CSV feedback messages — R7.4: non-blame language */}
      {csvFeedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            width: "100%",
            padding: spacing[3],
            borderRadius: radii.md,
            fontSize: "var(--text-sm)",
            backgroundColor:
              csvFeedback.type === "success"
                ? `${colors.correct}15`
                : csvFeedback.type === "warning"
                  ? `${colors.needsReview}15`
                  : `${colors.incorrect}15`,
            border: `1px solid ${
              csvFeedback.type === "success"
                ? `${colors.correct}40`
                : csvFeedback.type === "warning"
                  ? `${colors.needsReview}40`
                  : `${colors.incorrect}40`
            }`,
            color:
              csvFeedback.type === "success"
                ? colors.correct
                : csvFeedback.type === "warning"
                  ? colors.needsReview
                  : colors.incorrect,
          }}
        >
          {csvFeedback.messages.map((msg, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : `${spacing[1]} 0 0` }}>
              {msg}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setCsvFeedback(null)}
            className="btn-ghost"
            style={{
              marginTop: spacing[2],
              fontSize: "var(--text-xs)",
              minHeight: 44,
              minWidth: 44,
              color: "inherit",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

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
