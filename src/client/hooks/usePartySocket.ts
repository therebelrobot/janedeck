// src/client/hooks/usePartySocket.ts — PartySocket connection hook
// Manages WebSocket lifecycle with auto-reconnect and message routing.
import { useEffect, useRef, useCallback, useState } from "react";
import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage } from "@/shared/messages";
import type { PlayerRole } from "@/shared/types";
import { PARTY_GAME_ROOM } from "@/shared/constants";

/** Connection status for the WebSocket */
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UsePartySocketOptions {
  /** Game code (room ID) */
  gameCode: string;
  /** Role for this connection */
  role: PlayerRole;
  /** Auth token (for host/presentation connections) */
  token?: string;
  /** Callback when a server message is received */
  onMessage?: (message: ServerMessage) => void;
  /** Callback when the socket opens */
  onOpen?: () => void;
  /** Callback when the socket closes */
  onClose?: () => void;
  /** Callback when the socket errors */
  onError?: (event: Event) => void;
}

interface UsePartySocketReturn {
  /** Send a client message to the server */
  send: (message: ClientMessage) => void;
  /** Current connection status */
  status: ConnectionStatus;
  /** Ref to the underlying PartySocket instance */
  socket: React.RefObject<PartySocket | null>;
}

/**
 * Hook for managing a PartySocket WebSocket connection.
 * Handles connection lifecycle, auto-reconnect (built into PartySocket),
 * and message routing. Cleans up on unmount.
 */
export function usePartySocket({
  gameCode,
  role,
  token,
  onMessage,
  onOpen,
  onClose,
  onError,
}: UsePartySocketOptions): UsePartySocketReturn {
  const socketRef = useRef<PartySocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // Stabilize callbacks with refs to avoid reconnecting on every render
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const query: Record<string, string> = { role };
    if (token) {
      query.token = token;
    }

    setStatus("connecting");

    const socket = new PartySocket({
      host: window.location.host,
      room: gameCode,
      party: PARTY_GAME_ROOM,
      query,
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        onMessageRef.current?.(message);
      } catch {
        // Silently drop unparseable messages
      }
    });

    socket.addEventListener("open", () => {
      setStatus("connected");
      onOpenRef.current?.();
    });

    socket.addEventListener("close", () => {
      setStatus("disconnected");
      onCloseRef.current?.();
    });

    socket.addEventListener("error", (event) => {
      setStatus("error");
      onErrorRef.current?.(event);
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // Only reconnect when identity parameters change
  }, [gameCode, role, token]);

  const send = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { send, status, socket: socketRef };
}
