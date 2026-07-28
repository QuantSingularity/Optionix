import { renderHook, waitFor, act } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";

jest.mock("../services/authService", () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    register: jest.fn(),
    me: jest.fn(),
    refresh: jest.fn(),
  },
}));

jest.mock("../services/api", () => ({
  __esModule: true,
  extractErrorMessage: (err, fallback) => err?.message || fallback,
  setSessionExpiredHandler: jest.fn(),
  tokenStorage: {
    getAccessToken: jest.fn(() => Promise.resolve(null)),
    getRefreshToken: jest.fn(() => Promise.resolve(null)),
    setTokens: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

// eslint-disable-next-line import/first
import authService from "../services/authService";
// eslint-disable-next-line import/first
import { tokenStorage } from "../services/api";

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("starts unauthenticated with no stored token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  test("login stores tokens and loads the user profile", async () => {
    authService.login.mockResolvedValue({
      access_token: "access-123",
      refresh_token: "refresh-456",
    });
    authService.me.mockResolvedValue({
      email: "jane@example.com",
      full_name: "Jane Trader",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ email: "jane@example.com", password: "x" });
    });

    expect(tokenStorage.setTokens).toHaveBeenCalledWith(
      "access-123",
      "refresh-456",
    );
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user.email).toBe("jane@example.com");
  });

  test("login surfaces a readable error and does not authenticate", async () => {
    authService.login.mockRejectedValue(new Error("Invalid credentials"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.login({ email: "bad@example.com", password: "x" }),
      ).rejects.toThrow("Invalid credentials");
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  test("logout clears tokens and user state", async () => {
    authService.login.mockResolvedValue({
      access_token: "access-123",
      refresh_token: "refresh-456",
    });
    authService.me.mockResolvedValue({ email: "jane@example.com" });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login({ email: "jane@example.com", password: "x" });
    });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
