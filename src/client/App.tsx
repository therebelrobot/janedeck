// src/client/App.tsx — Root component with route definitions
// R5.5: ReducedMotionProvider wraps entire app.
// AnimatePresence provides page transition animations.
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ReducedMotionProvider } from "./animations/ReducedMotion";

// View imports
import { HomeView } from "./views/HomeView";
import { HostLogin } from "./views/host/HostLogin";
import { GameCreator } from "./views/host/GameCreator";
import { HostDashboard } from "./views/host/HostDashboard";
import { PlayerView } from "./views/player/PlayerView";
import { PresentationView } from "./views/presentation/PresentationView";
import { AudienceView } from "./views/audience/AudienceView";

/**
 * Error boundary for catching render errors.
 * R7.4: Error messages avoid blame — "Something went wrong on our end."
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>
            We ran into an unexpected problem. Please try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ marginTop: "var(--space-4)" }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Animated routes wrapper using AnimatePresence */
function AnimatedRoutes(): React.ReactElement {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Landing page */}
        <Route path="/" element={<HomeView />} />

        {/* Host routes */}
        <Route path="/host" element={<HostLogin />} />
        <Route path="/host/create" element={<GameCreator />} />
        <Route path="/host/:gameCode" element={<HostDashboard />} />

        {/* Player route */}
        <Route path="/play/:gameCode" element={<PlayerView />} />

        {/* Presentation route (shared screen) */}
        <Route path="/present/:gameCode" element={<PresentationView />} />

        {/* Audience route */}
        <Route path="/audience/:gameCode" element={<AudienceView />} />
      </Routes>
    </AnimatePresence>
  );
}

export function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <ReducedMotionProvider>
        <AnimatedRoutes />
      </ReducedMotionProvider>
    </ErrorBoundary>
  );
}
