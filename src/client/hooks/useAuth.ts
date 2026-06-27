// src/client/hooks/useAuth.ts — Host authentication hook
// R9.5: Token stored in sessionStorage (not localStorage) for session-scoped security.
// Posts to the AuthGate party HTTP endpoint for password validation.
import { useState, useCallback, useEffect } from "react";
import { PARTY_AUTH_GATE } from "@/shared/constants";

/** Key used for sessionStorage — R9.5: sensitive data, session-scoped */
const AUTH_TOKEN_KEY = "janedeck_host_token";

interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
}

interface UseAuthReturn {
  /** Whether the user currently has a valid token */
  isAuthenticated: boolean;
  /** The current auth token (null if not authenticated) */
  token: string | null;
  /** Attempt to log in with a password */
  login: (password: string) => Promise<LoginResult>;
  /** Clear the stored token and log out */
  logout: () => void;
  /** Get the current token (from sessionStorage) */
  getToken: () => string | null;
}

/**
 * Hook for host authentication against the AuthGate party.
 * Manages token lifecycle with sessionStorage.
 */
export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState<string | null>(() => {
    // Initialize from sessionStorage if available
    try {
      return sessionStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const isAuthenticated = token !== null;

  const login = useCallback(async (password: string): Promise<LoginResult> => {
    try {
      // Build the URL for the auth party HTTP endpoint
      const authUrl = `/parties/${PARTY_AUTH_GATE}/global`;

      const response = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json() as { token?: string; error?: string; expiresAt?: number };

      if (!response.ok || !data.token) {
        return {
          success: false,
          // R7.4: avoid blame language in error display
          error: data.error ?? "Unable to authenticate. Please try again.",
        };
      }

      // Store in sessionStorage — R9.5: session-scoped, not persisted
      try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
      } catch {
        // sessionStorage may be unavailable in some contexts
      }

      setToken(data.token);

      return { success: true, token: data.token };
    } catch {
      return {
        success: false,
        // R7.4: "Something went wrong on our end" — no blame
        error: "Something went wrong. Please check your connection and try again.",
      };
    }
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
      // sessionStorage may be unavailable
    }
    setToken(null);
  }, []);

  const getToken = useCallback((): string | null => {
    try {
      return sessionStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }, []);

  // Sync state if sessionStorage changes externally (e.g., another tab)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_TOKEN_KEY) {
        setToken(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return { isAuthenticated, token, login, logout, getToken };
}
