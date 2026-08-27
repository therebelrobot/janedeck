// src/client/views/presentation/LobbyScreen.tsx — Waiting room display
// R5.3: Semantic HTML. R5.5: Animations via ReducedMotionProvider.
// R5.4: High contrast for screen-sharing.
import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { PublicTeam } from "@/shared/types";
import { GameCodeDisplay } from "./components/GameCodeDisplay";
import { PlayerJoinFeed } from "./components/PlayerJoinFeed";
import { TeamMemberAvatars } from "../../components/TeamMemberAvatars";
import { colors, spacing, radii } from "../../styles/theme";
import { TEAM_CARD_LADDER } from "../../utils/rosterLayouts";
import { useFitToBox } from "../../hooks/useFitToBox";
import { pulse, staggerContainer, staggerItem, reduceVariants } from "../../animations/presets";

interface LobbyScreenProps {
  /** The game code */
  gameCode: string;
  /** List of joined players */
  players: Array<{ playerId: string; displayName: string; avatarSeed?: string }>;
  /** Total player count */
  playerCount: number;
  /** Whether Team Play is enabled — shows team formation instead of a flat join feed */
  teamPlayEnabled?: boolean;
  /** Current teams, when Team Play is enabled */
  teams?: PublicTeam[];
}

/**
 * Presentation lobby screen shown while waiting for players to join.
 * Features large game code, player join feed, and idle animations.
 */
export function LobbyScreen({
  gameCode,
  players,
  playerCount,
  teamPlayEnabled = false,
  teams = [],
}: LobbyScreenProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();

  // Once there's a roster to show — teams forming, or faces on the wall — the
  // vertical rhythm tightens to make room for it. At full size the roster gets
  // pushed off the bottom of the shared screen, and a projected screen can't
  // scroll down to reach it.
  const compact = teamPlayEnabled ? teams.length > 1 : players.length > 0;
  // A big roster needs the vertical space the stacked code block was using, so
  // the code and the QR move onto one line instead of two.
  const denseCode = teamPlayEnabled ? teams.length > 6 : players.length > 10;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? spacing[2] : spacing[6],
        width: "100%",
        // Fill the screen rather than sizing to content: the roster below needs
        // a real box to measure itself against, and whatever is left after the
        // join code is exactly that box.
        flex: 1,
        minHeight: 0,
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
          fontSize: compact ? "clamp(2rem, 5vw, 4.5rem)" : "clamp(3rem, 8vw, 8rem)",
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
      <GameCodeDisplay gameCode={gameCode} compact={compact} dense={denseCode} />

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
            fontSize: compact ? "clamp(1.25rem, 2vw, 2rem)" : "clamp(1.5rem, 3vw, 3rem)",
            fontWeight: 700,
            color: colors.primaryLight,
          }}
        >
          {playerCount} {playerCount === 1 ? "player" : "players"} joined
        </span>
      </motion.div>

      {teamPlayEnabled ? (
        <TeamFormationGrid teams={teams} prefersReducedMotion={!!prefersReducedMotion} />
      ) : (
        <>
          {/* Player join feed */}
          {players.length > 0 && (
            <div
              style={{
                width: "100%",
                maxWidth: "min(1800px, 96vw)",
                flex: 1,
                minHeight: 0,
                display: "flex",
              }}
            >
              <PlayerJoinFeed players={players} />
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
        </>
      )}
    </div>
  );
}

/** Team Play lobby: teams appear as cards as players form/join them */
function TeamFormationGrid({
  teams,
  prefersReducedMotion,
}: {
  teams: PublicTeam[];
  prefersReducedMotion: boolean;
}): React.ReactElement {
  // The roster measures itself against the space the join code leaves it and
  // tightens until it fits — big faces for a handful of teams, name-only chips
  // for a roomful. See useFitToBox.
  const { ref, step, visibleCount, hiddenCount } = useFitToBox(teams.length, TEAM_CARD_LADDER.length);
  const layout = TEAM_CARD_LADDER[Math.min(step, TEAM_CARD_LADDER.length - 1)];
  const shown = teams.slice(0, visibleCount);

  if (teams.length === 0) {
    return (
      <p
        style={{
          color: colors.textSecondary,
          fontSize: "var(--text-xl)",
          fontStyle: "italic",
          margin: 0,
        }}
      >
        Waiting for teams to form...
      </p>
    );
  }

  return (
    <motion.div
      ref={ref}
      variants={prefersReducedMotion ? reduceVariants(staggerContainer) : staggerContainer}
      initial="hidden"
      animate="show"
      style={{
        width: "100%",
        maxWidth: "min(1800px, 96vw)",
        display: "grid",
        // Columns track --avatar-scale for the same reason the avatars do: on a
        // 1920px screen every face is drawn 1.3x, and a fixed column would clip
        // the roster it's meant to hold.
        gridTemplateColumns: `repeat(auto-fit, minmax(calc(${layout.cardPx}px * var(--avatar-scale, 1)), 1fr))`,
        gap: spacing[2],
        alignContent: "center",
        justifyContent: "center",
        // The box useFitToBox measures: bounded, clipped, and the origin for
        // the children's offsetTop.
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
      }}
      aria-label="Teams"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {shown.map((team) => (
          <motion.div
            key={team.id}
            variants={prefersReducedMotion ? reduceVariants(staggerItem) : staggerItem}
            layout={!prefersReducedMotion}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: layout.gapPx,
              padding: layout.padPx,
              backgroundColor: colors.bgCard,
              borderRadius: radii.xl,
              border: `1px solid ${colors.border}`,
              minWidth: 0,
            }}
          >
            {/* Faces first — the roster is what the room looks at, the label
                follows. Past the last rung the faces go and the name carries
                the card on its own. */}
            {layout.size && (
              <TeamMemberAvatars
                members={team.members}
                size={layout.size}
                maxDisplay={5}
                align="center"
              />
            )}
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: layout.namePx,
                textAlign: "center",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {team.name}
            </span>
            {layout.showDetail && (
              <span style={{ fontSize: "var(--text-sm)", color: colors.textSecondary }}>
                {team.members.length} {team.members.length === 1 ? "player" : "players"}
              </span>
            )}
            {!layout.showDetail && !layout.size && (
              <span style={{ fontSize: "var(--text-xs)", color: colors.textSecondary }}>
                {team.members.length}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {hiddenCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: layout.padPx,
            borderRadius: radii.xl,
            border: `1px dashed ${colors.border}`,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: layout.namePx,
            color: colors.textSecondary,
          }}
        >
          +{hiddenCount} more
        </div>
      )}
    </motion.div>
  );
}
