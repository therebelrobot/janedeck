# ─────────────────────────────────────────────────────────────
# JaneDeck — Dockerfile
# Multi-platform: amd64 + arm64 (Raspberry Pi 4/5)
#
# Uses `vite dev` with the Cloudflare Vite plugin, which runs
# workerd (miniflare) internally. All source files are needed
# at runtime.
# ─────────────────────────────────────────────────────────────

FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy all source files
COPY . .

# Vite dev server port
EXPOSE 5173

# Persist Durable Objects storage across container restarts
VOLUME ["/app/.wrangler"]

# Health check — Vite dev serves the frontend on /
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5173/').then(r => { if (!r.ok) throw 1 }).catch(() => process.exit(1))"

# Run Vite dev server, bound to all interfaces
CMD ["npx", "vite", "dev", "--host", "0.0.0.0"]
