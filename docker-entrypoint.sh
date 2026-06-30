#!/bin/sh
# JaneDeck — Docker entrypoint
#
# The Cloudflare Workers runtime (workerd, via @cloudflare/vite-plugin) does
# not see the container's process environment — it only reads bindings from
# .dev.vars (or wrangler config). This regenerates .dev.vars from the env
# vars docker-compose injects, so `this.env.JANEDECK_ADMIN_PASSWORD` resolves
# inside the Worker the same way it would under `wrangler dev`.
set -e

if [ -n "$JANEDECK_ADMIN_PASSWORD" ]; then
  printf 'JANEDECK_ADMIN_PASSWORD=%s\n' "$JANEDECK_ADMIN_PASSWORD" > .dev.vars
fi

exec "$@"
