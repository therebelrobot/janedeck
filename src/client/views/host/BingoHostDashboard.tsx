// src/client/views/host/BingoHostDashboard.tsx — Bingo-specific dashboard content + controls
// Rendered by HostDashboard.tsx when gameStore.gameType === "bingo".
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClientMessage } from "@/shared/messages";
import type { GameState, BingoWinner } from "@/shared/types";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { slideFromBottom } from "../../animations/presets";
import { PlayerList, type PlayerListEntry } from "./components/PlayerList";
import { bingoResultsToCSV, downloadCSV } from "../../utils/csv";

export interface BingoActivityEntry {
  id: string;
  kind: "mark" | "win";
  message: string;
  timestamp: number;
}

const WIN_PATTERN_LABELS: Record<string, string> = {
  line: "Line",
  four_corners: "Four Corners",
  blackout: "Blackout",
};

/** Main content area for the bingo host dashboard — switches on gameState. */
export function BingoHostDashboard({
  gameCode,
  gameState,
  players,
  bingoWinners,
  activityFeed,
  onKick,
}: {
  gameCode: string;
  gameState: GameState;
  players: PlayerListEntry[];
  bingoWinners: BingoWinner[];
  activityFeed: BingoActivityEntry[];
  onKick: (id: string) => void;
}): React.ReactElement {
  if (gameState === "LOBBY") {
    return (
      <>
        <motion.div
          {...slideFromBottom}
          className="game-code-display"
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: radii.xl,
            padding: spacing[8],
            border: `1px solid ${colors.border}`,
            boxShadow: shadows.glow,
            textAlign: "center",
          }}
        >
          <p className="game-code-label">Share this code with players:</p>
          <p className="game-code-value">{gameCode}</p>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: colors.textSecondary,
              marginTop: spacing[4],
              marginBottom: 0,
            }}
          >
            Presentation view:{" "}
            <a
              href={`/present/${gameCode}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.primaryLight }}
            >
              /present/{gameCode}
            </a>
          </p>
        </motion.div>

        <div
          style={{
            backgroundColor: colors.bgCard,
            borderRadius: radii.xl,
            padding: spacing[6],
            border: `1px solid ${colors.border}`,
          }}
        >
          <PlayerList players={players} onKick={onKick} kickEnabled />
        </div>
      </>
    );
  }

  // BINGO_PLAYING or BINGO_ENDED
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[6], width: "100%" }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-3xl)",
          fontWeight: 700,
          textAlign: "center",
          color: colors.accentPurple,
          margin: 0,
        }}
      >
        {gameState === "BINGO_ENDED" ? "🏁 Bingo Ended" : "🎱 Bingo in Progress"}
      </h2>

      <WinnersPanel winners={bingoWinners} />

      <ActivityFeed entries={activityFeed} />

      <div
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[6],
          border: `1px solid ${colors.border}`,
        }}
      >
        <PlayerList players={players} onKick={onKick} kickEnabled={gameState !== "BINGO_ENDED"} />
      </div>
    </div>
  );
}

/** Winners-so-far list with a CSV export once the game has at least one winner. */
function WinnersPanel({ winners }: { winners: BingoWinner[] }): React.ReactElement {
  const handleExport = () => {
    const csv = bingoResultsToCSV(winners);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `janedeck-bingo-results-${date}.csv`);
  };

  return (
    <div
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radii.xl,
        padding: spacing[6],
        border: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing[2] }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Winners {winners.length > 0 && `(${winners.length})`}
        </h3>
        {winners.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="btn-ghost"
            style={{ minHeight: 44, minWidth: 44, fontSize: "var(--text-sm)" }}
          >
            📤 Export Results CSV
          </button>
        )}
      </div>

      {winners.length === 0 ? (
        <p style={{ color: colors.textSecondary, fontSize: "var(--text-sm)", margin: 0 }}>
          No one has completed a pattern yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
          {winners.map((winner, i) => (
            <div
              key={`${winner.playerId}-${winner.pattern}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: `${spacing[2]} ${spacing[3]}`,
                borderRadius: radii.md,
                backgroundColor: `${colors.accentYellow}10`,
                border: `1px solid ${colors.accentYellow}30`,
                fontSize: "var(--text-sm)",
              }}
            >
              <span>🏆 {winner.displayName}</span>
              <span style={{ color: colors.textSecondary }}>
                {WIN_PATTERN_LABELS[winner.pattern] || winner.pattern}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Live scrollable activity log — the host is the most likely person watching. */
function ActivityFeed({ entries }: { entries: BingoActivityEntry[] }): React.ReactElement {
  return (
    <div
      style={{
        backgroundColor: colors.bgCard,
        borderRadius: radii.xl,
        padding: spacing[4],
        border: `1px solid ${colors.border}`,
        maxHeight: 240,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: spacing[1],
      }}
      aria-live="polite"
      aria-label="Bingo activity feed"
    >
      {entries.length === 0 ? (
        <p style={{ color: colors.textSecondary, fontSize: "var(--text-sm)", margin: 0 }}>
          Activity will show up here as players mark squares.
        </p>
      ) : (
        <AnimatePresence mode="popLayout">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{
                fontSize: "var(--text-sm)",
                color: entry.kind === "win" ? colors.accentYellow : colors.textSecondary,
                fontWeight: entry.kind === "win" ? 700 : 400,
                padding: `${spacing[1]} ${spacing[2]}`,
                backgroundColor: entry.kind === "win" ? `${colors.accentYellow}10` : "transparent",
                borderRadius: radii.sm,
              }}
            >
              {entry.kind === "win" ? "🏆 " : "✅ "}
              {entry.message}
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

/** Sticky footer controls — start / end / reset the bingo game. */
export function BingoControls({
  gameState,
  send,
}: {
  gameState: GameState;
  send: (message: ClientMessage) => void;
}): React.ReactElement {
  if (gameState === "LOBBY") {
    return (
      <button
        type="button"
        className="btn-lg"
        style={{ width: "100%", backgroundColor: colors.correct }}
        onClick={() => send({ type: "HOST_START_BINGO_GAME", payload: {} })}
      >
        🎱 Start Bingo
      </button>
    );
  }

  if (gameState === "BINGO_PLAYING") {
    return (
      <button
        type="button"
        className="btn-lg"
        style={{ width: "100%", backgroundColor: colors.incorrect }}
        onClick={() => send({ type: "HOST_END_BINGO_GAME", payload: {} })}
      >
        🏁 End Game
      </button>
    );
  }

  // BINGO_ENDED
  return (
    <button
      type="button"
      className="btn-lg"
      style={{ width: "100%", backgroundColor: colors.primary }}
      onClick={() => send({ type: "HOST_RESET_BINGO_GAME", payload: {} })}
    >
      🔄 Reset / Play Again
    </button>
  );
}
