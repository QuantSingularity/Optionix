import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import SettingsScreen from "../../screens/SettingsScreen";
import { useAuth } from "../../context/AuthContext";
import tradingService from "../../services/tradingService";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../context/WalletContext", () => ({
  useWallet: () => ({
    address: null,
    isConnected: false,
    isConnecting: false,
    connect: jest.fn(),
  }),
}));
jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: { listAccounts: jest.fn(), createAccount: jest.fn() },
}));

const logout = jest.fn();
const user = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  created_at: "2024-03-15T12:00:00Z",
  is_verified: true,
  kyc_status: "under_review",
  mfa_enabled: true,
  risk_score: 42,
};
const accounts = [
  {
    account_id: "ACC-1234567890ABCDEF",
    account_type: "demo",
    balance_usd: 100000,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user, logout });
  tradingService.listAccounts.mockResolvedValue(accounts);
});

describe("SettingsScreen", () => {
  it("shows profile details", async () => {
    render(<SettingsScreen />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Mar 15, 2024")).toBeTruthy();
    // field label + status badge
    expect(screen.getAllByText("Verified")).toHaveLength(2);
    await screen.findByText("1 total");
  });

  it("shows security status", async () => {
    render(<SettingsScreen />);
    expect(screen.getByText("under review")).toBeTruthy();
    expect(screen.getByText("Enabled")).toBeTruthy();
    expect(screen.getByText("42/100")).toBeTruthy();
    await screen.findByText("1 total");
  });

  it("shows placeholders for a sparse profile", async () => {
    useAuth.mockReturnValue({ user: { email: "a@b.co" }, logout });
    render(<SettingsScreen />);
    expect(screen.getByText("Unverified")).toBeTruthy();
    expect(screen.getByText("Not enabled")).toBeTruthy();
    expect(screen.getByText("-/100")).toBeTruthy();
    await screen.findByText("1 total");
  });

  it("lists trading accounts with a shortened id and balance", async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText("demo")).toBeTruthy();
    expect(screen.getByText("ACC-12345678…")).toBeTruthy();
    expect(screen.getByText("$100,000.00")).toBeTruthy();
  });

  it("does not crash on an account without an id", async () => {
    tradingService.listAccounts.mockResolvedValue([
      { account_type: "live", balance_usd: 5 },
    ]);
    render(<SettingsScreen />);
    expect(await screen.findByText("live")).toBeTruthy();
  });

  it("shows an empty state", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    render(<SettingsScreen />);
    expect(await screen.findByText("No trading accounts")).toBeTruthy();
    expect(screen.getByText("0 total")).toBeTruthy();
  });

  it("shows an error when accounts cannot be loaded", async () => {
    tradingService.listAccounts.mockRejectedValue(new Error("Server down"));
    render(<SettingsScreen />);
    expect(await screen.findByText("Server down")).toBeTruthy();
  });

  it("signs out", async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText("Sign out"));
    expect(logout).toHaveBeenCalledTimes(1);
    await screen.findByText("1 total");
  });

  it("toggles the new-account form", async () => {
    render(<SettingsScreen />);
    await screen.findByText("1 total");
    fireEvent.press(screen.getByText("+ New Account"));
    expect(screen.getByText("Open your trading account")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByText("Open your trading account")).toBeNull();
  });

  it("closes the form and reloads accounts after creating one", async () => {
    tradingService.createAccount.mockResolvedValue({ id: 2 });
    render(<SettingsScreen />);
    await screen.findByText("1 total");
    fireEvent.press(screen.getByText("+ New Account"));
    fireEvent.press(screen.getByText("Open Account"));
    await waitFor(() =>
      expect(tradingService.listAccounts).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByText("Open your trading account")).toBeNull();
  });
});
