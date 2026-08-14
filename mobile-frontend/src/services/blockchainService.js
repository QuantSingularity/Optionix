import apiClient from "./api";

const blockchainService = {
  getStatus: () => apiClient.get("/blockchain/status").then((r) => r.data),

  getWalletBalance: (address) =>
    apiClient.get(`/blockchain/wallet/${address}/balance`).then((r) => r.data),

  getWalletPositions: (address) =>
    apiClient
      .get(`/blockchain/wallet/${address}/positions`)
      .then((r) => r.data),

  getWalletOptions: (address) =>
    apiClient.get(`/blockchain/wallet/${address}/options`).then((r) => r.data),

  getOption: (optionId) =>
    apiClient.get(`/blockchain/options/${optionId}`).then((r) => r.data),

  // Each of these returns an unsigned transaction for the connected wallet
  // to sign via WalletContext's sendTransaction - the backend never handles
  // a private key.
  prepareDepositMargin: ({ userAddress, amount, assetAddress }) =>
    apiClient
      .post("/blockchain/margin/deposit", {
        user_address: userAddress,
        amount,
        asset_address: assetAddress || undefined,
      })
      .then((r) => r.data.transaction),

  prepareWithdrawMargin: ({ userAddress, amount, assetAddress }) =>
    apiClient
      .post("/blockchain/margin/withdraw", {
        user_address: userAddress,
        amount,
        asset_address: assetAddress || undefined,
      })
      .then((r) => r.data.transaction),

  preparePurchaseOption: ({ walletAddress, optionId }) =>
    apiClient
      .post("/blockchain/options/purchase", {
        wallet_address: walletAddress,
        option_id: optionId,
      })
      .then((r) => r.data.transaction),

  prepareExerciseOption: ({ walletAddress, optionId }) =>
    apiClient
      .post("/blockchain/options/exercise", {
        wallet_address: walletAddress,
        option_id: optionId,
      })
      .then((r) => r.data.transaction),

  getTransactionStatus: (txHash) =>
    apiClient.get(`/blockchain/transactions/${txHash}`).then((r) => r.data),
};

export default blockchainService;
