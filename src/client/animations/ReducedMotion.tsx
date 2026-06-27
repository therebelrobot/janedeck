// src/client/animations/ReducedMotion.tsx — prefers-reduced-motion wrapper
// R5.5: When prefers-reduced-motion is enabled, animations are instant (0ms)
// and decorative animations are disabled.

import React from "react";
import { MotionConfig } from "framer-motion";

interface ReducedMotionProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app with MotionConfig that respects prefers-reduced-motion.
 * When reduced motion is preferred, all Framer Motion animations
 * are reduced to instant transitions.
 */
export function ReducedMotionProvider({
  children,
}: ReducedMotionProviderProps): React.ReactElement {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
