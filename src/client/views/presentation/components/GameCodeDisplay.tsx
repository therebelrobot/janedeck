// src/client/views/presentation/components/GameCodeDisplay.tsx — Huge game code display
// R5.3: Semantic HTML. R5.4: High contrast text on dark bg (≥ 4.5:1).
// R5.5: Animations respect prefers-reduced-motion via ReducedMotionProvider.
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import QRCode from "react-qr-code";
import { colors, spacing, radii, shadows } from "../../../styles/theme";

interface GameCodeDisplayProps {
  /** The 6-character game code */
  gameCode: string;
}

/**
 * Large animated game code display for the presentation lobby screen.
 * Each character is rendered in its own styled box with a subtle bounce animation.
 */
export function GameCodeDisplay({ gameCode }: GameCodeDisplayProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const chars = Array.from(gameCode.toUpperCase());
  const joinUrl = `${window.location.origin}/play/${gameCode}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing[6],
      }}
    >
      {/* Instructions */}
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-2xl)",
          color: colors.textSecondary,
          margin: 0,
        }}
      >
        Join on your device!
      </p>

      {/* Character boxes */}
      <div
        style={{
          display: "flex",
          gap: spacing[3],
          justifyContent: "center",
          flexWrap: "wrap",
        }}
        aria-label={`Game code: ${gameCode}`}
        role="presentation"
      >
        {chars.map((char, index) => (
          <motion.span
            key={`${char}-${index}`}
            initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0, opacity: 0 }}
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : {
                    scale: 1,
                    opacity: 1,
                  }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : {
                    type: "spring",
                    stiffness: 400,
                    damping: 20,
                    delay: index * 0.08,
                  }
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "clamp(60px, 10vw, 120px)",
              height: "clamp(72px, 12vw, 140px)",
              backgroundColor: colors.bgCard,
              borderRadius: radii.xl,
              border: `3px solid ${colors.accentYellow}`,
              boxShadow: `0 0 30px rgba(250, 204, 21, 0.3)`,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 7vw, 6rem)",
              fontWeight: 700,
              color: colors.accentYellow,
              textShadow: "0 0 20px rgba(250, 204, 21, 0.5)",
            }}
            aria-hidden="true"
          >
            {char}
          </motion.span>
        ))}
      </div>

      {/* QR code + URL row */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[6],
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* QR code */}
        <div
          style={{
            padding: spacing[3],
            backgroundColor: "#ffffff",
            borderRadius: radii.lg,
            lineHeight: 0,
          }}
          aria-hidden="true"
        >
          <QRCode
            value={joinUrl}
            size={Math.min(160, Math.max(100, window.innerWidth * 0.1))}
            fgColor="#000000"
            bgColor="#ffffff"
          />
        </div>

        {/* URL pill */}
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.9rem, 2vw, 1.4rem)",
            color: colors.primaryLight,
            margin: 0,
            padding: `${spacing[3]} ${spacing[6]}`,
            backgroundColor: `${colors.primary}20`,
            borderRadius: radii.lg,
            border: `1px solid ${colors.primary}40`,
            wordBreak: "break-all",
          }}
        >
          {window.location.origin}/play/<strong style={{ color: colors.accentYellow }}>{gameCode}</strong>
        </p>
      </div>

      {/* Accessible screen-reader text */}
      <span className="sr-only">
        Game code is {chars.join(" ")}. Join at {joinUrl}
      </span>
    </div>
  );
}
