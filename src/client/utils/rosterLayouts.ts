// src/client/utils/rosterLayouts.ts — Layout ladders for shared-screen rosters
//
// Each ladder runs from the boldest layout to the tightest. useFitToBox walks
// down it until the roster fits the screen, so the same code covers four teams
// on a 4K projector and twenty on a shared laptop window. Nothing here decides
// anything from the player count — the browser's own measurements do.
import type { AvatarSize } from "../components/PlayerAvatar";

export interface RosterCardLayout {
  /** Avatar size for each member, or null to drop the faces entirely */
  size: AvatarSize | null;
  /** Minimum card width, before --avatar-scale is applied */
  cardPx: number;
  /** Team name size that balances the faces at this rung */
  namePx: string;
  /** Whether there's room for the secondary line ("4 players") */
  showDetail: boolean;
  /** Card padding and internal gap */
  padPx: number;
  gapPx: number;
}

/** Lobby: teams as they form. Ends at a name-only chip. */
export const TEAM_CARD_LADDER: readonly RosterCardLayout[] = [
  { size: "xl", cardPx: 340, namePx: "var(--text-2xl)", showDetail: true, padPx: 20, gapPx: 10 },
  { size: "lg", cardPx: 260, namePx: "var(--text-xl)", showDetail: true, padPx: 16, gapPx: 8 },
  { size: "md", cardPx: 210, namePx: "var(--text-lg)", showDetail: true, padPx: 12, gapPx: 6 },
  { size: "sm", cardPx: 180, namePx: "var(--text-base)", showDetail: false, padPx: 10, gapPx: 4 },
  { size: null, cardPx: 150, namePx: "var(--text-sm)", showDetail: false, padPx: 8, gapPx: 0 },
];

/** Live round: the same teams, but the answered count has to survive to the end. */
export const TEAM_PROGRESS_LADDER: readonly RosterCardLayout[] = [
  { size: "lg", cardPx: 280, namePx: "var(--text-xl)", showDetail: true, padPx: 16, gapPx: 8 },
  { size: "md", cardPx: 220, namePx: "var(--text-lg)", showDetail: true, padPx: 12, gapPx: 6 },
  { size: "sm", cardPx: 180, namePx: "var(--text-base)", showDetail: true, padPx: 10, gapPx: 4 },
  { size: null, cardPx: 145, namePx: "var(--text-sm)", showDetail: true, padPx: 8, gapPx: 0 },
];

export interface WallTileLayout {
  size: AvatarSize;
  /** Fixed tile width so the wall stays a tidy grid rather than a ragged one */
  tilePx: number;
  namePx: string;
  /** Row gap; the wall reads as a crowd, so columns stay tight */
  gapPx: number;
}

/** Lobby without teams: a wall of faces, one per player. */
export const PLAYER_WALL_LADDER: readonly WallTileLayout[] = [
  { size: "xl", tilePx: 132, namePx: "var(--text-xl)", gapPx: 12 },
  { size: "lg", tilePx: 96, namePx: "var(--text-base)", gapPx: 10 },
  { size: "md", tilePx: 76, namePx: "var(--text-sm)", gapPx: 8 },
  { size: "sm", tilePx: 62, namePx: "var(--text-xs)", gapPx: 6 },
];

/** Ranked boards: rows shrink before the board starts dropping places. */
export const LEADERBOARD_LADDER: readonly AvatarSize[] = ["lg", "md", "sm"];
