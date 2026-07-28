import apiClient from "./api";

const riskService = {
  calculateVar: ({
    confidenceLevels,
    timeHorizonDays = 1,
    method = "historical",
    nSimulations,
  } = {}) =>
    apiClient
      .post("/risk/var", {
        confidence_levels: confidenceLevels,
        time_horizon_days: timeHorizonDays,
        method,
        n_simulations: nSimulations,
      })
      .then((r) => r.data),

  stressTest: ({ scenarios, portfolioValue, positions } = {}) =>
    apiClient
      .post("/risk/stress-test", {
        scenarios,
        portfolio_value: portfolioValue,
        positions,
      })
      .then((r) => r.data),

  getPortfolioGreeks: () =>
    apiClient.get("/risk/greeks/portfolio").then((r) => r.data),

  getLimits: () => apiClient.get("/risk/limits").then((r) => r.data),

  getCircuitBreakers: () =>
    apiClient.get("/risk/circuit-breakers").then((r) => r.data),
};

export default riskService;
