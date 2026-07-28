import apiClient from "./api";

const portfolioService = {
  getOverview: () => apiClient.get("/portfolio/overview").then((r) => r.data),

  getAllocation: () =>
    apiClient.get("/portfolio/allocation").then((r) => r.data),

  getPerformance: (days = 30) =>
    apiClient
      .get("/portfolio/performance", { params: { days } })
      .then((r) => r.data),

  getRiskMetrics: () =>
    apiClient.get("/portfolio/risk-metrics").then((r) => r.data),

  getGreeksSummary: () =>
    apiClient.get("/portfolio/positions/greeks-summary").then((r) => r.data),
};

export default portfolioService;
