// src/server/bingo/bingoHandlers.ts — Message handlers for bingo games
// Called from GameRoom.onMessage; ctx is the GameRoom instance narrowed to this interface.

import type { Connection } from "partyserver";
import type {
  BingoGame,
  ConnectionState,
  Game,
} from "@/shared/types";
import type {
  HostCreateBingoGameMessage,
  PlayerMarkSquareMessage,
  PlayerUnmarkSquareMessage,
} from "@/shared/messages";
import {
  broadcastToAll,
  broadcastStateChange,
  sendToConnection,
  sendToPlayer,
} from "@/server/utils/broadcast";
import { transition, validateTransition } from "@/server/stateMachine";
import { checkNewWins, generateCard, requiredPhraseCount } from "@/server/bingo/bingoEngine";

/** Minimal surface of GameRoom needed by bingo handlers */
export interface BingoRoomContext {
  readonly name: string;
  game: Game | null;
  persistGame(): Promise<void>;
  validateToken(token: string): Promise<boolean>;
  sendError(conn: Connection<ConnectionState>, code: string, message: string): void;
  getConnections<T>(): Iterable<Connection<T>>;
  broadcast(msg: string, without?: string[]): void;
}

export async function handleCreateBingoGame(
  ctx: BingoRoomContext,
  msg: HostCreateBingoGameMessage,
  sender: Connection<ConnectionState>,
): Promise<void> {
  const valid = await ctx.validateToken(msg.payload.token);
  if (!valid) {
    ctx.sendError(sender, "AUTH_FAILED", "Invalid or expired token");
    return;
  }

  const { settings } = msg.payload;
  if (
    settings.cardMode === "phrasePool" &&
    settings.phrasePool.length < requiredPhraseCount(settings)
  ) {
    ctx.sendError(
      sender,
      "INVALID_SETTINGS",
      `Phrase pool must have at least ${requiredPhraseCount(settings)} phrases`,
    );
    return;
  }

  const game: BingoGame = {
    id: ctx.name,
    hostToken: msg.payload.token,
    type: "bingo",
    state: "LOBBY",
    players: {},
    settings,
    cards: {},
    winners: [],
    createdAt: Date.now(),
  };

  ctx.game = game;
  await ctx.persistGame();

  sendToConnection(sender, {
    type: "GAME_CREATED",
    payload: { gameCode: ctx.name },
    timestamp: Date.now(),
  });

  broadcastStateChange(ctx, ctx.game);
}

export async function handleStartBingoGame(
  ctx: BingoRoomContext,
  sender: Connection<ConnectionState>,
): Promise<void> {
  if (!ctx.game || ctx.game.type !== "bingo") {
    ctx.sendError(sender, "NO_GAME", "No bingo game has been created");
    return;
  }

  if (ctx.game.state !== "LOBBY") {
    ctx.sendError(sender, "INVALID_STATE", "Game can only be started from the lobby");
    return;
  }

  const game = ctx.game;

  // Generate one card per joined player before transitioning
  for (const player of Object.values(game.players)) {
    if (player.role !== "player") continue;
    const squares = generateCard(game.settings);
    const marked = squares.filter((s) => s.isFree).map((s) => s.index);
    game.cards[player.id] = {
      playerId: player.id,
      squares,
      marked,
      wonPatterns: [],
    };
  }

  const result = validateTransition(game, "BINGO_PLAYING");
  if (!result.success) {
    ctx.sendError(sender, "INVALID_STATE", result.error ?? "Cannot start game");
    return;
  }
  ctx.game = transition(game, "BINGO_PLAYING") as BingoGame;

  for (const [playerId, card] of Object.entries(ctx.game.cards)) {
    sendToPlayer(ctx, playerId, {
      type: "BINGO_CARD_ASSIGNED",
      payload: { squares: card.squares, marked: card.marked },
      timestamp: Date.now(),
    });
  }

  await ctx.persistGame();
  broadcastStateChange(ctx, ctx.game);
}

export async function handleMarkSquare(
  ctx: BingoRoomContext,
  msg: PlayerMarkSquareMessage,
  sender: Connection<ConnectionState>,
): Promise<void> {
  if (!ctx.game || ctx.game.type !== "bingo" || ctx.game.state !== "BINGO_PLAYING") {
    return;
  }

  const playerId = sender.state?.playerId;
  if (!playerId) return;

  const game = ctx.game;
  const player = game.players[playerId];
  const card = game.cards[playerId];
  if (!player || !card) return;

  const { squareIndex } = msg.payload;
  const square = card.squares[squareIndex];
  if (!square || card.marked.includes(squareIndex)) return;

  card.marked.push(squareIndex);

  broadcastToAll(ctx, {
    type: "BINGO_SQUARE_MARKED",
    payload: {
      playerId,
      displayName: player.displayName,
      squareIndex,
      label: square.label,
      totalMarked: card.marked.length,
    },
    timestamp: Date.now(),
  });

  const newWins = checkNewWins(card, game.settings.winPatterns, game.settings.gridSize);
  for (const pattern of newWins) {
    card.wonPatterns.push(pattern);
    player.score += 1;
    game.winners.push({
      playerId,
      displayName: player.displayName,
      pattern,
      achievedAt: Date.now(),
    });

    broadcastToAll(ctx, {
      type: "BINGO_WINNER",
      payload: {
        playerId,
        displayName: player.displayName,
        pattern,
        allWinners: game.winners,
      },
      timestamp: Date.now(),
    });
  }

  await ctx.persistGame();
}

export async function handleUnmarkSquare(
  ctx: BingoRoomContext,
  msg: PlayerUnmarkSquareMessage,
  sender: Connection<ConnectionState>,
): Promise<void> {
  if (!ctx.game || ctx.game.type !== "bingo" || ctx.game.state !== "BINGO_PLAYING") {
    return;
  }

  const playerId = sender.state?.playerId;
  if (!playerId) return;

  const game = ctx.game;
  const player = game.players[playerId];
  const card = game.cards[playerId];
  if (!player || !card) return;

  const { squareIndex } = msg.payload;
  const square = card.squares[squareIndex];
  if (!square || square.isFree || !card.marked.includes(squareIndex)) return;

  card.marked = card.marked.filter((index) => index !== squareIndex);

  // Already-recorded wins/score for this pattern are not revoked — this is a
  // casual party game and the player may have already been celebrated for it.
  broadcastToAll(ctx, {
    type: "BINGO_SQUARE_UNMARKED",
    payload: {
      playerId,
      displayName: player.displayName,
      squareIndex,
      label: square.label,
      totalMarked: card.marked.length,
    },
    timestamp: Date.now(),
  });

  await ctx.persistGame();
}

export async function handleEndBingoGame(
  ctx: BingoRoomContext,
  _sender: Connection<ConnectionState>,
): Promise<void> {
  if (!ctx.game || ctx.game.type !== "bingo") return;
  if (ctx.game.state === "BINGO_ENDED" || ctx.game.state === "LOBBY") return;

  ctx.game = transition(ctx.game, "BINGO_ENDED") as BingoGame;

  broadcastToAll(ctx, {
    type: "BINGO_GAME_ENDED",
    payload: { winners: ctx.game.winners },
    timestamp: Date.now(),
  });

  broadcastStateChange(ctx, ctx.game);
  await ctx.persistGame();
}

export async function handleResetBingoGame(
  ctx: BingoRoomContext,
  sender: Connection<ConnectionState>,
): Promise<void> {
  if (!ctx.game || ctx.game.type !== "bingo") return;

  if (ctx.game.state !== "BINGO_ENDED") {
    ctx.sendError(sender, "INVALID_STATE", "Game can only be reset after it has ended");
    return;
  }

  const result = validateTransition(ctx.game, "LOBBY");
  if (!result.success) {
    ctx.sendError(sender, "INVALID_STATE", result.error ?? "Cannot reset game");
    return;
  }

  ctx.game = transition(ctx.game, "LOBBY") as BingoGame;
  broadcastStateChange(ctx, ctx.game);
  await ctx.persistGame();
}
