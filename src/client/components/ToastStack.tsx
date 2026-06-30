// src/client/components/ToastStack.tsx — Bingo mark/win toast notifications
// Mounted once at the app root so notifications reach players on their own
// device regardless of which view/route is active — the presentation screen
// may not be watched, so this can't be presentation-only.
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationStore } from "../stores/notificationStore";
import { colors, radii, spacing, shadows, zIndex } from "../styles/theme";
import { popIn } from "../animations/presets";

export function ToastStack(): React.ReactElement | null {
  const queue = useNotificationStore((s) => s.queue);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (queue.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: spacing[4],
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column-reverse",
        gap: spacing[2],
        zIndex: zIndex.toast,
        pointerEvents: "none",
        width: "min(420px, calc(100vw - 2rem))",
      }}
      aria-live="polite"
      role="status"
    >
      <AnimatePresence mode="popLayout">
        {queue.slice(-4).map((toast) => (
          <motion.div
            key={toast.id}
            layout
            {...popIn}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={() => dismiss(toast.id)}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
              padding: `${spacing[3]} ${spacing[4]}`,
              borderRadius: radii.lg,
              boxShadow: shadows.lg,
              backgroundColor: toast.kind === "win" ? colors.accentYellow : colors.bgElevated,
              color: toast.kind === "win" ? "#1a1a1a" : colors.text,
              border: `1px solid ${toast.kind === "win" ? colors.accentYellow : colors.border}`,
              fontSize: "var(--text-sm)",
              fontWeight: toast.kind === "win" ? 700 : 500,
              textAlign: "center",
            }}
          >
            {toast.kind === "win" ? "🏆 " : "✅ "}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
