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
    optionStyle = "european",
    pricingMethod = "black_scholes",
    monteCarloPaths,
    barrierLevel,
    barrierType,
    heston,
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
        option_style: optionStyle,
        pricing_method: pricingMethod,
        monte_carlo_paths: monteCarloPaths,
        barrier_level: barrierLevel,
        barrier_type: barrierType,
        heston,
      })
      .then((r) => r.data),

  impliedVolatility: ({
    marketPrice,
    spotPrice,
    strikePrice,
    timeToExpiry,
    riskFreeRate,
    dividendYield,
    optionType = "call",
    optionStyle = "european",
  }) =>
    apiClient
      .post("/analytics/implied-volatility", {
        market_price: marketPrice,
        spot_price: spotPrice,
        strike_price: strikePrice,
        time_to_expiry: timeToExpiry,
        risk_free_rate: riskFreeRate,
        dividend_yield: dividendYield,
        option_type: optionType,
        option_style: optionStyle,
      })
      .then((r) => r.data),

  volatilitySurface: ({
    spotPrice,
    strikes,
    expiries,
    riskFreeRate,
    dividendYield,
    baseVolatility,
    quotes,
    method,
  }) =>
    apiClient
      .post("/analytics/volatility-surface", {
        spot_price: spotPrice,
        strikes,
        expiries,
        risk_free_rate: riskFreeRate,
        dividend_yield: dividendYield,
        base_volatility: baseVolatility,
        quotes,
        method,
      })
      .then((r) => r.data),

  calibrate: ({ model, spotPrice, riskFreeRate, dividendYield, options }) =>
    apiClient
      .post("/analytics/calibrate", {
        model,
        spot_price: spotPrice,
        risk_free_rate: riskFreeRate,
        dividend_yield: dividendYield,
        options,
      })
      .then((r) => r.data),

  quickGreeks: (
    symbol,
    {
      spot,
      strike,
      expiryDays,
      volatility,
      riskFreeRate,
      dividendYield,
      optionType,
    },
  ) =>
    apiClient
      .get(`/analytics/greeks/${symbol}`, {
        params: {
          spot,
          strike,
          expiry_days: expiryDays,
          volatility,
          risk_free_rate: riskFreeRate,
          dividend_yield: dividendYield,
          option_type: optionType,
        },
      })
      .then((r) => r.data),
};

export default analyticsService;
