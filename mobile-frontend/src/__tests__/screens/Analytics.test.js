import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import AnalyticsScreen from "../../screens/AnalyticsScreen";
import analyticsService from "../../services/analyticsService";
import marketService from "../../services/marketService";
import { paperInputs, typeInto } from "../../testUtils/paper";

jest.mock("../../services/analyticsService", () => ({
  __esModule: true,
  default: {
    priceOption: jest.fn(),
    impliedVolatility: jest.fn(),
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

const tab = (label) => fireEvent.press(screen.getByText(label));

describe("AnalyticsScreen tabs", () => {
  it("opens on the pricer", () => {
    render(<AnalyticsScreen />);
    expect(screen.getByText("Analytics")).toBeTruthy();
    expect(screen.getByText("Calculate")).toBeTruthy();
  });

  it.each([
    ["Implied Vol", "Solve for IV"],
    ["Greeks", "Get Greeks"],
    ["Forecast", "Forecast Volatility"],
    ["Pricer", "Calculate"],
  ])("switches to %s", async (label, button) => {
    render(<AnalyticsScreen />);
    tab(label);
    expect(screen.getByText(button)).toBeTruthy();
    await waitFor(() =>
      expect(marketService.getModelInfo).toHaveBeenCalledTimes(
        label === "Forecast" ? 1 : 0,
      ),
    );
  });
});

describe("Option pricer", () => {
  it("prices with the default inputs as a European Black-Scholes call", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    render(<AnalyticsScreen />);
    fireEvent.press(screen.getByText("Calculate"));
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
    });
    render(<AnalyticsScreen />);
    fireEvent.press(screen.getByText("Calculate"));
    await screen.findByText("$7.50");
    expect(screen.getByText("0.5123")).toBeTruthy();
    expect(screen.getByText("-0.0500")).toBeTruthy();
    expect(screen.getByText("0.1200")).toBeTruthy();
    expect(screen.getByText("black_scholes")).toBeTruthy();
    expect(screen.getByText("Std error")).toBeTruthy();
    expect(screen.getByText("0.0123")).toBeTruthy();
  });

  it("shows a dash when rho is missing and no std error row", async () => {
    analyticsService.priceOption.mockResolvedValue({ ...priced, rho: null });
    render(<AnalyticsScreen />);
    fireEvent.press(screen.getByText("Calculate"));
    await screen.findByText("$7.50");
    expect(screen.getByText("-")).toBeTruthy();
    expect(screen.queryByText("Std error")).toBeNull();
  });

  it("sends edited numeric inputs and option type", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    render(<AnalyticsScreen />);
    typeInto(0, "100");
    typeInto(1, "90");
    typeInto(4, "");
    fireEvent.press(screen.getByText("Put"));
    fireEvent.press(screen.getByText("Calculate"));
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

  it("adds barrier fields for barrier options and sends them", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    render(<AnalyticsScreen />);
    expect(paperInputs()).toHaveLength(5);
    fireEvent.press(screen.getByText("Barrier"));
    expect(paperInputs()).toHaveLength(6);
    typeInto(5, "210");
    fireEvent.press(screen.getByText("Down in"));
    fireEvent.press(screen.getByText("Calculate"));
    await waitFor(() =>
      expect(analyticsService.priceOption).toHaveBeenCalled(),
    );
    expect(analyticsService.priceOption.mock.calls[0][0]).toMatchObject({
      optionStyle: "barrier",
      barrierLevel: 210,
      barrierType: "down_and_in",
    });
  });

  it("forces Black-Scholes (lattice) for American options", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    render(<AnalyticsScreen />);
    fireEvent.press(screen.getByText("Monte Carlo"));
    fireEvent.press(screen.getByText("American"));
    expect(screen.getByText("Lattice")).toBeTruthy();
    fireEvent.press(screen.getByText("Calculate"));
    await waitFor(() =>
      expect(analyticsService.priceOption).toHaveBeenCalled(),
    );
    expect(analyticsService.priceOption.mock.calls[0][0]).toMatchObject({
      optionStyle: "american",
      pricingMethod: "black_scholes",
    });
  });

  it("resets Heston to Black-Scholes when leaving European style", async () => {
    analyticsService.priceOption.mockResolvedValue(priced);
    render(<AnalyticsScreen />);
    fireEvent.press(screen.getByText("Heston"));
    fireEvent.press(screen.getByText("Barrier"));
    fireEvent.press(screen.getByText("Calculate"));
    await waitFor(() =>
      expect(analyticsService.priceOption).toHaveBeenCalled(),
    );
    expect(analyticsService.priceOption.mock.calls[0][0].pricingMethod).toBe(
      "black_scholes",
    );
  });

  it("shows an error when pricing fails and clears it on retry", async () => {
    analyticsService.priceOption.mockRejectedValueOnce(new Error("Bad inputs"));
    render(<AnalyticsScreen />);
    fireEvent.press(screen.getByText("Calculate"));
    expect(await screen.findByText("Bad inputs")).toBeTruthy();
    analyticsService.priceOption.mockResolvedValueOnce(priced);
    fireEvent.press(screen.getByText("Calculate"));
    await waitFor(() => expect(screen.queryByText("Bad inputs")).toBeNull());
  });
});

describe("Implied volatility", () => {
  it("solves with the default inputs and shows a percentage", async () => {
    analyticsService.impliedVolatility.mockResolvedValue({
      implied_volatility_pct: 27.456,
    });
    render(<AnalyticsScreen />);
    tab("Implied Vol");
    fireEvent.press(screen.getByText("Solve for IV"));
    expect(await screen.findByText("27.46%")).toBeTruthy();
    expect(analyticsService.impliedVolatility).toHaveBeenCalledWith({
      marketPrice: 12.5,
      spotPrice: 190,
      strikePrice: 195,
      timeToExpiry: 0.25,
    });
  });

  it("shows an error", async () => {
    analyticsService.impliedVolatility.mockRejectedValue(
      new Error("No solution"),
    );
    render(<AnalyticsScreen />);
    tab("Implied Vol");
    fireEvent.press(screen.getByText("Solve for IV"));
    expect(await screen.findByText("No solution")).toBeTruthy();
  });
});

describe("Quick Greeks", () => {
  it("fetches greeks for the symbol and formats them", async () => {
    analyticsService.quickGreeks.mockResolvedValue({
      greeks: { delta: 0.5, gamma: 0.0123456 },
    });
    render(<AnalyticsScreen />);
    tab("Greeks");
    typeInto(0, "MSFT");
    fireEvent.press(screen.getByText("Get Greeks"));
    expect(await screen.findByText("0.5000")).toBeTruthy();
    expect(screen.getByText("0.0123")).toBeTruthy();
    expect(analyticsService.quickGreeks).toHaveBeenCalledWith("MSFT", {
      spot: 190,
      strike: 195,
      expiryDays: 30,
      volatility: 0.28,
    });
  });

  it("shows an error", async () => {
    analyticsService.quickGreeks.mockRejectedValue(new Error("Unknown symbol"));
    render(<AnalyticsScreen />);
    tab("Greeks");
    fireEvent.press(screen.getByText("Get Greeks"));
    expect(await screen.findByText("Unknown symbol")).toBeTruthy();
  });
});

describe("Volatility forecast", () => {
  const forecast = {
    volatility: 0.3125,
    confidence: 0.834,
    prediction_horizon: "1d",
    model_version: "v2",
  };

  it("warns when the model info reports the statistical fallback", async () => {
    marketService.getModelInfo.mockResolvedValue({ fallback_active: true });
    render(<AnalyticsScreen />);
    tab("Forecast");
    expect(await screen.findByText(/trained model is not loaded/)).toBeTruthy();
  });

  it("does not warn when the model is loaded", async () => {
    render(<AnalyticsScreen />);
    tab("Forecast");
    await waitFor(() => expect(marketService.getModelInfo).toHaveBeenCalled());
    expect(screen.queryByText(/trained model is not loaded/)).toBeNull();
  });

  it("tolerates a failing model-info call", async () => {
    marketService.getModelInfo.mockRejectedValue(new Error("x"));
    render(<AnalyticsScreen />);
    tab("Forecast");
    await waitFor(() => expect(marketService.getModelInfo).toHaveBeenCalled());
    expect(screen.getByText("Forecast Volatility")).toBeTruthy();
  });

  it("forecasts with an upper-cased symbol and the chosen timeframe", async () => {
    marketService.predictVolatility.mockResolvedValue(forecast);
    render(<AnalyticsScreen />);
    tab("Forecast");
    typeInto(0, " tsla ");
    fireEvent.press(screen.getByText("4h"));
    fireEvent.press(screen.getByText("Forecast Volatility"));
    expect(await screen.findByText("31.25%")).toBeTruthy();
    expect(marketService.predictVolatility).toHaveBeenCalledWith({
      symbol: "TSLA",
      open: 190,
      high: 194,
      low: 188,
      close: 192,
      volume: 1000000,
      timeframe: "4h",
    });
    expect(screen.getByText("83.4%")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
  });

  it("shows n/a when confidence is missing", async () => {
    marketService.predictVolatility.mockResolvedValue({
      ...forecast,
      confidence: null,
    });
    render(<AnalyticsScreen />);
    tab("Forecast");
    fireEvent.press(screen.getByText("Forecast Volatility"));
    expect(await screen.findByText("n/a")).toBeTruthy();
  });

  it("warns when the result came from the fallback estimator", async () => {
    marketService.predictVolatility.mockResolvedValue({
      ...forecast,
      model_version: "fallback_statistical",
    });
    render(<AnalyticsScreen />);
    tab("Forecast");
    fireEvent.press(screen.getByText("Forecast Volatility"));
    expect(await screen.findByText(/trained model is not loaded/)).toBeTruthy();
  });

  it("carries the forecast volatility into the pricer", async () => {
    marketService.predictVolatility.mockResolvedValue(forecast);
    render(<AnalyticsScreen />);
    tab("Forecast");
    fireEvent.press(screen.getByText("Forecast Volatility"));
    fireEvent.press(
      await screen.findByText("Price an option with this volatility"),
    );
    expect(screen.getByText("Calculate")).toBeTruthy();
    expect(paperInputs()[3].props.value).toBe("0.3125");
  });

  it("shows an error", async () => {
    marketService.predictVolatility.mockRejectedValue(
      new Error("Model offline"),
    );
    render(<AnalyticsScreen />);
    tab("Forecast");
    fireEvent.press(screen.getByText("Forecast Volatility"));
    expect(await screen.findByText("Model offline")).toBeTruthy();
  });
});
