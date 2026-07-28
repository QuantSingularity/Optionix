import { Navigate, useLocation } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../../utils/AuthContext";
import { Spinner } from "./UI";

const FullScreen = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-dark);
  gap: 12px;
  color: var(--text-secondary);
  font-family: "DM Sans", sans-serif;
  font-size: 14px;
`;

export const LoadingScreen = () => (
  <FullScreen>
    <Spinner $size="20px" /> Loading Optionix…
  </FullScreen>
);

/** Only reachable when signed in — otherwise bounces to /login. */
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

/** Only reachable when signed out — otherwise skips straight to the dashboard. */
export const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};
