// src/client/components/Confetti.tsx — Canvas-based confetti effect
// R5.5: Disabled when prefers-reduced-motion is enabled.
// Shows static sparkle emoji instead for reduced motion users.
import React, { useEffect, useRef, useCallback } from "react";
import { useReducedMotion } from "framer-motion";

interface ConfettiProps {
  /** Whether the confetti is currently active */
  active: boolean;
  /** Duration in ms before auto-cleanup (default: 3000) */
  duration?: number;
  /** Custom confetti colors */
  colors?: string[];
}

/** Default confetti colors — game-show vibrant palette */
const DEFAULT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFEAA7",
  "#DDA0DD", "#F97316", "#22C55E", "#A855F7",
  "#EC4899", "#3B82F6",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "square" | "circle" | "strip";
}

/**
 * Canvas-based confetti particle effect for winner reveals.
 * Uses Canvas instead of DOM elements for performance.
 * Respects prefers-reduced-motion — shows static sparkle instead.
 */
export function Confetti({
  active,
  duration = 3000,
  colors = DEFAULT_COLORS,
}: ConfettiProps): React.ReactElement | null {
  const prefersReducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const createParticles = useCallback(
    (canvas: HTMLCanvasElement) => {
      const particles: Particle[] = [];
      const count = 80;

      for (let i = 0; i < count; i++) {
        const shapes: Particle["shape"][] = ["square", "circle", "strip"];
        particles.push({
          x: Math.random() * canvas.width,
          y: -10 - Math.random() * canvas.height * 0.5,
          vx: (Math.random() - 0.5) * 6,
          vy: Math.random() * 3 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          opacity: 1,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }

      return particles;
    },
    [colors],
  );

  const drawParticle = useCallback(
    (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      switch (p.shape) {
        case "square":
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "strip":
          ctx.fillRect(-p.size / 4, -p.size, p.size / 2, p.size * 2);
          break;
      }

      ctx.restore();
    },
    [],
  );

  useEffect(() => {
    if (!active || prefersReducedMotion) {
      // Cancel any running animation
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas to full viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = createParticles(canvas);
    startTimeRef.current = performance.now();

    function animate(currentTime: number) {
      if (!canvas || !ctx) return;

      const elapsed = currentTime - startTimeRef.current;
      const fadeStart = duration * 0.7;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let aliveCount = 0;

      for (const p of particlesRef.current) {
        // Physics
        p.x += p.vx;
        p.vy += 0.1; // gravity
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.vx *= 0.99; // air resistance

        // Fade out near end
        if (elapsed > fadeStart) {
          p.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart));
        }

        // Only draw visible particles
        if (p.y < canvas.height + 20 && p.opacity > 0.01) {
          drawParticle(ctx, p);
          aliveCount++;
        }
      }

      // Continue animation if particles alive and within duration
      if (aliveCount > 0 && elapsed < duration) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Clear canvas when done
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animFrameRef.current = null;
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      window.removeEventListener("resize", handleResize);
    };
  }, [active, duration, prefersReducedMotion, createParticles, drawParticle]);

  if (!active) return null;

  // R5.5: For reduced motion users, show a static sparkle instead of animation
  if (prefersReducedMotion) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 9999,
          fontSize: "4rem",
        }}
        aria-hidden="true"
      >
        ✨🎉✨
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="confetti-canvas"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
      aria-hidden="true"
    />
  );
}
