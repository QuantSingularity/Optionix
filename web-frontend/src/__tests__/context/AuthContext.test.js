import { act, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../../utils/AuthContext";
import authService from "../../services/authService";
import { tokenStorage } from "../../services/apiClient";

jest.mock("../../services/authService", () => ({
  __esModule: true,
  default: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
}));
jest.mock("../../services/apiClient", () => ({
  __esModule: true,
  extractErrorMessage: (err, fallback) => err?.message || fallback,
  tokenStorage: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
    clear: jest.fn(),
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
  tokenStorage.getAccessToken.mockReturnValue(null);
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
  it("stays loading while the stored session is verified", () => {
    tokenStorage.getAccessToken.mockReturnValue("tok");
    authService.me.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("finishes unauthenticated without a token and does not call the API", async () => {
    const { result } = await ready();
    expect(result.current.isAuthenticated).toBe(false);
    expect(authService.me).not.toHaveBeenCalled();
  });

  it("restores the session from a stored token", async () => {
    tokenStorage.getAccessToken.mockReturnValue("tok");
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    expect(result.current.user).toEqual(profile);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("clears tokens when the stored token is rejected", async () => {
    tokenStorage.getAccessToken.mockReturnValue("bad");
    authService.me.mockRejectedValue(new Error("401"));
    const { result } = await ready();
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe("session expiry event", () => {
  it("signs the user out with a message", async () => {
    tokenStorage.getAccessToken.mockReturnValue("tok");
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();

    act(() => {
      window.dispatchEvent(new CustomEvent("optionix:session-expired"));
    });

    expect(result.current.user).toBeNull();
    expect(result.current.authError).toBe(
      "Your session expired. Please sign in again.",
    );
  });

  it("stops listening after unmount", async () => {
    const { result, unmount } = await ready();
    unmount();
    act(() => {
      window.dispatchEvent(new CustomEvent("optionix:session-expired"));
    });
    expect(result.current.authError).toBeNull();
  });
});

describe("login", () => {
  it("stores tokens, loads the profile and returns it", async () => {
    authService.login.mockResolvedValue({
      access_token: "a",
      refresh_token: "r",
    });
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    let returned;
    await act(async () => {
      returned = await result.current.login({
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
    expect(tokenStorage.setTokens).toHaveBeenCalledWith("a", "r");
    expect(returned).toEqual(profile);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("throws a readable error and records it", async () => {
    authService.login.mockRejectedValue(new Error("Invalid credentials"));
    const { result } = await ready();
    await act(async () => {
      await expect(
        result.current.login({ email: "e", password: "p" }),
      ).rejects.toThrow("Invalid credentials");
    });
    expect(result.current.authError).toBe("Invalid credentials");
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("clears a previous error on the next attempt", async () => {
    authService.login.mockRejectedValueOnce(new Error("Nope"));
    const { result } = await ready();
    await act(async () => {
      await expect(
        result.current.login({ email: "e", password: "p" }),
      ).rejects.toThrow();
    });
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
  it("creates the account then signs in", async () => {
    authService.register.mockResolvedValue({});
    authService.login.mockResolvedValue({
      access_token: "a",
      refresh_token: "r",
    });
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    await act(async () => {
      await result.current.register({
        email: "j@x.co",
        password: "Pw1!",
        fullName: "Jane",
        marketingConsent: true,
      });
    });
    expect(authService.register).toHaveBeenCalledWith({
      email: "j@x.co",
      password: "Pw1!",
      fullName: "Jane",
      marketingConsent: true,
    });
    expect(authService.login).toHaveBeenCalledWith({
      email: "j@x.co",
      password: "Pw1!",
      mfaToken: undefined,
      rememberMe: undefined,
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("surfaces registration errors and does not sign in", async () => {
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
  it("logout clears tokens and the user", async () => {
    tokenStorage.getAccessToken.mockReturnValue("tok");
    authService.me.mockResolvedValue(profile);
    const { result } = await ready();
    act(() => result.current.logout());
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("refreshProfile reloads the user", async () => {
    tokenStorage.getAccessToken.mockReturnValue("tok");
    authService.me.mockResolvedValueOnce(profile);
    const { result } = await ready();
    authService.me.mockResolvedValueOnce({ ...profile, full_name: "Jane Q" });
    await act(async () => {
      await result.current.refreshProfile();
    });
    expect(result.current.user.full_name).toBe("Jane Q");
  });

  it("lets pages set and clear the auth error", async () => {
    const { result } = await ready();
    act(() => result.current.setAuthError("custom"));
    expect(result.current.authError).toBe("custom");
    act(() => result.current.setAuthError(null));
    expect(result.current.authError).toBeNull();
  });
});
