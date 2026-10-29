import { RefreshControl } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import RiskScreen from "../../screens/RiskScreen";
import riskService from "../../services/riskService";

jest.mock("../../services/riskService", () => ({
  __esModule: true,
  default: {
    getLimits: jest.fn(),
    getCircuitBreakers: jest.fn(),
    getPortfolioGreeks: jest.fn(),
    calculateVar: jest.fn(),
    stressTest: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  riskService.getLimits.mockResolvedValue({
    utilisation_pct: 42.5,
    status: "healthy",
  });
  riskService.getCircuitBreakers.mockResolvedValue({
    all_clear: true,
    circuit_breakers: [
      {
        name: "daily_loss_limit",
        description: "Max daily loss",
        triggered: false,
      },
      {
        name: "position_size_limit",
        description: "Max position size",
        triggered: true,
      },
    ],
  });
  riskService.getPortfolioGreeks.mockResolvedValue({
    open_positions: 2,
    position_greeks: [{}],
    net_greeks: { delta: 1.5, vega: 20 },
  });
});

const mount = async () => {
  render(<RiskScreen />);
  await screen.findByText("Circuit Breakers");
};

describe("RiskScreen overview", () => {
  it("shows a spinner then limits and status", async () => {
    render(<RiskScreen />);
    expect(screen.queryByText("Risk Management")).toBeNull();
    expect(await screen.findByText("Risk Management")).toBeTruthy();
    expect(screen.getByText("42.50%")).toBeTruthy();
    expect(screen.getByText("healthy")).toBeTruthy();
  });

  it.each([
    ["warning", "warning"],
    ["critical", "critical"],
    ["unknown", "unknown"],
  ])("renders limit status %s", async (status, label) => {
    riskService.getLimits.mockResolvedValue({ utilisation_pct: 1, status });
    await mount();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("lists circuit breakers with humanised names", async () => {
    await mount();
    expect(screen.getByText("All Clear")).toBeTruthy();
    expect(screen.getByText("daily loss limit")).toBeTruthy();
    expect(screen.getByText("Max position size")).toBeTruthy();
    expect(screen.getByText("check-circle")).toBeTruthy();
    expect(screen.getByText("close-circle")).toBeTruthy();
  });

  it("flags breakers needing attention", async () => {
    riskService.getCircuitBreakers.mockResolvedValue({
      all_clear: false,
      circuit_breakers: [],
    });
    await mount();
    expect(screen.getByText("Attention")).toBeTruthy();
  });

  it("shows portfolio greeks", async () => {
    await mount();
    expect(screen.getByText("2 open")).toBeTruthy();
    expect(screen.getByText("Net delta")).toBeTruthy();
    expect(screen.getByText("1.5000")).toBeTruthy();
    expect(screen.getByText("20.0000")).toBeTruthy();
  });

  it("shows an empty state without positions", async () => {
    riskService.getPortfolioGreeks.mockResolvedValue({
      open_positions: 0,
      position_greeks: [],
      net_greeks: {},
    });
    await mount();
    expect(screen.getByText("No open positions")).toBeTruthy();
  });

  it("shows an error when loading fails", async () => {
    riskService.getLimits.mockRejectedValue(new Error("Risk service down"));
    render(<RiskScreen />);
    expect(await screen.findByText("Risk service down")).toBeTruthy();
  });

  it("supports pull-to-refresh", async () => {
    await mount();
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() => expect(riskService.getLimits).toHaveBeenCalledTimes(2));
  });
});

describe("Value at Risk", () => {
  const result = {
    var_results: {
      95: { confidence_level: 0.95, var: 1234.5 },
      99: { confidence_level: 0.99, var: 2345.6 },
    },
  };

  it("defaults to the historical method", async () => {
    riskService.calculateVar.mockResolvedValue(result);
    await mount();
    fireEvent.press(screen.getByText("Calculate VaR"));
    await screen.findByText("95% confidence");
    expect(riskService.calculateVar).toHaveBeenCalledWith({
      method: "historical",
    });
    expect(screen.getByText("$1,234.50")).toBeTruthy();
    expect(screen.getByText("99% confidence")).toBeTruthy();
    expect(screen.getByText("$2,345.60")).toBeTruthy();
  });

  it("uses the selected method", async () => {
    riskService.calculateVar.mockResolvedValue(result);
    await mount();
    fireEvent.press(screen.getByText("Monte Carlo"));
    fireEvent.press(screen.getByText("Calculate VaR"));
    await waitFor(() =>
      expect(riskService.calculateVar).toHaveBeenCalledWith({
        method: "monte_carlo",
      }),
    );
  });

  it("shows an error", async () => {
    riskService.calculateVar.mockRejectedValue(new Error("Not enough history"));
    await mount();
    fireEvent.press(screen.getByText("Calculate VaR"));
    expect(await screen.findByText("Not enough history")).toBeTruthy();
  });
});

describe("Stress testing", () => {
  const results = {
    results: [
      { scenario: "market_crash", estimated_pnl: -15000 },
      { scenario: "rate_hike", estimated_pnl: -2500 },
    ],
  };

  it("runs the default scenario against a 100k portfolio", async () => {
    riskService.stressTest.mockResolvedValue(results);
    await mount();
    fireEvent.press(screen.getByText("Run Stress Test"));
    await screen.findByText("-$15,000.00");
    expect(riskService.stressTest).toHaveBeenCalledWith({
      scenarios: ["market_crash"],
      portfolioValue: 100000,
    });
  });

  it("lets the user add scenarios", async () => {
    riskService.stressTest.mockResolvedValue(results);
    await mount();
    fireEvent.press(screen.getByText("rate hike"));
    fireEvent.press(screen.getByText("Run Stress Test"));
    await waitFor(() =>
      expect(riskService.stressTest).toHaveBeenCalledWith({
        scenarios: ["market_crash", "rate_hike"],
        portfolioValue: 100000,
      }),
    );
    expect(await screen.findByText("-$2,500.00")).toBeTruthy();
  });

  it("disables the run button when every scenario is deselected", async () => {
    await mount();
    fireEvent.press(screen.getByText("market crash"));
    fireEvent.press(screen.getByText("Run Stress Test"));
    expect(riskService.stressTest).not.toHaveBeenCalled();
  });

  it("shows an error", async () => {
    riskService.stressTest.mockRejectedValue(new Error("Stress engine down"));
    await mount();
    fireEvent.press(screen.getByText("Run Stress Test"));
    expect(await screen.findByText("Stress engine down")).toBeTruthy();
  });
});
