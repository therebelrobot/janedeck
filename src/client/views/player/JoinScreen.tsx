// src/client/views/player/JoinScreen.tsx — Join game screen
// R1.2: Unicode-safe name input, max 256 bytes. R1.4: "Display Name" label.
// R1.6: No regex validation beyond empty check. R2.1: No gender/demographic data.
// R5.2: Touch targets ≥ 44px. R5.3: Semantic HTML. R5.6: labels, autocomplete, aria.
// R7.4: Non-blame error messages.
import React, { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GAME_CODE_LENGTH, MAX_DISPLAY_NAME_BYTES } from "@/shared/constants";
import { colors, spacing, radii, shadows } from "../../styles/theme";

interface JoinScreenProps {
  /** Pre-filled game code (from URL params) */
  initialGameCode?: string;
  /** Called when the player submits join info */
  onJoin: (gameCode: string, displayName: string) => void;
  /** Whether join is in progress */
  isJoining?: boolean;
  /** Error message from server */
  error?: string | null;
}

/**
 * Get byte length of a string (UTF-8).
 * R1.2: Field length must be ≥ 256 bytes.
 */
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * Join game screen for players.
 * Game code input (6 chars, auto-uppercase) and display name input.
 */
export function JoinScreen({
  initialGameCode = "",
  onJoin,
  isJoining = false,
  error = null,
}: JoinScreenProps): React.ReactElement {
  const [gameCode, setGameCode] = useState(initialGameCode);
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Auto-focus: code input if no initial code, otherwise name input
  useEffect(() => {
    if (initialGameCode) {
      nameInputRef.current?.focus();
    } else {
      codeInputRef.current?.focus();
    }
  }, [initialGameCode]);

  const handleGameCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase, strip non-alphanumeric
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length <= GAME_CODE_LENGTH) {
      setGameCode(value);
      setLocalError(null);
    }
    // Auto-advance to name field when code is complete
    if (value.length === GAME_CODE_LENGTH) {
      nameInputRef.current?.focus();
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // R1.2: Enforce max 256 bytes, not characters
    if (getByteLength(value) <= MAX_DISPLAY_NAME_BYTES) {
      setDisplayName(value);
      setLocalError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // R1.6: Only validate non-empty — no regex validation
    if (gameCode.length !== GAME_CODE_LENGTH) {
      setLocalError(`Please enter a ${GAME_CODE_LENGTH}-character game code.`);
      codeInputRef.current?.focus();
      return;
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length === 0) {
      setLocalError("Please enter a display name.");
      nameInputRef.current?.focus();
      return;
    }

    onJoin(gameCode, trimmedName);
  };

  const displayError = error || localError;

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
      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-4xl)",
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
          fontSize: "var(--text-lg)",
        }}
      >
        Join the game!
      </p>

      {/* Join form */}
      <form
        onSubmit={handleSubmit}
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
        {/* Game code input */}
        <div>
          <label
            htmlFor="game-code"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: colors.text,
              display: "block",
              marginBottom: spacing[2],
            }}
          >
            Game Code
          </label>
          <input
            ref={codeInputRef}
            id="game-code"
            type="text"
            value={gameCode}
            onChange={handleGameCodeChange}
            disabled={isJoining || !!initialGameCode}
            placeholder="ABCDEF"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={GAME_CODE_LENGTH}
            aria-describedby="code-hint"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-3xl)",
              fontWeight: 700,
              textAlign: "center",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              minHeight: 56,
              color: colors.accentYellow,
            }}
          />
          <p
            id="code-hint"
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              margin: `${spacing[1]} 0 0`,
            }}
          >
            {GAME_CODE_LENGTH}-character code from the host
          </p>
        </div>

        {/* Display name input — R1.4: label as "Display Name" */}
        <div>
          <label
            htmlFor="display-name"
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
            ref={nameInputRef}
            id="display-name"
            type="text"
            value={displayName}
            onChange={handleNameChange}
            disabled={isJoining}
            placeholder="Your name"
            autoComplete="nickname"
            aria-describedby="name-hint"
            style={{
              fontSize: "var(--text-xl)",
              minHeight: 56,
            }}
          />
          <p
            id="name-hint"
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              margin: `${spacing[1]} 0 0`,
            }}
          >
            This is how other players will see you
          </p>
        </div>

        {/* Error display — R7.4: non-blame language */}
        {displayError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
            {displayError}
          </motion.p>
        )}

        {/* Join button — R5.2: ≥ 44px touch target */}
        <button
          type="submit"
          disabled={isJoining}
          className="btn-lg"
          style={{
            width: "100%",
            minHeight: 56,
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            backgroundColor: colors.secondary,
            marginTop: spacing[2],
          }}
        >
          {isJoining ? "Joining..." : "Join Game"}
        </button>
      </form>
    </motion.div>
  );
}
