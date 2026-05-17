import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext();

// ---------------------------------------------------------------------------
// Demo credentials – allows the app to work without a running backend.
// Replace or remove once the real API is connected.
// ---------------------------------------------------------------------------
const DEMO_USER = {
  id: 1,
  email: "demo@optionix.com",
  full_name: "Demo Trader",
  role: "trader",
};
const DEMO_CREDENTIALS = { email: "demo@optionix.com", password: "demo123" };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for an existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const stored = localStorage.getItem("optionix_user");
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (_err) {
        localStorage.removeItem("optionix_user");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      // ------------------------------------------------------------------
      // Demo mode: accept hardcoded credentials without a backend call.
      // Swap this block for a real API call when the backend is ready:
      //
      //   const formData = new FormData();
      //   formData.append("username", email);
      //   formData.append("password", password);
      //   const response = await api.post("/auth/login", formData, {
      //     headers: { "Content-Type": "multipart/form-data" },
      //   });
      //   const { access_token, user: userData } = response.data;
      //   localStorage.setItem("auth_token", access_token);
      //   setUser(userData);
      // ------------------------------------------------------------------
      if (
        email === DEMO_CREDENTIALS.email &&
        password === DEMO_CREDENTIALS.password
      ) {
        localStorage.setItem("optionix_user", JSON.stringify(DEMO_USER));
        setUser(DEMO_USER);
        return { success: true };
      }

      // Attempt real API login (will fail gracefully if backend is offline)
      try {
        const { default: api } = await import("./api");
        const formData = new FormData();
        formData.append("username", email);
        formData.append("password", password);
        const response = await api.post("/auth/login", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const { access_token, user: userData } = response.data;
        localStorage.setItem("auth_token", access_token);
        localStorage.setItem("optionix_user", JSON.stringify(userData));
        setUser(userData);
        return { success: true };
      } catch (_apiErr) {
        // Backend not available – show a helpful error
        const errorMessage =
          "Invalid credentials. Use demo@optionix.com / demo123 to try the demo.";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      const errorMessage = err.message || "Login failed.";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    try {
      setLoading(true);
      setError(null);

      try {
        const { default: api } = await import("./api");
        const response = await api.post("/auth/register", {
          email,
          password,
          full_name: fullName,
        });
        const { access_token, user: userData } = response.data;
        localStorage.setItem("auth_token", access_token);
        localStorage.setItem("optionix_user", JSON.stringify(userData));
        setUser(userData);
        return { success: true };
      } catch (_apiErr) {
        const errorMessage =
          "Registration is unavailable in demo mode. Use demo@optionix.com / demo123 to sign in.";
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      const errorMessage = err.message || "Registration failed.";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("optionix_user");
    setUser(null);
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
