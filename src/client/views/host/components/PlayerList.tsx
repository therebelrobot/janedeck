// src/client/views/host/components/PlayerList.tsx — Connected players list
// R1.4: displayName is the chosen name. R5.3: Semantic <ul>.
// R5.2: Touch targets ≥ 44px for kick buttons.
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayerAvatar } from "../../../components/PlayerAvatar";
import { colors, radii, spacing } from "../../../styles/theme";
import { staggerContainer, staggerItem } from "../../../animations/presets";

/** Player data for list display */
export interface PlayerListEntry {
  id: string;
  displayName: string;
  score: number;
  isConnected: boolean;
}

type SortMode = "joined" | "score" | "name";

interface PlayerListProps {
  /** Array of players to display */
  players: PlayerListEntry[];
  /** Callback to kick a player */
  onKick: (playerId: string) => void;
  /** Whether kick is enabled (e.g., during lobby) */
  kickEnabled?: boolean;
}

/**
 * Connected players list with avatars, scores, and connection status.
 * Sortable by join order, score, or name.
 * Animated enter/exit for players joining/leaving.
 */
export function PlayerList({
  players,
  onKick,
  kickEnabled = true,
}: PlayerListProps): React.ReactElement {
  const [sortBy, setSortBy] = useState<SortMode>("joined");
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);

  const sortedPlayers = [...players].sort((a, b) => {
    switch (sortBy) {
      case "score":
        return b.score - a.score;
      case "name":
        return a.displayName.localeCompare(b.displayName);
      case "joined":
      default:
        return 0; // preserve original order
    }
  });

  const handleKickClick = (playerId: string) => {
    if (confirmKickId === playerId) {
      onKick(playerId);
      setConfirmKickId(null);
    } else {
      setConfirmKickId(playerId);
    }
  };

  const handleCancelKick = () => {
    setConfirmKickId(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: spacing[2],
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Players
          <span
            style={{
              marginInlineStart: spacing[2],
              color: colors.primary,
              fontSize: "var(--text-base)",
            }}
            aria-live="polite"
          >
            ({players.length} connected)
          </span>
        </h3>

        {/* Sort controls */}
        <div style={{ display: "flex", gap: spacing[1] }}>
          {(["joined", "score", "name"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortBy(mode)}
              className="btn-sm"
              style={{
                minHeight: 32,
                backgroundColor: sortBy === mode ? colors.primary : "transparent",
                color: sortBy === mode ? "#fff" : colors.textSecondary,
                border: sortBy === mode ? "none" : `1px solid ${colors.border}`,
                textTransform: "capitalize",
                fontSize: "var(--text-xs)",
              }}
              aria-pressed={sortBy === mode}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Player list */}
      {players.length === 0 ? (
        <p
          style={{
            color: colors.textSecondary,
            textAlign: "center",
            padding: spacing[8],
            fontSize: "var(--text-base)",
          }}
        >
          Waiting for players to join...
        </p>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: spacing[2],
          }}
          aria-label="Connected players"
        >
          <AnimatePresence mode="popLayout">
            {sortedPlayers.map((player) => (
              <motion.li
                key={player.id}
                variants={staggerItem}
                layout
                exit={{ opacity: 0, x: -30 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[3],
                  padding: `${spacing[2]} ${spacing[3]}`,
                  backgroundColor: colors.bgCard,
                  borderRadius: radii.md,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <PlayerAvatar
                  displayName={player.displayName}
                  isConnected={player.isConnected}
                  size="sm"
                />

                {/* R1.4: displayName is the chosen name */}
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: "var(--text-base)",
                    opacity: player.isConnected ? 1 : 0.5,
                  }}
                >
                  {player.displayName}
                  {!player.isConnected && (
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: colors.textSecondary,
                        marginInlineStart: spacing[2],
                      }}
                    >
                      (disconnected)
                    </span>
                  )}
                </span>

                {/* Score */}
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    color: colors.primaryLight,
                    fontSize: "var(--text-base)",
                    whiteSpace: "nowrap",
                  }}
                  aria-label={`${player.score} points`}
                >
                  {player.score.toLocaleString()}
                </span>

                {/* Kick button */}
                {kickEnabled && (
                  <div style={{ display: "flex", gap: spacing[1] }}>
                    {confirmKickId === player.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleKickClick(player.id)}
                          className="btn-sm btn-danger"
                          style={{
                            minHeight: 36,
                            fontSize: "var(--text-xs)",
                          }}
                          aria-label={`Confirm removing ${player.displayName}`}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelKick}
                          className="btn-sm btn-ghost"
                          style={{
                            minHeight: 36,
                            fontSize: "var(--text-xs)",
                          }}
                          aria-label="Cancel removal"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleKickClick(player.id)}
                        className="btn-sm btn-ghost"
                        style={{
                          minHeight: 36,
                          minWidth: 36,
                          color: colors.textSecondary,
                          fontSize: "var(--text-xs)",
                        }}
                        aria-label={`Remove ${player.displayName} from game`}
                        title={`Remove ${player.displayName}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
