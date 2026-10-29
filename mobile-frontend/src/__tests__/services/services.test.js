import apiClient from "../../services/api";
import analyticsService from "../../services/analyticsService";
import authService from "../../services/authService";
import blockchainService from "../../services/blockchainService";
import complianceService from "../../services/complianceService";
import marketService from "../../services/marketService";
import portfolioService from "../../services/portfolioService";
import riskService from "../../services/riskService";
import tradingService from "../../services/tradingService";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(apiClient).forEach((fn) =>
    fn.mockResolvedValue({ data: { ok: true, transaction: { to: "0xabc" } } }),
  );
});

describe("authService", () => {
  it("register maps fields to the API contract with consent flags", async () => {
    await authService.register({
      email: "a@b.co",
      password: "Pw1!aaaa",
      fullName: "Ada L",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/register", {
      email: "a@b.co",
      password: "Pw1!aaaa",
      full_name: "Ada L",
      data_processing_consent: true,
      data_retention_consent: true,
      marketing_consent: false,
    });
  });

  it("register passes marketing consent through", async () => {
    await authService.register({
      email: "a",
      password: "b",
      fullName: "c",
      marketingConsent: true,
    });
    expect(apiClient.post.mock.calls[0][1].marketing_consent).toBe(true);
  });

  it("login omits an empty MFA token and coerces rememberMe", async () => {
    await authService.login({ email: "a@b.co", password: "pw" });
    expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
      email: "a@b.co",
      password: "pw",
      mfa_token: undefined,
      remember_me: false,
    });
    await authService.login({
      email: "a",
      password: "b",
      mfaToken: "123456",
      rememberMe: true,
    });
    expect(apiClient.post.mock.calls[1][1]).toMatchObject({
      mfa_token: "123456",
      remember_me: true,
    });
  });

  it("me and refresh", async () => {
    await expect(authService.me()).resolves.toMatchObject({ ok: true });
    expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    await authService.refresh("rt");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/auth/refresh",
      {},
      { headers: { Authorization: "Bearer rt" } },
    );
  });
});

describe("tradingService", () => {
  it("accounts", async () => {
    await tradingService.listAccounts();
    expect(apiClient.get).toHaveBeenCalledWith("/trading/accounts");
    await tradingService.createAccount({
      ethereumAddress: "0x1",
      initialDeposit: 5000,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/trading/accounts", {
      ethereum_address: "0x1",
      account_type: "demo",
      initial_deposit: 5000,
    });
    await tradingService.getAccountSummary(3);
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/trading/accounts/3/summary",
    );
  });

  it("placeOrder maps fields and drops empty optional prices", async () => {
    await tradingService.placeOrder({
      accountId: 1,
      symbol: "AAPL",
      tradeType: "buy",
      orderType: "market",
      quantity: 10,
      price: 0,
      stopLoss: "",
      takeProfit: null,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/trading/orders", {
      account_id: 1,
      symbol: "AAPL",
      trade_type: "buy",
      order_type: "market",
      quantity: 10,
      price: undefined,
      stop_loss: undefined,
      take_profit: undefined,
    });
  });

  it("placeOrder keeps real prices", async () => {
    await tradingService.placeOrder({
      accountId: 1,
      symbol: "X",
      tradeType: "sell",
      orderType: "limit",
      quantity: 1,
      price: 12.5,
      stopLoss: 10,
      takeProfit: 15,
    });
    expect(apiClient.post.mock.calls[0][1]).toMatchObject({
      price: 12.5,
      stop_loss: 10,
      take_profit: 15,
    });
  });

  it("orders and positions", async () => {
    await tradingService.listOrders({ limit: 5 });
    expect(apiClient.get).toHaveBeenLastCalledWith("/trading/orders", {
      params: { limit: 5 },
    });
    await tradingService.listOrders();
    expect(apiClient.get).toHaveBeenLastCalledWith("/trading/orders", {
      params: {},
    });
    await tradingService.getOrder("T1");
    expect(apiClient.get).toHaveBeenLastCalledWith("/trading/orders/T1");
    await tradingService.cancelOrder("T1");
    expect(apiClient.delete).toHaveBeenCalledWith("/trading/orders/T1");
    await tradingService.listPositions({ status: "open" });
    expect(apiClient.get).toHaveBeenLastCalledWith("/trading/positions", {
      params: { status: "open" },
    });
    await tradingService.getPosition(9);
    expect(apiClient.get).toHaveBeenLastCalledWith("/trading/positions/9");
  });
});

describe("portfolioService", () => {
  it("calls the portfolio endpoints", async () => {
    await portfolioService.getOverview();
    expect(apiClient.get).toHaveBeenLastCalledWith("/portfolio/overview");
    await portfolioService.getAllocation();
    expect(apiClient.get).toHaveBeenLastCalledWith("/portfolio/allocation");
    await portfolioService.getPerformance();
    expect(apiClient.get).toHaveBeenLastCalledWith("/portfolio/performance", {
      params: { days: 30 },
    });
    await portfolioService.getPerformance(7);
    expect(apiClient.get).toHaveBeenLastCalledWith("/portfolio/performance", {
      params: { days: 7 },
    });
    await portfolioService.getRiskMetrics();
    expect(apiClient.get).toHaveBeenLastCalledWith("/portfolio/risk-metrics");
    await portfolioService.getGreeksSummary();
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/portfolio/positions/greeks-summary",
    );
  });
});

describe("riskService", () => {
  it("calculateVar defaults to 1 day historical", async () => {
    await riskService.calculateVar();
    expect(apiClient.post).toHaveBeenCalledWith("/risk/var", {
      confidence_levels: undefined,
      time_horizon_days: 1,
      method: "historical",
      n_simulations: undefined,
      annual_volatility: undefined,
      historical_returns: undefined,
    });
  });

  it("calculateVar maps custom arguments", async () => {
    await riskService.calculateVar({
      method: "monte_carlo",
      nSimulations: 1000,
      confidenceLevels: [0.95],
    });
    expect(apiClient.post.mock.calls[0][1]).toMatchObject({
      method: "monte_carlo",
      n_simulations: 1000,
      confidence_levels: [0.95],
    });
  });

  it("stress test, greeks, limits, breakers", async () => {
    await riskService.stressTest({
      scenarios: ["market_crash"],
      portfolioValue: 1000,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/risk/stress-test", {
      scenarios: ["market_crash"],
      portfolio_value: 1000,
      positions: undefined,
    });
    await riskService.stressTest();
    await riskService.getPortfolioGreeks();
    expect(apiClient.get).toHaveBeenLastCalledWith("/risk/greeks/portfolio");
    await riskService.getLimits();
    expect(apiClient.get).toHaveBeenLastCalledWith("/risk/limits");
    await riskService.getCircuitBreakers();
    expect(apiClient.get).toHaveBeenLastCalledWith("/risk/circuit-breakers");
  });
});

describe("complianceService", () => {
  it("submitKyc maps to snake_case", async () => {
    await complianceService.submitKyc({
      fullName: "Ada",
      dateOfBirth: "1990-01-01",
      nationality: "GB",
      address: { street: "1 St" },
      documentType: "passport",
      documentNumber: "X1",
      documentCountry: "GB",
      documentExpiry: "2030-01-01",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/compliance/kyc/submit", {
      full_name: "Ada",
      date_of_birth: "1990-01-01",
      nationality: "GB",
      address: { street: "1 St" },
      document_type: "passport",
      document_number: "X1",
      document_country: "GB",
      document_expiry: "2030-01-01",
    });
  });

  it("status, sanctions, alerts, reports, gdpr, audit", async () => {
    await complianceService.getKycStatus();
    expect(apiClient.get).toHaveBeenLastCalledWith("/compliance/kyc/status");
    await complianceService.runSanctionsCheck();
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/compliance/sanctions/check",
    );
    await complianceService.getAmlAlerts({ limit: 10 });
    expect(apiClient.get).toHaveBeenLastCalledWith("/compliance/aml/alerts", {
      params: { limit: 10 },
    });
    await complianceService.generateReport({
      reportType: "aml",
      regulationType: "mifid",
      periodStart: "a",
      periodEnd: "b",
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/compliance/reports/generate",
      {
        report_type: "aml",
        regulation_type: "mifid",
        period_start: "a",
        period_end: "b",
        include_details: false,
      },
    );
    await complianceService.listReports();
    expect(apiClient.get).toHaveBeenLastCalledWith("/compliance/reports", {
      params: {},
    });
    await complianceService.requestGdprAction({
      requestType: "erasure",
      description: "d",
      verificationMethod: "email",
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/compliance/gdpr/request",
      {
        request_type: "erasure",
        description: "d",
        verification_method: "email",
      },
    );
    await complianceService.getAuditLogs({ page: 1 });
    expect(apiClient.get).toHaveBeenLastCalledWith("/compliance/audit-logs", {
      params: { page: 1 },
    });
    await complianceService.getOverallStatus();
    expect(apiClient.get).toHaveBeenLastCalledWith("/compliance/status");
  });
});

describe("marketService", () => {
  it("predictVolatility defaults the timeframe to 1d", async () => {
    await marketService.predictVolatility({
      symbol: "AAPL",
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/market/volatility", {
      symbol: "AAPL",
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
      timeframe: "1d",
      limit: undefined,
    });
    await marketService.getModelInfo();
    expect(apiClient.get).toHaveBeenCalledWith("/market/model-info");
  });
});

describe("analyticsService", () => {
  it("priceOption applies sensible defaults", async () => {
    await analyticsService.priceOption({
      spotPrice: 100,
      strikePrice: 105,
      timeToExpiry: 0.5,
      riskFreeRate: 0.05,
      volatility: 0.2,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/analytics/price",
      expect.objectContaining({
        spot_price: 100,
        strike_price: 105,
        time_to_expiry: 0.5,
        risk_free_rate: 0.05,
        volatility: 0.2,
        option_type: "call",
        option_style: "european",
        pricing_method: "black_scholes",
      }),
    );
  });

  it("impliedVolatility, surface and calibration", async () => {
    await analyticsService.impliedVolatility({
      marketPrice: 5,
      spotPrice: 100,
      strikePrice: 100,
      timeToExpiry: 1,
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/analytics/implied-volatility",
      expect.objectContaining({
        market_price: 5,
        option_type: "call",
        option_style: "european",
      }),
    );
    await analyticsService.volatilitySurface({
      spotPrice: 100,
      strikes: [90],
      expiries: [1],
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/analytics/volatility-surface",
      expect.objectContaining({
        spot_price: 100,
        strikes: [90],
        expiries: [1],
      }),
    );
    await analyticsService.calibrate({
      model: "heston",
      spotPrice: 100,
      options: [],
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/analytics/calibrate",
      expect.objectContaining({
        model: "heston",
        spot_price: 100,
      }),
    );
  });

  it("quickGreeks puts the symbol in the path and maps params", async () => {
    await analyticsService.quickGreeks("AAPL", {
      spot: 100,
      strike: 105,
      expiryDays: 30,
      volatility: 0.2,
    });
    expect(apiClient.get).toHaveBeenCalledWith("/analytics/greeks/AAPL", {
      params: {
        spot: 100,
        strike: 105,
        expiry_days: 30,
        volatility: 0.2,
        risk_free_rate: undefined,
        dividend_yield: undefined,
        option_type: undefined,
      },
    });
  });
});

describe("blockchainService", () => {
  it("read endpoints use the wallet address in the path", async () => {
    await blockchainService.getStatus();
    expect(apiClient.get).toHaveBeenLastCalledWith("/blockchain/status");
    await blockchainService.getWalletBalance("0xabc");
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/blockchain/wallet/0xabc/balance",
    );
    await blockchainService.getWalletPositions("0xabc");
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/blockchain/wallet/0xabc/positions",
    );
    await blockchainService.getWalletOptions("0xabc");
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/blockchain/wallet/0xabc/options",
    );
    await blockchainService.getOption(4);
    expect(apiClient.get).toHaveBeenLastCalledWith("/blockchain/options/4");
    await blockchainService.getTransactionStatus("0xhash");
    expect(apiClient.get).toHaveBeenLastCalledWith(
      "/blockchain/transactions/0xhash",
    );
  });

  it("prepare* methods return the unsigned transaction only", async () => {
    await expect(
      blockchainService.prepareDepositMargin({ userAddress: "0x1", amount: 1 }),
    ).resolves.toEqual({ to: "0xabc" });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/blockchain/margin/deposit",
      {
        user_address: "0x1",
        amount: 1,
        asset_address: undefined,
      },
    );
    await blockchainService.prepareWithdrawMargin({
      userAddress: "0x1",
      amount: 2,
      assetAddress: "0xtoken",
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/blockchain/margin/withdraw",
      {
        user_address: "0x1",
        amount: 2,
        asset_address: "0xtoken",
      },
    );
    await blockchainService.preparePurchaseOption({
      walletAddress: "0x1",
      optionId: 3,
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/blockchain/options/purchase",
      {
        wallet_address: "0x1",
        option_id: 3,
      },
    );
    await blockchainService.prepareExerciseOption({
      walletAddress: "0x1",
      optionId: 3,
    });
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/blockchain/options/exercise",
      {
        wallet_address: "0x1",
        option_id: 3,
      },
    );
  });
});
