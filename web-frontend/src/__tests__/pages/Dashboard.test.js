import { fireEvent, screen, waitFor } from "@testing-library/react";
import Dashboard from "../../pages/Dashboard";
import { useAuth } from "../../utils/AuthContext";
import portfolioService from "../../services/portfolioService";
import tradingService from "../../services/tradingService";
import { renderWithRouter } from "../../testUtils/render";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../components/common/Charts", () => ({
  ThemedDoughnut: ({ data }) => (
    <div data-testid="doughnut">
      {data.labels.join("|")}:{data.datasets[0].data.join("|")}
    </div>
  ),
  CHART_PALETTE: ["#111"],
}));
jest.mock(
  "../../components/common/CreateAccountPrompt",
  () =>
    ({ onCreated }) => (
      <button onClick={() => onCreated({ id: 1 })}>create-account</button>
    ),
);
jest.mock("../../services/tradingService", () => ({
  __esModule: true,
  default: { listAccounts: jest.fn(), listOrders: jest.fn() },
}));
jest.mock("../../services/portfolioService", () => ({
  __esModule: true,
  default: {
    getOverview: jest.fn(),
    getAllocation: jest.fn(),
    getGreeksSummary: jest.fn(),
  },
}));

const overview = {
  total_equity: 125000.5,
  total_unrealised_pnl: 2500,
  margin_utilisation_pct: 12.5,
  open_positions: 4,
};
const allocation = {
  allocations: [
    { symbol: "AAPL", weight_pct: "60" },
    { symbol: "TSLA", weight_pct: 40 },
  ],
};
const greeks = {
  open_positions: 2,
  net_greeks: { delta: 0.5, vega: 12.3456789 },
};
const orders = [
  {
    trade_id: "T1",
    symbol: "AAPL",
    trade_type: "buy",
    order_type: "limit",
    quantity: 10,
    price: 5,
    executed_price: 5.25,
    status: "executed",
    created_at: "2024-03-15T12:00:00Z",
  },
  {
    trade_id: "T2",
    symbol: "TSLA",
    trade_type: "sell",
    order_type: "market",
    quantity: 3,
    price: 7,
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
  portfolioService.getGreeksSummary.mockResolvedValue(greeks);
});

const mount = () => renderWithRouter(<Dashboard />);

describe("Dashboard", () => {
  it("greets the user by first name after loading", async () => {
    mount();
    expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
    expect(await screen.findByText("Welcome back, Ada")).toBeInTheDocument();
  });

  it("falls back to a generic greeting", async () => {
    useAuth.mockReturnValue({ user: null });
    mount();
    expect(await screen.findByText("Welcome back, there")).toBeInTheDocument();
  });

  it("requests accounts first, then overview, allocation, greeks and 6 orders", async () => {
    mount();
    await screen.findByText("Welcome back, Ada");
    expect(portfolioService.getOverview).toHaveBeenCalled();
    expect(portfolioService.getAllocation).toHaveBeenCalled();
    expect(portfolioService.getGreeksSummary).toHaveBeenCalled();
    expect(tradingService.listOrders).toHaveBeenCalledWith({ limit: 6 });
  });

  it("shows headline stats", async () => {
    mount();
    expect(await screen.findByText("$125,000.50")).toBeInTheDocument();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("Positive exposure")).toBeInTheDocument();
    expect(screen.getByText("12.50%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("flags negative P&L", async () => {
    portfolioService.getOverview.mockResolvedValue({
      ...overview,
      total_unrealised_pnl: -300,
    });
    mount();
    expect(await screen.findByText("Negative exposure")).toBeInTheDocument();
    expect(screen.getByText("-$300.00")).toBeInTheDocument();
  });

  it("feeds numeric weights to the allocation chart", async () => {
    mount();
    expect(await screen.findByTestId("doughnut")).toHaveTextContent(
      "AAPL|TSLA:60|40",
    );
  });

  it("shows net greeks to 4 decimals", async () => {
    mount();
    expect(await screen.findByText("0.5000")).toBeInTheDocument();
    expect(screen.getByText("12.3457")).toBeInTheDocument();
  });

  it("lists recent orders preferring the executed price", async () => {
    mount();
    expect(await screen.findByText("$5.25")).toBeInTheDocument();
    expect(screen.getByText("$7.00")).toBeInTheDocument();
    expect(screen.getByText("executed")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("shows empty states", async () => {
    portfolioService.getAllocation.mockResolvedValue({ allocations: [] });
    portfolioService.getGreeksSummary.mockResolvedValue({
      open_positions: 0,
      net_greeks: {},
    });
    tradingService.listOrders.mockResolvedValue([]);
    mount();
    expect(
      await screen.findByText("No open positions yet"),
    ).toBeInTheDocument();
    expect(screen.getByText("No Greeks yet")).toBeInTheDocument();
    expect(screen.getByText("No orders yet")).toBeInTheDocument();
    expect(screen.queryByTestId("doughnut")).not.toBeInTheDocument();
  });

  it("links to trading and portfolio", async () => {
    mount();
    await screen.findByText("Welcome back, Ada");
    expect(screen.getByRole("link", { name: /New Order/ })).toHaveAttribute(
      "href",
      "/dashboard/trading",
    );
    expect(
      screen.getByRole("link", { name: /View portfolio/ }),
    ).toHaveAttribute("href", "/dashboard/portfolio");
    expect(screen.getByRole("link", { name: /View all/ })).toHaveAttribute(
      "href",
      "/dashboard/trading",
    );
  });

  it("prompts users without an account and skips the portfolio calls", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    mount();
    expect(await screen.findByText("create-account")).toBeInTheDocument();
    expect(portfolioService.getOverview).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: /New Order/ }),
    ).not.toBeInTheDocument();
  });

  it("reloads the dashboard after an account is created", async () => {
    tradingService.listAccounts.mockResolvedValueOnce([]);
    mount();
    fireEvent.click(await screen.findByText("create-account"));
    expect(await screen.findByText("$125,000.50")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    tradingService.listAccounts.mockRejectedValue(new Error("Backend offline"));
    mount();
    expect(await screen.findByText("Backend offline")).toBeInTheDocument();
  });
});
