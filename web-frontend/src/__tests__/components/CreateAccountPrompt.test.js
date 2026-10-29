import { fireEvent, screen, waitFor, act } from "@testing-library/react";
import CreateAccountPrompt from "../../components/common/CreateAccountPrompt";
import tradingService from "../../services/tradingService";
import { useWallet } from "../../utils/WalletContext";
import { renderWithTheme } from "../../testUtils/render";

jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: { createAccount: jest.fn() },
}));
jest.mock("../../utils/WalletContext", () => ({ useWallet: jest.fn() }));
jest.mock("../../services/apiClient", () => ({
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

beforeEach(() => {
  jest.clearAllMocks();
  wallet();
});

const address = () => screen.getByLabelText("Wallet address");
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /Open Account/ }));

describe("CreateAccountPrompt", () => {
  it("pre-fills a demo account with a generated address", () => {
    renderWithTheme(<CreateAccountPrompt />);
    expect(screen.getByText("Open your trading account")).toBeInTheDocument();
    expect(screen.getByLabelText("Account type")).toHaveValue("demo");
    expect(screen.getByLabelText("Initial deposit (USD)")).toHaveValue(100000);
    expect(address().value).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("offers the three account types", () => {
    renderWithTheme(<CreateAccountPrompt />);
    const options = Array.from(
      screen.getByLabelText("Account type").options,
    ).map((o) => o.value);
    expect(options).toEqual(["demo", "standard", "margin"]);
  });

  it("generates a fresh address on demand", () => {
    renderWithTheme(<CreateAccountPrompt />);
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    fireEvent.click(screen.getByTitle("Generate a new address"));
    expect(address()).toHaveValue(`0x${"0".repeat(40)}`);
    spy.mockRestore();
  });

  it("creates the account with the entered values and reports it", async () => {
    tradingService.createAccount.mockResolvedValue({ id: 5 });
    const onCreated = jest.fn();
    renderWithTheme(<CreateAccountPrompt onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "margin" },
    });
    fireEvent.change(screen.getByLabelText("Initial deposit (USD)"), {
      target: { value: "2500" },
    });
    fireEvent.change(address(), { target: { value: "0xabc" } });
    submit();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 5 }));
    expect(tradingService.createAccount).toHaveBeenCalledWith({
      ethereumAddress: "0xabc",
      accountType: "margin",
      initialDeposit: 2500,
    });
  });

  it("omits the deposit when blank and works without a callback", async () => {
    tradingService.createAccount.mockResolvedValue({});
    renderWithTheme(<CreateAccountPrompt />);
    fireEvent.change(screen.getByLabelText("Initial deposit (USD)"), {
      target: { value: "" },
    });
    submit();
    await waitFor(() =>
      expect(tradingService.createAccount).toHaveBeenCalled(),
    );
    expect(
      tradingService.createAccount.mock.calls[0][0].initialDeposit,
    ).toBeUndefined();
  });

  it("disables the button while submitting", async () => {
    let resolve;
    tradingService.createAccount.mockReturnValue(
      new Promise((r) => (resolve = r)),
    );
    renderWithTheme(<CreateAccountPrompt />);
    submit();
    expect(
      await screen.findByRole("button", { name: /Opening account/ }),
    ).toBeDisabled();
    await act(async () => resolve({}));
    expect(screen.getByRole("button", { name: /Open Account/ })).toBeEnabled();
  });

  it("shows the server error and allows retrying", async () => {
    tradingService.createAccount.mockRejectedValueOnce(
      new Error("Address in use"),
    );
    renderWithTheme(<CreateAccountPrompt />);
    submit();
    expect(await screen.findByText("Address in use")).toBeInTheDocument();
    tradingService.createAccount.mockResolvedValueOnce({});
    submit();
    await waitFor(() =>
      expect(screen.queryByText("Address in use")).not.toBeInTheDocument(),
    );
  });

  it("uses an already-connected wallet address without reconnecting", () => {
    wallet({ isConnected: true, address: WALLET });
    renderWithTheme(<CreateAccountPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /Use Wallet/ }));
    expect(connect).not.toHaveBeenCalled();
    expect(address()).toHaveValue(WALLET);
  });

  it("connects first when no wallet is connected", async () => {
    connect.mockResolvedValue(WALLET);
    renderWithTheme(<CreateAccountPrompt />);
    fireEvent.click(screen.getByRole("button", { name: /Use Wallet/ }));
    await waitFor(() => expect(address()).toHaveValue(WALLET));
  });

  it("keeps the generated address if connecting is cancelled", async () => {
    connect.mockResolvedValue(null);
    renderWithTheme(<CreateAccountPrompt />);
    const before = address().value;
    fireEvent.click(screen.getByRole("button", { name: /Use Wallet/ }));
    await waitFor(() => expect(connect).toHaveBeenCalled());
    expect(address()).toHaveValue(before);
  });

  it("disables the wallet button while connecting", () => {
    wallet({ isConnecting: true });
    renderWithTheme(<CreateAccountPrompt />);
    expect(
      screen.getByTitle("Use your connected wallet address"),
    ).toBeDisabled();
  });
});
