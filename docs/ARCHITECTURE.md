# JaneDeck — Architecture Document

> A real-time multiplayer trivia game platform inspired by Jackbox Games, built with PartyKit.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Choices](#2-technology-choices)
3. [PartyKit Room Design](#3-partykit-room-design)
4. [Data Models](#4-data-models)
5. [Game State Machine](#5-game-state-machine)
6. [WebSocket Message Protocol](#6-websocket-message-protocol)
7. [Authentication Flow](#7-authentication-flow)
8. [Fuzzy Matching Strategy](#8-fuzzy-matching-strategy)
9. [Component Hierarchy](#9-component-hierarchy)
10. [Animation Strategy](#10-animation-strategy)
11. [Project File Structure](#11-project-file-structure)
12. [Deployment & Scaling](#12-deployment--scaling)

---

## 1. System Overview

JaneDeck is a party trivia game where a host controls a game from a private dashboard, a shared screen shows questions and scores to the room, and players answer on their own devices. An optional audience mode lets spectators participate for bonus points.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PartyKit Server                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              GameRoom Party - room ID = game code             │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ Game State  │  │ Round State  │  │ Player Registry     │  │  │
│  │  │ Machine     │  │ Manager      │  │ + Score Tracker     │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │  │
│  │  │ Answer      │  │ Fuzzy Match  │  │ KV Storage          │  │  │
│  │  │ Collector   │  │ Engine       │  │ - persistence layer │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │           WebSocket Connection Manager                  │  │  │
│  │  │  Tagged connections: host | presentation | player | aud │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │           AuthGate Party - single global instance             │  │
│  │  Validates host password via onRequest before game creation   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │              │              │              │
     WebSocket      WebSocket      WebSocket      WebSocket
          │              │              │              │
    ┌─────┴─────┐  ┌─────┴──────┐ ┌────┴─────┐  ┌────┴──────┐
    │ Host View │  │Presentation│ │ Player   │  │ Audience  │
    │ - private │  │   View     │ │ View     │  │ View      │
    │ - control │  │ - shared   │ │ - mobile │  │ - spectate│
    │   panel   │  │   screen   │ │ - answer │  │ - vote    │
    └───────────┘  └────────────┘ └──────────┘  └───────────┘
```

### Request Flow Summary

```
┌──────────┐    POST /auth     ┌───────────┐
│  Host    │──────────────────>│ AuthGate  │
│  Browser │<──────────────────│ Party     │
└──────────┘   {token}         └───────────┘
     │
     │  WS connect with token + role=host
     v
┌───────────────────────────────────────────┐
│         GameRoom Party                     │
│  onBeforeConnect: validate token + role    │
│  onConnect: register tagged connection     │
│  onMessage: route by message type + role   │
└───────────────────────────────────────────┘
     ^         ^              ^
     │         │              │
  WS+role   WS+role       WS+role
  =present  =player       =audience
     │         │              │
┌────┴───┐ ┌───┴────┐  ┌─────┴─────┐
│Present.│ │Player  │  │ Audience  │
│ View   │ │ View   │  │ View      │
└────────┘ └────────┘  └───────────┘
```

---

## 2. Technology Choices

| Technology | Role | Rationale |
|---|---|---|
| **PartyKit** | Real-time server + WebSocket management | Purpose-built for multiplayer rooms. Each game is a Durable Object with isolated state, built-in storage, and WebSocket management. No need to manage connection pools or pub/sub infrastructure. |
| **React 19** | UI framework | Component model maps cleanly to the four views. Hooks for WebSocket state management. Large ecosystem. |
| **Vite** | Build tooling | Fast HMR for development, optimized builds, native TypeScript support. First-class PartyKit integration. |
| **TypeScript** | Language | End-to-end type safety for message protocols between server and client. Shared types between PartyKit server and React client. |
| **Framer Motion** | Animation library | Declarative animation API that works naturally with React. `AnimatePresence` for mount/unmount transitions. Layout animations for score reordering. |
| **Fuse.js** | Fuzzy matching | Lightweight, zero-dependency fuzzy search. Configurable threshold. Runs server-side in PartyKit for consistent matching. |
| **Zustand** | Client state management | Lightweight store that pairs well with WebSocket-driven state. No boilerplate. Easy to sync server state into local store. |
| **PartySocket** | WebSocket client | PartyKit's official client with auto-reconnect, room routing, and typed message support. |
| **Zod** | Schema validation | Runtime validation of WebSocket messages on both server and client. Shared schemas ensure protocol compliance. |
| **nanoid** | ID generation | Compact, URL-safe unique IDs for game codes, player IDs, and answer IDs. |

---

## 3. PartyKit Room Design

### Party Types

JaneDeck uses two party types defined in `partykit.json`:

```jsonc
{
  "name": "janedeck",
  "main": "src/server/gameRoom.ts",
  "parties": {
    "auth": "src/server/authGate.ts"
  },
  "compatibilityDate": "2024-09-01"
}
```

### 3.1 AuthGate Party

A singleton party (`room id = "global"`) that handles host authentication.

- **Purpose**: Validate the admin password and issue short-lived session tokens.
- **API**: Exposes an `onRequest` handler for `POST /parties/auth/global` with `{ password }` body.
- **Storage**: Stores the hashed admin password. The password is set via environment variable `JANEDECK_ADMIN_PASSWORD` and hashed on first `onStart`.
- **Token format**: A `nanoid`-generated opaque token stored in PartyKit storage with a TTL. The token is scoped to a single game creation session.
- **No WebSocket connections**: This party only handles HTTP requests.

### 3.2 GameRoom Party (Main)

One instance per game. The room ID **is** the game code (a 4-character alphanumeric string like `ABCD`).

- **Purpose**: Manages the entire lifecycle of a single trivia game.
- **Storage**: Uses PartyKit's built-in key-value storage to persist:
  - Game configuration (rounds, questions, point values)
  - Player registry
  - Answer submissions
  - Score history
  - Game state
- **Connections**: All four view types connect to the same room, differentiated by a `role` tag on the connection.

#### Connection Tagging

PartyKit connections support arbitrary state via `connection.setState()`. Each connection is tagged with:

```typescript
interface ConnectionState {
  role: "host" | "presentation" | "player" | "audience";
  playerId?: string;     // for player/audience connections
  displayName?: string;  // the player's chosen name — R1.4: this is always the chosen name
}
```

This allows targeted broadcasting:

- **Host-only messages**: Iterate connections, send only where `role === "host"`.
- **Presentation messages**: Send to `role === "presentation"`.
- **Player-specific messages**: Send to the connection matching a `playerId`.
- **Broadcast to all**: Use `this.party.broadcast()`.

#### Hibernation Support

The GameRoom server implements hibernation-compatible patterns:

- All event handlers (`onMessage`, `onClose`) are class methods, not closures attached in `onConnect`.
- Game state is loaded from storage in `onStart` and written back on every mutation.
- The `onAlarm` handler is used for round timers instead of `setTimeout` (which doesn't survive hibernation).

---

## 4. Data Models

All models are defined as TypeScript types with corresponding Zod schemas for runtime validation.

### 4.1 Entity Relationship Diagram

```
┌──────────────────┐
│      Game         │
│──────────────────│
│ id: string        │ ◄── this is the room ID / game code
│ hostToken: string │
│ state: GameState  │
│ settings          │
│ createdAt         │
└──────┬───────────┘
       │ 1:N
       ▼
┌──────────────────┐       ┌──────────────────┐
│     Round         │       │     Player        │
│──────────────────│       │──────────────────│
│ id: string        │       │ id: string        │
│ index: number     │       │ displayName       │
│ title: string     │       │ role: player|aud  │
│ state: RoundState │       │ score: number     │
│ questions[]       │       │ isConnected       │
└──────┬───────────┘       │ joinedAt          │
       │ 1:N                └──────┬───────────┘
       ▼                           │
┌──────────────────┐               │
│    Question       │               │
│──────────────────│               │
│ id: string        │               │
│ text: string      │               │
│ correctAnswer     │               │
│ pointValue        │               │
│ timeLimit         │               │
│ type              │               │
└──────┬───────────┘               │
       │                           │
       │         1:N per question  │
       ▼              per player   │
┌──────────────────────────────────┴──┐
│            Answer                    │
│─────────────────────────────────────│
│ id: string                           │
│ questionId: string                   │
│ playerId: string                     │
│ text: string                         │
│ submittedAt: number                  │
│ fuzzyScore: number | null            │
│ status: pending|correct|incorrect    │
│ bonusPoints: number                  │
│ hostNote: string | null              │
└─────────────────────────────────────┘
```

### 4.2 Type Definitions

```typescript
// === Game ===
interface Game {
  id: string;                    // 4-char alphanumeric game code
  hostToken: string;             // opaque token identifying the host session
  state: GameState;              // current state machine state
  currentRoundIndex: number;     // index into rounds[]
  currentQuestionIndex: number;  // index into current round's questions[]
  rounds: Round[];
  players: Map<string, Player>;  // keyed by player ID
  settings: GameSettings;
  createdAt: number;             // unix timestamp ms
}

interface GameSettings {
  maxPlayers: number;            // default: 16
  allowAudience: boolean;        // default: true
  audienceBonusPoints: number;   // points audience can earn per question
  defaultTimeLimit: number;      // seconds, default: 30
  showAnswersToPlayers: boolean; // after review, show correct answer
}

// === Round ===
interface Round {
  id: string;
  index: number;
  title: string;                 // e.g., "General Knowledge"
  questions: Question[];
  state: RoundState;
}

// === Question ===
type QuestionType = "text" | "multiple-choice" | "true-false";

interface Question {
  id: string;
  text: string;
  correctAnswer: string;
  acceptableAnswers?: string[];  // additional correct answers for fuzzy match
  pointValue: number;            // default: 100
  timeLimit: number;             // seconds, overrides game default
  type: QuestionType;
  choices?: string[];            // for multiple-choice type
  mediaUrl?: string;             // optional image/audio URL
}

// === Player ===
// R1.4: displayName is always the chosen name.
// R2.3: No gender collection — not needed for game mechanics.
interface Player {
  id: string;                    // nanoid
  displayName: string;           // chosen by player on join — R1.2: Unicode-safe, max 256 bytes
  role: "player" | "audience";
  score: number;
  isConnected: boolean;
  joinedAt: number;
  answers: Map<string, Answer>;  // keyed by question ID
}

// === Answer ===
type AnswerStatus = "pending" | "correct" | "incorrect" | "bonus";

interface Answer {
  id: string;
  questionId: string;
  playerId: string;
  text: string;
  submittedAt: number;
  fuzzyScore: number | null;     // 0.0–1.0, null if not yet scored
  status: AnswerStatus;
  pointsAwarded: number;        // base points + bonus
  bonusPoints: number;           // extra points awarded by host
  hostNote: string | null;       // host can add a note for funny answers
}
```

### 4.3 Storage Schema

PartyKit storage is a flat key-value store. Keys are structured as path-like strings:

| Key Pattern | Value Type | Description |
|---|---|---|
| `game:meta` | `Game` (without players/rounds) | Core game metadata and settings |
| `game:state` | `GameState` | Current state machine state |
| `round:{roundId}` | `Round` | Round configuration and questions |
| `player:{playerId}` | `Player` | Player profile and score |
| `answer:{questionId}:{playerId}` | `Answer` | Individual answer submission |
| `scores:leaderboard` | `ScoreEntry[]` | Sorted leaderboard cache |
| `host:token` | `string` | The valid host token for this game |

Storage writes are batched using `this.party.storage.transaction()` when multiple keys need atomic updates (e.g., scoring all answers for a question).

---

## 5. Game State Machine

The game progresses through a strict state machine. Only the host can trigger transitions (except `ANSWER_SUBMITTED` which is player-initiated).

### State Diagram

```
                    ┌─────────────┐
        ┌──────────>│   LOBBY     │ Players join
        │           └──────┬──────┘
        │                  │ host: START_GAME
        │                  ▼
        │           ┌─────────────┐
        │     ┌────>│ ROUND_INTRO │ Show round title + info
        │     │     └──────┬──────┘
        │     │            │ host: START_QUESTION
        │     │            ▼
        │     │     ┌─────────────────┐
        │     │     │ QUESTION_DISPLAY│ Show question, start timer
        │     │     └──────┬──────────┘
        │     │            │ auto: after brief display delay
        │     │            ▼
        │     │     ┌─────────────────┐
        │     │     │  ANSWERING      │ Players submit answers
        │     │     │  - timer active │ Timer countdown visible
        │     │     └──────┬──────────┘
        │     │            │ timer expires OR host: CLOSE_ANSWERS
        │     │            ▼
        │     │     ┌─────────────────┐
        │     │     │  REVIEWING      │ Host reviews answers
        │     │     │  - fuzzy match  │ Fuzzy suggestions shown
        │     │     │  - manual judge │ Accept/reject/bonus
        │     │     └──────┬──────────┘
        │     │            │ host: REVEAL_SCORES
        │     │            ▼
        │     │     ┌─────────────────┐
        │     │     │ SCORE_REVEAL    │ Animated score update
        │     │     └──────┬──────────┘
        │     │            │ host: NEXT_QUESTION or NEXT_ROUND
        │     │            │
        │     │     ┌──────┴──────────────────────────────────┐
        │     │     │                                          │
        │     │     ▼ more questions                           ▼ last question
        │     │  back to QUESTION_DISPLAY              ┌──────────────┐
        │     │                                        │ ROUND_RESULTS│
        │     │                                        └──────┬───────┘
        │     │                                               │
        │     │     ┌──────┴──────────────────────────────┐   │
        │     │     │                                      │   │
        │     │     ▼ more rounds                          ▼   │ last round
        │     └── back to ROUND_INTRO               ┌─────────┴──┐
        │                                           │ GAME_OVER   │
        │                                           │ - final rank│
        │                                           │ - fanfare   │
        │                                           └──────┬──────┘
        │                                                  │ host: RESET_GAME
        └──────────────────────────────────────────────────┘
```

### State Enum

```typescript
type GameState =
  | "LOBBY"
  | "ROUND_INTRO"
  | "QUESTION_DISPLAY"
  | "ANSWERING"
  | "REVIEWING"
  | "SCORE_REVEAL"
  | "ROUND_RESULTS"
  | "GAME_OVER";
```

### Transition Rules

| From | To | Trigger | Side Effects |
|---|---|---|---|
| `LOBBY` | `ROUND_INTRO` | Host sends `START_GAME` | Lock player joins (optional), set `currentRoundIndex = 0` |
| `ROUND_INTRO` | `QUESTION_DISPLAY` | Host sends `START_QUESTION` | Set `currentQuestionIndex`, broadcast question text |
| `QUESTION_DISPLAY` | `ANSWERING` | Auto after 3s display delay | Start alarm for `timeLimit` seconds |
| `ANSWERING` | `REVIEWING` | Alarm fires OR host sends `CLOSE_ANSWERS` | Cancel alarm if early, run fuzzy matching on all answers |
| `REVIEWING` | `SCORE_REVEAL` | Host sends `REVEAL_SCORES` | Persist awarded points, update leaderboard |
| `SCORE_REVEAL` | `QUESTION_DISPLAY` | Host sends `NEXT_QUESTION` (more questions remain) | Increment `currentQuestionIndex` |
| `SCORE_REVEAL` | `ROUND_RESULTS` | Host sends `NEXT_QUESTION` (last question in round) | Calculate round summary |
| `ROUND_RESULTS` | `ROUND_INTRO` | Host sends `NEXT_ROUND` (more rounds remain) | Increment `currentRoundIndex`, reset question index |
| `ROUND_RESULTS` | `GAME_OVER` | Host sends `NEXT_ROUND` (last round) | Calculate final rankings |
| `GAME_OVER` | `LOBBY` | Host sends `RESET_GAME` | Clear answers, reset scores, keep players |

### Timer Implementation

Timers use PartyKit's `onAlarm` API instead of `setTimeout` (survives hibernation):

```typescript
// When entering ANSWERING state:
const question = getCurrentQuestion();
await this.party.storage.setAlarm(
  Date.now() + question.timeLimit * 1000
);

// In onAlarm handler:
async onAlarm() {
  if (this.gameState === "ANSWERING") {
    await this.transitionTo("REVIEWING");
  }
}
```

The countdown timer value is broadcast to clients every second via a separate alarm chain during the `ANSWERING` state. Clients also run a local timer for smooth display, synced by the server's authoritative time-remaining broadcasts.

---

## 6. WebSocket Message Protocol

All messages are JSON-encoded with a discriminated union on the `type` field. Messages are validated with Zod schemas on both ends.

### 6.1 Message Envelope

```typescript
// Client → Server
interface ClientMessage {
  type: string;
  payload: Record<string, unknown>;
}

// Server → Client
interface ServerMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;  // server timestamp for ordering
}
```

### 6.2 Client → Server Messages

#### Host Messages

| Type | Payload | Description |
|---|---|---|
| `HOST_CREATE_GAME` | `{ token, settings, rounds }` | Create a new game with rounds and questions |
| `HOST_START_GAME` | `{}` | Transition from LOBBY to ROUND_INTRO |
| `HOST_START_QUESTION` | `{}` | Show next question and begin answering |
| `HOST_CLOSE_ANSWERS` | `{}` | Manually close answering early |
| `HOST_JUDGE_ANSWER` | `{ answerId, status, bonusPoints?, hostNote? }` | Accept, reject, or award bonus for an answer |
| `HOST_BULK_JUDGE` | `{ judgments: Array<{ answerId, status }> }` | Accept/reject multiple fuzzy-matched answers at once |
| `HOST_REVEAL_SCORES` | `{}` | Transition to score reveal |
| `HOST_NEXT_QUESTION` | `{}` | Advance to next question or round results |
| `HOST_NEXT_ROUND` | `{}` | Advance to next round or game over |
| `HOST_RESET_GAME` | `{}` | Reset game back to lobby |
| `HOST_KICK_PLAYER` | `{ playerId }` | Remove a player from the game |
| `HOST_UPDATE_SETTINGS` | `{ settings: Partial<GameSettings> }` | Update game settings during lobby |

#### Player Messages

| Type | Payload | Description |
|---|---|---|
| `PLAYER_JOIN` | `{ displayName }` | Join the game as a player |
| `PLAYER_SUBMIT_ANSWER` | `{ questionId, text }` | Submit an answer to the current question |
| `PLAYER_BUZZER` | `{ questionId }` | Optional: buzz in for speed bonus |

#### Audience Messages

| Type | Payload | Description |
|---|---|---|
| `AUDIENCE_JOIN` | `{ displayName }` | Join as an audience member |
| `AUDIENCE_VOTE` | `{ questionId, vote }` | Vote on what they think the correct answer is |

#### Presentation Messages

| Type | Payload | Description |
|---|---|---|
| `PRESENTATION_CONNECT` | `{ token }` | Connect as the shared screen view |

### 6.3 Server → Client Messages

#### Broadcast Messages (sent to all connections)

| Type | Payload | Sent During |
|---|---|---|
| `GAME_STATE_CHANGED` | `{ state, roundIndex?, questionIndex? }` | Any state transition |
| `PLAYER_JOINED` | `{ playerId, displayName, playerCount }` | LOBBY |
| `PLAYER_LEFT` | `{ playerId, playerCount }` | Any state |
| `TIMER_TICK` | `{ secondsRemaining }` | ANSWERING |
| `TIMER_EXPIRED` | `{}` | ANSWERING → REVIEWING |
| `SCORES_UPDATED` | `{ leaderboard: ScoreEntry[], changes: ScoreChange[] }` | SCORE_REVEAL |
| `ROUND_RESULTS` | `{ roundIndex, leaderboard, roundMVP }` | ROUND_RESULTS |
| `GAME_OVER` | `{ finalLeaderboard, winner, stats }` | GAME_OVER |

#### Question Display Messages

| Type | Sent To | Payload |
|---|---|---|
| `QUESTION_SHOW` | presentation, players, audience | `{ questionId, text, type, choices?, pointValue, timeLimit, questionNumber, totalQuestions }` |
| `QUESTION_SHOW_FULL` | host | Same as above plus `{ correctAnswer, acceptableAnswers }` |

#### Host-Only Messages

| Type | Payload | Description |
|---|---|---|
| `ANSWERS_FOR_REVIEW` | `{ answers: AnswerReview[] }` | All submitted answers with fuzzy scores |
| `ANSWER_SUBMITTED_NOTIFICATION` | `{ playerId, displayName, answeredCount, totalPlayers }` | Real-time notification as answers arrive |
| `GAME_CREATED` | `{ gameCode }` | Confirms game creation |

#### Player-Specific Messages (sent to individual player connection)

| Type | Payload | Description |
|---|---|---|
| `JOIN_ACCEPTED` | `{ playerId, gameSettings }` | Confirms successful join |
| `JOIN_REJECTED` | `{ reason }` | Rejection with reason |
| `YOUR_ANSWER_RESULT` | `{ questionId, status, pointsAwarded, bonusPoints, hostNote? }` | After scoring, tell the player their result |
| `YOUR_SCORE` | `{ score, rank }` | Updated personal score and rank |
| `KICKED` | `{ reason }` | Player was removed by host |

#### Answer Review Model (host-only)

```typescript
interface AnswerReview {
  answerId: string;
  playerId: string;
  displayName: string;
  text: string;
  fuzzyScore: number;          // 0.0 to 1.0 match against correctAnswer
  fuzzyMatchedAgainst: string; // which correct answer it matched
  suggestedStatus: "correct" | "incorrect" | "needs_review";
  submittedAt: number;
}
```

### 6.4 Message Flow Example — One Question Cycle

```
Host                    Server                 Presentation        Players
  │                       │                       │                  │
  │ HOST_START_QUESTION   │                       │                  │
  │──────────────────────>│                       │                  │
  │                       │   GAME_STATE_CHANGED  │                  │
  │                       │──────────────────────>│                  │
  │                       │──────────────────────────────────────────>│
  │   QUESTION_SHOW_FULL  │                       │                  │
  │<──────────────────────│   QUESTION_SHOW       │                  │
  │                       │──────────────────────>│                  │
  │                       │──────────────────────────────────────────>│
  │                       │                       │                  │
  │                       │  [3 second display delay, then alarm]    │
  │                       │                       │                  │
  │                       │   TIMER_TICK          │                  │
  │                       │──────────────────────>│                  │
  │                       │──────────────────────────────────────────>│
  │                       │                       │                  │
  │                       │         PLAYER_SUBMIT_ANSWER             │
  │                       │<─────────────────────────────────────────│
  │ ANSWER_SUBMITTED_NOTF │                       │                  │
  │<──────────────────────│                       │                  │
  │                       │                       │                  │
  │                       │  [alarm fires - timer expired]           │
  │                       │                       │                  │
  │                       │   TIMER_EXPIRED       │                  │
  │<──────────────────────│──────────────────────>│                  │
  │                       │──────────────────────────────────────────>│
  │   ANSWERS_FOR_REVIEW  │                       │                  │
  │<──────────────────────│                       │                  │
  │                       │                       │                  │
  │ HOST_JUDGE_ANSWER     │                       │                  │
  │──────────────────────>│                       │                  │
  │ HOST_BULK_JUDGE       │                       │                  │
  │──────────────────────>│                       │                  │
  │                       │                       │                  │
  │ HOST_REVEAL_SCORES    │                       │                  │
  │──────────────────────>│                       │                  │
  │                       │   SCORES_UPDATED      │                  │
  │<──────────────────────│──────────────────────>│                  │
  │                       │──────────────────────────────────────────>│
  │                       │                       │  YOUR_ANSWER_RESULT
  │                       │──────────────────────────────────────────>│
```

---

## 7. Authentication Flow

### 7.1 Host Authentication

The host password is a single shared secret (environment variable `JANEDECK_ADMIN_PASSWORD`). It gates **game creation**, not just connection.

```
┌──────────┐                    ┌──────────────┐
│  Host    │   1. POST /auth    │  AuthGate    │
│  Client  │───────────────────>│  Party       │
│          │   {password}       │  room=global │
│          │                    │              │
│          │   2. 200 OK        │  - bcrypt    │
│          │<───────────────────│    compare   │
│          │   {token, exp}     │  - generate  │
│          │                    │    token     │
│          │                    │  - store in  │
│          │                    │    KV + TTL  │
└────┬─────┘                    └──────────────┘
     │
     │  3. WS connect to GameRoom
     │     room = new game code
     │     query: ?token=xxx&role=host
     │
     ▼
┌──────────────────────────────────────────┐
│  GameRoom Party                           │
│                                           │
│  onBeforeConnect:                         │
│    - if role=host:                        │
│        fetch AuthGate to validate token   │
│        reject if invalid/expired          │
│    - if role=player/audience:             │
│        allow if game is in LOBBY state    │
│    - if role=presentation:                │
│        validate token matches game host   │
│                                           │
│  onConnect:                               │
│    - tag connection with role             │
│    - send initial state snapshot          │
└──────────────────────────────────────────┘
```

### 7.2 Token Validation

```typescript
// In AuthGate party:
async onRequest(req: Party.Request) {
  if (req.method === "POST") {
    const { password } = await req.json();
    const storedHash = await this.party.storage.get("passwordHash");
    
    if (await bcryptVerify(password, storedHash)) {
      const token = nanoid(32);
      await this.party.storage.put(`token:${token}`, {
        createdAt: Date.now(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
      });
      return Response.json({ token, expiresAt: ... });
    }
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }
  
  // GET for token validation by GameRoom
  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token");
    const data = await this.party.storage.get(`token:${token}`);
    if (data && data.expiresAt > Date.now()) {
      return Response.json({ valid: true });
    }
    return Response.json({ valid: false }, { status: 401 });
  }
}
```

### 7.3 Player Join Flow

Players join with no authentication — only a display name and the game code:

1. Player navigates to `/{gameCode}` or enters code on the home page.
2. Client prompts for display name (R1.2: Unicode-safe, 1–256 bytes, no format validation per R1.6).
3. Client opens WebSocket to the GameRoom with `?role=player`.
4. Client sends `PLAYER_JOIN` message with `{ displayName }`.
5. Server validates: game exists, game in LOBBY state, player count under max.
6. Server responds with `JOIN_ACCEPTED` or `JOIN_REJECTED`.

### 7.4 Reconnection

PartySocket handles auto-reconnect. On reconnect:

- **Host/Presentation**: Validated by token. Full state snapshot re-sent.
- **Players**: Identified by a `playerId` stored in `sessionStorage`. On reconnect, the player sends `PLAYER_REJOIN` with their `playerId`. Server matches and re-tags the connection.
- **Audience**: Treated as new connections on reconnect (no persistent identity needed).

---

## 8. Fuzzy Matching Strategy

### 8.1 Library: Fuse.js

Fuse.js runs **server-side** in the GameRoom party to ensure consistent, authoritative scoring.

### 8.2 Configuration

```typescript
const fuseOptions: Fuse.IFuseOptions<string> = {
  includeScore: true,
  threshold: 0.4,          // 0.0 = perfect match, 1.0 = match anything
  distance: 100,
  minMatchCharLength: 2,
  shouldSort: true,
};
```

### 8.3 Matching Pipeline

When the game transitions from `ANSWERING` → `REVIEWING`:

```
For each submitted answer:
  1. Normalize: lowercase, trim whitespace, strip punctuation
  2. Build Fuse index from: [correctAnswer, ...acceptableAnswers]
  3. Search the player's normalized answer against the index
  4. Capture the best fuzzyScore (0.0 = perfect, inverted for display)
  5. Apply classification thresholds:

     fuzzyScore <= 0.2  →  suggestedStatus: "correct"     (auto-accept)
     fuzzyScore <= 0.4  →  suggestedStatus: "needs_review" (host reviews)
     fuzzyScore > 0.4   →  suggestedStatus: "incorrect"    (auto-reject)

  6. Package as AnswerReview and send to host
```

### 8.4 Host Review UX

The host sees answers grouped by suggestion:

1. **Auto-accepted** (green): High-confidence matches. Host can override to reject.
2. **Needs review** (yellow): Fuzzy matches that need human judgment. Host accepts or rejects.
3. **Auto-rejected** (red): Low match scores. Host can override to accept or award bonus.
4. **Bonus-worthy** (star): Host can flag any answer for bonus points (creative, funny, etc.).

The host can also use `HOST_BULK_JUDGE` to accept/reject all auto-suggested answers at once, then manually review only the yellow "needs review" bucket.

### 8.5 Additional Normalizations

Before fuzzy matching, answers go through:

- Trim and collapse whitespace
- Lowercase
- Strip leading articles ("the", "a", "an") for proper nouns
- Normalize Unicode (NFC form)
- Expand common abbreviations (configurable per game)
- Strip punctuation except hyphens within words

---

## 9. Component Hierarchy

### 9.1 Routing Strategy

The app uses a single React SPA with client-side routing (React Router):

```
/                         → Landing page (enter game code or host)
/host                     → Host login (password entry)
/host/create              → Game creation (rounds, questions)
/host/:gameCode           → Host control panel (live game)
/play/:gameCode           → Player join + play view
/present/:gameCode        → Presentation/shared screen view
/audience/:gameCode       → Audience spectator view
```

### 9.2 Shared Components

```
App
├── ConnectionProvider          # PartySocket context provider
│   ├── GameStateProvider       # Synced game state from server
│   └── Router
│       ├── LandingPage
│       ├── HostRoutes
│       ├── PlayerRoutes
│       ├── PresentationRoutes
│       └── AudienceRoutes
│
├── Shared UI Components
│   ├── Timer                   # Animated countdown ring
│   ├── Leaderboard             # Animated score list with Framer layout
│   ├── QuestionCard            # Question display with type variants
│   ├── GameCode                # Large display of join code
│   ├── PlayerAvatar            # Color-coded player indicator
│   ├── AnimatedScore           # Counting-up number animation
│   └── StatusBadge             # Game state indicator
```

### 9.3 Host View Components

```
HostView
├── HostLogin                    # Password form
├── GameCreator                  # Round/question builder
│   ├── RoundEditor              # Add/edit/reorder rounds
│   │   └── QuestionEditor       # Add/edit questions within a round
│   │       ├── AnswerInput      # Correct answer + acceptable alternatives
│   │       ├── PointValueInput  # Point value selector
│   │       └── TimeLimitInput   # Per-question timer override
│   └── GameSettingsPanel        # Max players, audience mode, defaults
│
├── HostDashboard                # Live game control panel
│   ├── GameControls             # Start, next, close answers, reveal
│   │   ├── StateIndicator       # Current state badge
│   │   └── ActionButtons        # Context-sensitive action buttons
│   ├── PlayerList               # Connected players with kick option
│   ├── AnswerReviewPanel        # Answer review during REVIEWING state
│   │   ├── AnswerGroup          # Grouped by auto-accept/review/reject
│   │   │   └── AnswerCard       # Individual answer with judge controls
│   │   │       ├── FuzzyBadge   # Visual fuzzy match indicator
│   │   │       ├── JudgeButtons # Accept / Reject / Bonus
│   │   │       └── BonusInput   # Bonus points + host note
│   │   └── BulkActions          # Accept all auto, reject all auto
│   ├── MiniLeaderboard          # Compact score view
│   └── QuestionPreview          # What is currently shown on screen
```

### 9.4 Presentation View Components

```
PresentationView
├── LobbyScreen                  # Game code + player join feed
│   ├── GameCodeDisplay          # Large, scannable game code
│   ├── JoinInstructions         # URL + code instructions
│   └── PlayerJoinFeed           # Animated list of joining players
│
├── RoundIntroScreen             # Round title + number
│   └── RoundTitle               # Animated round name reveal
│
├── QuestionScreen               # Active question display
│   ├── QuestionCard             # Question text, large format
│   ├── Timer                    # Prominent countdown
│   ├── AnswerCount              # "X of Y players answered"
│   └── ChoiceGrid               # For multiple-choice questions
│
├── ReviewingScreen              # Waiting screen during host review
│   └── WaitingAnimation         # Playful loading state
│
├── ScoreRevealScreen            # Animated score updates
│   ├── AnswerReveal             # Show correct answer
│   ├── Leaderboard              # Animated reordering
│   └── ScoreChanges             # "+100" animations per player
│
├── RoundResultsScreen           # Round summary
│   ├── RoundMVP                 # Most points this round
│   └── Leaderboard              # Running totals
│
└── GameOverScreen               # Final results with fanfare
    ├── WinnerReveal             # Dramatic winner announcement
    ├── FinalLeaderboard         # Complete rankings
    └── GameStats                # Fun statistics
```

### 9.5 Player View Components

```
PlayerView
├── JoinScreen                   # Enter display name
│   ├── NameInput                # R1.2: Unicode-safe name input
│   └── JoinButton
│
├── WaitingScreen                # After joining, waiting for game start
│   └── PlayerReadyIndicator
│
├── QuestionScreen               # Answer submission
│   ├── QuestionText             # Question display (mobile-optimized)
│   ├── AnswerInput              # Text input or choice selector
│   │   ├── TextAnswer           # Free-text answer input
│   │   ├── MultipleChoice       # Tap-to-select choices
│   │   └── TrueFalse            # Two large buttons
│   ├── Timer                    # Countdown display
│   └── SubmitButton             # Submit answer, disabled after submit
│
├── WaitingForResultsScreen      # After submission, waiting for review
│   └── SubmittedConfirmation    # Check mark, your answer shown
│
├── ResultScreen                 # Your answer result
│   ├── AnswerResult             # Correct/incorrect/bonus indicator
│   ├── PointsEarned             # Points animation
│   └── YourRank                 # Current rank
│
└── GameOverScreen               # Final score and rank
    ├── YourFinalScore
    └── FinalRank
```

### 9.6 Audience View Components

```
AudienceView
├── JoinScreen                   # Enter display name
│
├── WatchScreen                  # Passive viewing during question
│   ├── QuestionText             # See the question
│   └── VoteInput                # Guess the correct answer
│
├── VoteResultScreen             # Did the audience guess right
│   └── BonusPointsEarned
│
└── AudienceLeaderboard          # Separate audience rankings
```

---

## 10. Animation Strategy

### 10.1 Framework: Framer Motion

Framer Motion is chosen for its declarative API, React integration, and layout animation capabilities. All animation work lives in a shared `animations/` module with reusable presets.

### 10.2 Animation Catalog

| Context | Animation Type | Framer Motion Feature | Details |
|---|---|---|---|
| **Page transitions** | Slide + fade between game states | `AnimatePresence` + `motion.div` | Each game state screen slides in from the right, previous slides out left. 300ms spring. |
| **Player join feed** | Pop-in from bottom | `initial={{ y: 20, opacity: 0 }}` | New player names pop up with a slight bounce when joining lobby. |
| **Question reveal** | Scale up from center | `scale: [0, 1.05, 1]` with spring | Question card scales up with slight overshoot. |
| **Timer countdown** | Ring depletion + pulse at low time | SVG circle `strokeDashoffset` | Smooth ring depletion. Pulses red when under 5 seconds. |
| **Answer submission** | Check mark + shrink | `AnimatePresence` exit animation | Input shrinks and transforms into a confirmed state. |
| **Score reveal** | Count-up numbers | Custom `useMotionValue` + `animate` | Scores count up from old value to new value over 1.5 seconds. |
| **Leaderboard reorder** | Layout animation | `layout` prop on `motion.li` | Items smoothly slide to new positions as rankings change. Framer handles the FLIP. |
| **Score change badges** | Float up and fade | `"+100"` element with `y: [0, -30]`, `opacity: [1, 0]` | Points earned float upward and fade out. |
| **Round intro** | Text reveal | Staggered children with `staggerChildren: 0.1` | Round number and title reveal letter by letter or word by word. |
| **Winner reveal** | Confetti + scale | Custom confetti component + `scale` spring | Winner name scales up with particle effects. |
| **Waiting states** | Pulse / breathing | `animate={{ scale: [1, 1.05, 1] }}` with `repeat: Infinity` | Gentle pulsing animation during review/waiting. |
| **Error/rejection** | Shake | `x: [0, -10, 10, -10, 10, 0]` over 400ms | Shake animation on incorrect answer or failed join. |

### 10.3 Animation Presets Module

```typescript
// src/client/animations/presets.ts

export const fadeSlideIn = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { type: "spring", stiffness: 300, damping: 30 },
};

export const popIn = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: "spring", stiffness: 400, damping: 25 },
};

export const countUp = (from: number, to: number) => ({
  initial: { value: from },
  animate: { value: to },
  transition: { duration: 1.5, ease: "easeOut" },
});
```

### 10.4 Performance Considerations

- All animations use `transform` and `opacity` only (GPU-composited properties).
- `will-change: transform` is applied via Framer's internal optimizations.
- Animations respect `prefers-reduced-motion` — when enabled, transitions are instant (0ms) and decorative animations are disabled (R5.5).
- Particle/confetti effects use `Canvas` instead of DOM elements.
- Leaderboard animations cap at 16 simultaneous layout transitions to avoid jank on mobile.

---

## 11. Project File Structure

```
janedeck/
├── docs/
│   └── ARCHITECTURE.md              # This document
│
├── src/
│   ├── server/                      # PartyKit server code
│   │   ├── gameRoom.ts              # Main party: game lifecycle
│   │   ├── authGate.ts              # Auth party: password + tokens
│   │   ├── stateMachine.ts          # State transition logic
│   │   ├── fuzzyMatcher.ts          # Fuse.js answer matching
│   │   ├── timer.ts                 # Alarm-based timer management
│   │   └── utils/
│   │       ├── broadcast.ts         # Role-targeted broadcast helpers
│   │       ├── gameCode.ts          # Game code generation
│   │       └── storage.ts           # Storage key helpers + serialization
│   │
│   ├── client/                      # React frontend
│   │   ├── main.tsx                 # Vite entry point
│   │   ├── App.tsx                  # Router + providers
│   │   │
│   │   ├── hooks/
│   │   │   ├── usePartySocket.ts    # PartySocket connection hook
│   │   │   ├── useGameState.ts      # Subscribe to game state updates
│   │   │   ├── useTimer.ts          # Local timer sync with server
│   │   │   └── useAnimatedScore.ts  # Score counting animation hook
│   │   │
│   │   ├── stores/
│   │   │   ├── gameStore.ts         # Zustand: synced game state
│   │   │   ├── playerStore.ts       # Zustand: local player state
│   │   │   └── hostStore.ts         # Zustand: host-only state
│   │   │
│   │   ├── views/
│   │   │   ├── host/
│   │   │   │   ├── HostLogin.tsx
│   │   │   │   ├── GameCreator.tsx
│   │   │   │   ├── HostDashboard.tsx
│   │   │   │   ├── AnswerReviewPanel.tsx
│   │   │   │   └── components/
│   │   │   │       ├── RoundEditor.tsx
│   │   │   │       ├── QuestionEditor.tsx
│   │   │   │       ├── AnswerCard.tsx
│   │   │   │       ├── GameControls.tsx
│   │   │   │       └── PlayerList.tsx
│   │   │   │
│   │   │   ├── presentation/
│   │   │   │   ├── PresentationView.tsx
│   │   │   │   ├── LobbyScreen.tsx
│   │   │   │   ├── QuestionScreen.tsx
│   │   │   │   ├── ScoreRevealScreen.tsx
│   │   │   │   ├── GameOverScreen.tsx
│   │   │   │   └── components/
│   │   │   │       ├── GameCodeDisplay.tsx
│   │   │   │       ├── PlayerJoinFeed.tsx
│   │   │   │       ├── AnswerReveal.tsx
│   │   │   │       └── WinnerReveal.tsx
│   │   │   │
│   │   │   ├── player/
│   │   │   │   ├── PlayerView.tsx
│   │   │   │   ├── JoinScreen.tsx
│   │   │   │   ├── QuestionScreen.tsx
│   │   │   │   ├── ResultScreen.tsx
│   │   │   │   └── components/
│   │   │   │       ├── AnswerInput.tsx
│   │   │   │       ├── MultipleChoice.tsx
│   │   │   │       └── SubmittedConfirmation.tsx
│   │   │   │
│   │   │   └── audience/
│   │   │       ├── AudienceView.tsx
│   │   │       ├── VoteInput.tsx
│   │   │       └── AudienceLeaderboard.tsx
│   │   │
│   │   ├── components/              # Shared UI components
│   │   │   ├── Timer.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── AnimatedScore.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── PlayerAvatar.tsx
│   │   │   └── Confetti.tsx
│   │   │
│   │   ├── animations/
│   │   │   ├── presets.ts           # Reusable animation configs
│   │   │   ├── variants.ts         # Named animation variants
│   │   │   └── ReducedMotion.tsx    # prefers-reduced-motion wrapper
│   │   │
│   │   └── styles/
│   │       ├── global.css
│   │       ├── theme.ts            # Design tokens
│   │       └── responsive.ts       # Breakpoint utilities
│   │
│   └── shared/                      # Shared between server and client
│       ├── types.ts                 # Game, Round, Question, Player, etc.
│       ├── messages.ts              # Message type definitions
│       ├── schemas.ts               # Zod schemas for message validation
│       ├── constants.ts             # Game limits, defaults
│       └── gameStates.ts            # State enum + transition map
│
├── public/
│   ├── index.html
│   └── assets/
│       ├── sounds/                  # Sound effects for reveals, timers
│       └── fonts/
│
├── partykit.json                    # PartyKit configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example                     # JANEDECK_ADMIN_PASSWORD=...
└── README.md
```

---

## 12. Deployment & Scaling

### 12.1 PartyKit Deployment

PartyKit deploys to Cloudflare's edge network. Each `GameRoom` is a Durable Object with:

- **128MB memory limit per room** (mitigated by hibernation)
- **Built-in storage** persisted across hibernation cycles
- **Global distribution** — rooms are created near the first connecting user

### 12.2 Hibernation Strategy

The GameRoom server uses hibernation mode to scale:

- During `LOBBY` and `REVIEWING` states (host idle time), the room hibernates.
- All state is persisted to storage before hibernation.
- `onStart` rehydrates state from storage.
- No `setTimeout` — all timers use `onAlarm`.
- Connection event handlers are class methods (not closures).

### 12.3 Scaling Limits

| Dimension | Limit | Mitigation |
|---|---|---|
| Connections per room | ~100 (practical) | `maxPlayers` setting defaults to 16; audience connections are lightweight |
| Storage per room | 1GB | Game data is small; answers are text strings |
| Memory per room | 128MB | Hibernation mode; minimal in-memory state |
| Message rate | ~1000/sec per room | Timer ticks are 1/sec; answer submissions are bursty but brief |
| Concurrent games | Unlimited | Each game is an isolated Durable Object |

### 12.4 Environment Variables

| Variable | Description |
|---|---|
| `JANEDECK_ADMIN_PASSWORD` | Admin password for host authentication |

### 12.5 Development Workflow

```bash
# Install dependencies
npm install

# Start PartyKit dev server + Vite dev server
npx partykit dev

# Deploy to production
npx partykit deploy
```

Vite is configured as the frontend build tool within PartyKit's dev server, serving the React app and proxying WebSocket connections to the PartyKit server.

---

## Appendix A: Accessibility Considerations

Per the inclusive software ruleset:

- **R1.2**: Display names accept full Unicode BMP. No regex validation on names (R1.6). Field length supports ≥ 256 bytes.
- **R1.4**: `displayName` is the only name field — it is the player's chosen name, used everywhere.
- **R2.1/R2.3**: No gender, pronouns, or demographic data is collected. None is needed for game mechanics.
- **R5.1**: WCAG 2.2 Level AA compliance target for all views.
- **R5.2**: Touch targets ≥ 44×44 CSS px on mobile player view (SC 2.5.8). Focus indicators on all interactive elements.
- **R5.3**: Semantic HTML: `<button>` for actions, `<input>` for answers, `<ol>` for leaderboards.
- **R5.5**: All animations respect `prefers-reduced-motion`. Timer animations use `aria-live="assertive"` for screen reader announcements.
- **R5.6**: All form inputs have programmatic labels. Error messages use `aria-describedby`.
- **R5.7**: Game instructions and UI copy target 8th-grade reading level.
- **R5.8**: Decorative animations use `aria-hidden="true"`. Score changes announced via `aria-live` regions.
- **R7.1**: No banned terms in codebase. Uses `primary`/`replica`, `allowlist`/`denylist`, `main` branch.

## Appendix B: Security Considerations

- **Host password** is bcrypt-hashed and stored in AuthGate party storage. Never transmitted in plaintext after initial auth.
- **Tokens** are opaque `nanoid` strings with 4-hour TTL. Stored server-side only.
- **No PII collection** beyond player-chosen display names, which are ephemeral to the game session.
- **WebSocket messages** are validated server-side with Zod before processing. Invalid messages are silently dropped.
- **Host actions** are verified server-side: the server checks that the connection tagged as `host` is the one sending host commands.
- **Rate limiting**: Answer submissions are limited to one per question per player, enforced server-side.
- **R4.4**: Not applicable (no sensitive population data), but the game code entry page uses no tracking or analytics pixels.
