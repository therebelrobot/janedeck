// src/client/views/host/GameTypeSelector.tsx — Host picks Trivia or Bingo
// R5.3: Semantic HTML. R5.6: Proper labels.
import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { LogoutButton } from "../../components/LogoutButton";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { pageTransition, staggerContainer, staggerItem } from "../../animations/presets";

interface GameTypeOption {
  type: "trivia" | "bingo";
  label: string;
  description: string;
  emoji: string;
}

const GAME_TYPE_OPTIONS: GameTypeOption[] = [
  {
    type: "trivia",
    label: "Trivia",
    description: "Host-paced rounds of questions with fuzzy-matched answers and a live leaderboard.",
    emoji: "🧠",
  },
  {
    type: "bingo",
    label: "Bingo",
    description: "Free-for-all bingo cards — players self-mark squares, with toasts and sounds for every mark and win.",
    emoji: "🎱",
  },
];

/**
 * Game type selection page. Host picks Trivia or Bingo, then is routed
 * to the corresponding creation flow.
 */
export function GameTypeSelector(): React.ReactElement {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/host", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <motion.div
      className="view view--host"
      {...pageTransition}
      style={{
        gap: spacing[6],
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", maxWidth: 720 }}>
        <LogoutButton />
      </div>

      <div style={{ textAlign: "center" }}>
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
          Choose a Game Type
        </h1>
        <p style={{ color: colors.textSecondary, margin: 0, fontSize: "var(--text-sm)" }}>
          What are you hosting today?
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spacing[6],
          justifyContent: "center",
          width: "100%",
          maxWidth: 720,
        }}
      >
        {GAME_TYPE_OPTIONS.map((option) => (
          <motion.button
            key={option.type}
            type="button"
            variants={staggerItem}
            onClick={() => navigate(`/host/create/${option.type}`)}
            className="btn-ghost"
            style={{
              flex: "1 1 280px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: spacing[3],
              padding: spacing[8],
              backgroundColor: colors.bgCard,
              borderRadius: radii.xl,
              border: `1px solid ${colors.border}`,
              boxShadow: shadows.sm,
              textAlign: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "3rem" }} aria-hidden="true">
              {option.emoji}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: colors.text,
              }}
            >
              {option.label}
            </span>
            <span style={{ color: colors.textSecondary, fontSize: "var(--text-sm)" }}>
              {option.description}
            </span>
          </motion.button>
        ))}
      </motion.div>

      <Link
        to="/host"
        style={{
          fontSize: "var(--text-sm)",
          color: colors.textSecondary,
        }}
      >
        ← Back to login
      </Link>
    </motion.div>
  );
}
