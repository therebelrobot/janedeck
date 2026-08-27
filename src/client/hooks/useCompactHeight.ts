// src/client/hooks/useCompactHeight.ts — Is the viewport short enough to need tighter layout?
//
// The presentation surface is fixed-height (see .view--presentation), so a
// screen with a lot of fixed-size content — a title, a podium, a closing
// line — can genuinely run out of room on a 768px-tall conference display
// even though the same layout is comfortable at 1080p. Font and avatar sizes
// there are tuned to viewport WIDTH (vw), which says nothing about how tall
// the screen actually is.
//
// Mirrors framer-motion's useReducedMotion — a matchMedia listener, not a
// resize handler — so it's cheap and updates if a shared browser window is
// resized mid-game.
import { useState, useEffect } from "react";

export function useCompactHeight(thresholdPx: number): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerHeight <= thresholdPx,
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-height: ${thresholdPx}px)`);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [thresholdPx]);

  return compact;
}
