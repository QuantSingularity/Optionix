import { createContext, useCallback, useContext, useState } from "react";

const AuthContext = createContext();

const DEMO_USER = { id:1, email:"demo@optionix.com", full_name:"Demo Trader", role:"trader" };

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);   // start as guest → Home page shows
  const [loading]             = useState(false);
  const [error,   setError]   = useState(null);

  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      if (email === "demo@optionix.com" && password === "demo123") {
        localStorage.setItem("optionix_user", JSON.stringify(DEMO_USER));
        setUser(DEMO_USER);
        return { success: true };
      }
      try {
        const { default: api } = await import("./api");
        const fd = new FormData();
        fd.append("username", email); fd.append("password", password);
        const { data } = await api.post("/auth/login", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        localStorage.setItem("auth_token",    data.access_token);
        localStorage.setItem("optionix_user", JSON.stringify(data.user));
        setUser(data.user);
        return { success: true };
      } catch (_) {
        const msg = "Invalid credentials. Use demo@optionix.com / demo123.";
        setError(msg);
        return { success: false, error: msg };
      }
    } catch (err) {
      const msg = err.message || "Login failed.";
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const register = useCallback(async (email, password, fullName) => {
    try {
      setError(null);
      const { default: api } = await import("./api");
      const { data } = await api.post("/auth/register", { email, password, full_name: fullName });
      localStorage.setItem("auth_token",    data.access_token);
      localStorage.setItem("optionix_user", JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (_) {
      const msg = "Registration unavailable in demo mode. Use demo@optionix.com / demo123.";
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("optionix_user");
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export default AuthContext;
