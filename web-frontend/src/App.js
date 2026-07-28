import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "styled-components";
import DashboardLayout from "./components/common/DashboardLayout";
import ErrorBoundary from "./components/common/ErrorBoundary";
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./components/common/RouteGuards";
import Analytics from "./pages/Analytics";
import Compliance from "./pages/Compliance";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Portfolio from "./pages/Portfolio";
import Risk from "./pages/Risk";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Trading from "./pages/Trading";
import { AuthProvider } from "./utils/AuthContext";

const theme = {
  colors: {
    primary: "#3b82f6",
    secondary: "#f97316",
    gold: "#d4af6a",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
    background: "#0b0e17",
    backgroundLight: "#111827",
    backgroundElevated: "#161d2e",
    textPrimary: "#f1f5f9",
    textSecondary: "#94a3b8",
    border: "rgba(255, 255, 255, 0.07)",
    borderAccent: "rgba(59, 130, 246, 0.3)",
  },
  fonts: {
    display: "'Syne', sans-serif",
    body: "'DM Sans', sans-serif",
    mono: "'DM Mono', monospace",
    serif: "'Playfair Display', serif",
  },
  breakpoints: {
    mobile: "480px",
    tablet: "900px",
    desktop: "1200px",
  },
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public marketing site */}
              <Route path="/" element={<Home />} />

              {/* Auth flows */}
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <SignIn />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicOnlyRoute>
                    <SignUp />
                  </PublicOnlyRoute>
                }
              />

              {/* Authenticated app */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="trading" element={<Trading />} />
                <Route path="portfolio" element={<Portfolio />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="risk" element={<Risk />} />
                <Route path="compliance" element={<Compliance />} />
                <Route path="settings" element={<Settings />} />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
