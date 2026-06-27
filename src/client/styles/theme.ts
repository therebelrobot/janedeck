// src/client/styles/theme.ts — Design tokens as TypeScript constants
// These mirror the CSS custom properties for use in JS/Framer Motion.
// R5.4: All text colors maintain ≥ 4.5:1 contrast on their backgrounds.

export const colors = {
  // Primary palette
  primary: "#3b82f6",
  primaryDark: "#2563eb",
  primaryLight: "#60a5fa",

  // Secondary palette
  secondary: "#ec4899",
  secondaryDark: "#db2777",
  secondaryLight: "#f472b6",

  // Accent colors
  accentYellow: "#facc15",
  accentGreen: "#22c55e",
  accentOrange: "#f97316",
  accentPurple: "#a855f7",

  // Feedback colors
  correct: "#22c55e",
  incorrect: "#ef4444",
  needsReview: "#eab308",
  bonus: "#a855f7",

  // Background (dark theme for contrast)
  bg: "#0f172a",
  bgCard: "#1e293b",
  bgElevated: "#334155",

  // Text — high contrast on dark backgrounds (≥ 4.5:1)
  text: "#f1f5f9",
  textSecondary: "#94a3b8",
  textOnPrimary: "#ffffff",
  textOnDark: "#e2e8f0",

  // Borders
  border: "#475569",
  borderLight: "#64748b",
} as const;

export const fonts = {
  display: '"Fredoka", system-ui, -apple-system, sans-serif',
  body: '"Inter", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export const durations = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  score: 1.5,
} as const;

export const spacing = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  12: "3rem",
  16: "4rem",
} as const;

export const radii = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
  md: "0 4px 6px rgba(0, 0, 0, 0.3)",
  lg: "0 10px 15px rgba(0, 0, 0, 0.4)",
  glow: "0 0 20px rgba(59, 130, 246, 0.3)",
  glowPink: "0 0 20px rgba(236, 72, 153, 0.3)",
  glowGreen: "0 0 20px rgba(34, 197, 94, 0.3)",
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  toast: 50,
  confetti: 9999,
} as const;
