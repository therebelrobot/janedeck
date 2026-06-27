// src/client/views/host/HostLogin.tsx — Host authentication page
// R5.6: autocomplete="current-password", aria-live for errors, <label for>.
// R5.9: Enter key submits, keyboard accessible.
// R5.3: Semantic HTML. R7.4: No blame language in errors.
import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { colors, radii, spacing, shadows } from "../../styles/theme";
import { pageTransition, slideFromBottom, shake } from "../../animations/presets";

/**
 * HomeView — Landing page at "/" with links to each role.
 */
export function HomeView(): React.ReactElement {
  return (
    <motion.div
      className="view"
      {...pageTransition}
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        gap: spacing[8],
      }}
    >
      {/* Branding */}
      <motion.h1
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-6xl)",
          fontWeight: 700,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        JaneDeck
      </motion.h1>

      <p
        style={{
          fontSize: "var(--text-xl)",
          color: colors.textSecondary,
          maxWidth: 400,
        }}
      >
        A live trivia game show for everyone
      </p>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing[4],
          width: "100%",
          maxWidth: 300,
        }}
        aria-label="Game roles"
      >
        <Link to="/host" style={{ textDecoration: "none" }}>
          <button
            type="button"
            className="btn-lg"
            style={{
              width: "100%",
              backgroundColor: colors.secondary,
              fontSize: "var(--text-xl)",
            }}
          >
            🎤 Host a Game
          </button>
        </Link>
      </nav>
    </motion.div>
  );
}

/**
 * HostLogin — Password-protected entrance to the host dashboard.
 * Styled as a VIP backstage area with animated gradient background.
 */
export function HostLogin(): React.ReactElement {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasShake, setHasShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If already authenticated, redirect to create
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/host/create", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Focus the password input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim() || isLoading) return;

      setError(null);
      setIsLoading(true);
      setHasShake(false);

      const result = await login(password);

      setIsLoading(false);

      if (result.success) {
        navigate("/host/create");
      } else {
        // R7.4: Non-blame error message
        setError(result.error ?? "Unable to authenticate. Please try again.");
        setHasShake(true);
        // Reset shake after animation
        setTimeout(() => setHasShake(false), 500);
        inputRef.current?.focus();
      }
    },
    [password, isLoading, login, navigate],
  );

  return (
    <motion.div
      className="view"
      {...pageTransition}
      style={{
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(ellipse at 30% 20%, ${colors.secondary}20 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, ${colors.primary}20 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, ${colors.accentPurple}10 0%, transparent 60%)
          `,
          zIndex: -1,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />

      {/* Login card */}
      <motion.div
        {...slideFromBottom}
        style={{
          backgroundColor: colors.bgCard,
          borderRadius: radii.xl,
          padding: spacing[8],
          border: `1px solid ${colors.border}`,
          boxShadow: shadows.lg,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: spacing[6],
        }}
      >
        {/* Branding */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          style={{ textAlign: "center" }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-4xl)",
              fontWeight: 700,
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: spacing[2],
            }}
          >
            JaneDeck
          </h1>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-lg)",
              color: colors.textSecondary,
              fontWeight: 500,
              margin: 0,
            }}
          >
            🎤 Host Backstage
          </p>
        </motion.div>

        {/* Divider */}
        <div
          style={{
            width: "60%",
            height: 1,
            backgroundColor: colors.border,
          }}
          aria-hidden="true"
        />

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: spacing[4],
          }}
          noValidate
        >
          {/* Password field */}
          <div>
            <label
              htmlFor="host-password"
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: colors.textSecondary,
              }}
            >
              Host Password
            </label>
            <div style={{ position: "relative" }}>
              <motion.div
                animate={hasShake ? shake.animate : {}}
              >
                {/* R5.6: autocomplete="current-password" for accessibility */}
                <input
                  ref={inputRef}
                  id="host-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="current-password"
                  placeholder="Enter host password..."
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={error ? "true" : "false"}
                  style={{
                    paddingInlineEnd: 56,
                    borderColor: error ? colors.incorrect : undefined,
                  }}
                />
              </motion.div>

              {/* Show/hide toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  insetInlineEnd: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: colors.textSecondary,
                  cursor: "pointer",
                  padding: spacing[2],
                  fontSize: "var(--text-sm)",
                  minHeight: 36,
                  minWidth: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* R5.6: aria-live="polite" for error announcements */}
          <div
            id="login-error"
            role="alert"
            aria-live="polite"
            style={{
              minHeight: 24,
              display: "flex",
              alignItems: "center",
            }}
          >
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  color: colors.incorrect,
                  fontSize: "var(--text-sm)",
                  margin: 0,
                }}
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="btn-lg"
            style={{
              width: "100%",
              backgroundColor: colors.secondary,
              fontSize: "var(--text-lg)",
              minHeight: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[2],
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 20,
                    height: 20,
                    border: `3px solid rgba(255,255,255,0.3)`,
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                  aria-hidden="true"
                />
                Authenticating...
              </>
            ) : (
              "🔑 Enter as Host"
            )}
          </button>
        </form>

        {/* Back link */}
        <Link
          to="/"
          style={{
            fontSize: "var(--text-sm)",
            color: colors.textSecondary,
          }}
        >
          ← Back to home
        </Link>
      </motion.div>

      {/* Inline keyframe for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}
