// src/server/index.ts — Worker entry point for partyserver
// Routes incoming requests to the appropriate Durable Object class.

import { routePartykitRequest } from "partyserver";

// Re-export DO classes so the runtime can find them
export { GameRoom } from "./gameRoom";
export { AuthGate } from "./authGate";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
