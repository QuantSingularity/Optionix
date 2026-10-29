import { fireEvent, screen, waitFor } from "@testing-library/react";
import Settings from "../../pages/Settings";
import { useAuth } from "../../utils/AuthContext";
import tradingService from "../../services/tradingService";
import { renderWithRouter } from "../../testUtils/render";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock(
  "../../components/common/CreateAccountPrompt",
  () =>
    ({ onCreated }) => (
      <button onClick={() => onCreated({ id: 2 })}>create-account</button>
    ),
);
jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: { listAccounts: jest.fn() },
}));

const logout = jest.fn();
const user = {
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  role: "trader",
  created_at: "2024-03-15T12:00:00Z",
  last_login: "2024-06-01T12:00:00Z",
  is_verified: true,
  kyc_status: "under_review",
  mfa_enabled: true,
  risk_score: 42,
};
const accounts = [
  {
    account_id: "ACC-1234567890ABCDEF",
    account_type: "demo",
    account_status: "active",
    balance_usd: 100000,
    margin_used: 250,
    created_at: "2024-01-05T00:00:00Z",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user, logout });
  tradingService.listAccounts.mockResolvedValue(accounts);
});

describe("Settings", () => {
  it("shows profile details", async () => {
    renderWithRouter(<Settings />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("trader")).toBeInTheDocument();
    expect(screen.getByText("Mar 15, 2024")).toBeInTheDocument();
    expect(screen.getByText("Jun 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    await screen.findByText("1 account total");
  });

  it("shows placeholders for a sparse profile", async () => {
    useAuth.mockReturnValue({ user: { email: "a@b.co" }, logout });
    renderWithRouter(<Settings />);
    expect(screen.getByText("This session")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.getByText("Not enabled")).toBeInTheDocument();
    expect(screen.getByText("-/100")).toBeInTheDocument();
    await screen.findByText("1 account total");
  });

  it("shows security status", async () => {
    renderWithRouter(<Settings />);
    expect(screen.getByText("under review")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("42/100")).toBeInTheDocument();
    await screen.findByText("1 account total");
  });

  it("lists accounts with a shortened id", async () => {
    renderWithRouter(<Settings />);
    expect(await screen.findByText("ACC-1234…")).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("$100,000.00")).toBeInTheDocument();
    expect(screen.getByText("$250.00")).toBeInTheDocument();
  });

  it("does not crash on an account without an id", async () => {
    tradingService.listAccounts.mockResolvedValue([
      { account_type: "live", account_status: "pending", balance_usd: 5 },
    ]);
    renderWithRouter(<Settings />);
    expect(await screen.findByText("live")).toBeInTheDocument();
  });

  it("pluralises the account count and shows the empty state", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    renderWithRouter(<Settings />);
    expect(await screen.findByText("No trading accounts")).toBeInTheDocument();
    expect(screen.getByText("0 accounts total")).toBeInTheDocument();
  });

  it("shows an error when accounts cannot be loaded", async () => {
    tradingService.listAccounts.mockRejectedValue(new Error("Server down"));
    renderWithRouter(<Settings />);
    expect(await screen.findByText("Server down")).toBeInTheDocument();
  });

  it("signs out", async () => {
    renderWithRouter(<Settings />);
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    expect(logout).toHaveBeenCalledTimes(1);
    await screen.findByText("1 account total");
  });

  it("toggles the new-account form and refreshes after creation", async () => {
    renderWithRouter(<Settings />);
    await screen.findByText("1 account total");
    fireEvent.click(screen.getByRole("button", { name: /New Account/ }));
    fireEvent.click(screen.getByText("create-account"));
    await waitFor(() =>
      expect(tradingService.listAccounts).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByText("create-account")).not.toBeInTheDocument();
  });
});
