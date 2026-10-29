import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import CreateAccountPrompt from "../../components/CreateAccountPrompt";
import tradingService from "../../services/tradingService";
import { useWallet } from "../../context/WalletContext";

jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: { createAccount: jest.fn() },
}));
jest.mock("../../context/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("../../services/api", () => ({
  __esModule: true,
  extractErrorMessage: (err, fallback) => err?.message || fallback,
}));

const WALLET = "0x9999999999999999999999999999999999999999";
const connect = jest.fn();

const wallet = (o = {}) =>
  useWallet.mockReturnValue({
    address: null,
    isConnected: false,
    isConnecting: false,
    connect,
    ...o,
  });

const addressInput = () => screen.getByDisplayValue(/^0x[0-9a-f]{40}$/);

beforeEach(() => {
  jest.clearAllMocks();
  wallet();
});

describe("CreateAccountPrompt", () => {
  it("pre-fills a demo deposit and a generated address", () => {
    render(<CreateAccountPrompt />);
    expect(screen.getByText("Open your trading account")).toBeTruthy();
    expect(screen.getByDisplayValue("100000")).toBeTruthy();
    expect(addressInput()).toBeTruthy();
  });

  it("generates a new address with the New button", () => {
    render(<CreateAccountPrompt />);
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    fireEvent.press(screen.getByText("New"));
    expect(screen.getByDisplayValue(`0x${"0".repeat(40)}`)).toBeTruthy();
    spy.mockRestore();
  });

  it("creates a demo account and reports it to the parent", async () => {
    const account = { id: 5 };
    tradingService.createAccount.mockResolvedValue(account);
    const onCreated = jest.fn();
    render(<CreateAccountPrompt onCreated={onCreated} />);
    const address = addressInput().props.value;

    fireEvent.changeText(screen.getByDisplayValue("100000"), "2500");
    fireEvent.press(screen.getByText("Open Account"));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(account));
    expect(tradingService.createAccount).toHaveBeenCalledWith({
      ethereumAddress: address,
      accountType: "demo",
      initialDeposit: 2500,
    });
  });

  it("omits the deposit when the field is empty", async () => {
    tradingService.createAccount.mockResolvedValue({});
    render(<CreateAccountPrompt />);
    fireEvent.changeText(screen.getByDisplayValue("100000"), "");
    fireEvent.press(screen.getByText("Open Account"));
    await waitFor(() =>
      expect(tradingService.createAccount).toHaveBeenCalled(),
    );
    expect(
      tradingService.createAccount.mock.calls[0][0].initialDeposit,
    ).toBeUndefined();
  });

  it("works without an onCreated callback", async () => {
    tradingService.createAccount.mockResolvedValue({});
    render(<CreateAccountPrompt />);
    fireEvent.press(screen.getByText("Open Account"));
    await waitFor(() =>
      expect(tradingService.createAccount).toHaveBeenCalled(),
    );
  });

  it("shows the server error and allows retrying", async () => {
    tradingService.createAccount.mockRejectedValueOnce(
      new Error("Address in use"),
    );
    render(<CreateAccountPrompt />);
    fireEvent.press(screen.getByText("Open Account"));
    expect(await screen.findByText("Address in use")).toBeTruthy();

    tradingService.createAccount.mockResolvedValueOnce({});
    fireEvent.press(screen.getByText("Open Account"));
    await waitFor(() =>
      expect(screen.queryByText("Address in use")).toBeNull(),
    );
  });

  it("uses the connected wallet address when already connected", () => {
    wallet({ isConnected: true, address: WALLET });
    render(<CreateAccountPrompt />);
    fireEvent.press(screen.getByText("Use Wallet"));
    expect(connect).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(WALLET)).toBeTruthy();
  });

  it("connects a wallet first when none is connected", async () => {
    connect.mockResolvedValue(WALLET);
    render(<CreateAccountPrompt />);
    await act(async () => {
      fireEvent.press(screen.getByText("Use Wallet"));
    });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue(WALLET)).toBeTruthy();
  });

  it("keeps the generated address when wallet connection is cancelled", async () => {
    connect.mockResolvedValue(null);
    render(<CreateAccountPrompt />);
    const before = addressInput().props.value;
    await act(async () => {
      fireEvent.press(screen.getByText("Use Wallet"));
    });
    expect(addressInput().props.value).toBe(before);
  });
});
