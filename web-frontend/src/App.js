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
import Wallet from "./pages/Wallet";
import theme from "./theme";
import { AuthProvider } from "./utils/AuthContext";
import { WalletProvider } from "./utils/WalletContext";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <WalletProvider>
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
                  <Route path="wallet" element={<Wallet />} />
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
          </WalletProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
