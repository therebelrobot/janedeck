// src/client/views/player/TeamSelectScreen.tsx — Team Play team selection
// R5.2: Touch targets ≥ 44px. R5.3: Semantic HTML. R5.6: labels, aria.
// Shown right after JOIN_ACCEPTED when the game has Team Play enabled and the
// player hasn't chosen a team yet. Self-serve by name: typing an existing
// team's name joins it, typing a new name creates it.
import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PublicTeam } from "@/shared/types";
import { TeamMemberAvatars } from "../../components/TeamMemberAvatars";
import { colors, spacing, radii, shadows } from "../../styles/theme";

interface TeamSelectScreenProps {
  displayName: string | null;
  /** Existing teams in the game, so the player can tap to join one directly */
  teams: PublicTeam[];
  maxTeamSize: number;
  /** Called with the chosen/created team name */
  onChooseTeam: (teamName: string) => void;
  /** The player's current team name, when this is shown to switch teams rather than pick one for the first time */
  currentTeamName?: string | null;
  /** When provided, shows a "back" action instead of forcing a choice — used when switching teams */
  onCancel?: () => void;
}

export function TeamSelectScreen({
  displayName,
  teams,
  maxTeamSize,
  onChooseTeam,
  currentTeamName,
  onCancel,
}: TeamSelectScreenProps): React.ReactElement {
  const [teamName, setTeamName] = useState("");
  const prefersReducedMotion = useReducedMotion();

  // When switching teams, don't list the team the player is already on.
  const selectableTeams = teams.filter((t) => t.name !== currentTeamName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = teamName.trim();
    if (trimmed.length === 0) return;
    onChooseTeam(trimmed);
  };

  return (
    <motion.div
      className="view view--player"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 300, damping: 25 }
      }
      style={{ justifyContent: "center" }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          fontWeight: 700,
          color: colors.text,
          textAlign: "center",
          marginBottom: spacing[2],
        }}
      >
        {currentTeamName ? "Switch teams" : `You're in, ${displayName}!`}
      </h2>
      <p style={{ color: colors.textSecondary, textAlign: "center", marginBottom: spacing[6] }}>
        {currentTeamName
          ? `You're currently on ${currentTeamName}. Pick a different team below.`
          : `Pick a team of up to ${maxTeamSize} — everyone on your team types the same team name.`}
      </p>

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
        <div>
          <label
            htmlFor="team-name"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: colors.text,
              display: "block",
              marginBottom: spacing[2],
            }}
          >
            Team Name
          </label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Type a new or existing team name"
            autoComplete="off"
            autoFocus
            style={{ fontSize: "var(--text-xl)", minHeight: 56 }}
          />
        </div>

        <button
          type="submit"
          disabled={teamName.trim().length === 0}
          className="btn-lg"
          style={{
            width: "100%",
            minHeight: 56,
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            backgroundColor: colors.secondary,
          }}
        >
          Join / Create Team
        </button>
      </form>

      {selectableTeams.length > 0 && (
        <div style={{ marginTop: spacing[6], width: "100%" }}>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              marginBottom: spacing[3],
              textAlign: "center",
            }}
          >
            Or tap an existing team to join it:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
            {selectableTeams.map((team) => {
              const full = team.members.length >= maxTeamSize;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onChooseTeam(team.name)}
                  disabled={full}
                  className="btn-ghost"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 48,
                    padding: `${spacing[2]} ${spacing[4]}`,
                    opacity: full ? 0.5 : 1,
                  }}
                  aria-label={`Join team ${team.name}, ${team.members.length} of ${maxTeamSize} members${full ? ", full" : ""}`}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
                    <TeamMemberAvatars members={team.members} size="sm" />
                    <span style={{ fontWeight: 600 }}>{team.name}</span>
                  </span>
                  <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
                    {team.members.length}/{maxTeamSize}
                    {full ? " · full" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost"
          style={{
            marginTop: spacing[4],
            minHeight: 44,
            color: colors.textSecondary,
          }}
        >
          ← Back to my team
        </button>
      )}
    </motion.div>
  );
}
