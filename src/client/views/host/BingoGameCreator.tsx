// src/client/views/host/BingoGameCreator.tsx — Bingo game setup page
// R5.3: Semantic HTML. R5.6: Proper labels, aria-describedby.
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { customAlphabet } from "nanoid";
import { useAuth } from "../../hooks/useAuth";
import { useHostStore } from "../../stores/hostStore";
import { LogoutButton } from "../../components/LogoutButton";
import { usePartySocket } from "../../hooks/usePartySocket";
import type { ClientMessage, ServerMessage } from "@/shared/messages";
import type { BingoCardMode, BingoWinPattern, BingoPhraseEntry, BingoSettings } from "@/shared/types";
import {
  DEFAULT_BINGO_SETTINGS,
  GAME_CODE_CHARS,
  GAME_CODE_LENGTH,
} from "@/shared/constants";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { pageTransition } from "../../animations/presets";
import {
  bingoSettingsAndPhrasesToCSV,
  csvToBingoSettingsAndPhrases,
  bingoTemplateCSV,
  downloadCSV,
} from "../../utils/csv";

/** Generate a game code client-side using the same alphabet as the server */
const generateGameCode = customAlphabet(GAME_CODE_CHARS, GAME_CODE_LENGTH);

const WIN_PATTERN_OPTIONS: Array<{ value: BingoWinPattern; label: string }> = [
  { value: "line", label: "Line (row, column, or diagonal)" },
  { value: "four_corners", label: "Four Corners" },
  { value: "blackout", label: "Blackout (full card)" },
];

/** Each textarea line is "Phrase" or "Phrase | optional clarification". */
function parsePhraseLine(line: string): BingoPhraseEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf("|");
  if (idx === -1) return { text: trimmed };
  const text = trimmed.slice(0, idx).trim();
  const definition = trimmed.slice(idx + 1).trim();
  if (!text) return null;
  return definition ? { text, definition } : { text };
}

function formatPhraseLine(entry: BingoPhraseEntry): string {
  return entry.definition ? `${entry.text} | ${entry.definition}` : entry.text;
}

function parsePhrasePoolText(text: string): BingoPhraseEntry[] {
  return text
    .split("\n")
    .map(parsePhraseLine)
    .filter((e): e is BingoPhraseEntry => e !== null);
}

/**
 * Bingo game creation page. The host picks card content (numbered or
 * phrase pool), win patterns, and other settings, then sends
 * HOST_CREATE_BINGO_GAME to the server.
 */
export function BingoGameCreator(): React.ReactElement {
  const navigate = useNavigate();
  const { isAuthenticated, token, logout } = useAuth();
  const hostStore = useHostStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/host", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Bingo settings
  const [maxPlayers, setMaxPlayers] = useState<number>(DEFAULT_BINGO_SETTINGS.maxPlayers);
  const [cardMode, setCardMode] = useState<BingoCardMode>(DEFAULT_BINGO_SETTINGS.cardMode as BingoCardMode);
  const [numberRange, setNumberRange] = useState<number>(DEFAULT_BINGO_SETTINGS.numberRange);
  const [phrasePoolText, setPhrasePoolText] = useState("");
  const [freeSpace, setFreeSpace] = useState<boolean>(DEFAULT_BINGO_SETTINGS.freeSpace);
  const [freeSpaceLine, setFreeSpaceLine] = useState("");
  const [winPatterns, setWinPatterns] = useState<BingoWinPattern[]>([
    ...DEFAULT_BINGO_SETTINGS.winPatterns,
  ]);

  const gridSize = DEFAULT_BINGO_SETTINGS.gridSize;
  const requiredPhrases = gridSize * gridSize - (freeSpace ? 1 : 0);

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [socketGameCode, setSocketGameCode] = useState<string | null>(null);

  const pendingCreateRef = useRef<ClientMessage | null>(null);

  // CSV import state
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [csvFeedback, setCsvFeedback] = useState<{
    type: "success" | "warning" | "error";
    messages: string[];
  } | null>(null);

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

  const { send, status } = usePartySocket({
    gameCode: socketGameCode,
    role: "host",
    token: token || undefined,
    onMessage: handleMessage,
  });

  useEffect(() => {
    if (status === "connected" && socketGameCode && pendingCreateRef.current) {
      send(pendingCreateRef.current);
      pendingCreateRef.current = null;
    }
  }, [status, socketGameCode, send]);

  useEffect(() => {
    const gameCode = hostStore.gameCode;
    if (gameCode && isCreating && gameCode === socketGameCode) {
      navigate(`/host/${gameCode}`);
    }
  }, [hostStore.gameCode, isCreating, navigate, socketGameCode]);

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

  const toggleWinPattern = useCallback((pattern: BingoWinPattern) => {
    setWinPatterns((prev) =>
      prev.includes(pattern) ? prev.filter((p) => p !== pattern) : [...prev, pattern],
    );
  }, []);

  // ── CSV Handlers ──────────────────────────────────────────────────────
  // Export/import round-trips the FULL game configuration (all settings plus
  // the phrase pool with optional per-phrase definitions), not just phrases.

  const handleExportCSV = useCallback(() => {
    const freeSpacePhrase = freeSpace ? parsePhraseLine(freeSpaceLine) ?? undefined : undefined;
    const settings: BingoSettings = {
      maxPlayers,
      cardMode,
      numberRange,
      phrasePool: parsePhrasePoolText(phrasePoolText),
      gridSize,
      freeSpace,
      ...(freeSpacePhrase && { freeSpacePhrase }),
      winPatterns,
    };
    const csv = bingoSettingsAndPhrasesToCSV(settings);
    downloadCSV(csv, "janedeck-bingo-config.csv");
  }, [maxPlayers, cardMode, numberRange, phrasePoolText, freeSpace, freeSpaceLine, winPatterns]);

  const handleDownloadTemplate = useCallback(() => {
    downloadCSV(bingoTemplateCSV(), "janedeck-bingo-template.csv");
  }, []);

  const handleImportClick = useCallback(() => {
    csvFileInputRef.current?.click();
  }, []);

  const handleCSVFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (phrasePoolText.trim()) {
        const confirmed = window.confirm(
          "This will replace your current settings and phrase pool. Continue?",
        );
        if (!confirmed) {
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

        const result = csvToBingoSettingsAndPhrases(csvContent);

        if (result.errors.length > 0) {
          setCsvFeedback({ type: "error", messages: [...result.errors, ...result.warnings] });
          if (csvFileInputRef.current) csvFileInputRef.current.value = "";
          return;
        }

        const { settings } = result;
        if (settings.maxPlayers !== undefined) setMaxPlayers(settings.maxPlayers);
        if (settings.cardMode !== undefined) setCardMode(settings.cardMode);
        if (settings.numberRange !== undefined) setNumberRange(settings.numberRange);
        if (settings.freeSpace !== undefined) setFreeSpace(settings.freeSpace);
        if (settings.freeSpacePhrase !== undefined) setFreeSpaceLine(formatPhraseLine(settings.freeSpacePhrase));
        if (settings.winPatterns !== undefined) setWinPatterns(settings.winPatterns);
        if (result.phrases.length > 0) {
          setPhrasePoolText(result.phrases.map(formatPhraseLine).join("\n"));
        }

        setValidationError(null);
        const messages: string[] = [];
        const importedSettingsCount = Object.keys(settings).length;
        if (importedSettingsCount > 0) {
          messages.push(`Imported ${importedSettingsCount} setting${importedSettingsCount !== 1 ? "s" : ""}.`);
        }
        if (result.phrases.length > 0) {
          messages.push(`Imported ${result.phrases.length} phrase${result.phrases.length !== 1 ? "s" : ""}.`);
        }
        if (messages.length === 0) {
          messages.push("Nothing was imported from this file.");
        }
        messages.push(...result.warnings);
        setCsvFeedback({
          type: result.warnings.length > 0 ? "warning" : "success",
          messages,
        });

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
    [phrasePoolText],
  );

  // Validation
  const validate = (): boolean => {
    if (winPatterns.length === 0) {
      setValidationError("Select at least one win pattern.");
      return false;
    }
    if (cardMode === "numbered") {
      if (!numberRange || numberRange < requiredPhrases) {
        setValidationError(`Number range must be at least ${requiredPhrases} to fill a ${gridSize}×${gridSize} card.`);
        return false;
      }
    } else {
      const phrases = parsePhrasePoolText(phrasePoolText);
      if (phrases.length < requiredPhrases) {
        setValidationError(
          `The phrase pool needs at least ${requiredPhrases} phrases to fill a ${gridSize}×${gridSize} card (currently ${phrases.length}).`,
        );
        return false;
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

    const code = generateGameCode();
    const phrasePool = parsePhrasePoolText(phrasePoolText);
    const freeSpacePhrase = freeSpace ? parsePhraseLine(freeSpaceLine) ?? undefined : undefined;

    pendingCreateRef.current = {
      type: "HOST_CREATE_BINGO_GAME",
      payload: {
        token,
        settings: {
          maxPlayers,
          cardMode,
          numberRange,
          phrasePool,
          gridSize,
          freeSpace,
          ...(freeSpacePhrase && { freeSpacePhrase }),
          winPatterns,
        },
      },
    };

    setSocketGameCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, maxPlayers, cardMode, numberRange, phrasePoolText, freeSpace, freeSpaceLine, winPatterns]);

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
            Create Bingo Game
          </h1>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: "var(--text-sm)" }}>
            Players self-mark their own cards — no host calling required
          </p>
        </div>

        <LogoutButton />
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
          Card Content
        </h2>

        {/* Card mode toggle */}
        <div style={{ display: "flex", gap: spacing[4] }} role="radiogroup" aria-label="Card mode">
          <label style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input
              type="radio"
              name="card-mode"
              checked={cardMode === "numbered"}
              onChange={() => setCardMode("numbered")}
              style={{ width: 20, height: 20, minHeight: "auto", accentColor: colors.primary }}
            />
            Classic numbered (1–N, B-I-N-G-O columns)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input
              type="radio"
              name="card-mode"
              checked={cardMode === "phrasePool"}
              onChange={() => setCardMode("phrasePool")}
              style={{ width: 20, height: 20, minHeight: "auto", accentColor: colors.primary }}
            />
            Custom phrase pool
          </label>
        </div>

        {cardMode === "numbered" ? (
          <div style={{ maxWidth: 250 }}>
            <label htmlFor="number-range" style={{ fontSize: "var(--text-sm)" }}>
              Number range (1 to N)
            </label>
            <input
              id="number-range"
              type="number"
              min={requiredPhrases}
              max={500}
              value={numberRange}
              onChange={(e) =>
                setNumberRange(Math.max(requiredPhrases, parseInt(e.target.value, 10) || requiredPhrases))
              }
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: spacing[2], flexWrap: "wrap" }}
              role="toolbar"
              aria-label="Phrase pool CSV import and export"
            >
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCSVFileChange}
                aria-label="Import phrase pool CSV file"
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
                style={{ minHeight: 44, minWidth: 44, fontSize: "var(--text-sm)" }}
              >
                📥 Import CSV
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="btn-ghost"
                style={{ minHeight: 44, minWidth: 44, fontSize: "var(--text-sm)" }}
              >
                📤 Export CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn-ghost"
                style={{ minHeight: 44, minWidth: 44, fontSize: "var(--text-sm)" }}
              >
                📋 Download Template
              </button>
            </div>

            {csvFeedback && (
              <div
                role="status"
                aria-live="polite"
                style={{
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
              </div>
            )}

            <label htmlFor="phrase-pool" style={{ fontSize: "var(--text-sm)" }}>
              Phrases (one per line — need at least {requiredPhrases}). Add{" "}
              <code>{" | clarification"}</code> after a phrase for an optional definition players
              can expand on their card.
            </label>
            <textarea
              id="phrase-pool"
              value={phrasePoolText}
              onChange={(e) => setPhrasePoolText(e.target.value)}
              rows={8}
              placeholder={
                "They fast-forward the trailers\nSomeone quotes the movie before it happens | Recited along with the dialogue counts too\n..."
              }
              style={{
                width: "100%",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                resize: "vertical",
              }}
            />
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: colors.textSecondary }}>
              {parsePhrasePoolText(phrasePoolText).length} / {requiredPhrases} phrases
            </p>
          </div>
        )}

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Win Conditions
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
          {WIN_PATTERN_OPTIONS.map((option) => (
            <label
              key={option.value}
              style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "var(--text-sm)", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={winPatterns.includes(option.value)}
                onChange={() => toggleWinPattern(option.value)}
                style={{ width: 20, height: 20, minHeight: "auto", accentColor: colors.primary }}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-xs)", color: colors.textSecondary }}>
          The game keeps running after the first winner — players can keep marking until you end it.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Other Settings
        </h2>

        <div style={{ display: "flex", gap: spacing[6], flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: spacing[2], fontSize: "var(--text-sm)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={freeSpace}
              onChange={(e) => setFreeSpace(e.target.checked)}
              style={{ width: 20, height: 20, minHeight: "auto", accentColor: colors.primary }}
            />
            Free center space
          </label>

          <div style={{ flex: "1 1 150px", maxWidth: 200 }}>
            <label htmlFor="max-players" style={{ fontSize: "var(--text-sm)" }}>
              Max players
            </label>
            <input
              id="max-players"
              type="number"
              min={1}
              max={100}
              value={maxPlayers}
              onChange={(e) =>
                setMaxPlayers(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || DEFAULT_BINGO_SETTINGS.maxPlayers)))
              }
            />
          </div>
        </div>

        {freeSpace && (
          <div>
            <label htmlFor="free-space-phrase" style={{ fontSize: "var(--text-sm)" }}>
              Custom free space phrase (optional — leave blank for the default "FREE" space)
            </label>
            <input
              id="free-space-phrase"
              type="text"
              value={freeSpaceLine}
              onChange={(e) => setFreeSpaceLine(e.target.value)}
              placeholder="e.g. Someone proposes a toast | Optional clarification"
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Validation error */}
      <div role="alert" aria-live="polite" style={{ width: "100%", minHeight: 24 }}>
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
          "🎱 Start Game"
        )}
      </button>

      {status !== "connected" && (
        <p style={{ fontSize: "var(--text-xs)", color: colors.textSecondary, textAlign: "center", margin: 0 }}>
          Connection: {status}
        </p>
      )}

      <Link to="/host/create" style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
        ← Back to game type
      </Link>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
