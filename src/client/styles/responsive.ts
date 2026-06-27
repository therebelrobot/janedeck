// src/client/styles/responsive.ts — Breakpoint utilities (mobile-first)

import { breakpoints } from "./theme";

/**
 * Create a media query string for a minimum width breakpoint (mobile-first).
 * Usage: `const query = minWidth('md'); // "(min-width: 768px)"`
 */
export function minWidth(bp: keyof typeof breakpoints): string {
  return `(min-width: ${breakpoints[bp]}px)`;
}

/**
 * Create a media query string for a maximum width breakpoint.
 * Usage: `const query = maxWidth('md'); // "(max-width: 767px)"`
 */
export function maxWidth(bp: keyof typeof breakpoints): string {
  return `(max-width: ${breakpoints[bp] - 1}px)`;
}

/**
 * Create a media query for a range between two breakpoints.
 * Usage: `const query = between('sm', 'lg'); // "(min-width: 640px) and (max-width: 1023px)"`
 */
export function between(
  min: keyof typeof breakpoints,
  max: keyof typeof breakpoints,
): string {
  return `(min-width: ${breakpoints[min]}px) and (max-width: ${breakpoints[max] - 1}px)`;
}

/**
 * Check if we're on a mobile-sized screen.
 * Use for conditional rendering, not styling (prefer CSS media queries).
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < breakpoints.md;
}

/**
 * Check if we're on a tablet-sized screen.
 */
export function isTablet(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= breakpoints.md && window.innerWidth < breakpoints.lg;
}

/**
 * Check if we're on a desktop-sized screen.
 */
export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= breakpoints.lg;
}

/**
 * Media query strings for common breakpoints, ready for CSS-in-JS.
 */
export const media = {
  sm: `@media (min-width: ${breakpoints.sm}px)`,
  md: `@media (min-width: ${breakpoints.md}px)`,
  lg: `@media (min-width: ${breakpoints.lg}px)`,
  xl: `@media (min-width: ${breakpoints.xl}px)`,
  reducedMotion: "@media (prefers-reduced-motion: reduce)",
  highContrast: "@media (forced-colors: active)",
} as const;
