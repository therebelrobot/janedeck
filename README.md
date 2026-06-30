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

## Deploying to Your Own Cloudflare Account

JaneDeck is built on [Cloudflare Workers](https://workers.cloudflare.com/) and Durable Objects — deploying it to your own Cloudflare account is the officially supported, zero-Docker way to run it in production. `workerd` runs on Cloudflare's infrastructure, so none of the [Docker/Raspberry Pi virtual-address-space caveats](#docker-deployment) below apply.

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free to create).
- **A paid Workers plan.** JaneDeck's `GameRoom` and `AuthGate` Durable Object classes use SQLite storage (see the `migrations` block in [`wrangler.jsonc`](wrangler.jsonc)), which is not available on Cloudflare's free Workers plan. Check [Cloudflare's current Workers pricing](https://www.cloudflare.com/plans/developer-platform/) before deploying — plan names and what's included in free vs. paid tiers change over time, so verify rather than relying on this README.
- Node.js 22+ and npm 9+ (same as local dev — see [Quick Start](#quick-start)).
- A clone of this repo with `npm install` already run.

### One-Time Setup

```bash
# Authenticate wrangler with your Cloudflare account (opens a browser to authorize)
npx wrangler login

# Store the admin password as an encrypted secret — NOT your local .env file.
# .env/.dev.vars only apply to `npm run dev`; deployed Workers read secrets
# set this way instead.
 
```

### Deploy

```bash
npm run deploy
```

This builds the frontend (`vite build` → `dist/`), then runs `wrangler deploy`, which bundles `src/server/index.ts`, provisions the `GameRoom`/`AuthGate` Durable Object classes (first deploy only), and uploads the built frontend as static assets.

On success, wrangler prints the live URL:

```
https://janedeck.<your-subdomain>.workers.dev
```

If this is the first Worker on your account, wrangler may prompt you to claim a `workers.dev` subdomain first — any available name works.

### Using Your Own Domain (Optional)

To serve JaneDeck from your own domain instead of `*.workers.dev`:

1. Add the domain to Cloudflare if it isn't already there ([zone setup guide](https://developers.cloudflare.com/dns/zone-setups/)).
2. Add a `routes` entry to `wrangler.jsonc`:
   ```jsonc
   {
     // ...existing config...
     "routes": [
       { "pattern": "janedeck.yourdomain.com", "custom_domain": true }
     ]
   }
   ```
3. Redeploy: `npm run deploy`. Cloudflare provisions DNS and TLS for the custom domain automatically.

### Renaming Your Deployment

The `name` field in `wrangler.jsonc` (`"janedeck"` by default) sets your Worker's name and its default `*.workers.dev` URL. Worker names are scoped to your own account, so there's no conflict with anyone else's deployment — change it freely before your first deploy if you want a different URL. Renaming *after* Durable Objects have been provisioned under the original name requires a proper [migration](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/), not just an edit to `name`.

### Updating

```bash
git pull
npm install
npm run deploy
```

Game data lives in Durable Object storage and persists across deploys — redeploying replaces code, not state.

### Logs

```bash
npx wrangler tail
```

Streams live logs from the deployed Worker.

### Deploying from CI (Optional)

For automated deploys instead of running `npm run deploy` by hand, authenticate with an API token rather than `wrangler login`:

1. Create a token at [Cloudflare's API Tokens page](https://dash.cloudflare.com/profile/api-tokens) using the "Edit Cloudflare Workers" template.
2. Add it as a `CLOUDFLARE_API_TOKEN` secret in your CI provider.
3. Run `npm run deploy` in your CI job — wrangler picks up `CLOUDFLARE_API_TOKEN` from the environment automatically.

This repo's [`.github/workflows/`](.github/workflows/) currently only publishes the Docker image to GHCR; it does not auto-deploy to Cloudflare. Add a workflow yourself if you want that.

## Docker Deployment

JaneDeck can run in Docker on any platform — a cloud VM like a **DigitalOcean Droplet**, or **Raspberry Pi 4/5** hardware (ARM64, running Ubuntu Server — see the Prerequisites note below on why the official Raspberry Pi OS doesn't work). There are two ways to run it:

- **Self-hosted (prebuilt image)** — pulls the published image from GHCR, no repo clone needed. Recommended for most self-hosters.
- **Build from source** — clones the repo and builds the image locally. Use this if you're developing or want to run an unreleased change.

### Prerequisites

- Docker Engine 20+ and Docker Compose v2
- For Raspberry Pi: **a 48-bit VA kernel required — the official Raspberry Pi OS does not work.** `workerd` (Cloudflare's Workers runtime) uses an allocator that reserves virtual memory at addresses above 512GB. Raspberry Pi Foundation's own kernel builds (the `*-rpi-v8` packages used by Raspberry Pi OS) hardcode `CONFIG_ARM64_VA_BITS=39` — capping user-space VA at 512GB — on **every** version we've tested, from Bullseye's 6.1.x through a Bookworm-era 6.12.x build from September 2025. This appears to be a permanent characteristic of their kernel config (likely to keep one unified build across the whole Pi lineup, including low-RAM boards like Pi Zero 2 W), not something a Debian version bump fixes. The container will crash-loop on startup regardless of available RAM or Docker settings.
  - **Raspberry Pi OS (any version)**: 39-bit VA → confirmed **does not work**
  - **Ubuntu Server 22.04/24.04 LTS for Raspberry Pi (ARM64)**: targets the same generic arm64 kernel config used for cloud arm64 (AWS Graviton, etc.), which is 48-bit VA — expected to work, but verify before relying on it
  - Verify before running: `zcat /proc/config.gz 2>/dev/null | grep CONFIG_ARM64_VA_BITS || grep CONFIG_ARM64_VA_BITS /boot/config-$(uname -r)` — must show `CONFIG_ARM64_VA_BITS=48`
  - Alternatively, skip self-hosting on Pi hardware entirely and run `npm run deploy` to deploy to actual Cloudflare Workers (generous free tier) — `workerd` then runs on Cloudflare's infrastructure, not the Pi, sidestepping this issue altogether

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

1. **Install Ubuntu Server 64-bit, not Raspberry Pi OS.** Flash [Ubuntu Server for Raspberry Pi (ARM64)](https://ubuntu.com/download/raspberry-pi) to your SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/). The official Raspberry Pi OS does **not** work — see the VA-bits note in Prerequisites above.

2. **Verify the kernel's VA bits before going further**:
   ```bash
   zcat /proc/config.gz 2>/dev/null | grep CONFIG_ARM64_VA_BITS || grep CONFIG_ARM64_VA_BITS /boot/config-$(uname -r)
   # Must show CONFIG_ARM64_VA_BITS=48 — if it shows 39, workerd will crash-loop regardless of the steps below
   ```

3. **Install Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in, then:
   docker --version
   ```

4. **Set up and run JaneDeck** (prebuilt image — see [Option A](#option-a-self-hosted-prebuilt-image) above; swap in [Option B](#option-b-build-from-source) if you'd rather build from source):
   ```bash
   mkdir janedeck && cd janedeck
   curl -O https://raw.githubusercontent.com/therebelrobot/janebox/main/docker-compose.prod.yml
   echo "JANEDECK_ADMIN_PASSWORD=your-strong-password" > .env
   docker compose -f docker-compose.prod.yml up -d
   ```

5. **Access from your network**: Open `http://<pi-ip>:5173` from any device on the same network. Find your Pi's IP with `hostname -I`.

### DigitalOcean Droplet Setup

Standard cloud kernels — including DigitalOcean's — use a 48-bit virtual address space, so none of the Raspberry Pi VA-bits caveats above apply. This is the simpler path if you just want a reliably-working self-hosted instance reachable from the internet, not specifically a Pi.

1. **Create a Droplet**: Ubuntu 22.04/24.04 LTS, Basic plan. See [Resource Usage](#resource-usage) below for sizing guidance — either the Regular (Intel/AMD) or Premium AMD/Arm tier works fine, since JaneDeck's footprint is small. DigitalOcean also offers a [Docker 1-Click App](https://marketplace.digitalocean.com/apps/docker) image with Docker preinstalled if you'd rather skip step 3.

2. **Point a domain at it (optional but recommended)**: add an `A` record for your domain/subdomain to the Droplet's public IP, in DigitalOcean's DNS or wherever your domain is hosted.

3. **SSH in and install Docker** (skip if you used the Docker 1-Click App image):
   ```bash
   ssh root@<droplet-ip>
   curl -fsSL https://get.docker.com | sh
   ```

4. **Set up and run JaneDeck** (prebuilt image — see [Option A](#option-a-self-hosted-prebuilt-image) above; swap in [Option B](#option-b-build-from-source) if you'd rather build from source):
   ```bash
   mkdir janedeck && cd janedeck
   curl -O https://raw.githubusercontent.com/therebelrobot/janebox/main/docker-compose.prod.yml
   echo "JANEDECK_ADMIN_PASSWORD=your-strong-password" > .env
   docker compose -f docker-compose.prod.yml up -d
   ```

5. **Open the firewall**: if you have DigitalOcean Cloud Firewalls or `ufw` enabled, allow the port you're exposing JaneDeck on:
   ```bash
   sudo ufw allow 5173/tcp     # direct access, no reverse proxy
   # or, if adding HTTPS via reverse proxy (recommended for a real domain):
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

6. **Access**: `http://<droplet-ip>:5173` directly, or set up [HTTPS](#adding-https-optional) below with your domain for a proper `https://` URL — a Droplet reachable from the public internet is exactly the case HTTPS matters most for.

### Resource Usage

| Component | RAM Usage |
|---|---|
| `workerd` (Cloudflare Workers runtime) | ~100–200 MB |
| Per active game room | ~1–5 MB |
| **Total (1–5 concurrent games)** | **~250–500 MB** |

This profile is the same regardless of host. A Raspberry Pi 4 (2 GB+) or Pi 5 handles 16–50 players comfortably. On DigitalOcean, the smallest Basic Droplet tier (1 GB RAM) is enough for casual/personal use; size up if you expect several concurrent games or larger groups — check [DigitalOcean's current Droplet pricing](https://www.digitalocean.com/pricing/droplets) for what's available. The compose files don't set a hard memory cap on the container — `workerd`'s allocator reserves a large virtual-memory arena up front at startup, and a tight cgroup limit can make that reservation fail rather than actually constraining real usage (which stays in the range above).

### Adding HTTPS (Optional)

For access beyond your LAN (or for any internet-facing host like a DigitalOcean Droplet), use a reverse proxy. Example with [Caddy](https://caddyserver.com/):

```bash
# Install Caddy on the host (outside Docker)
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
