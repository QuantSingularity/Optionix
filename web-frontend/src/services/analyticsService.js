import apiClient from "./apiClient";

const analyticsService = {
  priceOption: ({
    spotPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate,
    volatility,
    optionType = "call",
    dividendYield,
    pricingMethod = "black_scholes",
    monteCarloPaths,
  }) =>
    apiClient
      .post("/analytics/price", {
        spot_price: spotPrice,
        strike_price: strikePrice,
        time_to_expiry: timeToExpiry,
        risk_free_rate: riskFreeRate,
        volatility,
        option_type: optionType,
        dividend_yield: dividendYield,
        pricing_method: pricingMethod,
        monte_carlo_paths: monteCarloPaths,
      })
      .then((r) => r.data),

  impliedVolatility: ({
    marketPrice,
    spotPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate,
    optionType = "call",
  }) =>
    apiClient
      .post("/analytics/implied-volatility", {
        market_price: marketPrice,
        spot_price: spotPrice,
        strike_price: strikePrice,
        time_to_expiry: timeToExpiry,
        risk_free_rate: riskFreeRate,
        option_type: optionType,
      })
      .then((r) => r.data),

  volatilitySurface: ({
    spotPrice,
    strikes,
    expiries,
    riskFreeRate,
    baseVolatility,
  }) =>
    apiClient
      .post("/analytics/volatility-surface", {
        spot_price: spotPrice,
        strikes,
        expiries,
        risk_free_rate: riskFreeRate,
        base_volatility: baseVolatility,
      })
      .then((r) => r.data),

  quickGreeks: (
    symbol,
    { spot, strike, expiryDays, volatility, riskFreeRate },
  ) =>
    apiClient
      .get(`/analytics/greeks/${symbol}`, {
        params: {
          spot,
          strike,
          expiry_days: expiryDays,
          volatility,
          risk_free_rate: riskFreeRate,
        },
      })
      .then((r) => r.data),
};

export default analyticsService;
