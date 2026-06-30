// src/server/utils/broadcast.ts — Role-targeted broadcast helpers
// Uses partyserver's Server base class methods instead of Party.Room.

import type { Server, Connection } from "partyserver";
import type {
  ConnectionState,
  PlayerRole,
  Game,
  ScoreEntry,
  TriviaGame,
} from "@/shared/types";
import type { ServerMessage } from "@/shared/messages";

/** Interface for the subset of Server methods needed by broadcast helpers */
interface BroadcastContext {
  getConnections<T>(): Iterable<Connection<T>>;
  broadcast(msg: string, without?: string[]): void;
}

/**
 * Send a message to all connections with a specific role.
 */
export function broadcastToRole(
  server: BroadcastContext,
  role: PlayerRole,
  message: ServerMessage,
): void {
  const encoded = JSON.stringify(message);
  for (const conn of server.getConnections<ConnectionState>()) {
    if (conn.state?.role === role) {
      conn.send(encoded);
    }
  }
}

/**
 * Send a message to a specific player by their player ID.
 */
export function sendToPlayer(
  server: BroadcastContext,
  playerId: string,
  message: ServerMessage,
): void {
  const encoded = JSON.stringify(message);
  for (const conn of server.getConnections<ConnectionState>()) {
    if (conn.state?.playerId === playerId) {
      conn.send(encoded);
      return;
    }
  }
}

/**
 * Send a message to a single connection with JSON serialization.
 */
export function sendToConnection(
  conn: Connection<ConnectionState>,
  message: ServerMessage,
): void {
  conn.send(JSON.stringify(message));
}

/**
 * Send a message to all connections except those with a specific role.
 */
export function broadcastExceptRole(
  server: BroadcastContext,
  excludeRole: PlayerRole,
  message: ServerMessage,
): void {
  const encoded = JSON.stringify(message);
  for (const conn of server.getConnections<ConnectionState>()) {
    if (conn.state?.role !== excludeRole) {
      conn.send(encoded);
    }
  }
}

/**
 * Broadcast to all connections.
 */
export function broadcastToAll(
  server: BroadcastContext,
  message: ServerMessage,
): void {
  server.broadcast(JSON.stringify(message));
}

/**
 * Compute the current leaderboard from game players.
 */
export function computeLeaderboard(game: Game): ScoreEntry[] {
  const players = Object.values(game.players).filter(
    (p) => p.role === "player",
  );

  const sorted = players.sort((a, b) => b.score - a.score);

  return sorted.map((player, index) => ({
    playerId: player.id,
    displayName: player.displayName,
    score: player.score,
    rank: index + 1,
    avatarSeed: player.avatarSeed,
  }));
}

/**
 * Send the game state change notification to all connections.
 */
export function broadcastStateChange(
  server: BroadcastContext,
  game: Game,
): void {
  const message: ServerMessage = {
    type: "GAME_STATE_CHANGED",
    payload: {
      gameType: game.type,
      state: game.state,
      ...(game.type === "trivia"
        ? {
            roundIndex: game.currentRoundIndex,
            questionIndex: game.currentQuestionIndex,
          }
        : {}),
    },
    timestamp: Date.now(),
  };
  broadcastToAll(server, message);
}

/**
 * Send the current question to the appropriate roles.
 * Host gets the full version (with answers), everyone else gets the public version.
 */
export function broadcastQuestion(
  server: BroadcastContext,
  game: TriviaGame,
): void {
  const round = game.rounds[game.currentRoundIndex];
  if (!round) return;

  const question = round.questions[game.currentQuestionIndex];
  if (!question) return;

  const now = Date.now();
  const totalQuestions = round.questions.length;
  const questionNumber = game.currentQuestionIndex + 1;

  // Public version — for presentation, players, audience
  const publicMsg: ServerMessage = {
    type: "QUESTION_SHOW",
    payload: {
      questionId: question.id,
      text: question.text,
      type: question.type,
      choices: question.choices,
      pointValue: question.pointValue,
      timeLimit: question.timeLimit,
      questionNumber,
      totalQuestions,
    },
    timestamp: now,
  };

  // Full version — for host only
  const hostMsg: ServerMessage = {
    type: "QUESTION_SHOW_FULL",
    payload: {
      questionId: question.id,
      text: question.text,
      type: question.type,
      choices: question.choices,
      pointValue: question.pointValue,
      timeLimit: question.timeLimit,
      questionNumber,
      totalQuestions,
      correctAnswer: question.correctAnswer,
      acceptableAnswers: question.acceptableAnswers ?? [],
    },
    timestamp: now,
  };

  broadcastToRole(server, "host", hostMsg);
  broadcastToRole(server, "presentation", publicMsg);
  broadcastToRole(server, "player", publicMsg);
  broadcastToRole(server, "audience", publicMsg);
}
