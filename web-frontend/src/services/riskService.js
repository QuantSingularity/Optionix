import apiClient from "./apiClient";

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

  getGreeksHeatmap: ({
    spot,
    strike,
    expiryDays,
    baseVol,
    spotRangePct,
    volRangePct,
    gridSteps,
  }) =>
    apiClient
      .post(
        "/risk/greeks/heatmap",
        {
          spot_range_pct: spotRangePct,
          vol_range_pct: volRangePct,
          grid_steps: gridSteps,
        },
        {
          params: {
            spot,
            strike,
            expiry_days: expiryDays,
            base_vol: baseVol,
          },
        },
      )
      .then((r) => r.data),

  getLimits: () => apiClient.get("/risk/limits").then((r) => r.data),

  getCircuitBreakers: () =>
    apiClient.get("/risk/circuit-breakers").then((r) => r.data),
};

export default riskService;
