// src/client/views/presentation/LobbyScreen.tsx — Waiting room display
// R5.3: Semantic HTML. R5.5: Animations via ReducedMotionProvider.
// R5.4: High contrast for screen-sharing.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GameCodeDisplay } from "./components/GameCodeDisplay";
import { PlayerJoinFeed } from "./components/PlayerJoinFeed";
import { colors, spacing } from "../../styles/theme";
import { pulse } from "../../animations/presets";

interface LobbyScreenProps {
  /** The game code */
  gameCode: string;
  /** List of joined players */
  players: Array<{ playerId: string; displayName: string }>;
  /** Total player count */
  playerCount: number;
}

/**
 * Presentation lobby screen shown while waiting for players to join.
 * Features large game code, player join feed, and idle animations.
 */
export function LobbyScreen({
  gameCode,
  players,
  playerCount,
}: LobbyScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[8],
        width: "100%",
        minHeight: "80vh",
      }}
    >
      {/* Title */}
      <motion.h1
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -30 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 200, damping: 20 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(3rem, 8vw, 8rem)",
          fontWeight: 700,
          color: colors.secondary,
          textShadow: "0 0 60px rgba(236, 72, 153, 0.6), 0 0 120px rgba(236, 72, 153, 0.2)",
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        JaneDeck
      </motion.h1>

      {/* Game code display */}
      <GameCodeDisplay gameCode={gameCode} />

      {/* Player count */}
      <motion.div
        {...(prefersReducedMotion ? {} : pulse)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          padding: `${spacing[3]} ${spacing[6]}`,
          backgroundColor: `${colors.primary}15`,
          borderRadius: "var(--radius-full)",
          border: `1px solid ${colors.primary}40`,
        }}
        aria-live="polite"
      >
        <span style={{ fontSize: "var(--text-2xl)" }} aria-hidden="true">👥</span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.5rem, 3vw, 3rem)",
            fontWeight: 700,
            color: colors.primaryLight,
          }}
        >
          {playerCount} {playerCount === 1 ? "player" : "players"} joined
        </span>
      </motion.div>

      {/* Player join feed */}
      {players.length > 0 && (
        <div style={{ width: "100%", maxWidth: "min(900px, 90vw)" }}>
          <PlayerJoinFeed players={players} maxDisplay={20} />
        </div>
      )}

      {/* Waiting message */}
      {players.length === 0 && (
        <p
          style={{
            color: colors.textSecondary,
            fontSize: "var(--text-xl)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Waiting for players to join...
        </p>
      )}
    </div>
  );
}
