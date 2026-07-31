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
    primary: "#c6a15b",
    secondary: "#4f8f74",
    gold: "#c6a15b",
    success: "#3f9d72",
    danger: "#c2483f",
    warning: "#c98d3f",
    background: "#08090b",
    backgroundLight: "#121316",
    backgroundElevated: "#1a1b1f",
    textPrimary: "#f3f1ea",
    textSecondary: "#93938a",
    border: "rgba(243, 241, 234, 0.08)",
    borderAccent: "rgba(198, 161, 91, 0.32)",
  },
  fonts: {
    display: "'DM Sans', sans-serif",
    body: "'DM Sans', sans-serif",
    mono: "'DM Mono', monospace",
    serif: "'Cormorant Garamond', serif",
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
