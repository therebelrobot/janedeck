// src/client/views/host/RoundAnsweringHostView.tsx — Team Play round-answering host view
// Shows the round timer plus per-team answered-count progress instead of the
// single-question timer/progress used by individual play's QuestionView.
import React from "react";
import { Timer } from "../../components/Timer";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import type { TeamAnswerProgressEntry } from "../../stores/gameStore";

interface RoundAnsweringHostViewProps {
  roundTitle: string;
  roundIndex: number;
  totalQuestions: number;
  timerSeconds: number | null;
  timerTotal: number | null;
  /** Per-team progress, keyed by team ID */
  teamProgress: Record<string, TeamAnswerProgressEntry>;
  teamCount: number;
}

/**
 * Host view during a Team Play round's ANSWERING phase.
 * Shows the round-level countdown and how many questions each team has
 * answered so far.
 */
export function RoundAnsweringHostView({
  roundTitle,
  roundIndex,
  totalQuestions,
  timerSeconds,
  timerTotal,
  teamProgress,
  teamCount,
}: RoundAnsweringHostViewProps): React.ReactElement {
  const teams = Object.entries(teamProgress).sort(([, a], [, b]) =>
    a.teamName.localeCompare(b.teamName),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[4], width: "100%" }}>
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[6],
          border: `2px solid ${colors.primary}`,
          boxShadow: shadows.glow,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: spacing[2],
          }}
        >
          Round {roundIndex + 1} · {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
        </p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-2xl)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {roundTitle}
        </h2>
      </div>

      {/* Round timer */}
      {timerSeconds !== null && timerTotal !== null && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Timer secondsRemaining={timerSeconds} totalSeconds={timerTotal} size="lg" />
        </div>
      )}

      {/* Per-team progress */}
      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[4],
          border: `1px solid ${colors.border}`,
        }}
      >
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
            marginBottom: spacing[3],
          }}
          aria-live="polite"
        >
          {teams.length}/{teamCount} team{teamCount !== 1 ? "s" : ""} answering
        </p>

        {teams.length === 0 ? (
          <p style={{ color: colors.textSecondary, textAlign: "center", padding: spacing[4] }}>
            Waiting for teams to start answering...
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {teams.map(([teamId, progress]) => {
              const done = progress.answeredCount >= progress.totalQuestions;
              return (
                <div
                  key={teamId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: `${spacing[2]} ${spacing[3]}`,
                    borderRadius: radii.md,
                    backgroundColor: done ? `${colors.correct}15` : colors.bgElevated,
                    border: `1px solid ${done ? colors.correct : colors.border}`,
                  }}
                >
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                    {progress.teamName}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: done ? colors.correct : colors.primaryLight,
                    }}
                  >
                    {progress.answeredCount}/{progress.totalQuestions}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
