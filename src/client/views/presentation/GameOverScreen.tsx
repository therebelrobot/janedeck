// src/client/views/presentation/GameOverScreen.tsx — Final results with confetti
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R1.4: displayName is the chosen name.
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ScoreEntry } from "@/shared/types";
import { Confetti } from "../../components/Confetti";
import { Leaderboard } from "../../components/Leaderboard";
import { WinnerReveal } from "./components/WinnerReveal";
import { colors, spacing } from "../../styles/theme";

interface GameOverScreenProps {
  /** Final leaderboard */
  leaderboard: ScoreEntry[];
  /** Winner info */
  winner: {
    playerId: string;
    displayName: string;
    score: number;
  } | null;
}

/**
 * Final game over screen for the presentation view.
 * Features podium-style top 3 reveal, confetti, and full leaderboard.
 */
export function GameOverScreen({
  leaderboard,
  winner,
}: GameOverScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);

  const topPlayers = leaderboard.slice(0, 3);

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
      {/* Confetti effect */}
      <Confetti active={showConfetti} duration={5000} />

      {/* Title */}
      <motion.h2
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 200, damping: 15, delay: 0.1 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.5rem, 6vw, 5rem)",
          fontWeight: 700,
          color: colors.secondary,
          textAlign: "center",
          margin: 0,
          textShadow: "0 0 40px rgba(236, 72, 153, 0.4)",
        }}
      >
        🏆 Game Over!
      </motion.h2>

      {/* Winner podium */}
      {topPlayers.length > 0 && (
        <WinnerReveal
          topPlayers={topPlayers}
          onFirstPlaceRevealed={() => setShowConfetti(true)}
        />
      )}

      {/* Full leaderboard (below podium) */}
      {leaderboard.length > 3 && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { delay: 2.0, type: "spring", stiffness: 200, damping: 25 }
          }
          style={{
            width: "100%",
            maxWidth: 700,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing[4],
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              color: colors.textSecondary,
              margin: 0,
            }}
          >
            Final Standings
          </h3>
          <Leaderboard
            entries={leaderboard.slice(3)}
            maxDisplay={20}
          />
        </motion.div>
      )}

      {/* Thanks message */}
      <motion.p
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { delay: 2.5, duration: 0.5 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.25rem, 2.5vw, 2rem)",
          color: colors.textSecondary,
          textAlign: "center",
          margin: 0,
        }}
      >
        Thanks for playing! 🎉
      </motion.p>
    </div>
  );
}
