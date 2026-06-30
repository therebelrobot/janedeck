// src/client/components/SoundToggle.tsx — Toggles synthesized notification sounds on/off
import React, { useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "../utils/soundEffects";
import { colors, spacing } from "../styles/theme";

interface SoundToggleProps {
  style?: React.CSSProperties;
}

export function SoundToggle({ style }: SoundToggleProps): React.ReactElement {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());

  const handleToggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="btn-ghost"
      aria-pressed={enabled}
      aria-label={enabled ? "Mute sound effects" : "Unmute sound effects"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
        color: colors.textSecondary,
        fontSize: "var(--text-sm)",
        ...style,
      }}
    >
      {enabled ? "🔊 Sound" : "🔇 Muted"}
    </button>
  );
}
