import { useState } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import styled, { ThemeProvider } from "styled-components";
import ErrorBoundary from "./components/common/ErrorBoundary";
import Footer from "./components/common/Footer";
import Navbar from "./components/common/Navbar";
import Sidebar from "./components/common/Sidebar";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Portfolio from "./pages/Portfolio";
import Trading from "./pages/Trading";
import { AppProvider } from "./utils/AppContext";
import { AuthProvider, useAuth } from "./utils/AuthContext";

const theme = {
  colors: {
    primary:         "#3b82f6",
    primaryDark:     "#2563eb",
    primaryLight:    "#93c5fd",
    secondary:       "#f97316",
    secondaryDark:   "#c2410c",
    secondaryLight:  "#fdba74",
    backgroundDark:  "#0b0e17",
    backgroundLight: "#111827",
    backgroundElevated:"#161d2e",
    textPrimary:     "#f1f5f9",
    textSecondary:   "#94a3b8",
    success:         "#10b981",
    danger:          "#ef4444",
    warning:         "#f59e0b",
    info:            "#06b6d4",
    border:          "rgba(255,255,255,0.07)",
    borderAccent:    "rgba(59,130,246,0.3)",
    cardBg:          "#111827",
  },
  breakpoints: {
    mobile:  "576px",
    tablet:  "768px",
    desktop: "992px",
    wide:    "1200px",
  },
  fonts: {
    display: "'Syne', sans-serif",
    body:    "'DM Sans', sans-serif",
    mono:    "'DM Mono', monospace",
  },
};

/* ─── Authenticated app shell ────────────────────────────── */
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${p => p.theme.colors.backgroundDark};
  color: ${p => p.theme.colors.textPrimary};
`;

const Body = styled.main`display: flex; flex: 1;`;

const ContentArea = styled.div`
  flex: 1;
  padding: 90px 28px 28px;
  margin-left: ${p => (p.$hasSidebar ? "240px" : "0")};
  transition: margin-left 0.3s ease;
  min-height: 100vh;

  @media (max-width: ${p => p.theme.breakpoints.tablet}) {
    margin-left: 0;
  }
`;

/* ─── Protected route ────────────────────────────────────── */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"center",
        minHeight:"100vh", backgroundColor:"#0b0e17",
        color:"#94a3b8", fontFamily:"'DM Sans',sans-serif", fontSize:"16px",
      }}>
        Loading…
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/* ─── Authenticated layout ───────────────────────────────── */
const AuthLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isAuthenticated } = useAuth();

  return (
    <Shell>
      <Navbar toggleSidebar={() => setSidebarOpen(o => !o)} />
      <Body>
        <Sidebar isOpen={sidebarOpen} />
        <ContentArea $hasSidebar={isAuthenticated && sidebarOpen}>
          <Routes>
            <Route index              element={<Dashboard />} />
            <Route path="trading"    element={<Trading />} />
            <Route path="portfolio"  element={<Portfolio />} />
            <Route path="analytics"  element={<Analytics />} />
            <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ContentArea>
      </Body>
      <Footer />
    </Shell>
  );
};

/* ─── Root app content ───────────────────────────────────── */
const AppContent = () => (
  <Router>
    <Routes>
      {/* Public routes */}
      <Route path="/"      element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Protected routes — everything under /dashboard/* */}
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <AuthLayout />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
);

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <AuthProvider>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
