import { fireEvent, screen, waitFor } from "@testing-library/react";
import Risk from "../../pages/Risk";
import riskService from "../../services/riskService";
import { renderWithRouter } from "../../testUtils/render";

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
    risk_limit_usd: 500000,
    margin_used_usd: 125000,
    utilisation_pct: 25,
    status: "healthy",
  });
  riskService.getCircuitBreakers.mockResolvedValue({
    all_clear: true,
    circuit_breakers: [
      {
        name: "daily_loss_limit",
        description: "Max daily loss",
        triggered: false,
        current_pct: 1.5,
        threshold_pct: 5,
      },
      {
        name: "position_size_limit",
        description: "Max position size",
        triggered: true,
        current_pct: 12,
        threshold_pct: 10,
      },
    ],
  });
  riskService.getPortfolioGreeks.mockResolvedValue({
    open_positions: 2,
    position_greeks: [
      {
        position_id: 1,
        symbol: "AAPL",
        delta: 0.5,
        gamma: 0.01,
        theta: -0.05,
        vega: 0.3,
        rho: 0.12,
      },
    ],
    net_greeks: { delta: 1.5, vega: 20 },
  });
});

const mount = async () => {
  renderWithRouter(<Risk />);
  await screen.findByText("Circuit Breakers");
};

describe("overview", () => {
  it("shows a spinner, then limits", async () => {
    renderWithRouter(<Risk />);
    expect(screen.queryByText("Risk Management")).not.toBeInTheDocument();
    expect(await screen.findByText("Risk Management")).toBeInTheDocument();
    expect(screen.getByText("$500,000.00")).toBeInTheDocument();
    expect(screen.getByText("$125,000.00")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
    expect(screen.getByText("healthy")).toBeInTheDocument();
  });

  it("falls back to dashes and zeros without limits", async () => {
    riskService.getLimits.mockResolvedValue({});
    await mount();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(2);
  });

  it("lists circuit breakers with humanised names and thresholds", async () => {
    await mount();
    expect(screen.getByText("All Clear")).toBeInTheDocument();
    expect(screen.getByText("daily loss limit")).toBeInTheDocument();
    expect(screen.getByText("Max position size")).toBeInTheDocument();
    expect(screen.getByText("1.5% / 5% threshold")).toBeInTheDocument();
    expect(screen.getByText("12% / 10% threshold")).toBeInTheDocument();
  });

  it("flags breakers needing attention", async () => {
    riskService.getCircuitBreakers.mockResolvedValue({
      all_clear: false,
      circuit_breakers: [],
    });
    await mount();
    expect(screen.getByText("Attention Needed")).toBeInTheDocument();
  });

  it("shows portfolio and per-position Greeks", async () => {
    await mount();
    expect(screen.getByText("2 open positions")).toBeInTheDocument();
    expect(screen.getByText("Net delta")).toBeInTheDocument();
    expect(screen.getByText("1.5000")).toBeInTheDocument();
    expect(screen.getByText("20.0000")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("-0.0500")).toBeInTheDocument();
  });

  it("shows an empty state without positions", async () => {
    riskService.getPortfolioGreeks.mockResolvedValue({
      open_positions: 0,
      position_greeks: [],
      net_greeks: {},
    });
    await mount();
    expect(screen.getByText("No open positions")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    riskService.getLimits.mockRejectedValue(new Error("Risk service down"));
    renderWithRouter(<Risk />);
    expect(await screen.findByText("Risk service down")).toBeInTheDocument();
  });
});

describe("Value at Risk", () => {
  const result = {
    var_results: {
      95: { confidence_level: 0.95, var: 1234.5, cvar: 1500, var_pct: 1.25 },
      99: { confidence_level: 0.99, var: 2345.6, cvar: 2900, var_pct: 2.34 },
    },
  };

  it("defaults to historical, 1 day", async () => {
    riskService.calculateVar.mockResolvedValue(result);
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Calculate VaR" }));
    await screen.findByText("95%");
    expect(riskService.calculateVar).toHaveBeenCalledWith({
      timeHorizonDays: 1,
      method: "historical",
    });
    expect(screen.getByText("$1,234.50")).toBeInTheDocument();
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    expect(screen.getByText("99%")).toBeInTheDocument();
    expect(screen.getByText("2.34%")).toBeInTheDocument();
  });

  it("uses the chosen method and horizon", async () => {
    riskService.calculateVar.mockResolvedValue(result);
    await mount();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "monte_carlo" },
    });
    // spinbuttons in DOM order: [VaR horizon, stress portfolio value]
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calculate VaR" }));
    await waitFor(() =>
      expect(riskService.calculateVar).toHaveBeenCalledWith({
        timeHorizonDays: 10,
        method: "monte_carlo",
      }),
    );
  });

  it("shows Calculating… while running", async () => {
    riskService.calculateVar.mockReturnValue(new Promise(() => {}));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Calculate VaR" }));
    expect(
      await screen.findByRole("button", { name: "Calculating…" }),
    ).toBeDisabled();
  });

  it("shows an error", async () => {
    riskService.calculateVar.mockRejectedValue(new Error("Not enough history"));
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Calculate VaR" }));
    expect(await screen.findByText("Not enough history")).toBeInTheDocument();
  });
});

describe("Stress testing", () => {
  const results = {
    results: [
      {
        scenario: "market_crash",
        estimated_pnl: -15000,
        estimated_pnl_pct: -15,
        severity: "critical",
      },
      {
        scenario: "rate_hike",
        estimated_pnl: -2500,
        estimated_pnl_pct: -2.5,
        severity: "low",
      },
    ],
  };
  const run = () =>
    fireEvent.click(screen.getByRole("button", { name: "Run Stress Test" }));

  it("runs the three default scenarios against a 100k portfolio", async () => {
    riskService.stressTest.mockResolvedValue(results);
    await mount();
    run();
    await screen.findByText("-$15,000.00");
    expect(riskService.stressTest).toHaveBeenCalledWith({
      scenarios: ["market_crash", "volatility_spike", "rate_hike"],
      portfolioValue: 100000,
    });
    expect(screen.getByText("-15.00%")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("low")).toBeInTheDocument();
  });

  it("lets the user toggle scenarios on and off", async () => {
    riskService.stressTest.mockResolvedValue(results);
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "black swan" }));
    fireEvent.click(screen.getByRole("button", { name: "market crash" }));
    run();
    await waitFor(() =>
      expect(riskService.stressTest).toHaveBeenCalledWith({
        scenarios: ["volatility_spike", "rate_hike", "black_swan"],
        portfolioValue: 100000,
      }),
    );
  });

  it("uses the entered portfolio value", async () => {
    riskService.stressTest.mockResolvedValue(results);
    await mount();
    fireEvent.change(screen.getAllByRole("spinbutton")[1], {
      target: { value: "250000" },
    });
    run();
    await waitFor(() =>
      expect(riskService.stressTest.mock.calls[0][0].portfolioValue).toBe(
        250000,
      ),
    );
  });

  it("disables running when every scenario is deselected", async () => {
    await mount();
    ["market crash", "volatility spike", "rate hike"].forEach((n) =>
      fireEvent.click(screen.getByRole("button", { name: n })),
    );
    expect(
      screen.getByRole("button", { name: "Run Stress Test" }),
    ).toBeDisabled();
  });

  it("shows Running… while in flight", async () => {
    riskService.stressTest.mockReturnValue(new Promise(() => {}));
    await mount();
    run();
    expect(
      await screen.findByRole("button", { name: "Running…" }),
    ).toBeDisabled();
  });

  it("shows an error", async () => {
    riskService.stressTest.mockRejectedValue(new Error("Stress engine down"));
    await mount();
    run();
    expect(await screen.findByText("Stress engine down")).toBeInTheDocument();
  });
});
