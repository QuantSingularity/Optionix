import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import authService from "../services/authService";
import {
  extractErrorMessage,
  setSessionExpiredHandler,
  tokenStorage,
} from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await authService.me();
      setUser(profile);
      return profile;
    } catch {
      await tokenStorage.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const token = await tokenStorage.getAccessToken();
      if (token) {
        await loadProfile();
      }
      setIsLoading(false);
    };
    bootstrap();

    setSessionExpiredHandler(() => {
      setUser(null);
      setAuthError("Your session expired. Please sign in again.");
    });
    return () => setSessionExpiredHandler(null);
  }, [loadProfile]);

  const login = useCallback(
    async ({ email, password, mfaToken, rememberMe }) => {
      setAuthError(null);
      try {
        const tokenData = await authService.login({
          email,
          password,
          mfaToken,
          rememberMe,
        });
        await tokenStorage.setTokens(
          tokenData.access_token,
          tokenData.refresh_token,
        );
        return await loadProfile();
      } catch (err) {
        const message = extractErrorMessage(err, "Unable to sign in.");
        setAuthError(message);
        throw new Error(message);
      }
    },
    [loadProfile],
  );

  const register = useCallback(
    async ({ email, password, fullName, marketingConsent }) => {
      setAuthError(null);
      try {
        await authService.register({
          email,
          password,
          fullName,
          marketingConsent,
        });
        return await login({ email, password });
      } catch (err) {
        const message = extractErrorMessage(err, "Unable to create account.");
        setAuthError(message);
        throw new Error(message);
      }
    },
    [login],
  );

  const logout = useCallback(async () => {
    await tokenStorage.clear();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      authError,
      setAuthError,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, isLoading, authError, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export default AuthContext;
