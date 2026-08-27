// src/client/hooks/useFitToBox.ts — Shrink a roster until it fits its box
//
// The shared screen is the one display in the room nobody can scroll: whatever
// runs off the bottom of a projector is simply gone. Guessing at sizes from the
// player count can't work, because the same 17 teams have to fit a 1080p
// projector, a 1366x768 conference display and a laptop being screen-shared.
//
// So instead of guessing, the roster measures itself. It renders at its boldest
// layout, asks the browser whether it overflowed, and steps down through
// progressively tighter layouts until it fits — faces get smaller, then labels
// shrink, then the whole card collapses to a chip. If even the tightest layout
// can't hold everyone, it drops the tail and reports how many it had to hide so
// the caller can show a "+N more" tile.
import { useLayoutEffect, useEffect, useCallback, useRef, useState } from "react";

/** A pixel or two of rounding shouldn't trigger a step down */
const TOLERANCE = 2;

export interface FitResult<E extends HTMLElement = HTMLElement> {
  /**
   * Attach to the element holding the items. It must be height-constrained
   * (`flex: 1; min-height: 0; overflow: hidden`) and `position: relative`, so
   * that its own height is the space available and children measure against it.
   */
  ref: (node: E | null) => void;
  /** Index into the caller's layout ladder — 0 is the boldest layout */
  step: number;
  /** How many items to render; less than `itemCount` only as a last resort */
  visibleCount: number;
  /** Items that didn't fit even at the tightest layout */
  hiddenCount: number;
}

/**
 * Fit `itemCount` items into the returned ref's box, stepping through
 * `stepCount` progressively tighter layouts and finally dropping items.
 *
 * A pass only ever tightens, and a fresh pass starts from the boldest layout
 * whenever the item count changes or the box is resized — so a lobby that
 * collapsed to chips as people poured in opens back up if a team leaves or the
 * screen goes fullscreen.
 */
export function useFitToBox<E extends HTMLElement = HTMLDivElement>(
  itemCount: number,
  stepCount: number,
): FitResult<E> {
  // A callback ref, not a ref object: the roster is often mounted after its
  // parent (an empty lobby renders "waiting for teams" first), and an observer
  // wired up on mount against a ref that was still null would never fire —
  // leaving the layout stuck at whatever it guessed on the very first paint.
  const [node, setNode] = useState<E | null>(null);
  const nodeRef = useRef<E | null>(null);
  const ref = useCallback((next: E | null) => {
    nodeRef.current = next;
    setNode(next);
  }, []);
  const [step, setStep] = useState(0);
  const [visibleCount, setVisibleCount] = useState(itemCount);
  /** Bumped by the resize observer to start a fresh pass */
  const [generation, setGeneration] = useState(0);
  const passKey = useRef("");
  const boxHeight = useRef(0);

  // One effect does both the reset and the measurement, in that order.
  // Splitting them lets a reset and a step-down land in the same commit, where
  // the step-down wins — which ratchets the layout tighter on every arrival and
  // leaves a half-full lobby rendered as if it were packed.
  //
  // The measurement waits two frames rather than reading straight out of the
  // layout effect. The cards are motion components, and Framer applies their
  // styles on its own scheduler a frame after React commits — so an immediate
  // read (or a single rAF) measures the rung above the one just applied, and
  // the ladder walks all the way to the bottom no matter how much room there
  // is. Two frames is the first point where the boxes match the styles.
  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        // The reset comes first, before any bail-out. visibleCount starts at
        // whatever itemCount was on the very first render — often zero, since
        // scores arrive after the board mounts — and a board rendering zero
        // rows has zero height, which would trip the not-laid-out guard below
        // and strand it empty for the rest of the game.
        const key = `${itemCount}:${stepCount}:${generation}`;
        if (passKey.current !== key) {
          passKey.current = key;
          if (step !== 0 || visibleCount !== itemCount) {
            setStep(0);
            setVisibleCount(itemCount);
            return; // measure again next render, against the boldest layout
          }
        }

        if (el.clientHeight === 0) return; // not laid out yet (hidden tab, first paint)

        // Which rung the roster settled on, so a person (or the load test) can
        // see whether a screen is collapsing further than it needs to.
        el.dataset.fitStep = String(step);
        el.dataset.fitBox = `${el.clientHeight}/${el.scrollHeight}`;

        if (el.scrollHeight <= el.clientHeight + TOLERANCE) return;

        if (step < stepCount - 1) {
          setStep(step + 1);
          return;
        }

        // Tightest layout and still overflowing: keep only the items that fit,
        // leaving a slot for the caller's "+N more" tile.
        const children = Array.from(el.children) as HTMLElement[];
        let fits = 0;
        for (const child of children) {
          if (child.offsetTop + child.offsetHeight > el.clientHeight + TOLERANCE) break;
          fits++;
        }
        const next = Math.max(1, fits - 1);
        if (next < visibleCount) setVisibleCount(next);
      });
    });

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  });

  // The box changed size — a resized window, a fullscreen toggle, or a sibling
  // above growing. Start a fresh pass from the boldest layout.
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      if (Math.abs(height - boxHeight.current) < TOLERANCE) return;
      boxHeight.current = height;
      setGeneration((value) => value + 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, step, visibleCount, hiddenCount: Math.max(0, itemCount - visibleCount) };
}
