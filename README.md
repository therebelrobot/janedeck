# 🎮 JaneDeck

A real-time multiplayer trivia game platform inspired by Jackbox Games, built with [PartyServer](https://github.com/threepointone/partyserver) + React on Cloudflare Workers.

Players join from their phones, the host controls the game, and a presentation view shows everything on a shared screen — all connected via WebSockets.

## Features

- **Multiple rounds** with customizable questions and point values
- **Fuzzy answer matching** — powered by Fuse.js with host override for edge cases
- **Bonus points** for creative or funny answers
- **4 views** designed for different roles:
  - **Host** — control panel for managing the game (desktop)
  - **Presentation** — screen-share view for video calls (TV/projector)
  - **Player** — mobile-first answer interface (phone)
  - **Audience** — spectator mode with reactions (phone)
- **Real-time** WebSocket communication via PartyServer
- **Animated** transitions, score reveals, and celebrations (Framer Motion)
- **Accessible** — WCAG 2.2 AA compliant (semantic HTML, keyboard navigation, screen reader support, reduced motion)

## Quick Start

### Prerequisites

- Node.js 18+
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
2. **Host** creates a game with rounds and questions (or uses Quick Start template)
3. **Players** join via game code at `/play/CODE` (or from the home page at `/`)
4. **Host** shares the Presentation view (`/present/CODE`) on a video call or screen
5. **Host** advances through rounds — players answer from their phones
6. After each question, the host reviews answers (auto-scored by fuzzy matching)
7. Scores are revealed with animated leaderboard updates
8. At the end, the winner is crowned with confetti 🎉

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

- **GameRoom** — main Durable Object; manages game state, player connections, timer, scoring
- **AuthGate** — secondary Durable Object; validates host passwords, issues session tokens
- **State Machine** — `LOBBY → ROUND_INTRO → QUESTION_DISPLAY → ANSWERING → REVIEWING → SCORE_REVEAL → ROUND_RESULTS → GAME_OVER`

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
│   ├── types.ts             # TypeScript interfaces (Game, Player, Answer, etc.)
│   ├── messages.ts          # WebSocket message type definitions
│   ├── schemas.ts           # Zod schemas for runtime validation
│   ├── gameStates.ts        # State machine transitions
│   └── constants.ts         # Shared constants
├── server/                  # PartyServer / Cloudflare Workers code
│   ├── gameRoom.ts          # Main game room Durable Object
│   ├── authGate.ts          # Authentication Durable Object
│   ├── stateMachine.ts      # Game state transition logic
│   ├── timer.ts             # Alarm-based countdown timer
│   ├── fuzzyMatcher.ts      # Fuse.js answer matching
│   └── utils/               # Server utilities
│       ├── broadcast.ts     # Role-targeted message broadcasting
│       ├── storage.ts       # Durable Object storage helpers
│       └── gameCode.ts      # Game code generation
└── client/                  # React frontend
    ├── App.tsx              # Root component with routes
    ├── main.tsx             # React entry point
    ├── styles/              # Global CSS and theme tokens
    ├── animations/          # Framer Motion presets and variants
    ├── hooks/               # Custom React hooks
    │   ├── usePartySocket.ts # WebSocket connection management
    │   ├── useGameState.ts   # Game state subscription
    │   ├── useAuth.ts        # Host authentication
    │   ├── useTimer.ts       # Client-side timer sync
    │   └── useAnimatedScore.ts # Score counting animation
    ├── stores/              # Zustand state stores
    │   ├── gameStore.ts     # Shared game state
    │   ├── hostStore.ts     # Host-specific state
    │   └── playerStore.ts   # Player-specific state
    ├── components/          # Reusable UI components
    │   ├── Timer.tsx        # SVG countdown ring
    │   ├── Leaderboard.tsx  # Animated score list
    │   ├── Confetti.tsx     # Canvas confetti effect
    │   ├── StatusBadge.tsx  # Game state indicator
    │   ├── QuestionCard.tsx # Question display
    │   ├── PlayerAvatar.tsx # Color-coded player icon
    │   └── AnimatedScore.tsx # Counting-up score display
    └── views/               # Route-level view components
        ├── HomeView.tsx     # Landing page
        ├── host/            # Host views
        ├── player/          # Player views
        ├── presentation/    # Screen-share views
        └── audience/        # Spectator views
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

JaneDeck can run in Docker on any platform — including **Raspberry Pi 4/5** (ARM64).

### Prerequisites

- Docker Engine 20+ and Docker Compose v2
- For Raspberry Pi: **64-bit OS required** (Raspberry Pi OS 64-bit, Ubuntu Server 64-bit, or Debian arm64). The 32-bit armv7l OS is not supported because the `workerd` runtime only ships ARM64 binaries.

### Quick Start (Docker)

```bash
# 1. Clone the repo
git clone https://github.com/therebelrobot/janedeck.git
cd janedeck

# 2. Create your environment file
cp .env.example .env
# Edit .env and set JANEDECK_ADMIN_PASSWORD

# 3. Build and start
docker compose up -d

# 4. Open in browser
# http://localhost:5173          (local)
# http://<your-pi-ip>:5173      (LAN)
```

### Docker Commands

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

3. **Clone and run JaneDeck**:
   ```bash
   git clone https://github.com/therebelrobot/janedeck.git
   cd janedeck
   cp .env.example .env
   nano .env  # Set your admin password
   docker compose up -d
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

Game state is stored in a Docker volume (`janedeck-data`). This means:
- Game data survives container restarts (`docker compose restart`)
- To clear all game data: `docker compose down -v`
- Volume is stored at `/var/lib/docker/volumes/janedeck_janedeck-data/`

## Routes

| Path | View | Description |
|---|---|---|
| `/` | HomeView | Landing page with join/host options |
| `/host` | HostLogin | Host password entry |
| `/host/create` | GameCreator | Create game with rounds/questions |
| `/host/:gameCode` | HostDashboard | Live game control panel |
| `/play/:gameCode` | PlayerView | Player mobile interface |
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
