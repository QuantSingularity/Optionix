import apiClient from "./api";

const authService = {
  register: (payload) =>
    apiClient
      .post("/auth/register", {
        email: payload.email,
        password: payload.password,
        full_name: payload.fullName,
        data_processing_consent: true,
        data_retention_consent: true,
        marketing_consent: !!payload.marketingConsent,
      })
      .then((r) => r.data),

  login: ({ email, password, mfaToken, rememberMe }) =>
    apiClient
      .post("/auth/login", {
        email,
        password,
        mfa_token: mfaToken || undefined,
        remember_me: !!rememberMe,
      })
      .then((r) => r.data),

  me: () => apiClient.get("/auth/me").then((r) => r.data),

  refresh: (refreshToken) =>
    apiClient
      .post(
        "/auth/refresh",
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } },
      )
      .then((r) => r.data),
};

export default authService;
