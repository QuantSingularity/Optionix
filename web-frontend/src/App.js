import { useState } from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import styled, { ThemeProvider } from "styled-components";
import ErrorBoundary from "./components/common/ErrorBoundary";
import Footer from "./components/common/Footer";
// Components
import Navbar from "./components/common/Navbar";
import Sidebar from "./components/common/Sidebar";
import Analytics from "./pages/Analytics";
// Pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Portfolio from "./pages/Portfolio";
import Trading from "./pages/Trading";
import { AppProvider } from "./utils/AppContext";
import { AuthProvider, useAuth } from "./utils/AuthContext";

// Theme
const theme = {
  colors: {
    primary: "#2962ff",
    primaryDark: "#0039cb",
    primaryLight: "#768fff",
    secondary: "#ff6d00",
    secondaryDark: "#c43c00",
    secondaryLight: "#ff9e40",
    backgroundDark: "#131722",
    backgroundLight: "#1e222d",
    textPrimary: "#ffffff",
    textSecondary: "#b2b5be",
    success: "#26a69a",
    danger: "#ef5350",
    warning: "#ffca28",
    info: "#42a5f5",
    border: "#2a2e39",
    cardBg: "#1e222d",
  },
  breakpoints: {
    mobile: "576px",
    tablet: "768px",
    desktop: "992px",
    wide: "1200px",
  },
};

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${(props) => props.theme.colors.backgroundDark};
  color: ${(props) => props.theme.colors.textPrimary};
`;

const MainContent = styled.main`
  display: flex;
  flex: 1;
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 20px;
  padding-top: 90px;
  margin-left: ${(props) => (props.hasSidebar ? "240px" : "0")};

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    margin-left: 0;
    padding-top: 90px;
  }
`;

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <AppContainer>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
          }}
        >
          <p>Loading...</p>
        </div>
      </AppContainer>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Main App Component
const AppContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isAuthenticated } = useAuth();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppContainer>
                <Navbar toggleSidebar={toggleSidebar} />
                <MainContent>
                  <Sidebar isOpen={sidebarOpen} />
                  <ContentArea hasSidebar={isAuthenticated && sidebarOpen}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/trading" element={<Trading />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/analytics" element={<Analytics />} />
                    </Routes>
                  </ContentArea>
                </MainContent>
                <Footer />
              </AppContainer>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
