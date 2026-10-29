import { RefreshControl } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import DashboardScreen from "../../screens/DashboardScreen";
import { useAuth } from "../../context/AuthContext";
import portfolioService from "../../services/portfolioService";
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
  default: {
    listAccounts: jest.fn(),
    listOrders: jest.fn(),
    createAccount: jest.fn(),
  },
}));
jest.mock("../../services/portfolioService", () => ({
  __esModule: true,
  default: { getOverview: jest.fn(), getAllocation: jest.fn() },
}));

const navigation = { navigate: jest.fn() };
const overview = {
  total_equity: 125000.5,
  total_unrealised_pnl: 2500,
  margin_utilisation_pct: 12.5,
  open_positions: 4,
};
const allocation = {
  allocations: [
    { symbol: "AAPL", exposure: 60000, weight_pct: 60 },
    { symbol: "TSLA", exposure: 40000, weight_pct: 40 },
  ],
};
const orders = [
  {
    trade_id: "T1",
    symbol: "AAPL",
    trade_type: "buy",
    quantity: 10,
    status: "executed",
    created_at: "2024-03-15T12:00:00Z",
  },
  {
    trade_id: "T2",
    symbol: "TSLA",
    trade_type: "sell",
    quantity: 5,
    status: "pending",
    created_at: "2024-03-16T12:00:00Z",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { full_name: "Ada Lovelace" } });
  tradingService.listAccounts.mockResolvedValue([{ id: 1 }]);
  tradingService.listOrders.mockResolvedValue(orders);
  portfolioService.getOverview.mockResolvedValue(overview);
  portfolioService.getAllocation.mockResolvedValue(allocation);
});

const mount = () => render(<DashboardScreen navigation={navigation} />);

describe("DashboardScreen", () => {
  it("shows a spinner, then greets the user by first name", async () => {
    mount();
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    expect(await screen.findByText("Welcome back, Ada")).toBeTruthy();
  });

  it("falls back to a generic greeting", async () => {
    useAuth.mockReturnValue({ user: null });
    mount();
    expect(await screen.findByText("Welcome back, there")).toBeTruthy();
  });

  it("loads accounts, then overview, allocation and 5 recent orders", async () => {
    mount();
    await screen.findByText("Welcome back, Ada");
    expect(portfolioService.getOverview).toHaveBeenCalled();
    expect(portfolioService.getAllocation).toHaveBeenCalled();
    expect(tradingService.listOrders).toHaveBeenCalledWith({ limit: 5 });
  });

  it("shows headline stats", async () => {
    mount();
    expect(await screen.findByText("$125,000.50")).toBeTruthy();
    expect(screen.getByText("$2,500.00")).toBeTruthy();
    expect(screen.getByText("Positive exposure")).toBeTruthy();
    expect(screen.getByText("12.50%")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("flags negative P&L", async () => {
    portfolioService.getOverview.mockResolvedValue({
      ...overview,
      total_unrealised_pnl: -300,
    });
    mount();
    expect(await screen.findByText("Negative exposure")).toBeTruthy();
    expect(screen.getByText("-$300.00")).toBeTruthy();
  });

  it("lists allocation rows", async () => {
    mount();
    await screen.findByText("$60,000.00 · 60.00%");
    // AAPL appears once in allocation and once in recent orders.
    expect(screen.getAllByText("AAPL")).toHaveLength(2);
    expect(screen.getAllByText("TSLA")).toHaveLength(2);
    expect(screen.getByText("$60,000.00 · 60.00%")).toBeTruthy();
    expect(screen.getByText("$40,000.00 · 40.00%")).toBeTruthy();
  });

  it("lists recent orders with status badges", async () => {
    mount();
    expect(await screen.findByText("2 shown")).toBeTruthy();
    expect(screen.getByText("executed")).toBeTruthy();
    expect(screen.getByText("pending")).toBeTruthy();
    expect(screen.getByText(/BUY · 10/)).toBeTruthy();
    expect(screen.getByText(/SELL · 5/)).toBeTruthy();
  });

  it("does not crash on an order without a trade type", async () => {
    tradingService.listOrders.mockResolvedValue([
      { trade_id: "T9", symbol: "X", quantity: 1, status: "mystery" },
    ]);
    mount();
    expect(await screen.findByText("mystery")).toBeTruthy();
  });

  it("shows empty states for allocation and orders", async () => {
    portfolioService.getAllocation.mockResolvedValue({ allocations: [] });
    tradingService.listOrders.mockResolvedValue([]);
    mount();
    expect(await screen.findByText("No open positions yet")).toBeTruthy();
    expect(screen.getByText("No orders yet")).toBeTruthy();
  });

  it("navigates to Trading", async () => {
    mount();
    fireEvent.press(await screen.findByText("Go to Trading →"));
    expect(navigation.navigate).toHaveBeenCalledWith("Trading");
  });

  it("prompts users without an account to open one, and skips portfolio calls", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    mount();
    expect(await screen.findByText("Open your trading account")).toBeTruthy();
    expect(portfolioService.getOverview).not.toHaveBeenCalled();
    expect(screen.queryByText("Total Equity")).toBeNull();
  });

  it("reloads the dashboard after an account is created", async () => {
    tradingService.listAccounts.mockResolvedValueOnce([]);
    tradingService.createAccount.mockResolvedValue({ id: 1 });
    mount();
    fireEvent.press(await screen.findByText("Open Account"));
    expect(await screen.findByText("Total Equity")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    tradingService.listAccounts.mockRejectedValue(new Error("Backend offline"));
    mount();
    expect(await screen.findByText("Backend offline")).toBeTruthy();
  });

  it("supports pull-to-refresh", async () => {
    mount();
    await screen.findByText("Welcome back, Ada");
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() =>
      expect(tradingService.listAccounts).toHaveBeenCalledTimes(2),
    );
  });
});
