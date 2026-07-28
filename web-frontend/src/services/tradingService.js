import apiClient from "./apiClient";

const tradingService = {
  // ── Accounts ──────────────────────────────────────────────
  listAccounts: () => apiClient.get("/trading/accounts").then((r) => r.data),

  createAccount: ({ ethereumAddress, accountType = "demo", initialDeposit }) =>
    apiClient
      .post("/trading/accounts", {
        ethereum_address: ethereumAddress,
        account_type: accountType,
        initial_deposit: initialDeposit,
      })
      .then((r) => r.data),

  getAccountSummary: (accountId) =>
    apiClient.get(`/trading/accounts/${accountId}/summary`).then((r) => r.data),

  // ── Orders ────────────────────────────────────────────────
  placeOrder: ({
    accountId,
    symbol,
    tradeType,
    orderType,
    quantity,
    price,
    stopLoss,
    takeProfit,
  }) =>
    apiClient
      .post("/trading/orders", {
        account_id: accountId,
        symbol,
        trade_type: tradeType,
        order_type: orderType,
        quantity,
        price: price || undefined,
        stop_loss: stopLoss || undefined,
        take_profit: takeProfit || undefined,
      })
      .then((r) => r.data),

  listOrders: (params = {}) =>
    apiClient.get("/trading/orders", { params }).then((r) => r.data),

  getOrder: (tradeId) =>
    apiClient.get(`/trading/orders/${tradeId}`).then((r) => r.data),

  cancelOrder: (tradeId) =>
    apiClient.delete(`/trading/orders/${tradeId}`).then((r) => r.data),

  // ── Positions ─────────────────────────────────────────────
  listPositions: (params = {}) =>
    apiClient.get("/trading/positions", { params }).then((r) => r.data),

  getPosition: (positionId) =>
    apiClient.get(`/trading/positions/${positionId}`).then((r) => r.data),
};

export default tradingService;
