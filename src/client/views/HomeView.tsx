// src/client/views/HomeView.tsx — Landing page for JaneDeck
// R5.3: Semantic HTML. R5.6: labels, autocomplete, aria attributes.
// R5.2: Touch targets ≥ 44px. R5.5: Animations respect prefers-reduced-motion.
// R1.2: Unicode-safe name input. R1.6: No regex validation.
// R7.4: Non-blame language in errors.
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { GAME_CODE_LENGTH, MAX_DISPLAY_NAME_BYTES } from "@/shared/constants";
import { colors, spacing, radii, shadows } from "../styles/theme";
import { pageTransition, slideFromBottom } from "../animations/presets";

/**
 * Get byte length of a string (UTF-8).
 * R1.2: Field length ≥ 256 bytes.
 */
function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/**
 * HomeView — the main landing page at "/".
 * Provides entry points for all user roles:
 * - Join a game (player)
 * - Host a game
 * - Watch as audience
 */
export function HomeView(): React.ReactElement {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  // Join game state
  const [gameCode, setGameCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus code input on mount
  useEffect(() => {
    // Delay slightly to avoid conflict with page transition
    const timeout = setTimeout(() => codeInputRef.current?.focus(), 300);
    return () => clearTimeout(timeout);
  }, []);

  const handleGameCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length <= GAME_CODE_LENGTH) {
      setGameCode(value);
      setJoinError(null);
    }
    if (value.length === GAME_CODE_LENGTH) {
      nameInputRef.current?.focus();
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // R1.2: Enforce max 256 bytes, not characters
    if (getByteLength(value) <= MAX_DISPLAY_NAME_BYTES) {
      setDisplayName(value);
      setJoinError(null);
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();

    if (gameCode.length !== GAME_CODE_LENGTH) {
      setJoinError(`Please enter a ${GAME_CODE_LENGTH}-character game code.`);
      codeInputRef.current?.focus();
      return;
    }

    const trimmedName = displayName.trim();
    if (trimmedName.length === 0) {
      setJoinError("Please enter a display name.");
      nameInputRef.current?.focus();
      return;
    }

    // Navigate to the player view with the game code
    navigate(`/play/${gameCode}`);
  };

  const handleWatchGame = () => {
    if (gameCode.length !== GAME_CODE_LENGTH) {
      setJoinError(`Please enter a ${GAME_CODE_LENGTH}-character game code to watch.`);
      codeInputRef.current?.focus();
      return;
    }
    navigate(`/audience/${gameCode}`);
  };

  return (
    <motion.div
      className="view"
      {...pageTransition}
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: spacing[8],
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background gradients */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 30%, ${colors.primary}18 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, ${colors.secondary}15 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, ${colors.accentPurple}10 0%, transparent 60%)
          `,
          zIndex: -1,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />

      {/* Branding */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { y: -30, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 200, damping: 20 }
        }
        style={{ textAlign: "center" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 8vw, 5rem)",
            fontWeight: 700,
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}, ${colors.accentPurple})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: spacing[2],
            lineHeight: 1.1,
          }}
        >
          JaneDeck
        </h1>
        <p
          style={{
            fontSize: "var(--text-xl)",
            color: colors.textSecondary,
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          A live trivia game show for everyone
        </p>
      </motion.div>

      {/* Join Game Card */}
      <motion.div
        {...slideFromBottom}
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[6],
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.lg,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: spacing[4],
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            textAlign: "center",
            margin: 0,
            color: colors.text,
          }}
        >
          🎮 Join a Game
        </h2>

        <form
          onSubmit={handleJoinGame}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing[4],
          }}
          noValidate
        >
          {/* Game code input */}
          <div>
            <label
              htmlFor="home-game-code"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: colors.textSecondary,
              }}
            >
              Game Code
            </label>
            <input
              ref={codeInputRef}
              id="home-game-code"
              type="text"
              value={gameCode}
              onChange={handleGameCodeChange}
              placeholder="ABCDEF"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={GAME_CODE_LENGTH}
              aria-describedby="home-code-hint"
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
              id="home-code-hint"
              style={{
                fontSize: "var(--text-xs)",
                color: colors.textSecondary,
                margin: `${spacing[1]} 0 0`,
              }}
            >
              {GAME_CODE_LENGTH}-character code from the host
            </p>
          </div>

          {/* Display name input — R1.4 */}
          <div>
            <label
              htmlFor="home-display-name"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: colors.textSecondary,
              }}
            >
              Display Name
            </label>
            <input
              ref={nameInputRef}
              id="home-display-name"
              type="text"
              value={displayName}
              onChange={handleNameChange}
              placeholder="Your name"
              autoComplete="nickname"
              aria-describedby="home-name-hint"
              style={{
                fontSize: "var(--text-xl)",
                minHeight: 52,
              }}
            />
            <p
              id="home-name-hint"
              style={{
                fontSize: "var(--text-xs)",
                color: colors.textSecondary,
                margin: `${spacing[1]} 0 0`,
              }}
            >
              This is how other players will see you
            </p>
          </div>

          {/* Error display — R7.4 */}
          {joinError && (
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
              {joinError}
            </motion.p>
          )}

          {/* Join button — R5.2 */}
          <button
            type="submit"
            className="btn-lg"
            style={{
              width: "100%",
              minHeight: 56,
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              backgroundColor: colors.secondary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[2],
            }}
          >
            🚀 Join Game
          </button>
        </form>

        {/* Watch as audience link */}
        <button
          type="button"
          onClick={handleWatchGame}
          className="btn-ghost"
          style={{
            width: "100%",
            fontSize: "var(--text-base)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[2],
          }}
        >
          👁️ Watch as Audience
        </button>
      </motion.div>

      {/* Host a Game Card */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 200, damping: 20, delay: 0.2 }
        }
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[4],
          border: `1px solid ${colors.border}`,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          alignItems: "center",
          gap: spacing[4],
        }}
      >
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: colors.text,
              margin: 0,
              marginBottom: spacing[1],
            }}
          >
            🎤 Want to host?
          </p>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              margin: 0,
            }}
          >
            Create and run your own trivia game
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/host")}
          style={{
            backgroundColor: colors.accentPurple,
            fontSize: "var(--text-base)",
            fontWeight: 700,
            padding: `${spacing[3]} ${spacing[6]}`,
            whiteSpace: "nowrap",
          }}
        >
          Host Game →
        </button>
      </motion.div>

      {/* Footer */}
      <p
        style={{
          fontSize: "var(--text-xs)",
          color: colors.textSecondary,
          textAlign: "center",
          margin: 0,
          opacity: 0.6,
        }}
      >
        Built with PartyKit + React
      </p>
    </motion.div>
  );
}
