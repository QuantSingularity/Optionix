import axios from "axios";
import apiClient, {
  API_BASE_URL,
  extractErrorMessage,
  tokenStorage,
} from "../../services/apiClient";

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

let expired;
const onExpired = () => expired();

beforeEach(() => {
  localStorage.clear();
  axios.post.mockReset();
  axios._instance.mockReset();
  expired = jest.fn();
  window.addEventListener("optionix:session-expired", onExpired);
});
afterEach(() =>
  window.removeEventListener("optionix:session-expired", onExpired),
);

describe("configuration", () => {
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
  it("round-trips tokens through localStorage", () => {
    tokenStorage.setTokens("a", "r");
    expect(tokenStorage.getAccessToken()).toBe("a");
    expect(tokenStorage.getRefreshToken()).toBe("r");
    expect(localStorage.getItem("optionix_access_token")).toBe("a");
    expect(localStorage.getItem("optionix_refresh_token")).toBe("r");
  });

  it("only writes provided tokens", () => {
    tokenStorage.setTokens("a", "r");
    tokenStorage.setTokens("a2");
    expect(tokenStorage.getAccessToken()).toBe("a2");
    expect(tokenStorage.getRefreshToken()).toBe("r");
    tokenStorage.setTokens(null, null);
    expect(tokenStorage.getAccessToken()).toBe("a2");
  });

  it("clears both tokens", () => {
    tokenStorage.setTokens("a", "r");
    tokenStorage.clear();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});

describe("request interceptor", () => {
  it("adds the bearer token when stored", () => {
    tokenStorage.setTokens("tok");
    expect(requestHandler({ headers: {} }).headers.Authorization).toBe(
      "Bearer tok",
    );
  });

  it("leaves anonymous requests alone", () => {
    expect(
      requestHandler({ headers: {} }).headers.Authorization,
    ).toBeUndefined();
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
    expect(expired).not.toHaveBeenCalled();
  });

  it("rejects errors without a config instead of throwing a TypeError", async () => {
    tokenStorage.setTokens("a", "r");
    const err = new Error("network down");
    err.response = { status: 401, data: {} };
    await expect(onError(err)).rejects.toBe(err);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it.each(["/auth/login", "/auth/register", "/auth/refresh"])(
    "never refreshes on %s",
    async (url) => {
      tokenStorage.setTokens("a", "r");
      const err = httpError(401, { url, headers: {} });
      await expect(onError(err)).rejects.toBe(err);
      expect(axios.post).not.toHaveBeenCalled();
      expect(expired).not.toHaveBeenCalled();
    },
  );

  it("clears tokens and announces session expiry when there is no refresh token", async () => {
    tokenStorage.setTokens("stale");
    await expect(onError(httpError(401))).rejects.toBeDefined();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("refreshes and replays the original request", async () => {
    tokenStorage.setTokens("old", "refresh-1");
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
    expect(tokenStorage.getAccessToken()).toBe("new");
    expect(tokenStorage.getRefreshToken()).toBe("refresh-2");
    expect(err.config._retry).toBe(true);
    expect(err.config.headers.Authorization).toBe("Bearer new");
    expect(res).toEqual({ data: { replayed: true } });
    expect(expired).not.toHaveBeenCalled();
  });

  it("does not retry a request twice", async () => {
    tokenStorage.setTokens("a", "r");
    const err = httpError(401, { url: "/x", headers: {}, _retry: true });
    await expect(onError(err)).rejects.toBe(err);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("clears the session and announces expiry when refresh fails", async () => {
    tokenStorage.setTokens("a", "r");
    const failure = new Error("refresh denied");
    axios.post.mockRejectedValue(failure);
    await expect(onError(httpError(401))).rejects.toBe(failure);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("queues concurrent 401s behind one refresh and replays them all", async () => {
    tokenStorage.setTokens("a", "r");
    let resolveRefresh;
    axios.post.mockReturnValue(new Promise((r) => (resolveRefresh = r)));
    axios._instance.mockResolvedValue({ data: {} });

    const first = onError(httpError(401, { url: "/a", headers: {} }));
    await new Promise((r) => setTimeout(r, 0));
    const second = onError(httpError(401, { url: "/b", headers: {} }));
    await new Promise((r) => setTimeout(r, 0));

    resolveRefresh({ data: { access_token: "fresh", refresh_token: "r2" } });
    await Promise.all([first, second]);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios._instance).toHaveBeenCalledTimes(2);
    expect(
      axios._instance.mock.calls.map((c) => c[0].headers.Authorization),
    ).toEqual(["Bearer fresh", "Bearer fresh"]);
  });

  it("rejects queued requests too when the refresh fails", async () => {
    tokenStorage.setTokens("a", "r");
    let rejectRefresh;
    axios.post.mockReturnValue(new Promise((_, rej) => (rejectRefresh = rej)));

    const first = onError(httpError(401, { url: "/a", headers: {} }));
    await new Promise((r) => setTimeout(r, 0));
    const second = onError(httpError(401, { url: "/b", headers: {} }));
    await new Promise((r) => setTimeout(r, 0));

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

  it("uses the error message, then the fallback", () => {
    expect(extractErrorMessage(new Error("timeout"))).toBe("timeout");
    expect(extractErrorMessage(undefined)).toBe("Something went wrong.");
    expect(extractErrorMessage({}, "custom")).toBe("custom");
  });
});
