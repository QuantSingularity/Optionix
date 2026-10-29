import { RefreshControl } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import PortfolioScreen from "../../screens/PortfolioScreen";
import portfolioService from "../../services/portfolioService";
import tradingService from "../../services/tradingService";

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
  portfolioService.getOverview.mockResolvedValue({ total_equity: 98765.43 });
  portfolioService.getAllocation.mockResolvedValue({
    allocations: [
      { symbol: "AAPL", exposure: 60000, weight_pct: 60 },
      { symbol: "TSLA", exposure: 40000, weight_pct: 40 },
    ],
  });
  portfolioService.getPerformance.mockResolvedValue({
    total_trades: 12,
    total_pnl: 3456.78,
  });
  portfolioService.getRiskMetrics.mockResolvedValue({
    var_95: 1234.5,
    methodology: "historical simulation",
  });
  portfolioService.getGreeksSummary.mockResolvedValue({
    open_positions: 3,
    net_greeks: { delta: 0.5, gamma: 0.01234567, vega: 12.3 },
  });
});

describe("PortfolioScreen", () => {
  it("loads everything for a user with an account", async () => {
    render(<PortfolioScreen />);
    await screen.findByText("Total Equity");
    expect(portfolioService.getPerformance).toHaveBeenCalledWith(30);
    expect(portfolioService.getRiskMetrics).toHaveBeenCalled();
    expect(portfolioService.getGreeksSummary).toHaveBeenCalled();
  });

  it("shows equity and VaR", async () => {
    render(<PortfolioScreen />);
    expect(await screen.findByText("$98,765.43")).toBeTruthy();
    expect(screen.getByText("$1,234.50")).toBeTruthy();
  });

  it("lists allocation rows", async () => {
    render(<PortfolioScreen />);
    expect(await screen.findByText("AAPL")).toBeTruthy();
    expect(screen.getByText("$60,000.00")).toBeTruthy();
    expect(screen.getByText("TSLA")).toBeTruthy();
  });

  it("shows net Greeks to 4 decimals", async () => {
    render(<PortfolioScreen />);
    expect(await screen.findByText("0.5000")).toBeTruthy();
    expect(screen.getByText("0.0123")).toBeTruthy();
    expect(screen.getByText("12.3000")).toBeTruthy();
    expect(screen.getByText("delta")).toBeTruthy();
  });

  it("shows 30 day performance and the methodology footnote", async () => {
    render(<PortfolioScreen />);
    expect(await screen.findByText("12")).toBeTruthy();
    expect(screen.getByText("$3,456.78")).toBeTruthy();
    expect(
      screen.getByText("Risk figures computed via historical simulation."),
    ).toBeTruthy();
  });

  it("shows empty states when there is no activity", async () => {
    portfolioService.getAllocation.mockResolvedValue({ allocations: [] });
    portfolioService.getGreeksSummary.mockResolvedValue({
      open_positions: 0,
      net_greeks: {},
    });
    portfolioService.getPerformance.mockResolvedValue({ total_trades: 0 });
    portfolioService.getRiskMetrics.mockResolvedValue({});
    render(<PortfolioScreen />);
    expect(await screen.findByText("No open positions")).toBeTruthy();
    expect(screen.getByText("No Greeks yet")).toBeTruthy();
    expect(screen.getByText("No trades in this window")).toBeTruthy();
    expect(screen.queryByText(/Risk figures computed/)).toBeNull();
  });

  it("prompts for an account and skips portfolio calls when none exists", async () => {
    tradingService.listAccounts.mockResolvedValue([]);
    render(<PortfolioScreen />);
    expect(await screen.findByText("Open your trading account")).toBeTruthy();
    expect(portfolioService.getOverview).not.toHaveBeenCalled();
  });

  it("loads the portfolio once an account has been created", async () => {
    tradingService.listAccounts.mockResolvedValueOnce([]);
    tradingService.createAccount.mockResolvedValue({ id: 1 });
    render(<PortfolioScreen />);
    fireEvent.press(await screen.findByText("Open Account"));
    expect(await screen.findByText("Total Equity")).toBeTruthy();
  });

  it("shows an error message when any request fails", async () => {
    portfolioService.getRiskMetrics.mockRejectedValue(
      new Error("Risk engine offline"),
    );
    render(<PortfolioScreen />);
    expect(await screen.findByText("Risk engine offline")).toBeTruthy();
  });

  it("supports pull-to-refresh", async () => {
    render(<PortfolioScreen />);
    await screen.findByText("Total Equity");
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() =>
      expect(tradingService.listAccounts).toHaveBeenCalledTimes(2),
    );
  });
});
