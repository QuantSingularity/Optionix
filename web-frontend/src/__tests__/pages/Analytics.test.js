import { fireEvent, screen, waitFor } from "@testing-library/react";
import Analytics, { parseNumberList } from "../../pages/Analytics";
import analyticsService from "../../services/analyticsService";
import marketService from "../../services/marketService";
import { control, setField } from "../../testUtils/fields";
import { renderWithRouter } from "../../testUtils/render";

jest.mock("../../components/common/Charts", () => ({
  ThemedLine: ({ data, showLegend }) => (
    <div data-testid="line" data-legend={String(showLegend)}>
      {JSON.stringify(data)}
    </div>
  ),
  CHART_PALETTE: ["#111", "#222", "#333"],
}));
jest.mock("../../services/analyticsService", () => ({
  __esModule: true,
  default: {
    priceOption: jest.fn(),
    impliedVolatility: jest.fn(),
    volatilitySurface: jest.fn(),
    quickGreeks: jest.fn(),
  },
}));
jest.mock("../../services/marketService", () => ({
  __esModule: true,
  default: { predictVolatility: jest.fn(), getModelInfo: jest.fn() },
}));

const priced = {
  price: 7.5,
  delta: 0.51234,
  gamma: 0.01,
  theta: -0.05,
  vega: 0.3,
  rho: 0.12,
  method: "black_scholes",
};

beforeEach(() => {
  jest.clearAllMocks();
  marketService.getModelInfo.mockResolvedValue({ fallback_active: false });
});

const mount = (route = "/dashboard/analytics") =>
  renderWithRouter(<Analytics />, { route });
const tab = (name) => fireEvent.click(screen.getByRole("button", { name }));
const submit = (name) => fireEvent.click(screen.getByRole("button", { name }));

describe("parseNumberList", () => {
  it.each([
    ["170,180,190", [170, 180, 190]],
    [" 170 , 180 ,190 ", [170, 180, 190]],
    ["170,180,", [170, 180]],
    ["170,,180", [170, 180]],
    [",,", []],
    ["", []],
    ["0.083,0.25", [0.083, 0.25]],
    ["1,abc,2", [1, 2]],
    ["0,5", [0, 5]],
    ["Infinity,3", [3]],
  ])("parses %p", (text, expected) => {
    expect(parseNumberList(text)).toEqual(expected);
  });
});

describe("tabs", () => {
  it("opens on the option pricer", () => {
    mount();
    expect(screen.getByText("Contract Parameters")).toBeInTheDocument();
  });

  it.each([
    ["Implied Volatility", "Market Inputs"],
    ["Vol Surface", "Surface Inputs"],
    ["Quick Greeks", "Lookup"],
    ["Vol Forecast", "Latest Bar"],
    ["Option Pricer", "Contract Parameters"],
  ])("switches to %s", (name, heading) => {
    mount();
    tab(name);
    expect(screen.getByText(heading)).toBeInTheDocument();
  });

  it("opens Quick Greeks with the symbol from ?symbol=", () => {
    mount("/dashboard/analytics?symbol=MSFT");
    expect(screen.getByText("Lookup")).toBeInTheDocument();
    expect(control("Symbol")).toHaveValue("MSFT");
  });
});

describe("Option pricer", () => {
  it("prices with default inputs as a European Black-Scholes call", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    mount();
    submit("Calculate");
    await screen.findByText("$7.50");
    expect(analyticsService.priceOption).toHaveBeenCalledWith({
      spotPrice: 190,
      strikePrice: 195,
      timeToExpiry: 0.25,
      volatility: 0.28,
      riskFreeRate: 0.05,
      dividendYield: 0,
      optionType: "call",
      optionStyle: "european",
      pricingMethod: "black_scholes",
      barrierLevel: undefined,
      barrierType: undefined,
    });
  });

  it("shows the result grid", async () => {
    analyticsService.priceOption.mockResolvedValue({
      ...priced,
      std_error: 0.0123,
      confidence_interval: [7.1234, 7.8765],
    });
    mount();
    submit("Calculate");
    await screen.findByText("$7.50");
    expect(screen.getByText("0.5123")).toBeInTheDocument();
    expect(screen.getByText("-0.0500")).toBeInTheDocument();
    expect(screen.getByText("0.1200")).toBeInTheDocument();
    expect(screen.getByText("Std error")).toBeInTheDocument();
    expect(screen.getByText("7.123 to 7.877")).toBeInTheDocument();
  });

  it("shows a dash for a missing rho and no std error rows", async () => {
    analyticsService.priceOption.mockResolvedValue({ ...priced, rho: null });
    mount();
    submit("Calculate");
    await screen.findByText("$7.50");
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.queryByText("Std error")).not.toBeInTheDocument();
  });

  it("sends edited inputs and option type", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    mount();
    setField("Spot price", "100");
    setField("Strike price", "90");
    setField("Dividend yield", "");
    setField("Option type", "put");
    submit("Calculate");
    await waitFor(() =>
      expect(analyticsService.priceOption).toHaveBeenCalled(),
    );
    expect(analyticsService.priceOption.mock.calls[0][0]).toMatchObject({
      spotPrice: 100,
      strikePrice: 90,
      dividendYield: 0,
      optionType: "put",
    });
  });

  it("adds barrier fields and sends level and type for barrier options", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    mount();
    expect(screen.queryByText("Barrier level")).not.toBeInTheDocument();
    setField("Exercise style", "barrier");
    setField("Barrier level", "210");
    setField("Barrier type", "down_and_in");
    submit("Calculate");
    await waitFor(() =>
      expect(analyticsService.priceOption).toHaveBeenCalled(),
    );
    expect(analyticsService.priceOption.mock.calls[0][0]).toMatchObject({
      optionStyle: "barrier",
      barrierLevel: 210,
      barrierType: "down_and_in",
    });
  });

  it("relabels the method and forces Black-Scholes for American options", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    mount();
    setField("Pricing method", "monte_carlo");
    setField("Exercise style", "american");
    expect(control("Pricing method")).toHaveValue("black_scholes");
    expect(
      screen.getByRole("option", { name: "Binomial lattice" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Monte Carlo" })).toBeDisabled();
    submit("Calculate");
    await waitFor(() =>
      expect(analyticsService.priceOption).toHaveBeenCalled(),
    );
    expect(analyticsService.priceOption.mock.calls[0][0]).toMatchObject({
      optionStyle: "american",
      pricingMethod: "black_scholes",
    });
  });

  it("resets Heston when leaving European style, and only allows it for European", () => {
    mount();
    expect(
      screen.getByRole("option", { name: "Heston stochastic volatility" }),
    ).toBeEnabled();
    setField("Pricing method", "heston");
    setField("Exercise style", "barrier");
    expect(control("Pricing method")).toHaveValue("black_scholes");
    expect(
      screen.getByRole("option", { name: "Heston stochastic volatility" }),
    ).toBeDisabled();
  });

  it("shows an error, then clears it on a successful retry", async () => {
    analyticsService.priceOption.mockRejectedValueOnce(new Error("Bad inputs"));
    mount();
    submit("Calculate");
    expect(await screen.findByText("Bad inputs")).toBeInTheDocument();
    analyticsService.priceOption.mockResolvedValueOnce(priced);
    submit("Calculate");
    await waitFor(() =>
      expect(screen.queryByText("Bad inputs")).not.toBeInTheDocument(),
    );
  });

  it("disables the button while pricing", async () => {
    analyticsService.priceOption.mockReturnValue(new Promise(() => {}));
    mount();
    submit("Calculate");
    expect(
      await screen.findByRole("button", { name: "Pricing…" }),
    ).toBeDisabled();
  });
});

describe("Implied volatility", () => {
  it("solves with defaults and shows percent and raw sigma", async () => {
    analyticsService.impliedVolatility.mockResolvedValue({
      implied_volatility_pct: 27.456,
      implied_volatility: 0.27456,
      option_type: "call",
      option_style: "european",
    });
    mount();
    tab("Implied Volatility");
    submit("Solve for IV");
    expect(await screen.findByText("27.46%")).toBeInTheDocument();
    expect(screen.getByText("0.274560")).toBeInTheDocument();
    expect(analyticsService.impliedVolatility).toHaveBeenCalledWith({
      marketPrice: 12.5,
      spotPrice: 190,
      strikePrice: 195,
      timeToExpiry: 0.25,
      dividendYield: 0,
      optionType: "call",
      optionStyle: "european",
    });
  });

  it("shows an error", async () => {
    analyticsService.impliedVolatility.mockRejectedValue(
      new Error("No solution"),
    );
    mount();
    tab("Implied Volatility");
    submit("Solve for IV");
    expect(await screen.findByText("No solution")).toBeInTheDocument();
  });
});

describe("Volatility surface", () => {
  const surface = {
    surface: [
      { strike: 190, expiry_years: 0.25, implied_vol: 0.3 },
      { strike: 180, expiry_years: 0.25, implied_vol: 0.32 },
      { strike: 180, expiry_years: 1, implied_vol: 0.28 },
    ],
  };

  it("sends parsed strikes and expiries", async () => {
    analyticsService.volatilitySurface.mockResolvedValue(surface);
    mount();
    tab("Vol Surface");
    submit("Generate Surface");
    await screen.findByTestId("line");
    expect(analyticsService.volatilitySurface).toHaveBeenCalledWith({
      spotPrice: 190,
      strikes: [170, 180, 190, 200, 210],
      expiries: [0.083, 0.25, 0.5, 1],
      baseVolatility: 0.28,
    });
  });

  it("drops blank entries instead of sending a strike of 0", async () => {
    analyticsService.volatilitySurface.mockResolvedValue(surface);
    mount();
    tab("Vol Surface");
    setField("Strikes (comma-separated)", "170, 180,,190,");
    setField("Expiries in years (comma-separated)", "0.25,");
    submit("Generate Surface");
    await waitFor(() =>
      expect(analyticsService.volatilitySurface).toHaveBeenCalled(),
    );
    const arg = analyticsService.volatilitySurface.mock.calls[0][0];
    expect(arg.strikes).toEqual([170, 180, 190]);
    expect(arg.expiries).toEqual([0.25]);
  });

  it("builds one smile per expiry with sorted strikes, in percent, with gaps as null", async () => {
    analyticsService.volatilitySurface.mockResolvedValue(surface);
    mount();
    tab("Vol Surface");
    submit("Generate Surface");
    const chart = JSON.parse((await screen.findByTestId("line")).textContent);
    expect(chart.labels).toEqual([180, 190]);
    expect(chart.datasets.map((d) => d.label)).toEqual(["0.25y", "1y"]);
    chart.datasets[0].data.forEach((v, i) =>
      expect(v).toBeCloseTo([32, 30][i], 6),
    );
    expect(chart.datasets[1].data[0]).toBeCloseTo(28, 6);
    expect(chart.datasets[1].data[1]).toBeNull();
    expect(screen.getByTestId("line")).toHaveAttribute("data-legend", "true");
  });

  it("shows a hint before generating and an error on failure", async () => {
    analyticsService.volatilitySurface.mockRejectedValue(
      new Error("Grid too large"),
    );
    mount();
    tab("Vol Surface");
    expect(
      screen.getByText("Generate a surface to see the smile per expiry."),
    ).toBeInTheDocument();
    submit("Generate Surface");
    expect(await screen.findByText("Grid too large")).toBeInTheDocument();
  });
});

describe("Quick Greeks", () => {
  it("fetches greeks for the symbol and formats them", async () => {
    analyticsService.quickGreeks.mockResolvedValue({
      symbol: "MSFT",
      greeks: { delta: 0.5, gamma: 0.0123456 },
    });
    mount();
    tab("Quick Greeks");
    setField("Symbol", "MSFT");
    submit("Get Greeks");
    expect(await screen.findByText("0.5000")).toBeInTheDocument();
    expect(screen.getByText("0.0123")).toBeInTheDocument();
    expect(analyticsService.quickGreeks).toHaveBeenCalledWith("MSFT", {
      spot: 190,
      strike: 195,
      expiryDays: 30,
      volatility: 0.28,
      optionType: "call",
    });
  });

  it("shows an error", async () => {
    analyticsService.quickGreeks.mockRejectedValue(new Error("Unknown symbol"));
    mount();
    tab("Quick Greeks");
    submit("Get Greeks");
    expect(await screen.findByText("Unknown symbol")).toBeInTheDocument();
  });
});

describe("Volatility forecast", () => {
  const forecast = {
    volatility: 0.3125,
    confidence: 0.834,
    prediction_horizon: "1d",
    model_version: "v2",
    symbol: "TSLA",
  };

  it("warns when the model info reports the statistical fallback", async () => {
    marketService.getModelInfo.mockResolvedValue({ fallback_active: true });
    mount();
    tab("Vol Forecast");
    expect(
      await screen.findByText(/trained model is not loaded/),
    ).toBeInTheDocument();
  });

  it("does not warn when the model is loaded, and tolerates failures", async () => {
    mount();
    tab("Vol Forecast");
    await waitFor(() => expect(marketService.getModelInfo).toHaveBeenCalled());
    expect(
      screen.queryByText(/trained model is not loaded/),
    ).not.toBeInTheDocument();
  });

  it("tolerates a failing model-info call", async () => {
    marketService.getModelInfo.mockRejectedValue(new Error("x"));
    mount();
    tab("Vol Forecast");
    await waitFor(() => expect(marketService.getModelInfo).toHaveBeenCalled());
    expect(screen.getByText("Latest Bar")).toBeInTheDocument();
  });

  it("forecasts with an upper-cased symbol and chosen timeframe", async () => {
    marketService.predictVolatility.mockResolvedValue(forecast);
    mount();
    tab("Vol Forecast");
    setField("Symbol", " tsla ");
    setField("Timeframe", "4h");
    submit("Forecast Volatility");
    expect(await screen.findByText("31.25%")).toBeInTheDocument();
    expect(marketService.predictVolatility).toHaveBeenCalledWith({
      symbol: "TSLA",
      open: 190,
      high: 194,
      low: 188,
      close: 192,
      volume: 1000000,
      timeframe: "4h",
    });
    expect(screen.getByText("83.4%")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("offers all six timeframes", () => {
    mount();
    tab("Vol Forecast");
    const options = Array.from(control("Timeframe").options).map(
      (o) => o.value,
    );
    expect(options).toEqual(["1m", "5m", "15m", "1h", "4h", "1d"]);
  });

  it("shows n/a when confidence is missing", async () => {
    marketService.predictVolatility.mockResolvedValue({
      ...forecast,
      confidence: null,
    });
    mount();
    tab("Vol Forecast");
    submit("Forecast Volatility");
    expect(await screen.findByText("n/a")).toBeInTheDocument();
  });

  it("warns when the result came from the fallback estimator", async () => {
    marketService.predictVolatility.mockResolvedValue({
      ...forecast,
      model_version: "fallback_statistical",
    });
    mount();
    tab("Vol Forecast");
    submit("Forecast Volatility");
    expect(
      await screen.findByText(/trained model is not loaded/),
    ).toBeInTheDocument();
  });

  it("carries the forecast into the option pricer", async () => {
    marketService.predictVolatility.mockResolvedValue(forecast);
    mount();
    tab("Vol Forecast");
    submit("Forecast Volatility");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Price an option with this volatility",
      }),
    );
    expect(screen.getByText("Contract Parameters")).toBeInTheDocument();
    expect(control("Volatility (σ)")).toHaveValue(0.3125);
  });

  it("shows an error", async () => {
    marketService.predictVolatility.mockRejectedValue(
      new Error("Model offline"),
    );
    mount();
    tab("Vol Forecast");
    submit("Forecast Volatility");
    expect(await screen.findByText("Model offline")).toBeInTheDocument();
  });
});
