import apiClient from "./apiClient";

const marketService = {
  predictVolatility: ({
    symbol,
    open,
    high,
    low,
    close,
    volume,
    timeframe = "1d",
    limit,
  }) =>
    apiClient
      .post("/market/volatility", {
        symbol,
        open,
        high,
        low,
        close,
        volume,
        timeframe,
        limit,
      })
      .then((r) => r.data),
};

export default marketService;
