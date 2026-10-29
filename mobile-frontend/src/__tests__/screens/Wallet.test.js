import { Linking, RefreshControl } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import WalletScreen from "../../screens/WalletScreen";
import blockchainService from "../../services/blockchainService";
import { useWallet } from "../../context/WalletContext";
import { typeInto } from "../../testUtils/paper";

jest.mock("../../context/WalletContext", () => ({ useWallet: jest.fn() }));
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
const disconnect = jest.fn();
const sendTransaction = jest.fn();

const wallet = (o = {}) =>
  useWallet.mockReturnValue({
    address: null,
    isConnected: false,
    isConfigured: true,
    isInitializing: false,
    isConnecting: false,
    pairingUri: null,
    error: "",
    connect,
    disconnect,
    sendTransaction,
    ...o,
  });
const connected = (o = {}) =>
  wallet({ address: ADDRESS, isConnected: true, ...o });

const positions = {
  liquidation_risk: "very_low",
  positions: [
    {
      position_id: 7,
      leverage: 5,
      entry_price: 1850.5,
      margin: 0.25,
      position_type: "long",
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
    holder: ADDRESS.toUpperCase().replace("0X", "0x"),
    status: "active",
  },
  {
    option_id: 2,
    option_type: "put",
    option_style: "american",
    strike_price: 1500,
    premium: 0.02,
    holder: "0x2222222222222222222222222222222222222222",
    status: "active",
  },
  {
    option_id: 3,
    option_type: "call",
    option_style: "european",
    strike_price: 1000,
    premium: 0.01,
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

describe("not connected", () => {
  it("prompts to connect", async () => {
    render(<WalletScreen />);
    expect(await screen.findByText("No wallet connected")).toBeTruthy();
    fireEvent.press(screen.getByText("Connect Wallet"));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(blockchainService.getWalletBalance).not.toHaveBeenCalled();
  });

  it("shows a spinner while the wallet client initializes", () => {
    wallet({ isInitializing: true });
    render(<WalletScreen />);
    expect(screen.queryByText("No wallet connected")).toBeNull();
  });

  it("warns and disables connecting when not configured", async () => {
    wallet({ isConfigured: false });
    render(<WalletScreen />);
    expect(
      await screen.findByText(/isn't configured for this build/),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("Connect Wallet"));
    expect(connect).not.toHaveBeenCalled();
  });

  it("shows the pairing QR code and opens the wallet app on request", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    wallet({ pairingUri: "wc:abc123" });
    render(<WalletScreen />);
    const qr = await screen.findByText(/Scan with a wallet app/);
    expect(qr).toBeTruthy();
    expect(screen.UNSAFE_getByType("QRCode").props.value).toBe("wc:abc123");
    fireEvent.press(screen.getByText("Open in wallet app"));
    expect(openURL).toHaveBeenCalledWith("wc:abc123");
    openURL.mockRestore();
  });

  it("shows wallet-level errors", async () => {
    wallet({ error: "User rejected" });
    render(<WalletScreen />);
    expect(await screen.findByText("User rejected")).toBeTruthy();
  });

  it("warns when the backend has no deployed contract", async () => {
    blockchainService.getStatus.mockResolvedValue({});
    render(<WalletScreen />);
    expect(
      await screen.findByText(/isn't pointed at a deployed contract/),
    ).toBeTruthy();
  });

  it("tolerates a failing status call", async () => {
    blockchainService.getStatus.mockRejectedValue(new Error("x"));
    render(<WalletScreen />);
    expect(await screen.findByText("No wallet connected")).toBeTruthy();
  });
});

describe("connected", () => {
  it("loads balance, positions and options for the address", async () => {
    connected();
    render(<WalletScreen />);
    expect(await screen.findByText("1.2346 ETH")).toBeTruthy();
    expect(blockchainService.getWalletBalance).toHaveBeenCalledWith(ADDRESS);
    expect(blockchainService.getWalletPositions).toHaveBeenCalledWith(ADDRESS);
    expect(blockchainService.getWalletOptions).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByText("0x1111…1111")).toBeTruthy();
    expect(screen.getByText("very low")).toBeTruthy();
  });

  it("lists on-chain positions", async () => {
    connected();
    render(<WalletScreen />);
    expect(await screen.findByText("#7 · 5x")).toBeTruthy();
    expect(screen.getByText(/Entry 1,850.50/)).toBeTruthy();
    expect(screen.getByText("long")).toBeTruthy();
    expect(screen.getByText("1 open")).toBeTruthy();
  });

  it("offers Exercise only for the holder's active options (case-insensitive address match)", async () => {
    connected();
    render(<WalletScreen />);
    await screen.findByText("3 total");
    expect(screen.getAllByText("Exercise")).toHaveLength(1);
    expect(screen.getAllByText(/Holder/)).toHaveLength(2);
    expect(screen.getAllByText(/Writer/)).toHaveLength(1);
    expect(screen.getByText("exercised")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
  });

  it("shows empty states", async () => {
    connected();
    blockchainService.getWalletPositions.mockResolvedValue({
      liquidation_risk: "none",
      positions: [],
    });
    blockchainService.getWalletOptions.mockResolvedValue([]);
    render(<WalletScreen />);
    expect(await screen.findByText("No open positions")).toBeTruthy();
    expect(screen.getByText("No on-chain options yet")).toBeTruthy();
  });

  it("shows an error when on-chain data cannot be loaded", async () => {
    connected();
    blockchainService.getWalletBalance.mockRejectedValue(new Error("RPC down"));
    render(<WalletScreen />);
    expect(await screen.findByText("RPC down")).toBeTruthy();
  });

  it("disconnects", async () => {
    connected();
    render(<WalletScreen />);
    fireEvent.press(await screen.findByText("Disconnect"));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("supports pull-to-refresh", async () => {
    connected();
    render(<WalletScreen />);
    await screen.findByText("1.2346 ETH");
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() =>
      expect(blockchainService.getWalletBalance).toHaveBeenCalledTimes(2),
    );
  });
});

describe("margin and transactions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const ready = async () => {
    connected();
    render(<WalletScreen />);
    await screen.findByText("1.2346 ETH");
  };
  const advance = (ms) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  it("does not submit with an empty amount", async () => {
    await ready();
    fireEvent.press(screen.getByText("Deposit Margin"));
    expect(blockchainService.prepareDepositMargin).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "abc"])("ignores an invalid amount %p", async (value) => {
    await ready();
    typeInto(0, value);
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    expect(blockchainService.prepareDepositMargin).not.toHaveBeenCalled();
  });

  it("prepares, signs and confirms a deposit, then reloads", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({ to: "0xabc" });
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "success",
    });
    await ready();

    typeInto(0, "0.5");
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    expect(blockchainService.prepareDepositMargin).toHaveBeenCalledWith({
      userAddress: ADDRESS,
      amount: 0.5,
    });
    expect(sendTransaction).toHaveBeenCalledWith({ to: "0xabc" });
    expect(screen.getByText("Waiting for confirmation…")).toBeTruthy();

    await advance(2000);
    expect(blockchainService.getTransactionStatus).toHaveBeenCalledWith(
      "0xhash",
    );
    expect(screen.getByText("Transaction confirmed.")).toBeTruthy();
    expect(blockchainService.getWalletBalance).toHaveBeenCalledTimes(2);
  });

  it("switches to withdraw", async () => {
    blockchainService.prepareWithdrawMargin.mockResolvedValue({ to: "0xabc" });
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "success",
    });
    await ready();
    fireEvent.press(screen.getByText("Withdraw"));
    typeInto(0, "1");
    fireEvent.press(screen.getByText("Withdraw Margin"));
    await advance(0);
    expect(blockchainService.prepareWithdrawMargin).toHaveBeenCalledWith({
      userAddress: ADDRESS,
      amount: 1,
    });
    expect(blockchainService.prepareDepositMargin).not.toHaveBeenCalled();
    await advance(2000);
  });

  it("keeps polling until the transaction is final", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus
      .mockResolvedValueOnce({ status: "pending" })
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ status: "success" });
    await ready();
    typeInto(0, "1");
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    await advance(2000);
    await advance(2000);
    expect(screen.queryByText("Transaction confirmed.")).toBeNull();
    await advance(2000);
    expect(screen.getByText("Transaction confirmed.")).toBeTruthy();
    expect(blockchainService.getTransactionStatus).toHaveBeenCalledTimes(3);
  });

  it("reports an on-chain failure and does not reload wallet data", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "failed",
      error: "Out of gas",
    });
    await ready();
    typeInto(0, "1");
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    await advance(2000);
    expect(screen.getByText("Out of gas")).toBeTruthy();
    expect(blockchainService.getWalletBalance).toHaveBeenCalledTimes(1);
  });

  it("uses a generic message for a failure without details", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "error",
    });
    await ready();
    typeInto(0, "1");
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    await advance(2000);
    expect(screen.getByText("Transaction failed on-chain.")).toBeTruthy();
  });

  it("gives up after 30 attempts", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockResolvedValue("0xhash");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "pending",
    });
    await ready();
    typeInto(0, "1");
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    await advance(2000 * 30);
    expect(blockchainService.getTransactionStatus).toHaveBeenCalledTimes(30);
    expect(screen.getByText("Timed out waiting to confirm.")).toBeTruthy();
  });

  it("shows an error when the transaction cannot be prepared or signed", async () => {
    blockchainService.prepareDepositMargin.mockResolvedValue({});
    sendTransaction.mockRejectedValue(new Error("User denied"));
    await ready();
    typeInto(0, "1");
    fireEvent.press(screen.getByText("Deposit Margin"));
    await advance(0);
    expect(screen.getByText("User denied")).toBeTruthy();
  });

  it("exercises an option and reloads on confirmation", async () => {
    blockchainService.prepareExerciseOption.mockResolvedValue({ to: "0xopt" });
    sendTransaction.mockResolvedValue("0xhash2");
    blockchainService.getTransactionStatus.mockResolvedValue({
      status: "success",
    });
    await ready();
    fireEvent.press(screen.getByText("Exercise"));
    await advance(0);
    expect(blockchainService.prepareExerciseOption).toHaveBeenCalledWith({
      walletAddress: ADDRESS,
      optionId: 1,
    });
    expect(sendTransaction).toHaveBeenCalledWith({ to: "0xopt" });
    await advance(2000);
    expect(screen.getByText("Transaction confirmed.")).toBeTruthy();
    expect(blockchainService.getWalletOptions).toHaveBeenCalledTimes(2);
  });

  it("reports exercise failures", async () => {
    blockchainService.prepareExerciseOption.mockRejectedValue(
      new Error("Option expired"),
    );
    await ready();
    fireEvent.press(screen.getByText("Exercise"));
    await advance(0);
    expect(screen.getByText("Option expired")).toBeTruthy();
  });
});
