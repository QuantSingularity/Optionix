import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

// react-native-dotenv is configured with allowUndefined, so this stays safe
// even when no .env file is present (defaults to localhost for local dev).
let API_BASE_URL = "http://localhost:8000";
try {
  // eslint-disable-next-line global-require
  const env = require("@env");
  if (env?.API_BASE_URL) API_BASE_URL = env.API_BASE_URL;
} catch {
  // @env not configured — fall back to the default above.
}

export { API_BASE_URL };

const ACCESS_TOKEN_KEY = "optionix_access_token";
const REFRESH_TOKEN_KEY = "optionix_refresh_token";

export const tokenStorage = {
  async getAccessToken() {
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },
  async setTokens(access, refresh) {
    const ops = [];
    if (access) ops.push(AsyncStorage.setItem(ACCESS_TOKEN_KEY, access));
    if (refresh) ops.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh));
    await Promise.all(ops);
  },
  async clear() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue = [];
const flushQueue = (error, token) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

let onSessionExpired = null;
/** Registered once by AuthContext so the client can force a sign-out. */
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const statusCode = error.response ? error.response.status : null;
    const isAuthRoute =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/register") ||
      originalRequest?.url?.includes("/auth/refresh");

    if (statusCode === 401 && !originalRequest._retry && !isAuthRoute) {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) {
        await tokenStorage.clear();
        onSessionExpired?.();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } },
        );
        await tokenStorage.setTokens(data.access_token, data.refresh_token);
        flushQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        await tokenStorage.clear();
        onSessionExpired?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export function extractErrorMessage(error, fallback = "Something went wrong.") {
  const detail = error?.response?.data?.detail;
  if (!detail) return error?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === "string" ? d : d.msg || JSON.stringify(d)))
      .join(" ");
  }
  return fallback;
}

export default apiClient;
