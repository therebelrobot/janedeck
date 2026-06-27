// src/server/authGate.ts — partyserver Durable Object for host authentication
// Singleton DO (room name = "global") that validates admin password and issues tokens.

import { Server } from "partyserver";
import type { Connection, ConnectionContext, WSMessage } from "partyserver";
import { nanoid } from "nanoid";
import { AUTH_TOKEN_TTL } from "@/shared/constants";

interface TokenData {
  createdAt: number;
  expiresAt: number;
}

export class AuthGate extends Server<Env> {
  /**
   * Initialize on first start.
   * The admin password is read from the JANEDECK_ADMIN_PASSWORD env var
   * and compared directly (no hashing in the workerd runtime since
   * bcrypt is not available; the env var is a secret).
   */
  async onStart(): Promise<void> {
    // Clean up any expired tokens on start
    await this.cleanupExpiredTokens();
  }

  /** Handle HTTP requests for authentication */
  async onRequest(req: Request): Promise<Response> {
    // Add CORS headers for cross-origin requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === "POST") {
      const response = await this.handleLogin(req);
      // Add CORS headers to response
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    }

    if (req.method === "GET") {
      const response = await this.handleTokenValidation(req);
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  /** POST /parties/auth-gate/global — Validate password and issue token */
  private async handleLogin(req: Request): Promise<Response> {
    try {
      const body = (await req.json()) as { password?: string };
      const { password } = body;

      if (!password) {
        return Response.json(
          { error: "Password is required" },
          { status: 400 },
        );
      }

      // Read admin password from environment variable
      const adminPassword = this.env.JANEDECK_ADMIN_PASSWORD ?? "";

      if (!adminPassword) {
        return Response.json(
          // R7.4: avoid blame language
          { error: "Server configuration is incomplete. Please contact the administrator." },
          { status: 500 },
        );
      }

      // Constant-time comparison to avoid timing attacks
      if (!timingSafeEqual(password, adminPassword)) {
        return Response.json(
          { error: "Invalid password" },
          { status: 401 },
        );
      }

      // Generate a secure token
      const token = nanoid(32);
      const now = Date.now();
      const tokenData: TokenData = {
        createdAt: now,
        expiresAt: now + AUTH_TOKEN_TTL,
      };

      await this.ctx.storage.put(`token:${token}`, tokenData);

      // Periodically clean up expired tokens (every 10th login)
      const loginCount =
        ((await this.ctx.storage.get<number>("meta:loginCount")) ?? 0) + 1;
      await this.ctx.storage.put("meta:loginCount", loginCount);
      if (loginCount % 10 === 0) {
        // Fire and forget — don't block the login response
        void this.cleanupExpiredTokens();
      }

      return Response.json({
        token,
        expiresAt: tokenData.expiresAt,
      });
    } catch {
      return Response.json(
        // R7.4: avoid blame — "Something went wrong on our end"
        { error: "Something went wrong on our end" },
        { status: 500 },
      );
    }
  }

  /** GET /parties/auth-gate/global?token=xxx — Validate a token */
  private async handleTokenValidation(
    req: Request,
  ): Promise<Response> {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return Response.json({ valid: false }, { status: 400 });
    }

    const data = await this.ctx.storage.get<TokenData>(
      `token:${token}`,
    );

    if (data && data.expiresAt > Date.now()) {
      return Response.json({ valid: true });
    }

    // Clean up this specific expired token if it exists
    if (data) {
      await this.ctx.storage.delete(`token:${token}`);
    }

    return Response.json({ valid: false }, { status: 401 });
  }

  /** Remove all expired tokens from storage */
  private async cleanupExpiredTokens(): Promise<void> {
    const allEntries = await this.ctx.storage.list<TokenData>({
      prefix: "token:",
    });

    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, tokenData] of allEntries) {
      if (tokenData && tokenData.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      await this.ctx.storage.delete(expiredKeys);
    }
  }
}

/**
 * Constant-time string comparison to avoid timing attacks.
 * Compares two strings byte-by-byte, always checking all characters.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid early return timing leak
    // Compare against itself to burn the same amount of time
    let result = 1; // length mismatch
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ a.charCodeAt(i);
    }
    return result === 0; // always false since result starts at 1
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
