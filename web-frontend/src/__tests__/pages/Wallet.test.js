import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import Wallet from "../../pages/Wallet";
import blockchainService from "../../services/blockchainService";
import { useWallet } from "../../utils/WalletContext";
import { renderWithRouter } from "../../testUtils/render";

jest.mock("../../utils/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("../../services/blockchainService", () => ({
  __esModule: true,
  default: {
    getStatus: jest.fn(),
    getWalletBalance: jest.fn(),
    getWalletPositions: jest.fn(),
    getWalletOptions: jest.fn(),
    getTransactionStatus: jest.fn(),
    prepareDepositMargin: jest.fn(),
    prepareWithdrawMargin: jest.fn(),
    prepareExerciseOption: jest.fn(),
  },
}));

const ADDRESS = "0x1111111111111111111111111111111111111111";
const connect = jest.fn();
const sendTransaction = jest.fn();
const wallet = (o = {}) =>
  useWallet.mockReturnValue({
    address: null,
    chainId: null,
    isConnected: false,
    isWalletAvailable: true,
    isConnecting: false,
    error: "",
    connect,
    sendTransaction,
    ...o,
  });
const connected = (o = {}) =>
  wallet({ address: ADDRESS, chainId: 137, isConnected: true, ...o });

const positions = {
  liquidation_risk: "very_low",
  total_margin_used: 0.25,
  positions: [
    {
      position_id: 7,
      position_type: "long",
      size: 1.5,
      entry_price: 1850.5,
      margin: 0.25,
      leverage: 5,
      liquidation_price: 1500,
    },
  ],
};
const options = [
  {
    option_id: 1,
    option_type: "call",
    option_style: "european",
    strike_price: 2000,
    premium: 0.05,
    expiration_time: 1900000000,
    holder: ADDRESS.toUpperCase().replace("0X", "0x"),
    status: "active",
  },
  {
    option_id: 2,
    option_type: "put",
    option_style: "american",
    strike_price: 1500,
    premium: 0.02,
    expiration_time: 1900000000,
    holder: "0x2222222222222222222222222222222222222222",
    status: "active",
  },
  {
    option_id: 3,
    option_type: "call",
    option_style: "european",
    strike_price: 1000,
    premium: 0.01,
    expiration_time: 1900000000,
    holder: ADDRESS,
    status: "exercised",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  wallet();
  blockchainService.getStatus.mockResolvedValue({
    futures_contract_configured: true,
  });
  blockchainService.getWalletBalance.mockResolvedValue({
    balance_eth: 1.23456,
  });
  blockchainService.getWalletPositions.mockResolvedValue(positions);
  blockchainService.getWalletOptions.mockResolvedValue(options);
});

const mount = () => renderWithRouter(<Wallet />);

describe("not connected", () => {
  it("prompts to connect and does not load on-chain data", async () => {
    mount();
    expect(await screen.findByText("No wallet connected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet/ }));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(blockchainService.getWalletBalance).not.toHaveBeenCalled();
  });

  it("disables the button while connecting", () => {
    wallet({ isConnecting: true });
    mount();
    expect(screen.getByRole("button", { name: /Connecting…/ })).toBeDisabled();
  });

  it("links to MetaMask when no browser wallet is available", async () => {
    wallet({ isWalletAvailable: false });
    mount();
    const link = await screen.findByRole("link", { name: "MetaMask" });
    expect(link).toHaveAttribute("href", "https://metamask.io/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("warns when the backend has no deployed contract", async () => {
    blockchainService.getStatus.mockResolvedValue({});
    mount();
    expect(
      await screen.findByText(
        /isn't pointed at a deployed futures or options contract/,
      ),
    ).toBeInTheDocument();
  });

  it("does not warn when either contract is configured", async () => {
    blockchainService.getStatus.mockResolvedValue({
      options_contract_configured: true,
    });
    mount();
    await waitFor(() => expect(blockchainService.getStatus).toHaveBeenCalled());
    expect(
      screen.queryByText(/isn't pointed at a deployed/),
    ).not.toBeInTheDocument();
  });

  it("tolerates a failing status call", async () => {
    blockchainService.getStatus.mockRejectedValue(new Error("x"));
    mount();
    expect(await screen.findByText("No wallet connected")).toBeInTheDocument();
  });

  it("shows wallet-level errors", async () => {
    wallet({ error: "User rejected" });
    mount();
    expect(await screen.findByText("User rejected")).toBeInTheDocument();
  });
});

describe("connected", () => {
  it("shows the address and chain, and loads on-chain data", async () => {
    connected();
    mount();
    expect(await screen.findByText("1.2346 ETH")).toBeInTheDocument();
    expect(screen.getByText(/0x1111…1111 · chain 137/)).toBeInTheDocument();
    expect(blockchainService.getWalletBalance).toHaveBeenCalledWith(ADDRESS);
    expect(blockchainService.getWalletPositions).toHaveBeenCalledWith(ADDRESS);
    expect(blockchainService.getWalletOptions).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByText("0.2500 ETH")).toBeInTheDocument();
    expect(screen.getByText("very low")).toBeInTheDocument();
  });

  it("omits the chain label when unknown", async () => {
    connected({ chainId: null });
    mount();
    await screen.findByText("1.2346 ETH");
    expect(screen.queryByText(/· chain/)).not.toBeInTheDocument();
  });

  it("lists on-chain futures positions", async () => {
    connected();
    mount();
    expect(await screen.findByText("#7")).toBeInTheDocument();
    expect(screen.getByText("long")).toBeInTheDocument();
    expect(screen.getByText("5x")).toBeInTheDocument();
    expect(screen.getByText("1,850.50")).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
  });

  it("does not crash when the API omits liquidation_risk", async () => {
    connected();
    blockchainService.getWalletPositions.mockResolvedValue({ positions: [] });
    mount();
    expect(await screen.findByText("none")).toBeInTheDocument();
  });

  it("offers Exercise only on the holder's active options (case-insensitive)", async () => {
    connected();
    mount();
    await screen.findByText("3 total");
    expect(screen.getAllByRole("button", { name: "Exercise" })).toHaveLength(1);
    expect(screen.getAllByText("Holder")).toHaveLength(2);
    expect(screen.getAllByText("Writer")).toHaveLength(1);
    expect(screen.getByText("exercised")).toBeInTheDocument();
  });

  it("shows empty states", async () => {
    connected();
    blockchainService.getWalletPositions.mockResolvedValue({
      liquidation_risk: "none",
      positions: [],
    });
    blockchainService.getWalletOptions.mockResolvedValue([]);
    mount();
    expect(
      await screen.findByText("No open on-chain positions"),
    ).toBeInTheDocument();
  });

  it("shows an error when on-chain data cannot be loaded", async () => {
    connected();
    blockchainService.getWalletBalance.mockRejectedValue(new Error("RPC down"));
    mount();
    expect(await screen.findByText("RPC down")).toBeInTheDocument();
  });
});

describe("margin and transactions", () => {
  beforeEach(() => jest.useFakeTimers({ advanceTimers: true }));
  afterEach(() => jest.useRealTimers());

  const ready = async () => {
    connected();
    mount();
    await screen.findByText("1.2346 ETH");
  };
  const amount = (v) =>
    fireEvent.change(screen.getByLabelText("Amount (ETH)"), {
      target: { value: v },
    });
  const advance = (ms) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  it("disables submit until an amount is entered", async () => {
    await ready();
    expect(
      screen.getByRole("button", { name: "Deposit Margin" }),
    ).toBeDisabled();
    amount("1");
    expect(
      screen.getByRole("button", { name: "Deposit Margin" }),
    ).toBeEnabled();
  });

  it.each(["0", "-1"])("ignores a non-positive amount %p", async (v) => {
    await ready();
    amount(v);
    fireEvent.submit(screen.getByLabelText("Amount (ETH)").closest("form"));
    await advance(0);
    expect(blockchainService.prepareDepositMargin).not.toHaveBeenCalled();
  });

  it("switches between deposit and withdraw copy", async () => {
    await ready();
    expect(
      screen.getByText(
        /Sent from your wallet directly into the futures contract/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(
      screen.getByText(/Withdrawn from your available on-chain margin/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Withdraw Margin" }),
    ).toBeInTheDocument();
  });

  it("prepares, signs, confirms and reloads a deposit", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({ to: "0xabc" });
    sendTransaction.mockResolvedValue(
      "0x1234567890abcdef1234567890abcdef12345678",
    );
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "success",
    });
    await ready();
    amount("0.5");
    fireEvent.click(screen.getByRole("button", { name: "Deposit Margin" }));
    await advance(0);
    expect(blockchainService.prepareDepositMargin).toHaveBeenCalledWith({
      userAddress: ADDRESS,
      amount: 0.5,
    });
    expect(sendTransaction).toHaveBeenCalledWith({ to: "0xabc" });
    expect(screen.getByText(/Waiting for confirmation…/)).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (ETH)")).toHaveValue(null);

    await advance(2000);
    expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument();
    expect(blockchainService.getWalletBalance).toHaveBeenCalledTimes(2);
  });

  it("withdraws via the withdraw endpoint", async () => {
    blockchainService.prepareWithdrawMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "success",
    });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    amount("1");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw Margin" }));
    await advance(0);
    expect(blockchainService.prepareWithdrawMargin).toHaveBeenCalledWith({
      userAddress: ADDRESS,
      amount: 1,
    });
    expect(blockchainService.prepareDepositMargin).not.toHaveBeenCalled();
    await advance(2000);
  });

  it("keeps polling through pending states and transient errors", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus
      .mockResolvedValueOnce({ status: "pending" })
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ status: "success" });
    await ready();
    amount("1");
    fireEvent.click(screen.getByRole("button", { name: "Deposit Margin" }));
    await advance(0);
    await advance(4000);
    expect(screen.queryByText(/Transaction confirmed/)).not.toBeInTheDocument();
    await advance(2000);
    expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument();
    expect(blockchainService.getTransactionStatus).toHaveBeenCalledTimes(3);
  });

  it("reports on-chain failure details and does not reload", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "failed",
      error: "Out of gas",
    });
    await ready();
    amount("1");
    fireEvent.click(screen.getByRole("button", { name: "Deposit Margin" }));
    await advance(0);
    await advance(2000);
    expect(screen.getByText("Out of gas")).toBeInTheDocument();
    expect(blockchainService.getWalletBalance).toHaveBeenCalledTimes(1);
  });

  it("uses a generic message when a failure has no details", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "error",
    });
    await ready();
    amount("1");
    fireEvent.click(screen.getByRole("button", { name: "Deposit Margin" }));
    await advance(0);
    await advance(2000);
    expect(
      screen.getByText("Transaction failed on-chain."),
    ).toBeInTheDocument();
  });

  it("gives up after 30 attempts", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "pending",
    });
    await ready();
    amount("1");
    fireEvent.click(screen.getByRole("button", { name: "Deposit Margin" }));
    await advance(0);
    await advance(2000 * 30);
    expect(blockchainService.getTransactionStatus).toHaveBeenCalledTimes(30);
    expect(
      screen.getByText("Timed out waiting to confirm."),
    ).toBeInTheDocument();
  });

  it("shows an error if the transaction cannot be prepared or signed", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockRejectedValue(new Error("User denied"));
    await ready();
    amount("1");
    fireEvent.click(screen.getByRole("button", { name: "Deposit Margin" }));
    await advance(0);
    expect(screen.getByText("User denied")).toBeInTheDocument();
  });

  it("exercises an option and reloads on confirmation", async () => {
    blockchainService.prepareExerciseOption.mockResolvedValue({ to: "0xopt" });
    sendTransaction.mockResolvedValue("0xhash2");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "success",
    });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Exercise" }));
    await advance(0);
    expect(blockchainService.prepareExerciseOption).toHaveBeenCalledWith({
      walletAddress: ADDRESS,
      optionId: 1,
    });
    await advance(2000);
    expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument();
    expect(blockchainService.getWalletOptions).toHaveBeenCalledTimes(2);
  });

  it("reports exercise failures", async () => {
    blockchainService.prepareExerciseOption.mockRejectedValue(
      new Error("Option expired"),
    );
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Exercise" }));
    await advance(0);
    expect(screen.getByText("Option expired")).toBeInTheDocument();
  });
});
