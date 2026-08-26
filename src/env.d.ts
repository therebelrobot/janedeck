// src/env.d.ts — Cloudflare Workers environment type definitions
// Generated interface for Durable Object bindings and environment variables.

interface Env {
  GameRoom: DurableObjectNamespace;
  AuthGate: DurableObjectNamespace;
  JANEDECK_ADMIN_PASSWORD: string;
  /**
   * R2 bucket holding host-uploaded question media.
   *
   * Optional: an instance without this binding runs every game type normally,
   * it just reports media uploads as unavailable (see GET /media/config).
   */
  MEDIA?: R2Bucket;
}
