import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import apiClient, {
  API_BASE_URL,
  extractErrorMessage,
  setSessionExpiredHandler,
  tokenStorage,
} from "../../services/api";

jest.mock("axios", () => {
  const handlers = { request: [], response: [] };
  const instance = jest.fn(() => Promise.resolve({ data: {} }));
  instance.interceptors = {
    request: { use: jest.fn((ok) => handlers.request.push(ok)) },
    response: {
      use: jest.fn((ok, err) => handlers.response.push({ ok, err })),
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      post: jest.fn(),
      _instance: instance,
      _handlers: handlers,
    },
  };
});

const requestHandler = axios._handlers.request[0];
const { ok: onSuccess, err: onError } = axios._handlers.response[0];

const httpError = (
  status,
  config = { url: "/portfolio/overview", headers: {} },
) => {
  const e = new Error(`status ${status}`);
  e.config = { ...config, headers: { ...config.headers } };
  e.response = { status, data: {} };
  return e;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  axios.post.mockReset();
  axios._instance.mockReset();
  setSessionExpiredHandler(null);
});

describe("client configuration", () => {
  it("defaults to the local backend", () => {
    expect(API_BASE_URL).toBe("http://localhost:8000");
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: "http://localhost:8000",
      timeout: 20000,
      headers: { "Content-Type": "application/json" },
    });
    expect(apiClient).toBe(axios._instance);
  });
});

describe("tokenStorage", () => {
  it("round-trips tokens", async () => {
    await tokenStorage.setTokens("a", "r");
    expect(await tokenStorage.getAccessToken()).toBe("a");
    expect(await tokenStorage.getRefreshToken()).toBe("r");
  });

  it("only writes provided tokens", async () => {
    await tokenStorage.setTokens("a", "r");
    await tokenStorage.setTokens("a2");
    expect(await tokenStorage.getAccessToken()).toBe("a2");
    expect(await tokenStorage.getRefreshToken()).toBe("r");
    await tokenStorage.setTokens(null, null);
    expect(await tokenStorage.getAccessToken()).toBe("a2");
  });

  it("clears both tokens", async () => {
    await tokenStorage.setTokens("a", "r");
    await tokenStorage.clear();
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });
});

describe("request interceptor", () => {
  it("adds the bearer token when stored", async () => {
    await tokenStorage.setTokens("tok");
    const cfg = await requestHandler({ headers: {} });
    expect(cfg.headers.Authorization).toBe("Bearer tok");
  });

  it("leaves anonymous requests alone", async () => {
    const cfg = await requestHandler({ headers: {} });
    expect(cfg.headers.Authorization).toBeUndefined();
  });
});

describe("response interceptor", () => {
  it("passes successes through", () => {
    const res = { data: 1 };
    expect(onSuccess(res)).toBe(res);
  });

  it("rejects non-401 errors unchanged", async () => {
    const err = httpError(500);
    await expect(onError(err)).rejects.toBe(err);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("rejects errors that have no config instead of throwing a TypeError", async () => {
    await tokenStorage.setTokens("a", "r");
    const err = new Error("network down");
    err.response = { status: 401, data: {} };
    await expect(onError(err)).rejects.toBe(err);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each(["/auth/login", "/auth/register", "/auth/refresh"])(
    "never refreshes on %s",
    async (url) => {
      await tokenStorage.setTokens("a", "r");
      const err = httpError(401, { url, headers: {} });
      await expect(onError(err)).rejects.toBe(err);
      expect(axios.post).not.toHaveBeenCalled();
    },
  );

  it("signs out when there is no refresh token", async () => {
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    await tokenStorage.setTokens("stale");
    await expect(onError(httpError(401))).rejects.toBeDefined();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(await tokenStorage.getAccessToken()).toBeNull();
  });

  it("refreshes and replays the original request", async () => {
    await tokenStorage.setTokens("old", "refresh-1");
    axios.post.mockResolvedValue({
      data: { access_token: "new", refresh_token: "refresh-2" },
    });
    axios._instance.mockResolvedValue({ data: { replayed: true } });
    const err = httpError(401);

    const res = await onError(err);

    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:8000/auth/refresh",
      {},
      { headers: { Authorization: "Bearer refresh-1" } },
    );
    expect(await tokenStorage.getAccessToken()).toBe("new");
    expect(await tokenStorage.getRefreshToken()).toBe("refresh-2");
    expect(err.config._retry).toBe(true);
    expect(err.config.headers.Authorization).toBe("Bearer new");
    expect(res).toEqual({ data: { replayed: true } });
  });

  it("does not retry a request twice", async () => {
    await tokenStorage.setTokens("a", "r");
    const err = httpError(401, { url: "/x", headers: {}, _retry: true });
    await expect(onError(err)).rejects.toBe(err);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("clears the session and notifies when refresh fails", async () => {
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    await tokenStorage.setTokens("a", "r");
    const failure = new Error("refresh denied");
    axios.post.mockRejectedValue(failure);

    await expect(onError(httpError(401))).rejects.toBe(failure);

    expect(expired).toHaveBeenCalledTimes(1);
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it("queues concurrent 401s behind one refresh and replays them all", async () => {
    await tokenStorage.setTokens("a", "r");
    let resolveRefresh;
    axios.post.mockReturnValue(new Promise((r) => (resolveRefresh = r)));
    axios._instance.mockResolvedValue({ data: {} });

    const first = onError(httpError(401, { url: "/a", headers: {} }));
    await new Promise((r) => setImmediate(r));
    const second = onError(httpError(401, { url: "/b", headers: {} }));
    await new Promise((r) => setImmediate(r));

    resolveRefresh({ data: { access_token: "fresh", refresh_token: "r2" } });
    await Promise.all([first, second]);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios._instance).toHaveBeenCalledTimes(2);
    const retried = axios._instance.mock.calls.map(
      (c) => c[0].headers.Authorization,
    );
    expect(retried).toEqual(["Bearer fresh", "Bearer fresh"]);
  });

  it("rejects queued requests too when the refresh fails", async () => {
    await tokenStorage.setTokens("a", "r");
    let rejectRefresh;
    axios.post.mockReturnValue(new Promise((_, rej) => (rejectRefresh = rej)));

    const first = onError(httpError(401, { url: "/a", headers: {} }));
    await new Promise((r) => setImmediate(r));
    const second = onError(httpError(401, { url: "/b", headers: {} }));
    await new Promise((r) => setImmediate(r));

    const failure = new Error("denied");
    rejectRefresh(failure);
    await expect(first).rejects.toBe(failure);
    await expect(second).rejects.toBe(failure);
  });
});

describe("extractErrorMessage", () => {
  const withDetail = (detail) => ({ response: { data: { detail } } });

  it("returns string details", () => {
    expect(extractErrorMessage(withDetail("Bad credentials"))).toBe(
      "Bad credentials",
    );
  });

  it("joins validation error arrays", () => {
    expect(
      extractErrorMessage(
        withDetail([{ msg: "field required" }, "other", { loc: ["x"] }]),
      ),
    ).toBe('field required other {"loc":["x"]}');
  });

  it("falls back for non-string, non-array details", () => {
    expect(extractErrorMessage(withDetail({ a: 1 }), "fallback")).toBe(
      "fallback",
    );
  });

  it("uses the error message when there is no detail", () => {
    expect(extractErrorMessage(new Error("timeout"))).toBe("timeout");
  });

  it("uses the fallback for empty input", () => {
    expect(extractErrorMessage(undefined)).toBe("Something went wrong.");
    expect(extractErrorMessage(null, "custom")).toBe("custom");
    expect(extractErrorMessage({}, "custom")).toBe("custom");
  });
});
