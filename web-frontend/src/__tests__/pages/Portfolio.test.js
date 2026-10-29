import { fireEvent, screen, waitFor } from "@testing-library/react";
import Portfolio from "../../pages/Portfolio";
import portfolioService from "../../services/portfolioService";
import tradingService from "../../services/tradingService";
import { renderWithRouter } from "../../testUtils/render";

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
  default: { listAccounts: jest.fn() },
}));
jest.mock("../../services/portfolioService", () => ({
  __esModule: true,
  default: {
    getOverview: jest.fn(),
    getAllocation: jest.fn(),
    getPerformance: jest.fn(),
    getRiskMetrics: jest.fn(),
    getGreeksSummary: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  tradingService.listAccounts.mockResolvedValue([{ id: 1 }]);
  portfolioService.getOverview.mockResolvedValue({
    total_equity: 98765.43,
    total_unrealised_pnl: -120.5,
  });
  portfolioService.getAllocation.mockResolvedValue({
    allocations: [
      { symbol: "AAPL", exposure: 60000, weight_pct: 60 },
      { symbol: "TSLA", exposure: 40000, weight_pct: 40 },
    ],
  });
  portfolioService.getPerformance.mockResolvedValue({
    total_trades: 12,
    total_pnl: 3456.78,
    total_fees: 12.5,
    avg_trade_value: 999.99,
  });
  portfolioService.getRiskMetrics.mockResolvedValue({
    var_95: 1234.5,
    cvar_95: 2345.6,
    methodology: "historical simulation",
  });
  portfolioService.getGreeksSummary.mockResolvedValue({
    open_positions: 3,
    net_greeks: { delta: 0.5, gamma: 0.01234567 },
  });
});

const mount = () => renderWithRouter(<Portfolio />);

describe("Portfolio", () => {
  it("loads everything with a 30 day performance window", async () => {
    mount();
    await screen.findByText("Total Equity");
    expect(portfolioService.getPerformance).toHaveBeenCalledWith(30);
  });

  it("shows equity, P&L, VaR and CVaR", async () => {
    mount();
    expect(await screen.findByText("$98,765.43")).toBeInTheDocument();
    expect(screen.getByText("-$120.50")).toBeInTheDocument();
    expect(screen.getByText("$1,234.50")).toBeInTheDocument();
    expect(screen.getByText("$2,345.60")).toBeInTheDocument();
  });

  it("charts and tabulates the allocation", async () => {
    mount();
    expect(await screen.findByTestId("doughnut")).toHaveTextContent(
      "AAPL|TSLA:60|40",
    );
    expect(screen.getByText("$60,000.00")).toBeInTheDocument();
    expect(screen.getByText("60.00%")).toBeInTheDocument();
  });

  it("shows net greeks to 4 decimals", async () => {
    mount();
    expect(await screen.findByText("0.5000")).toBeInTheDocument();
    expect(screen.getByText("0.0123")).toBeInTheDocument();
    expect(screen.getByText("delta")).toBeInTheDocument();
  });

  it("shows performance and the methodology footnote", async () => {
    mount();
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getByText("$3,456.78")).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
    expect(screen.getByText("$999.99")).toBeInTheDocument();
    expect(
      screen.getByText(/Risk figures computed via historical simulation\./),
    ).toBeInTheDocument();
  });

  it("refetches performance when the period changes", async () => {
    mount();
    await screen.findByText("Total Equity");
    fireEvent.click(screen.getByRole("button", { name: "90d" }));
    await waitFor(() =>
      expect(portfolioService.getPerformance).toHaveBeenLastCalledWith(90),
    );
    fireEvent.click(await screen.findByRole("button", { name: "7d" }));
    await waitFor(() =>
      expect(portfolioService.getPerformance).toHaveBeenLastCalledWith(7),
    );
  });

  it("shows empty states", async () => {
    portfolioService.getAllocation.mockResolvedValue({ allocations: [] });
    portfolioService.getGreeksSummary.mockResolvedValue({
      open_positions: 0,
      net_greeks: {},
    });
    portfolioService.getPerformance.mockResolvedValue({ total_trades: 0 });
    portfolioService.getRiskMetrics.mockResolvedValue({});
    mount();
    expect(await screen.findByText("No open positions")).toBeInTheDocument();
    expect(screen.getByText("No Greeks yet")).toBeInTheDocument();
    expect(screen.getByText("No trades in this window")).toBeInTheDocument();
    expect(screen.queryByText(/Risk figures computed/)).not.toBeInTheDocument();
  });

  it("prompts for an account and skips portfolio calls", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    mount();
    expect(await screen.findByText("create-account")).toBeInTheDocument();
    expect(portfolioService.getOverview).not.toHaveBeenCalled();
  });

  it("loads the portfolio after an account is created", async () => {
    tradingService.listAccounts.mockResolvedValueOnce([]);
    mount();
    fireEvent.click(await screen.findByText("create-account"));
    expect(await screen.findByText("Total Equity")).toBeInTheDocument();
  });

  it("shows an error message but keeps the page when a request fails", async () => {
    portfolioService.getRiskMetrics.mockRejectedValue(
      new Error("Risk engine offline"),
    );
    mount();
    expect(await screen.findByText("Risk engine offline")).toBeInTheDocument();
  });
});
