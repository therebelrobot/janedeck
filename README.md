# 🎮 JaneDeck

A seff-hosted, real-time multiplayer party game platform inspired by Jackbox Games, built with [PartyServer](https://github.com/threepointone/partyserver) + React on Cloudflare Workers. Hosts pick **Trivia** or **Bingo** when creating a game.

Players join from their phones, the host controls (or, for Bingo, simply starts/ends) the game, and a presentation view shows everything on a shared screen — all connected via WebSockets.

## Features

- **Two game types**, picked by the host at creation time:
  - **Trivia** — multiple rounds with customizable questions and point values, fuzzy answer matching (Fuse.js, with host override for edge cases), and bonus points for creative or funny answers
  - **Bingo** — numbered or custom-phrase-pool cards, free-for-all self-marking (no host pacing), configurable win patterns (line / four corners / blackout), and cross-player glow hints when another player marks a square matching yours
- **4 views** designed for different roles:
  - **Host** — control panel for managing the game, starting with a Trivia/Bingo type picker (desktop)
  - **Presentation** — screen-share view for video calls (TV/projector)
  - **Player** — mobile-first interface for answering questions or marking a bingo card (phone)
  - **Audience** — spectator mode with reactions (phone)
- **Real-time** WebSocket communication via PartyServer
- **In-app notifications** — toasts and synthesized sound effects (mutable) for marks, wins, and other live events, so players don't need to be watching the shared presentation screen
- **Animated** transitions, score reveals, and celebrations (Framer Motion)
- **Accessible** — WCAG 2.2 AA compliant (semantic HTML, keyboard navigation, screen reader support, reduced motion)

## Quick Start

### Prerequisites

- Node.js 22+
- npm 9+

### Setup

```bash
# Install dependencies
npm install

# Create your environment file
cp .env.example .env
# Edit .env and set JANEDECK_ADMIN_PASSWORD to a strong password

# Start the development server
npm run dev
```

The dev server starts Vite with the Cloudflare plugin, serving both the WebSocket server (via workerd/miniflare) and the React frontend.

### How to Play

1. **Host** opens `/host` and enters the admin password
2. **Host** picks a game type at `/host/create` — **Trivia** or **Bingo**
3. **Players** join via game code at `/play/CODE` (or from the home page at `/`)
4. **Host** shares the Presentation view (`/present/CODE`) on a video call or screen

**Trivia:**

5. **Host** creates the game with rounds and questions (or uses Quick Start template)
6. **Host** advances through rounds — players answer from their phones
7. After each question, the host reviews answers (auto-scored by fuzzy matching)
8. Scores are revealed with animated leaderboard updates
9. At the end, the winner is crowned with confetti 🎉

**Bingo:**

5. **Host** creates the game, choosing numbered or custom-phrase cards and which win patterns count (line / four corners / blackout)
6. **Host** starts the game — each player gets their own shuffled card
7. **Players** tap squares to mark or unmark them at their own pace, no host pacing required
8. When another player marks a square matching one on your card, it glows as a hint
9. Marks and wins are announced live (toast + sound, mutable via the in-app sound toggle) so players don't need to watch the shared screen
10. **Host** ends the game when ready — multiple players can complete multiple patterns before then

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design.

### High-Level Overview

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  React App  │◄───►│  PartyServer (DO)    │◄───►│  React App  │
│  (Host)     │ WS  │  ┌─────────────────┐ │ WS  │  (Players)  │
│             │     │  │ GameRoom        │ │     │             │
└─────────────┘     │  │ (state machine) │ │     └─────────────┘
                    │  └─────────────────┘ │
┌─────────────┐     │  ┌─────────────────┐ │     ┌─────────────┐
│ Presentation│◄───►│  │ AuthGate        │ │◄───►│  Audience   │
│ (Screen)    │ WS  │  │ (token auth)    │ │ WS  │  (Spectator)│
└─────────────┘     │  └─────────────────┘ │     └─────────────┘
                    └──────────────────────┘
```

- **GameRoom** — single Durable Object class shared by both game types; `Game` is a discriminated union (`TriviaGame | BingoGame`) narrowed on a `type` field, each with its own state machine and message handlers
- **AuthGate** — secondary Durable Object; validates host passwords, issues session tokens
- **Trivia state machine** — `LOBBY → ROUND_INTRO → QUESTION_DISPLAY → ANSWERING → REVIEWING → SCORE_REVEAL → ROUND_RESULTS → GAME_OVER`
- **Bingo state machine** — `LOBBY → BINGO_PLAYING → BINGO_ENDED`, with marking/win-checking handled by `src/server/bingo/` (`bingoEngine.ts` for card generation and pattern checks, `bingoHandlers.ts` for the message handlers)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [PartyServer](https://github.com/threepointone/partyserver) on [Cloudflare Workers](https://workers.cloudflare.com/) |
| Frontend | [React 19](https://react.dev/) |
| Routing | [React Router 7](https://reactrouter.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Validation | [Zod 4](https://zod.dev/) |
| Fuzzy Match | [Fuse.js](https://www.fusejs.io/) |
| Build | [Vite 8](https://vite.dev/) + [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/frameworks/framework-guides/vite-plugin/) |
| WebSocket | [PartySocket](https://www.npmjs.com/package/partysocket) |
| Language | TypeScript 6 |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JANEDECK_ADMIN_PASSWORD` | Yes | Password that hosts must enter to create games. Set in `.env` for local dev; configure as a secret for deployment. |

## Project Structure

```
src/
├── shared/                  # Shared types, messages, constants
│   ├── types.ts             # TypeScript interfaces (Game, Player, Answer, BingoCard, etc.)
│   ├── messages.ts          # WebSocket message type definitions
│   ├── schemas.ts           # Zod schemas for runtime validation
│   ├── gameStates.ts        # State machine transitions (trivia + bingo)
│   └── constants.ts         # Shared constants
├── server/                  # PartyServer / Cloudflare Workers code
│   ├── index.ts             # Worker entry point
│   ├── gameRoom.ts          # Main game room Durable Object (both game types)
│   ├── authGate.ts          # Authentication Durable Object
│   ├── stateMachine.ts      # Game state transition logic (trivia + bingo)
│   ├── timer.ts             # Alarm-based countdown timer
│   ├── fuzzyMatcher.ts      # Fuse.js answer matching
│   ├── bingo/                # Bingo-specific server logic
│   │   ├── bingoEngine.ts   # Card generation, win-pattern checking
│   │   └── bingoHandlers.ts # Message handlers (create/start/mark/unmark/end)
│   └── utils/                # Server utilities
│       ├── broadcast.ts     # Role-targeted message broadcasting
│       ├── storage.ts       # Durable Object storage helpers
│       └── gameCode.ts      # Game code generation
└── client/                  # React frontend
    ├── App.tsx              # Root component with routes
    ├── main.tsx             # React entry point
    ├── styles/              # Global CSS and theme tokens
    ├── animations/          # Framer Motion presets, variants, reduced-motion provider
    ├── hooks/                 # Custom React hooks
    │   ├── usePartySocket.ts # WebSocket connection management
    │   ├── useGameState.ts   # Game state subscription
    │   ├── useAuth.ts        # Host authentication (login + logout)
    │   ├── useTimer.ts       # Client-side timer sync
    │   └── useAnimatedScore.ts # Score counting animation
    ├── stores/                  # Zustand state stores
    │   ├── gameStore.ts         # Shared game state (trivia + bingo)
    │   ├── hostStore.ts         # Host-specific state
    │   ├── playerStore.ts       # Player-specific state
    │   └── notificationStore.ts # Toast notification queue
    ├── utils/                 # Client utilities
    │   ├── csv.ts            # CSV import/export (questions, phrase pools, results)
    │   └── soundEffects.ts   # Web Audio synthesized sound effects (mutable)
    ├── components/            # Reusable UI components
    │   ├── Timer.tsx          # SVG countdown ring
    │   ├── Leaderboard.tsx    # Animated score list
    │   ├── Confetti.tsx       # Canvas confetti effect
    │   ├── StatusBadge.tsx    # Game state indicator
    │   ├── QuestionCard.tsx   # Question display
    │   ├── PlayerAvatar.tsx   # Color-coded player icon
    │   ├── AnimatedScore.tsx  # Counting-up score display
    │   ├── LogoutButton.tsx   # Host session logout
    │   ├── SoundToggle.tsx    # Mute/unmute sound effects
    │   └── ToastStack.tsx     # Renders queued notification toasts
    └── views/                 # Route-level view components
        ├── HomeView.tsx       # Landing page
        ├── host/              # Host views (login, game type selector, trivia + bingo creators/dashboards, sub-components)
        ├── player/            # Player views (trivia question flow + BingoCard, sub-components)
        ├── presentation/      # Screen-share views (lobby, question, score reveal, game over, sub-components)
        └── audience/          # Spectator views (leaderboard, vote input)
```

## Development

```bash
# Start dev server (Vite + Cloudflare plugin)
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

## Docker Deployment

JaneDeck can run in Docker on any platform — including **Raspberry Pi 4/5** (ARM64). There are two ways to run it:

- **Self-hosted (prebuilt image)** — pulls the published image from GHCR, no repo clone needed. Recommended for most self-hosters.
- **Build from source** — clones the repo and builds the image locally. Use this if you're developing or want to run an unreleased change.

### Prerequisites

- Docker Engine 20+ and Docker Compose v2
- For Raspberry Pi: **64-bit OS required** (Raspberry Pi OS 64-bit, Ubuntu Server 64-bit, or Debian arm64). The 32-bit armv7l OS is not supported because the `workerd` runtime only ships ARM64 binaries.

### Option A: Self-Hosted (Prebuilt Image)

```bash
# 1. Make a directory for JaneDeck's compose file and data
mkdir janedeck && cd janedeck

# 2. Download the self-hoster compose file
curl -O https://raw.githubusercontent.com/therebelrobot/janebox/main/docker-compose.prod.yml

# 3. Create your environment file
echo "JANEDECK_ADMIN_PASSWORD=your-strong-password" > .env

# 4. Start
docker compose -f docker-compose.prod.yml up -d

# 5. Open in browser
# http://localhost:5173          (local)
# http://<your-pi-ip>:5173      (LAN)
```

Game data persists in `./data`, right next to `docker-compose.prod.yml` — a plain folder you can see, back up, or delete, not a hidden Docker-managed volume.

```bash
# Start in background
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f janedeck

# Stop
docker compose -f docker-compose.prod.yml down

# Update to the latest published image
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Reset game data
rm -rf ./data
```

### Option B: Build from Source

```bash
# 1. Clone the repo
git clone https://github.com/therebelrobot/janebox.git
cd janebox

# 2. Create your environment file
cp .env.example .env
# Edit .env and set JANEDECK_ADMIN_PASSWORD

# 3. Build and start
docker compose up -d

# 4. Open in browser
# http://localhost:5173          (local)
# http://<your-pi-ip>:5173      (LAN)
```

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f janedeck

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Reset game data (clear persistent storage)
docker compose down -v
```

### Raspberry Pi Setup

1. **Install 64-bit OS**: Flash [Raspberry Pi OS (64-bit)](https://www.raspberrypi.com/software/) or Ubuntu Server 64-bit to your SD card.

2. **Install Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in, then:
   docker --version
   ```

3. **Set up and run JaneDeck** (prebuilt image — see [Option A](#option-a-self-hosted-prebuilt-image) above; swap in [Option B](#option-b-build-from-source) if you'd rather build from source):
   ```bash
   mkdir janedeck && cd janedeck
   curl -O https://raw.githubusercontent.com/therebelrobot/janebox/main/docker-compose.prod.yml
   echo "JANEDECK_ADMIN_PASSWORD=your-strong-password" > .env
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Access from your network**: Open `http://<pi-ip>:5173` from any device on the same network. Find your Pi's IP with `hostname -I`.

### Resource Usage on Raspberry Pi

| Component | RAM Usage |
|---|---|
| `workerd` (Cloudflare Workers runtime) | ~100–200 MB |
| Per active game room | ~1–5 MB |
| **Total (1–5 concurrent games)** | **~250–500 MB** |

A Raspberry Pi 4 (2 GB+) or Pi 5 handles 16–50 players comfortably. The Docker Compose file limits the container to 512 MB RAM.

### Adding HTTPS (Optional)

For access beyond your LAN, use a reverse proxy. Example with [Caddy](https://caddyserver.com/):

```bash
# Install Caddy on the Pi (outside Docker)
sudo apt install -y caddy

# /etc/caddy/Caddyfile
janedeck.yourdomain.com {
    reverse_proxy localhost:5173
}

# Reload Caddy
sudo systemctl reload caddy
```

Caddy automatically provisions TLS certificates via Let's Encrypt.

### Persistent Storage

Where game state lives depends on which compose file you used:

- **Option A (`docker-compose.prod.yml`)** — bind-mounted to `./data`, right next to the compose file. It's a plain folder: back it up with a normal file copy, or wipe it with `rm -rf ./data` (container must be stopped first).
- **Option B (`docker-compose.yml`)** — a named Docker volume (`janedeck-data`), stored at `/var/lib/docker/volumes/janedeck_janedeck-data/`. Survives `docker compose restart`; clear it with `docker compose down -v`.

## Routes

| Path | View | Description |
|---|---|---|
| `/` | HomeView | Landing page with join/host options |
| `/host` | HostLogin | Host password entry |
| `/host/create` | GameTypeSelector | Choose Trivia or Bingo |
| `/host/create/trivia` | GameCreator | Create a trivia game with rounds/questions |
| `/host/create/bingo` | BingoGameCreator | Create a bingo game (card mode, win patterns) |
| `/host/:gameCode` | HostDashboard | Live game control panel (trivia or bingo) |
| `/play/:gameCode` | PlayerView | Player mobile interface (question answering or bingo card) |
| `/present/:gameCode` | PresentationView | Screen-share display |
| `/audience/:gameCode` | AudienceView | Spectator mode |

## Accessibility

This project follows WCAG 2.2 AA guidelines:

- **Semantic HTML** — proper heading hierarchy, `<button>`, `<label>`, `<ol>`, etc.
- **Keyboard navigation** — all interactive elements reachable, visible focus indicators
- **Screen reader support** — `aria-live` regions, `aria-label`, `role` attributes
- **Reduced motion** — respects `prefers-reduced-motion` via Framer Motion's `ReducedMotionProvider`
- **Color contrast** — ≥ 4.5:1 for text, ≥ 3:1 for UI components
- **Touch targets** — ≥ 44×44 CSS pixels for interactive elements
- **Forced colors** — supports Windows High Contrast mode

## Inclusive Design

Following the [Inclusive Software Ruleset](https://inclusive.microsoft.design/):

- **R1.2/R1.4/R1.6** — Unicode-safe display names, no regex validation, chosen name always used
- **R2.1** — No gender or demographic data collected (not needed for game mechanics)
- **R5.x** — Full WCAG 2.2 AA accessibility compliance
- **R7.1/R7.4** — Inclusive terminology, non-blame error messages
- **R9.5** — Session-scoped auth tokens (sessionStorage, not localStorage)

## License

MIT
