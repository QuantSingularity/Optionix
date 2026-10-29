import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../../context/AuthContext";
import authService from "../../services/authService";
import { setSessionExpiredHandler, tokenStorage } from "../../services/api";

jest.mock("../../services/authService", () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    register: jest.fn(),
    me: jest.fn(),
    refresh: jest.fn(),
  },
}));
jest.mock("../../services/api", () => ({
  __esModule: true,
  extractErrorMessage: (err, fallback) => err?.message || fallback,
  setSessionExpiredHandler: jest.fn(),
  tokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
  },
}));

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
const profile = { email: "jane@example.com", full_name: "Jane Trader" };

const ready = async () => {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
};

beforeEach(() => {
  jest.clearAllMocks();
  tokenStorage.getAccessToken.mockResolvedValue(null);
});

describe("useAuth", () => {
  it("throws outside a provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
    spy.mockRestore();
  });
});

describe("bootstrap", () => {
  it("is loading until the stored session has been checked", async () => {
    tokenStorage.getAccessToken.mockResolvedValue("tok");
    authService.me.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("restores the session from a stored token", async () => {
    tokenStorage.getAccessToken.mockResolvedValue("tok");
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    expect(result.current.user).toEqual(profile);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("clears tokens when the stored token is rejected", async () => {
    tokenStorage.getAccessToken.mockResolvedValue("bad");
    authService.me.mockRejectedValue(new Error("401"));
    const { result } = await ready();
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("does not call the API when there is no token", async () => {
    await ready();
    expect(authService.me).not.toHaveBeenCalled();
  });
});

describe("session expiry", () => {
  it("registers a handler that signs the user out with a message", async () => {
    tokenStorage.getAccessToken.mockResolvedValue("tok");
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    const handler = setSessionExpiredHandler.mock.calls[0][0];
    expect(typeof handler).toBe("function");

    act(() => handler());

    expect(result.current.user).toBeNull();
    expect(result.current.authError).toBe(
      "Your session expired. Please sign in again.",
    );
  });

  it("unregisters the handler on unmount", async () => {
    const { unmount } = await ready();
    unmount();
    expect(setSessionExpiredHandler).toHaveBeenLastCalledWith(null);
  });
});

describe("login", () => {
  it("passes MFA and remember-me through", async () => {
    authService.login.mockResolvedValue({
      access_token: "a",
      refresh_token: "r",
    });
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    await act(async () => {
      await result.current.login({
        email: "e",
        password: "p",
        mfaToken: "123456",
        rememberMe: true,
      });
    });
    expect(authService.login).toHaveBeenCalledWith({
      email: "e",
      password: "p",
      mfaToken: "123456",
      rememberMe: true,
    });
  });

  it("clears a previous error when retrying", async () => {
    authService.login.mockRejectedValueOnce(new Error("Nope"));
    const { result } = await ready();
    await act(async () => {
      await expect(
        result.current.login({ email: "e", password: "p" }),
      ).rejects.toThrow("Nope");
    });
    expect(result.current.authError).toBe("Nope");

    authService.login.mockResolvedValue({
      access_token: "a",
      refresh_token: "r",
    });
    authService.me.mockResolvedValue(profile);
    await act(async () => {
      await result.current.login({ email: "e", password: "p" });
    });
    expect(result.current.authError).toBeNull();
  });
});

describe("register", () => {
  it("creates the account, then signs in with the same credentials", async () => {
    authService.register.mockResolvedValue({});
    authService.login.mockResolvedValue({
      access_token: "a",
      refresh_token: "r",
    });
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();

    await act(async () => {
      await result.current.register({
        email: "jane@example.com",
        password: "Pw1!aaaa",
        fullName: "Jane",
        marketingConsent: true,
      });
    });

    expect(authService.register).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Pw1!aaaa",
      fullName: "Jane",
      marketingConsent: true,
    });
    expect(authService.login).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Pw1!aaaa",
      mfaToken: undefined,
      rememberMe: undefined,
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("surfaces registration errors and does not attempt a login", async () => {
    authService.register.mockRejectedValue(new Error("Email taken"));
    const { result } = await ready();
    await act(async () => {
      await expect(
        result.current.register({ email: "e", password: "p", fullName: "n" }),
      ).rejects.toThrow("Email taken");
    });
    expect(authService.login).not.toHaveBeenCalled();
    expect(result.current.authError).toBe("Email taken");
  });
});

describe("logout / refreshProfile / setAuthError", () => {
  it("logout clears the user and tokens", async () => {
    tokenStorage.getAccessToken.mockResolvedValue("tok");
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    await act(async () => {
      await result.current.logout();
    });
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("refreshProfile reloads the user", async () => {
    tokenStorage.getAccessToken.mockResolvedValue("tok");
    authService.me.mockResolvedValueOnce(profile);
    const { result } = await ready();
    authService.me.mockResolvedValueOnce({ ...profile, full_name: "Jane Q" });
    await act(async () => {
      await result.current.refreshProfile();
    });
    expect(result.current.user.full_name).toBe("Jane Q");
  });

  it("lets screens set and clear the auth error", async () => {
    const { result } = await ready();
    act(() => result.current.setAuthError("custom"));
    expect(result.current.authError).toBe("custom");
    act(() => result.current.setAuthError(null));
    expect(result.current.authError).toBeNull();
  });
});
