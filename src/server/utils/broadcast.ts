// src/server/utils/broadcast.ts — Role-targeted broadcast helpers
// Uses partyserver's Server base class methods instead of Party.Room.

import type { Server, Connection } from "partyserver";
import type {
  ConnectionState,
  PlayerRole,
  Game,
  Question,
  ScoreEntry,
  TriviaGame,
  PublicTeam,
  Team,
  TeamScoreEntry,
} from "@/shared/types";
import type {
  RoundQuestionFull,
  RoundQuestionPublic,
  ServerMessage,
} from "@/shared/messages";

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
 * Send a message to a set of players by their player IDs — e.g. all members of a team.
 */
export function sendToPlayers(
  server: BroadcastContext,
  playerIds: string[],
  message: ServerMessage,
): void {
  const idSet = new Set(playerIds);
  const encoded = JSON.stringify(message);
  for (const conn of server.getConnections<ConnectionState>()) {
    if (conn.state?.playerId && idSet.has(conn.state.playerId)) {
      conn.send(encoded);
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
 * Compute the current team leaderboard — Team Play equivalent of computeLeaderboard.
 */
export function computeTeamLeaderboard(game: TriviaGame): TeamScoreEntry[] {
  const teams = Object.values(game.teams);
  const sorted = [...teams].sort((a, b) => b.score - a.score);

  return sorted.map((team, index) => ({
    teamId: team.id,
    teamName: team.name,
    score: team.score,
    rank: index + 1,
    members: teamMembers(game, team),
  }));
}

/** Build the public member-info list for a team, in join order */
function teamMembers(game: TriviaGame, team: Team): PublicTeam["members"] {
  const members: PublicTeam["members"] = [];
  for (const id of team.memberIds) {
    const player = game.players[id];
    if (player) {
      members.push({ id: player.id, displayName: player.displayName, avatarSeed: player.avatarSeed });
    }
  }
  return members;
}

/**
 * Strip a team down to its public, broadcast-safe shape — never includes answers.
 */
export function toPublicTeam(game: TriviaGame, team: Team): PublicTeam {
  return {
    id: team.id,
    name: team.name,
    members: teamMembers(game, team),
    score: team.score,
  };
}

/**
 * Broadcast the full team roster to everyone in the room.
 */
export function broadcastTeams(server: BroadcastContext, game: TriviaGame): void {
  broadcastToAll(server, {
    type: "TEAM_UPDATED",
    payload: { teams: Object.values(game.teams).map((t) => toPublicTeam(game, t)) },
    timestamp: Date.now(),
  });
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
            totalRounds: game.rounds.length,
            teamPlayEnabled: game.settings.teamPlayEnabled,
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
      media: question.media,
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
      media: question.media,
    },
    timestamp: now,
  };

  broadcastToRole(server, "host", hostMsg);
  broadcastToRole(server, "presentation", publicMsg);
  broadcastToRole(server, "player", publicMsg);
  broadcastToRole(server, "audience", publicMsg);
}

/**
 * Team Play: how many of the current round's questions the host has revealed
 * so far. `currentQuestionIndex` doubles as the reveal pointer in this mode,
 * so questions 0..currentQuestionIndex are the visible ones.
 */
export function revealedQuestionCount(game: TriviaGame): number {
  const round = game.rounds[game.currentRoundIndex];
  if (!round) return 0;
  return Math.min(game.currentQuestionIndex + 1, round.questions.length);
}

function toPublicRoundQuestion(question: Question): RoundQuestionPublic {
  return {
    questionId: question.id,
    text: question.text,
    type: question.type,
    choices: question.choices,
    pointValue: question.pointValue,
    media: question.media,
  };
}

function toFullRoundQuestion(question: Question): RoundQuestionFull {
  return {
    ...toPublicRoundQuestion(question),
    correctAnswer: question.correctAnswer,
    acceptableAnswers: question.acceptableAnswers ?? [],
  };
}

/**
 * Build the ROUND_SHOW / ROUND_SHOW_FULL pair for the current round, carrying
 * only the questions revealed so far. Returns null when there's no round.
 * Shared by the round-start broadcast and the mid-round connect snapshot.
 */
export function buildRoundShowMessages(
  game: TriviaGame,
): { publicMsg: ServerMessage; hostMsg: ServerMessage } | null {
  const round = game.rounds[game.currentRoundIndex];
  if (!round) return null;

  const now = Date.now();
  const timeLimit =
    round.roundTimeLimit ??
    round.questions.reduce((sum, q) => sum + q.timeLimit, 0);
  const revealed = round.questions.slice(0, revealedQuestionCount(game));

  return {
    publicMsg: {
      type: "ROUND_SHOW",
      payload: {
        roundIndex: game.currentRoundIndex,
        roundTitle: round.title,
        questions: revealed.map(toPublicRoundQuestion),
        totalQuestions: round.questions.length,
        timeLimit,
      },
      timestamp: now,
    },
    hostMsg: {
      type: "ROUND_SHOW_FULL",
      payload: {
        roundIndex: game.currentRoundIndex,
        roundTitle: round.title,
        questions: revealed.map(toFullRoundQuestion),
        totalQuestions: round.questions.length,
        timeLimit,
      },
      timestamp: now,
    },
  };
}

/**
 * Send the current round's revealed questions to the appropriate roles — Team
 * Play equivalent of broadcastQuestion, sent when the round opens. Host gets
 * correct answers, everyone else gets public fields.
 */
export function broadcastRoundQuestions(
  server: BroadcastContext,
  game: TriviaGame,
): void {
  const messages = buildRoundShowMessages(game);
  if (!messages) return;

  broadcastToRole(server, "host", messages.hostMsg);
  broadcastToRole(server, "presentation", messages.publicMsg);
  broadcastToRole(server, "player", messages.publicMsg);
  broadcastToRole(server, "audience", messages.publicMsg);
}

/**
 * Team Play: announce the question the host just revealed. Clients append it
 * to the questions they already have rather than replacing them, so earlier
 * answers stay editable.
 */
export function broadcastRevealedQuestion(
  server: BroadcastContext,
  game: TriviaGame,
): void {
  const round = game.rounds[game.currentRoundIndex];
  const question = round?.questions[game.currentQuestionIndex];
  if (!round || !question) return;

  const now = Date.now();
  const base = {
    roundIndex: game.currentRoundIndex,
    questionIndex: game.currentQuestionIndex,
    totalQuestions: round.questions.length,
  };

  const publicMsg: ServerMessage = {
    type: "ROUND_QUESTION_REVEALED",
    payload: { ...base, question: toPublicRoundQuestion(question) },
    timestamp: now,
  };

  const hostMsg: ServerMessage = {
    type: "ROUND_QUESTION_REVEALED_FULL",
    payload: { ...base, question: toFullRoundQuestion(question) },
    timestamp: now,
  };

  broadcastToRole(server, "host", hostMsg);
  broadcastToRole(server, "presentation", publicMsg);
  broadcastToRole(server, "player", publicMsg);
  broadcastToRole(server, "audience", publicMsg);
}
