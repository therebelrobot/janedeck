// src/server/gameRoom.ts — Main partyserver Durable Object for game rooms
// Each instance manages one trivia game. The room name is the game code.

import { Server } from "partyserver";
import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { nanoid } from "nanoid";
import type {
  ConnectionState,
  Game,
  Player,
  Answer,
  ScoreEntry,
  ScoreChange,
  AnswerReview,
  GameStats,
} from "@/shared/types";
import type {
  ClientMessage,
  ServerMessage,
  HostCreateGameMessage,
  HostJudgeAnswerMessage,
  HostBulkJudgeMessage,
  HostUpdateSettingsMessage,
  HostKickPlayerMessage,
  PlayerJoinMessage,
  PlayerRejoinMessage,
  PlayerSubmitAnswerMessage,
  AudienceJoinMessage,
  AudienceVoteMessage,
  HostEndGameMessage,
  HostCreateBingoGameMessage,
  PlayerMarkSquareMessage,
} from "@/shared/messages";
import { ClientMessageSchema } from "@/shared/schemas";
import { PARTY_AUTH_GATE, QUESTION_DISPLAY_DELAY } from "@/shared/constants";
import {
  saveGame,
  loadGame,
  saveAnswer,
} from "@/server/utils/storage";
import {
  broadcastToAll,
  broadcastToRole,
  sendToPlayer,
  sendToConnection,
  computeLeaderboard,
  broadcastStateChange,
  broadcastQuestion,
} from "@/server/utils/broadcast";
import {
  canTransition,
  transition,
  validateTransition,
} from "@/server/stateMachine";
import { batchMatch } from "@/server/fuzzyMatcher";
import {
  startTimer,
  cancelTimer,
  getSecondsRemaining,
} from "@/server/timer";
import {
  handleCreateBingoGame,
  handleEndBingoGame,
  handleMarkSquare,
  handleResetBingoGame,
  handleStartBingoGame,
  handleUnmarkSquare,
} from "@/server/bingo/bingoHandlers";

export class GameRoom extends Server<Env> {
  static options = { hibernate: true };

  /** Game state — rehydrated from storage in onStart */
  game: Game | null = null;

  /** Called when the party starts (including after hibernation) */
  async onStart(): Promise<void> {
    // Rehydrate game state from storage
    const stored = await loadGame(this.ctx.storage);
    if (stored) {
      this.game = stored;
    }
  }

  /** Handle new WebSocket connections */
  async onConnect(
    conn: Connection<ConnectionState>,
    ctx: ConnectionContext,
  ): Promise<void> {
    const url = new URL(ctx.request.url);
    const role = url.searchParams.get("role") ?? "player";
    const token = url.searchParams.get("token");

    // Tag the connection with its role
    const connectionState: ConnectionState = {
      role: role as ConnectionState["role"],
    };

    // For host connections, validate the token
    if (role === "host" && token) {
      const valid = await this.validateToken(token);
      if (!valid) {
        this.sendError(conn, "AUTH_FAILED", "Invalid or expired token");
        conn.close(4001, "Invalid token");
        return;
      }
    }

    conn.setState(connectionState);

    // Send current game state to the connecting client
    if (this.game) {
      // Send state change so client knows current state
      sendToConnection(conn, {
        type: "GAME_STATE_CHANGED",
        payload: {
          gameType: this.game.type,
          state: this.game.state,
          ...(this.game.type === "trivia"
            ? {
                roundIndex: this.game.currentRoundIndex,
                questionIndex: this.game.currentQuestionIndex,
              }
            : {}),
        },
        timestamp: Date.now(),
      });

      // If in a question-related state, send question info
      if (
        this.game.type === "trivia" &&
        (this.game.state === "QUESTION_DISPLAY" ||
          this.game.state === "ANSWERING" ||
          this.game.state === "REVIEWING")
      ) {
        const round = this.game.rounds[this.game.currentRoundIndex];
        const question = round?.questions[this.game.currentQuestionIndex];
        if (question && round) {
          const questionNumber = this.game.currentQuestionIndex + 1;
          const totalQuestions = round.questions.length;

          if (role === "host") {
            sendToConnection(conn, {
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
              timestamp: Date.now(),
            });
          } else {
            sendToConnection(conn, {
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
              timestamp: Date.now(),
            });
          }
        }

        // If answering, send timer info
        if (
          this.game.state === "ANSWERING" &&
          this.game.timerStartedAt &&
          this.game.timerDuration
        ) {
          const remaining = getSecondsRemaining(
            this.game.timerStartedAt,
            this.game.timerDuration,
          );
          sendToConnection(conn, {
            type: "TIMER_TICK",
            payload: { secondsRemaining: remaining },
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  /** Handle incoming WebSocket messages — NOTE: partyserver swaps parameter order */
  async onMessage(
    sender: Connection<ConnectionState>,
    message: WSMessage,
  ): Promise<void> {
    // Validate message with Zod schema
    let parsed: ClientMessage;
    try {
      parsed = ClientMessageSchema.parse(JSON.parse(String(message))) as ClientMessage;
    } catch {
      // Invalid messages are silently dropped
      return;
    }

    const state = sender.state;
    if (!state) return;

    // Route message based on type and role
    switch (parsed.type) {
      // ─── Host Messages ──────────────────────────────────────────────
      case "HOST_CREATE_GAME":
        if (state.role !== "host") return;
        await this.handleCreateGame(parsed, sender);
        break;

      case "HOST_START_GAME":
        if (state.role !== "host") return;
        await this.handleStartGame(sender);
        break;

      case "HOST_START_QUESTION":
        if (state.role !== "host") return;
        await this.handleStartQuestion(sender);
        break;

      case "HOST_CLOSE_ANSWERS":
        if (state.role !== "host") return;
        await this.handleCloseAnswers(sender);
        break;

      case "HOST_JUDGE_ANSWER":
        if (state.role !== "host") return;
        await this.handleJudgeAnswer(parsed, sender);
        break;

      case "HOST_BULK_JUDGE":
        if (state.role !== "host") return;
        await this.handleBulkJudge(parsed, sender);
        break;

      case "HOST_REVEAL_SCORES":
        if (state.role !== "host") return;
        await this.handleRevealScores(sender);
        break;

      case "HOST_NEXT_QUESTION":
        if (state.role !== "host") return;
        await this.handleNextQuestion(sender);
        break;

      case "HOST_NEXT_ROUND":
        if (state.role !== "host") return;
        await this.handleNextRound(sender);
        break;

      case "HOST_RESET_GAME":
        if (state.role !== "host") return;
        await this.handleResetGame(sender);
        break;

      case "HOST_END_GAME":
        if (state.role !== "host") return;
        await this.handleEndGame(sender);
        break;

      case "HOST_KICK_PLAYER":
        if (state.role !== "host") return;
        await this.handleKickPlayer(parsed, sender);
        break;

      case "HOST_UPDATE_SETTINGS":
        if (state.role !== "host") return;
        await this.handleUpdateSettings(parsed, sender);
        break;

      // ─── Player Messages ────────────────────────────────────────────
      case "PLAYER_JOIN":
        // Allow any role to send join — they might connect as "player" initially
        await this.handlePlayerJoin(parsed, sender);
        break;

      case "PLAYER_REJOIN":
        await this.handlePlayerRejoin(parsed, sender);
        break;

      case "PLAYER_SUBMIT_ANSWER":
        if (state.role !== "player") return;
        await this.handleSubmitAnswer(parsed, sender);
        break;

      case "PLAYER_BUZZER":
        // Optional buzz-in — not implemented in MVP
        break;

      // ─── Audience Messages ──────────────────────────────────────────
      case "AUDIENCE_JOIN":
        await this.handleAudienceJoin(parsed, sender);
        break;

      case "AUDIENCE_VOTE":
        if (state.role !== "audience") return;
        await this.handleAudienceVote(parsed, sender);
        break;

      // ─── Presentation Messages ──────────────────────────────────────
      case "PRESENTATION_CONNECT":
        // Presentation just connects and receives broadcasts — no special handling
        break;

      // ─── Bingo Host Messages ─────────────────────────────────────────
      case "HOST_CREATE_BINGO_GAME":
        if (state.role !== "host") return;
        await handleCreateBingoGame(this, parsed, sender);
        break;

      case "HOST_START_BINGO_GAME":
        if (state.role !== "host") return;
        await handleStartBingoGame(this, sender);
        break;

      case "HOST_END_BINGO_GAME":
        if (state.role !== "host") return;
        await handleEndBingoGame(this, sender);
        break;

      case "HOST_RESET_BINGO_GAME":
        if (state.role !== "host") return;
        await handleResetBingoGame(this, sender);
        break;

      // ─── Bingo Player Messages ───────────────────────────────────────
      case "PLAYER_MARK_SQUARE":
        if (state.role !== "player") return;
        await handleMarkSquare(this, parsed, sender);
        break;

      case "PLAYER_UNMARK_SQUARE":
        if (state.role !== "player") return;
        await handleUnmarkSquare(this, parsed, sender);
        break;

      case "PLAYER_UPDATE_AVATAR":
        if (state.role !== "player" || !state.playerId) return;
        await this.handleUpdateAvatar(parsed, sender);
        break;
    }
  }

  private async handleUpdateAvatar(
    msg: { payload: { avatarSeed: string } },
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;
    const playerId = sender.state?.playerId;
    if (!playerId) return;
    const player = this.game.players[playerId];
    if (!player) return;
    player.avatarSeed = msg.payload.avatarSeed.slice(0, 64);
    await this.persistGame();
    broadcastToAll(this, {
      type: "PLAYER_AVATAR_UPDATED",
      payload: { playerId, avatarSeed: player.avatarSeed },
      timestamp: Date.now(),
    });
  }

  /** Handle WebSocket disconnections */
  async onClose(
    conn: Connection<ConnectionState>,
    code?: number,
    reason?: string,
    wasClean?: boolean,
  ): Promise<void> {
    const state = conn.state;
    if (!state || !this.game) return;

    // Mark player as disconnected but keep their data
    if (state.role === "player" && state.playerId) {
      const player = this.game.players[state.playerId];
      if (player) {
        player.isConnected = false;
        await this.persistGame();

        // Broadcast player disconnection
        const playerCount = this.getConnectedPlayerCount();
        broadcastToAll(this, {
          type: "PLAYER_LEFT",
          payload: {
            playerId: state.playerId,
            playerCount,
          },
          timestamp: Date.now(),
        });
      }
    }
  }

  /** Handle timer alarms (used for question countdown and tick broadcasts) */
  async onAlarm(): Promise<void> {
    if (!this.game) return;

    if (this.game.state === "ANSWERING") {
      // Check if timer has expired
      if (this.game.timerStartedAt && this.game.timerDuration) {
        const remaining = getSecondsRemaining(
          this.game.timerStartedAt,
          this.game.timerDuration,
        );

        if (remaining <= 0) {
          // Timer expired — transition to REVIEWING
          await this.transitionTo("REVIEWING");
          broadcastStateChange(this, this.game);

          // Broadcast timer expired
          broadcastToAll(this, {
            type: "TIMER_EXPIRED",
            payload: {},
            timestamp: Date.now(),
          });

          // Run fuzzy matching and send results to host
          await this.runFuzzyMatchingAndNotifyHost();
        } else {
          // Broadcast tick and set next alarm
          broadcastToAll(this, {
            type: "TIMER_TICK",
            payload: { secondsRemaining: remaining },
            timestamp: Date.now(),
          });

          // Set next tick alarm (1 second)
          await this.ctx.storage.setAlarm(Date.now() + 1000);
        }
      }
    } else if (this.game.state === "QUESTION_DISPLAY") {
      // Auto-transition from QUESTION_DISPLAY to ANSWERING after delay
      await this.transitionTo("ANSWERING");

      // Start the actual countdown timer
      const round = this.game.rounds[this.game.currentRoundIndex];
      const question = round?.questions[this.game.currentQuestionIndex];
      if (question) {
        await startTimer(this.ctx.storage, question.timeLimit, question.id);
      }

      broadcastStateChange(this, this.game);
    }
  }

  // ─── Host Message Handlers ──────────────────────────────────────────────────

  private async handleCreateGame(
    msg: HostCreateGameMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    // Validate the token
    const valid = await this.validateToken(msg.payload.token);
    if (!valid) {
      this.sendError(sender, "AUTH_FAILED", "Invalid or expired token");
      return;
    }

    // Build the game object
    const gameId = this.name;
    const rounds = msg.payload.rounds.map((roundInput, roundIndex) => ({
      id: nanoid(12),
      index: roundIndex,
      title: roundInput.title,
      state: "pending" as const,
      questions: roundInput.questions.map((qInput) => ({
        id: nanoid(12),
        text: qInput.text,
        correctAnswer: qInput.correctAnswer,
        acceptableAnswers: qInput.acceptableAnswers,
        pointValue: qInput.pointValue,
        timeLimit: qInput.timeLimit,
        type: qInput.type,
        choices: qInput.choices,
        mediaUrl: qInput.mediaUrl,
      })),
    }));

    this.game = {
      id: gameId,
      hostToken: msg.payload.token,
      type: "trivia",
      state: "LOBBY",
      currentRoundIndex: 0,
      currentQuestionIndex: 0,
      rounds,
      players: {},
      settings: msg.payload.settings,
      createdAt: Date.now(),
      timerStartedAt: null,
      timerDuration: null,
    };

    await this.persistGame();

    // Confirm game creation to host
    sendToConnection(sender, {
      type: "GAME_CREATED",
      payload: { gameCode: gameId },
      timestamp: Date.now(),
    });

    // Broadcast initial state
    broadcastStateChange(this, this.game);
  }

  private async handleStartGame(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.type !== "trivia") {
      this.sendError(sender, "NO_GAME", "No game has been created");
      return;
    }

    if (this.game.state !== "LOBBY") {
      this.sendError(
        sender,
        "INVALID_STATE",
        "Game can only be started from the lobby",
      );
      return;
    }

    if (this.game.rounds.length === 0) {
      this.sendError(sender, "NO_ROUNDS", "Game must have at least one round");
      return;
    }

    // Transition LOBBY → ROUND_INTRO
    this.game.currentRoundIndex = 0;
    this.game.currentQuestionIndex = 0;
    await this.transitionTo("ROUND_INTRO");
    broadcastStateChange(this, this.game);
  }

  private async handleStartQuestion(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    if (this.game.state !== "ROUND_INTRO" && this.game.state !== "SCORE_REVEAL") {
      this.sendError(
        sender,
        "INVALID_STATE",
        "Cannot start a question from this state",
      );
      return;
    }

    // Transition to QUESTION_DISPLAY
    await this.transitionTo("QUESTION_DISPLAY");
    broadcastStateChange(this, this.game);

    // Send question to all roles
    broadcastQuestion(this, this.game);

    // Set alarm for auto-transition to ANSWERING after display delay
    await this.ctx.storage.setAlarm(Date.now() + QUESTION_DISPLAY_DELAY);
  }

  private async handleCloseAnswers(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.state !== "ANSWERING") {
      this.sendError(sender, "INVALID_STATE", "Answers can only be closed during answering");
      return;
    }

    // Cancel the timer
    await cancelTimer(this.ctx.storage);

    // Transition to REVIEWING
    await this.transitionTo("REVIEWING");

    broadcastToAll(this, {
      type: "TIMER_EXPIRED",
      payload: {},
      timestamp: Date.now(),
    });

    broadcastStateChange(this, this.game);

    // Run fuzzy matching and send to host
    await this.runFuzzyMatchingAndNotifyHost();
  }

  private async handleJudgeAnswer(
    msg: HostJudgeAnswerMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.state !== "REVIEWING") {
      this.sendError(sender, "INVALID_STATE", "Answers can only be judged during review");
      return;
    }

    const { answerId, status, bonusPoints, hostNote } = msg.payload;

    // Find the answer across all players
    for (const player of Object.values(this.game.players)) {
      for (const answer of Object.values(player.answers)) {
        if (answer.id === answerId) {
          answer.status = status;
          answer.hostNote = hostNote ?? null;

          if (status === "correct") {
            const round = this.game.rounds[this.game.currentRoundIndex];
            const question = round?.questions[this.game.currentQuestionIndex];
            answer.pointsAwarded = question?.pointValue ?? 100;
          } else if (status === "bonus") {
            answer.bonusPoints = bonusPoints ?? 0;
            answer.pointsAwarded = bonusPoints ?? 0;
          } else {
            answer.pointsAwarded = 0;
          }

          // Save the answer
          await saveAnswer(this.ctx.storage, answer);
          await this.persistGame();
          return;
        }
      }
    }
  }

  private async handleBulkJudge(
    msg: HostBulkJudgeMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.state !== "REVIEWING") {
      this.sendError(sender, "INVALID_STATE", "Answers can only be judged during review");
      return;
    }

    const round = this.game.rounds[this.game.currentRoundIndex];
    const question = round?.questions[this.game.currentQuestionIndex];
    const pointValue = question?.pointValue ?? 100;

    for (const judgment of msg.payload.judgments) {
      for (const player of Object.values(this.game.players)) {
        for (const answer of Object.values(player.answers)) {
          if (answer.id === judgment.answerId) {
            answer.status = judgment.status;
            if (judgment.status === "correct") {
              answer.pointsAwarded = pointValue;
            } else {
              answer.pointsAwarded = 0;
            }
            await saveAnswer(this.ctx.storage, answer);
          }
        }
      }
    }

    await this.persistGame();
  }

  private async handleRevealScores(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.state !== "REVIEWING") {
      this.sendError(sender, "INVALID_STATE", "Scores can only be revealed during review");
      return;
    }

    // Calculate scores from answers
    const previousScores: Record<string, number> = {};
    const previousLeaderboard = computeLeaderboard(this.game);
    const previousRanks: Record<string, number> = {};
    for (const entry of previousLeaderboard) {
      previousScores[entry.playerId] = entry.score;
      previousRanks[entry.playerId] = entry.rank;
    }

    // Award points for all judged answers for the current question
    const round = this.game.rounds[this.game.currentRoundIndex];
    const question = round?.questions[this.game.currentQuestionIndex];
    if (question) {
      for (const player of Object.values(this.game.players)) {
        const answer = player.answers[question.id];
        if (answer && answer.pointsAwarded > 0) {
          player.score += answer.pointsAwarded + answer.bonusPoints;
        }
      }
    }

    // Transition to SCORE_REVEAL
    await this.transitionTo("SCORE_REVEAL");

    // Calculate new leaderboard
    const newLeaderboard = computeLeaderboard(this.game);

    // Build score changes
    const changes: ScoreChange[] = newLeaderboard.map((entry) => ({
      playerId: entry.playerId,
      displayName: entry.displayName,
      previousScore: previousScores[entry.playerId] ?? 0,
      newScore: entry.score,
      pointsEarned: entry.score - (previousScores[entry.playerId] ?? 0),
      previousRank: previousRanks[entry.playerId] ?? entry.rank,
      newRank: entry.rank,
    }));

    // Broadcast scores
    broadcastToAll(this, {
      type: "SCORES_UPDATED",
      payload: { leaderboard: newLeaderboard, changes },
      timestamp: Date.now(),
    });

    // Send individual results to each player
    if (question) {
      for (const player of Object.values(this.game.players)) {
        const answer = player.answers[question.id];
        if (answer) {
          sendToPlayer(this, player.id, {
            type: "YOUR_ANSWER_RESULT",
            payload: {
              questionId: question.id,
              status: answer.status,
              pointsAwarded: answer.pointsAwarded,
              bonusPoints: answer.bonusPoints,
              hostNote: answer.hostNote ?? undefined,
            },
            timestamp: Date.now(),
          });
        }

        // Send updated personal score
        const playerEntry = newLeaderboard.find(
          (e) => e.playerId === player.id,
        );
        if (playerEntry) {
          sendToPlayer(this, player.id, {
            type: "YOUR_SCORE",
            payload: {
              score: playerEntry.score,
              rank: playerEntry.rank,
            },
            timestamp: Date.now(),
          });
        }
      }
    }

    broadcastStateChange(this, this.game);
    await this.persistGame();
  }

  private async handleNextQuestion(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    if (this.game.state !== "SCORE_REVEAL") {
      this.sendError(
        sender,
        "INVALID_STATE",
        "Can only advance to next question from score reveal",
      );
      return;
    }

    const round = this.game.rounds[this.game.currentRoundIndex];
    if (!round) return;

    const hasMoreQuestions =
      this.game.currentQuestionIndex < round.questions.length - 1;

    if (hasMoreQuestions) {
      // Move to next question
      this.game.currentQuestionIndex += 1;

      // Go to QUESTION_DISPLAY
      await this.transitionTo("QUESTION_DISPLAY");
      broadcastStateChange(this, this.game);
      broadcastQuestion(this, this.game);

      // Set alarm for auto-transition to ANSWERING
      await this.ctx.storage.setAlarm(Date.now() + QUESTION_DISPLAY_DELAY);
    } else {
      // Last question in round — go to ROUND_RESULTS
      await this.transitionTo("ROUND_RESULTS");

      const leaderboard = computeLeaderboard(this.game);

      // Find round MVP (most points scored this round)
      let roundMVP: {
        playerId: string;
        displayName: string;
        roundScore: number;
      } | null = null;

      // Calculate round scores by summing answer points for this round
      let maxRoundScore = 0;
      for (const player of Object.values(this.game.players)) {
        let roundScore = 0;
        for (const q of round.questions) {
          const answer = player.answers[q.id];
          if (answer) {
            roundScore += answer.pointsAwarded + answer.bonusPoints;
          }
        }
        if (roundScore > maxRoundScore) {
          maxRoundScore = roundScore;
          roundMVP = {
            playerId: player.id,
            displayName: player.displayName,
            roundScore,
          };
        }
      }

      broadcastToAll(this, {
        type: "ROUND_RESULTS",
        payload: {
          roundIndex: this.game.currentRoundIndex,
          leaderboard,
          roundMVP,
        },
        timestamp: Date.now(),
      });

      broadcastStateChange(this, this.game);
      await this.persistGame();
    }
  }

  private async handleNextRound(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    if (this.game.state !== "ROUND_RESULTS") {
      this.sendError(
        sender,
        "INVALID_STATE",
        "Can only advance to next round from round results",
      );
      return;
    }

    const hasMoreRounds =
      this.game.currentRoundIndex < this.game.rounds.length - 1;

    if (hasMoreRounds) {
      // Move to next round
      this.game.currentRoundIndex += 1;
      this.game.currentQuestionIndex = 0;

      await this.transitionTo("ROUND_INTRO");
      broadcastStateChange(this, this.game);
      await this.persistGame();
    } else {
      // Last round — go to GAME_OVER
      await this.transitionTo("GAME_OVER");

      const finalLeaderboard = computeLeaderboard(this.game);
      const winner = finalLeaderboard.length > 0 ? {
        playerId: finalLeaderboard[0].playerId,
        displayName: finalLeaderboard[0].displayName,
        score: finalLeaderboard[0].score,
      } : null;

      const stats = this.computeGameStats();

      broadcastToAll(this, {
        type: "GAME_OVER",
        payload: {
          finalLeaderboard,
          winner,
          stats,
        },
        timestamp: Date.now(),
      });

      broadcastStateChange(this, this.game);
      await this.persistGame();
    }
  }

  private async handleResetGame(
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    if (this.game.state !== "GAME_OVER") {
      this.sendError(sender, "INVALID_STATE", "Game can only be reset from game over");
      return;
    }

    // Transition GAME_OVER → LOBBY (the transition function handles resetting)
    await this.transitionTo("LOBBY");
    broadcastStateChange(this, this.game);
    await this.persistGame();
  }

  private async handleEndGame(
    _sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    // Skip if already at GAME_OVER or LOBBY
    if (this.game.state === "GAME_OVER" || this.game.state === "LOBBY") return;

    // Cancel any running timer alarm
    await cancelTimer(this.ctx.storage);

    // Force transition to GAME_OVER, bypassing state machine validation
    this.game = transition(this.game, "GAME_OVER");

    const finalLeaderboard = computeLeaderboard(this.game);
    const winner = finalLeaderboard.length > 0 ? {
      playerId: finalLeaderboard[0].playerId,
      displayName: finalLeaderboard[0].displayName,
      score: finalLeaderboard[0].score,
    } : null;

    const stats = this.computeGameStats();

    broadcastToAll(this, {
      type: "GAME_OVER",
      payload: { finalLeaderboard, winner, stats },
      timestamp: Date.now(),
    });

    broadcastStateChange(this, this.game);
    await this.persistGame();
  }

  private async handleKickPlayer(
    msg: HostKickPlayerMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    const { playerId } = msg.payload;
    const player = this.game.players[playerId];
    if (!player) {
      this.sendError(sender, "PLAYER_NOT_FOUND", "Player not found");
      return;
    }

    // Send kicked message to the player before removing
    sendToPlayer(this, playerId, {
      type: "KICKED",
      payload: { reason: "You have been removed from the game by the host" },
      timestamp: Date.now(),
    });

    // Close the player's connection
    for (const conn of this.getConnections<ConnectionState>()) {
      if (conn.state?.playerId === playerId) {
        conn.close(4002, "Kicked by host");
      }
    }

    // Remove the player from the game
    delete this.game.players[playerId];

    // Broadcast player left
    const playerCount = this.getConnectedPlayerCount();
    broadcastToAll(this, {
      type: "PLAYER_LEFT",
      payload: { playerId, playerCount },
      timestamp: Date.now(),
    });

    await this.persistGame();
  }

  private async handleUpdateSettings(
    msg: HostUpdateSettingsMessage,
    _sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    if (this.game.state !== "LOBBY") {
      return; // Settings can only be updated in lobby
    }

    this.game.settings = {
      ...this.game.settings,
      ...msg.payload.settings,
    };

    await this.persistGame();
  }

  // ─── Player Message Handlers ────────────────────────────────────────────────

  private async handlePlayerJoin(
    msg: PlayerJoinMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "No game is currently active" },
        timestamp: Date.now(),
      });
      return;
    }

    if (this.game.state !== "LOBBY") {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "The game has already started" },
        timestamp: Date.now(),
      });
      return;
    }

    // Check player count limit
    const currentPlayerCount = Object.values(this.game.players).filter(
      (p) => p.role === "player",
    ).length;

    if (currentPlayerCount >= this.game.settings.maxPlayers) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "The game is full" },
        timestamp: Date.now(),
      });
      return;
    }

    // R1.2/R1.6: Display name validation — accept full Unicode, reject only empty
    const displayName = msg.payload.displayName.trim();
    if (displayName.length === 0) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "Display name is required" },
        timestamp: Date.now(),
      });
      return;
    }

    // Create the player
    const playerId = nanoid(12);
    const avatarSeed = (msg.payload.avatarSeed || "default").slice(0, 64);
    const player: Player = {
      id: playerId,
      displayName,
      avatarSeed,
      role: "player",
      score: 0,
      isConnected: true,
      joinedAt: Date.now(),
      answers: {},
    };

    this.game.players[playerId] = player;

    // Update connection state with player info
    sender.setState({
      role: "player",
      playerId,
      displayName,
    });

    await this.persistGame();

    // Send join acceptance to the player
    sendToConnection(sender, {
      type: "JOIN_ACCEPTED",
      payload: {
        playerId,
        avatarSeed,
        gameSettings: this.game.settings,
      },
      timestamp: Date.now(),
    });

    // Broadcast player joined to all
    const playerCount = Object.values(this.game.players).filter(
      (p) => p.role === "player",
    ).length;

    broadcastToAll(this, {
      type: "PLAYER_JOINED",
      payload: {
        playerId,
        displayName,
        avatarSeed,
        playerCount,
      },
      timestamp: Date.now(),
    });
  }

  private async handlePlayerRejoin(
    msg: PlayerRejoinMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) return;

    const { playerId } = msg.payload;
    const player = this.game.players[playerId];

    if (!player) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "Player not found" },
        timestamp: Date.now(),
      });
      return;
    }

    // Mark player as reconnected
    player.isConnected = true;

    // Update connection state
    sender.setState({
      role: player.role,
      playerId: player.id,
      displayName: player.displayName,
    });

    await this.persistGame();

    // Send join acceptance
    sendToConnection(sender, {
      type: "JOIN_ACCEPTED",
      payload: {
        playerId: player.id,
        avatarSeed: player.avatarSeed ?? "",
        gameSettings: this.game.settings,
      },
      timestamp: Date.now(),
    });

    // Send current state
    sendToConnection(sender, {
      type: "GAME_STATE_CHANGED",
      payload: {
        gameType: this.game.type,
        state: this.game.state,
        ...(this.game.type === "trivia"
          ? {
              roundIndex: this.game.currentRoundIndex,
              questionIndex: this.game.currentQuestionIndex,
            }
          : {}),
      },
      timestamp: Date.now(),
    });

    // For bingo, resend the reconnecting player's card snapshot
    if (this.game.type === "bingo") {
      const card = this.game.cards[playerId];
      if (card) {
        sendToConnection(sender, {
          type: "BINGO_CARD_ASSIGNED",
          payload: { squares: card.squares, marked: card.marked },
          timestamp: Date.now(),
        });
      }
    }

    // Send current score
    const leaderboard = computeLeaderboard(this.game);
    const entry = leaderboard.find((e) => e.playerId === playerId);
    if (entry) {
      sendToConnection(sender, {
        type: "YOUR_SCORE",
        payload: { score: entry.score, rank: entry.rank },
        timestamp: Date.now(),
      });
    }
  }

  private async handleSubmitAnswer(
    msg: PlayerSubmitAnswerMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.state !== "ANSWERING") {
      return; // Silently ignore answers outside of answering state
    }

    const playerId = sender.state?.playerId;
    if (!playerId) return;

    const player = this.game.players[playerId];
    if (!player) return;

    const { questionId, text } = msg.payload;

    // Verify question matches current question
    const round = this.game.rounds[this.game.currentRoundIndex];
    const question = round?.questions[this.game.currentQuestionIndex];
    if (!question || question.id !== questionId) {
      return; // Wrong question — silently ignore
    }

    // Check for duplicate submission (one answer per question per player)
    if (player.answers[questionId]) {
      return; // Already answered — silently ignore
    }

    // Create the answer
    const answer: Answer = {
      id: nanoid(12),
      questionId,
      playerId,
      text,
      submittedAt: Date.now(),
      fuzzyScore: null,
      status: "pending",
      pointsAwarded: 0,
      bonusPoints: 0,
      hostNote: null,
    };

    // Store the answer
    player.answers[questionId] = answer;
    await saveAnswer(this.ctx.storage, answer);
    await this.persistGame();

    // Notify host of the submission
    const answeredCount = Object.values(this.game.players).filter(
      (p) => p.role === "player" && p.answers[questionId],
    ).length;
    const totalPlayers = Object.values(this.game.players).filter(
      (p) => p.role === "player",
    ).length;

    broadcastToRole(this, "host", {
      type: "ANSWER_SUBMITTED_NOTIFICATION",
      payload: {
        playerId,
        displayName: player.displayName,
        answeredCount,
        totalPlayers,
      },
      timestamp: Date.now(),
    });
  }

  // ─── Audience Message Handlers ──────────────────────────────────────────────

  private async handleAudienceJoin(
    msg: AudienceJoinMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "No game is currently active" },
        timestamp: Date.now(),
      });
      return;
    }

    const allowAudience =
      this.game.type === "trivia" ? this.game.settings.allowAudience : true;
    if (!allowAudience) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "Audience mode is not enabled for this game" },
        timestamp: Date.now(),
      });
      return;
    }

    const displayName = msg.payload.displayName.trim();
    if (displayName.length === 0) {
      sendToConnection(sender, {
        type: "JOIN_REJECTED",
        payload: { reason: "Display name is required" },
        timestamp: Date.now(),
      });
      return;
    }

    const playerId = nanoid(12);
    const audienceMember: Player = {
      id: playerId,
      displayName,
      avatarSeed: "",
      role: "audience",
      score: 0,
      isConnected: true,
      joinedAt: Date.now(),
      answers: {},
    };

    this.game.players[playerId] = audienceMember;

    sender.setState({
      role: "audience",
      playerId,
      displayName,
    });

    await this.persistGame();

    sendToConnection(sender, {
      type: "JOIN_ACCEPTED",
      payload: {
        playerId,
        avatarSeed: "",
        gameSettings: this.game.settings,
      },
      timestamp: Date.now(),
    });
  }

  private async handleAudienceVote(
    msg: AudienceVoteMessage,
    sender: Connection<ConnectionState>,
  ): Promise<void> {
    if (!this.game || this.game.state !== "ANSWERING") return;

    const playerId = sender.state?.playerId;
    if (!playerId) return;

    const player = this.game.players[playerId];
    if (!player || player.role !== "audience") return;

    const { questionId, vote } = msg.payload;

    // Verify question matches current question
    const round = this.game.rounds[this.game.currentRoundIndex];
    const question = round?.questions[this.game.currentQuestionIndex];
    if (!question || question.id !== questionId) return;

    // Check for duplicate vote
    if (player.answers[questionId]) return;

    // Store audience vote as an answer
    const answer: Answer = {
      id: nanoid(12),
      questionId,
      playerId,
      text: vote,
      submittedAt: Date.now(),
      fuzzyScore: null,
      status: "pending",
      pointsAwarded: 0,
      bonusPoints: 0,
      hostNote: null,
    };

    player.answers[questionId] = answer;
    await this.persistGame();
  }

  // ─── Helper Methods ──────────────────────────────────────────────────────────

  /** Validate a token against the AuthGate DO */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Use the AuthGate DO binding to validate the token
      const authId = this.env.AuthGate.idFromName("global");
      const authStub = this.env.AuthGate.get(authId);
      const response = await authStub.fetch(
        new Request(`https://auth/parties/${PARTY_AUTH_GATE}/global?token=${encodeURIComponent(token)}`),
      );
      if (!response.ok) return false;
      const data = (await response.json()) as { valid: boolean };
      return data.valid === true;
    } catch {
      // If we can't reach auth gate, check if token matches game's stored token
      if (this.game && this.game.hostToken === token) {
        return true;
      }
      return false;
    }
  }

  /** Transition the game to a new state with side effects */
  private async transitionTo(targetState: Game["state"]): Promise<boolean> {
    if (!this.game) return false;

    const result = validateTransition(this.game, targetState);
    if (!result.success) {
      return false;
    }

    this.game = transition(this.game, targetState);
    await this.persistGame();
    return true;
  }

  /** Persist the current game state to storage */
  async persistGame(): Promise<void> {
    if (this.game) {
      await saveGame(this.ctx.storage, this.game);
    }
  }

  /** Send an error message to a specific connection */
  sendError(
    conn: Connection<ConnectionState>,
    code: string,
    message: string,
  ): void {
    sendToConnection(conn, {
      type: "ERROR",
      payload: { code, message },
      timestamp: Date.now(),
    });
  }

  /** Get the count of currently connected players */
  private getConnectedPlayerCount(): number {
    if (!this.game) return 0;
    return Object.values(this.game.players).filter(
      (p) => p.role === "player" && p.isConnected,
    ).length;
  }

  /** Run fuzzy matching on all answers for the current question and send to host */
  private async runFuzzyMatchingAndNotifyHost(): Promise<void> {
    if (!this.game || this.game.type !== "trivia") return;

    const round = this.game.rounds[this.game.currentRoundIndex];
    const question = round?.questions[this.game.currentQuestionIndex];
    if (!question) return;

    // Collect all player answers for this question
    const answers: Answer[] = [];
    for (const player of Object.values(this.game.players)) {
      if (player.role === "player") {
        const answer = player.answers[question.id];
        if (answer) {
          answers.push(answer);
        }
      }
    }

    // Run fuzzy matching
    const reviews: AnswerReview[] = batchMatch(
      answers,
      question,
      this.game.players,
    );

    // Update answers with fuzzy scores
    for (const review of reviews) {
      const player = this.game.players[review.playerId];
      if (player) {
        const answer = player.answers[question.id];
        if (answer) {
          answer.fuzzyScore = review.fuzzyScore;
          // Auto-accept/reject based on fuzzy classification
          if (review.suggestedStatus === "correct") {
            answer.status = "correct";
            answer.pointsAwarded = question.pointValue;
          } else if (review.suggestedStatus === "incorrect") {
            answer.status = "incorrect";
            answer.pointsAwarded = 0;
          }
          // "needs_review" answers stay "pending" for host to decide
        }
      }
    }

    await this.persistGame();

    // Send review data to host
    broadcastToRole(this, "host", {
      type: "ANSWERS_FOR_REVIEW",
      payload: { answers: reviews },
      timestamp: Date.now(),
    });
  }

  /** Compute game statistics for the game over screen */
  private computeGameStats(): GameStats {
    if (!this.game || this.game.type !== "trivia") {
      return {
        totalQuestions: 0,
        totalAnswers: 0,
        averageScore: 0,
        fastestAnswer: null,
        mostBonusPoints: null,
      };
    }

    let totalQuestions = 0;
    for (const round of this.game.rounds) {
      totalQuestions += round.questions.length;
    }

    let totalAnswers = 0;
    let fastestAnswer: GameStats["fastestAnswer"] = null;
    let fastestTime = Infinity;
    const bonusTotals: Record<
      string,
      { playerId: string; displayName: string; bonusTotal: number }
    > = {};

    const players = Object.values(this.game.players).filter(
      (p) => p.role === "player",
    );

    for (const player of players) {
      let playerBonusTotal = 0;

      for (const answer of Object.values(player.answers)) {
        totalAnswers++;

        // Find the question to compute response time
        for (const round of this.game.rounds) {
          for (const question of round.questions) {
            if (question.id === answer.questionId) {
              // We don't have exact question start time stored, but we can
              // use submittedAt relative ordering to find the fastest
              const answerTimeMs = answer.submittedAt - this.game.createdAt;
              if (answerTimeMs < fastestTime && answer.status === "correct") {
                fastestTime = answerTimeMs;
                fastestAnswer = {
                  playerId: player.id,
                  displayName: player.displayName,
                  timeMs: answerTimeMs,
                };
              }
            }
          }
        }

        playerBonusTotal += answer.bonusPoints;
      }

      bonusTotals[player.id] = {
        playerId: player.id,
        displayName: player.displayName,
        bonusTotal: playerBonusTotal,
      };
    }

    // Find most bonus points
    let mostBonusPoints: GameStats["mostBonusPoints"] = null;
    let maxBonus = 0;
    for (const entry of Object.values(bonusTotals)) {
      if (entry.bonusTotal > maxBonus) {
        maxBonus = entry.bonusTotal;
        mostBonusPoints = entry;
      }
    }

    const averageScore =
      players.length > 0
        ? players.reduce((sum, p) => sum + p.score, 0) / players.length
        : 0;

    return {
      totalQuestions,
      totalAnswers,
      averageScore,
      fastestAnswer: fastestTime === Infinity ? null : fastestAnswer,
      mostBonusPoints: maxBonus > 0 ? mostBonusPoints : null,
    };
  }
}
