// src/client/components/LogoutButton.tsx — Clears the host auth token and returns to login
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { colors, spacing } from "../styles/theme";

interface LogoutButtonProps {
  style?: React.CSSProperties;
}

/**
 * Logs the host out: clears the stored session token and returns to the
 * login screen. Use this any time a stale/invalid token needs clearing
 * without the host having to manually clear browser storage.
 */
export function LogoutButton({ style }: LogoutButtonProps): React.ReactElement {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/host", { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="btn-ghost"
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        color: colors.textSecondary,
        fontSize: "var(--text-sm)",
        ...style,
      }}
    >
      🚪 Logout
    </button>
  );
}
