// src/client/views/presentation/ScoreRevealScreen.tsx — Animated score reveal
// R5.3: Semantic HTML. R5.5: Animations respect prefers-reduced-motion.
// R5.4: High contrast colors for screen-sharing.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type {
  QuestionReveal,
  ScoreEntry,
  ScoreChange,
  TeamScoreEntry,
  TeamScoreChange,
} from "@/shared/types";
import { AnswerRevealPanel } from "../../components/AnswerReveal";
import { Leaderboard } from "../../components/Leaderboard";
import { TeamLeaderboard } from "../../components/TeamLeaderboard";
import { colors, spacing, radii, shadows } from "../../styles/theme";

interface ScoreRevealScreenProps {
  /** Current leaderboard */
  leaderboard: ScoreEntry[];
  /** Score changes for animated indicators */
  scoreChanges: ScoreChange[];
  /** Optional round index for round results */
  roundIndex?: number;
  /** Whether this is a round results view (vs question score reveal) */
  isRoundResults?: boolean;
  /** Round MVP info */
  roundMVP?: {
    displayName: string;
    roundScore: number;
  } | null;
  /** Team Play only: when present, teams are shown as first-class rows instead of leaderboard/roundMVP */
  teamLeaderboard?: TeamScoreEntry[];
  teamScoreChanges?: TeamScoreChange[];
  /**
   * The question(s) that just closed, with their correct answers and what
   * everyone said. Rendered alongside the leaderboard so the room gets the
   * payoff before the scores move on.
   */
  answerReveal?: QuestionReveal[] | null;
}

/**
 * Score reveal screen for presentation view.
 * Shows animated leaderboard with score change indicators.
 * Used for both per-question score reveals and round results.
 */
export function ScoreRevealScreen({
  leaderboard,
  scoreChanges,
  roundIndex,
  isRoundResults = false,
  roundMVP,
  teamLeaderboard,
  teamScoreChanges,
  answerReveal,
}: ScoreRevealScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const hasReveal = !!answerReveal && answerReveal.length > 0;
  // A whole Team Play round needs room to tile into columns; a single question
  // is happier staying compact. Kept narrow enough that reveal + leaderboard
  // still sit side by side on a 1280-wide shared screen — wrapping there would
  // push the scores below the fold, and a projected screen can't scroll.
  const revealBasis = (answerReveal?.length ?? 0) > 1 ? 720 : 560;

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
      {/* Header */}
      <motion.h2
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 300, damping: 20 }
        }
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.5rem, 5vw, 5rem)",
          fontWeight: 700,
          color: isRoundResults ? colors.accentOrange : colors.accentPurple,
          textAlign: "center",
          margin: 0,
          textShadow: isRoundResults
            ? "0 0 40px rgba(249, 115, 22, 0.4)"
            : "0 0 40px rgba(168, 85, 247, 0.4)",
        }}
      >
        {isRoundResults
          ? `🏁 Round ${(roundIndex ?? 0) + 1} Complete`
          : teamLeaderboard
            ? "📊 Team Scores"
            : "📊 Scores"}
      </motion.h2>

      {/* Round MVP */}
      {isRoundResults && roundMVP && (
        <motion.div
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { scale: 0.7, opacity: 0 }
          }
          animate={
            prefersReducedMotion
              ? { opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 200, damping: 15, delay: 0.2 }
          }
          style={{
            textAlign: "center",
            padding: `${spacing[4]} ${spacing[8]}`,
            backgroundColor: `${colors.accentYellow}15`,
            borderRadius: radii.xl,
            border: `2px solid ${colors.accentYellow}40`,
            boxShadow: `0 0 30px rgba(250, 204, 21, 0.2)`,
          }}
        >
          <p
            style={{
              fontSize: "var(--text-lg)",
              color: colors.textSecondary,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Round MVP
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 700,
              color: colors.accentYellow,
              margin: `${spacing[1]} 0`,
            }}
          >
            ⭐ {roundMVP.displayName}
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-xl)",
              color: colors.primaryLight,
              margin: 0,
            }}
          >
            {roundMVP.roundScore} points this round
          </p>
        </motion.div>
      )}

      {/*
        Answers and scores sit side by side where the shared screen is wide
        enough for both, and stack on anything narrower. Without a reveal the
        leaderboard keeps its original centered width.
      */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: spacing[8],
          width: "100%",
          maxWidth: hasReveal ? "min(1800px, 95vw)" : "min(1000px, 90vw)",
        }}
      >
        {hasReveal && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 200, damping: 25, delay: 0.1 }
            }
            style={{
              flex: `1 1 min(100%, ${revealBasis}px)`,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: spacing[4],
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                fontWeight: 700,
                color: colors.correct,
                margin: 0,
                textAlign: "center",
              }}
            >
              ✅ {answerReveal.length > 1 ? "The Answers" : "The Answer"}
            </h3>
            <AnswerRevealPanel reveals={answerReveal} variant="presentation" />
          </motion.section>
        )}

        {/* Leaderboard */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 30 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : {
                  type: "spring",
                  stiffness: 200,
                  damping: 25,
                  delay: isRoundResults && roundMVP ? 0.4 : 0.2,
                }
          }
          style={{
            flex: hasReveal ? "1 1 min(100%, 400px)" : "1 1 100%",
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {teamLeaderboard ? (
            <TeamLeaderboard
              entries={teamLeaderboard}
              showChanges={!isRoundResults}
              scoreChanges={teamScoreChanges}
              maxDisplay={10}
            />
          ) : (
            <Leaderboard
              entries={leaderboard}
              showChanges={!isRoundResults}
              scoreChanges={scoreChanges}
              maxDisplay={10}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
