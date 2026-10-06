import { useEffect, useState } from "react";
import { FiActivity, FiCpu, FiGrid, FiSearch, FiTarget } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { ThemedLine } from "../components/common/Charts";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Field,
  Grid,
  HelpText,
  Input,
  Label,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageWrap,
  Segmented,
  SegmentedBtn,
  Select,
  StatLabel,
  StatValue,
} from "../components/common/UI";
import analyticsService from "../services/analyticsService";
import { extractErrorMessage } from "../services/apiClient";
import marketService from "../services/marketService";
import { formatCurrency } from "../utils/format";

const TABS = [
  { key: "price", label: "Option Pricer", icon: <FiTarget /> },
  { key: "iv", label: "Implied Volatility", icon: <FiActivity /> },
  { key: "surface", label: "Vol Surface", icon: <FiGrid /> },
  { key: "quick", label: "Quick Greeks", icon: <FiSearch /> },
  { key: "forecast", label: "Vol Forecast", icon: <FiCpu /> },
];

const ResultGrid = ({ items }) => (
  <Grid $cols={3} $gap="14px">
    {items.map(([label, value]) => (
      <div key={label}>
        <StatLabel style={{ marginBottom: 4 }}>{label}</StatLabel>
        <StatValue style={{ fontSize: 17 }}>{value}</StatValue>
      </div>
    ))}
  </Grid>
);

const OptionPricer = ({ initialVolatility }) => {
  const [form, setForm] = useState({
    spotPrice: "190",
    strikePrice: "195",
    timeToExpiry: "0.25",
    volatility: "0.28",
    riskFreeRate: "0.05",
    dividendYield: "0",
    optionType: "call",
    optionStyle: "european",
    pricingMethod: "black_scholes",
    barrierLevel: "",
    barrierType: "up_and_out",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialVolatility) {
      setForm((f) => ({ ...f, volatility: String(initialVolatility) }));
    }
  }, [initialVolatility]);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const updateStyle = (e) => {
    const optionStyle = e.target.value;
    setForm((f) => {
      let pricingMethod = f.pricingMethod;
      if (optionStyle === "american") pricingMethod = "black_scholes";
      if (optionStyle !== "european" && pricingMethod === "heston") {
        pricingMethod = "black_scholes";
      }
      return { ...f, optionStyle, pricingMethod };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await analyticsService.priceOption({
        spotPrice: Number(form.spotPrice),
        strikePrice: Number(form.strikePrice),
        timeToExpiry: Number(form.timeToExpiry),
        volatility: Number(form.volatility),
        riskFreeRate: Number(form.riskFreeRate),
        dividendYield: Number(form.dividendYield || 0),
        optionType: form.optionType,
        optionStyle: form.optionStyle,
        pricingMethod: form.pricingMethod,
        barrierLevel:
          form.optionStyle === "barrier"
            ? Number(form.barrierLevel)
            : undefined,
        barrierType:
          form.optionStyle === "barrier" ? form.barrierType : undefined,
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Pricing failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid $cols={3} $gap="18px">
      <Card>
        <CardHeader>
          <CardTitle>Contract Parameters</CardTitle>
        </CardHeader>
        {error && <Alert $tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Spot price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.spotPrice}
                onChange={update("spotPrice")}
              />
            </Field>
            <Field>
              <Label>Strike price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.strikePrice}
                onChange={update("strikePrice")}
              />
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Time to expiry (yrs)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.timeToExpiry}
                onChange={update("timeToExpiry")}
              />
            </Field>
            <Field>
              <Label>Volatility (σ)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.volatility}
                onChange={update("volatility")}
              />
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Risk-free rate</Label>
              <Input
                type="number"
                step="0.001"
                value={form.riskFreeRate}
                onChange={update("riskFreeRate")}
              />
            </Field>
            <Field>
              <Label>Option type</Label>
              <Select value={form.optionType} onChange={update("optionType")}>
                <option value="call">Call</option>
                <option value="put">Put</option>
              </Select>
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Dividend yield</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.dividendYield}
                onChange={update("dividendYield")}
              />
            </Field>
            <Field>
              <Label>Exercise style</Label>
              <Select value={form.optionStyle} onChange={updateStyle}>
                <option value="european">European</option>
                <option value="american">American</option>
                <option value="barrier">Barrier</option>
              </Select>
            </Field>
          </Grid>
          {form.optionStyle === "barrier" && (
            <Grid $cols={2} $gap="12px">
              <Field>
                <Label>Barrier level</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={form.barrierLevel}
                  onChange={update("barrierLevel")}
                />
              </Field>
              <Field>
                <Label>Barrier type</Label>
                <Select
                  value={form.barrierType}
                  onChange={update("barrierType")}
                >
                  <option value="up_and_out">Up and out</option>
                  <option value="up_and_in">Up and in</option>
                  <option value="down_and_out">Down and out</option>
                  <option value="down_and_in">Down and in</option>
                </Select>
              </Field>
            </Grid>
          )}
          <Field>
            <Label>Pricing method</Label>
            <Select
              value={form.pricingMethod}
              onChange={update("pricingMethod")}
            >
              <option value="black_scholes">
                {form.optionStyle === "american"
                  ? "Binomial lattice"
                  : "Analytic (Black-Scholes)"}
              </option>
              <option
                value="monte_carlo"
                disabled={form.optionStyle === "american"}
              >
                Monte Carlo
              </option>
              <option value="heston" disabled={form.optionStyle !== "european"}>
                Heston stochastic volatility
              </option>
            </Select>
          </Field>
          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Pricing…" : "Calculate"}
          </Button>
        </form>
      </Card>

      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>Price &amp; Greeks</CardTitle>
        </CardHeader>
        {result ? (
          <ResultGrid
            items={[
              ["Theoretical Price", formatCurrency(result.price)],
              ["Delta (Δ)", result.delta.toFixed(4)],
              ["Gamma (Γ)", result.gamma.toFixed(4)],
              ["Theta (Θ)", result.theta.toFixed(4)],
              ["Vega (ν)", result.vega.toFixed(4)],
              ["Rho (ρ)", result.rho != null ? result.rho.toFixed(4) : "-"],
              ["Method", result.method],
              ...(result.std_error != null
                ? [
                    ["Std error", result.std_error.toFixed(4)],
                    [
                      "95% interval",
                      `${result.confidence_interval[0].toFixed(3)} to ${result.confidence_interval[1].toFixed(3)}`,
                    ],
                  ]
                : []),
            ]}
          />
        ) : (
          <HelpText>Fill in the contract parameters and calculate.</HelpText>
        )}
      </Card>
    </Grid>
  );
};

const ImpliedVolatility = () => {
  const [form, setForm] = useState({
    marketPrice: "12.50",
    spotPrice: "190",
    strikePrice: "195",
    timeToExpiry: "0.25",
    dividendYield: "0",
    optionType: "call",
    optionStyle: "european",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await analyticsService.impliedVolatility({
        marketPrice: Number(form.marketPrice),
        spotPrice: Number(form.spotPrice),
        strikePrice: Number(form.strikePrice),
        timeToExpiry: Number(form.timeToExpiry),
        dividendYield: Number(form.dividendYield || 0),
        optionType: form.optionType,
        optionStyle: form.optionStyle,
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't solve for implied vol."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid $cols={3} $gap="18px">
      <Card>
        <CardHeader>
          <CardTitle>Market Inputs</CardTitle>
        </CardHeader>
        {error && <Alert $tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <Field>
            <Label>Market price</Label>
            <Input
              type="number"
              step="0.01"
              value={form.marketPrice}
              onChange={update("marketPrice")}
            />
          </Field>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Spot price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.spotPrice}
                onChange={update("spotPrice")}
              />
            </Field>
            <Field>
              <Label>Strike price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.strikePrice}
                onChange={update("strikePrice")}
              />
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Time to expiry (yrs)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.timeToExpiry}
                onChange={update("timeToExpiry")}
              />
            </Field>
            <Field>
              <Label>Option type</Label>
              <Select value={form.optionType} onChange={update("optionType")}>
                <option value="call">Call</option>
                <option value="put">Put</option>
              </Select>
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Dividend yield</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.dividendYield}
                onChange={update("dividendYield")}
              />
            </Field>
            <Field>
              <Label>Exercise style</Label>
              <Select value={form.optionStyle} onChange={update("optionStyle")}>
                <option value="european">European</option>
                <option value="american">American</option>
              </Select>
            </Field>
          </Grid>
          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Solving…" : "Solve for IV"}
          </Button>
        </form>
      </Card>

      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        {result ? (
          <ResultGrid
            items={[
              [
                "Implied Volatility",
                `${result.implied_volatility_pct.toFixed(2)}%`,
              ],
              ["Raw σ", result.implied_volatility.toFixed(6)],
              ["Option type", result.option_type],
              ["Exercise style", result.option_style],
            ]}
          />
        ) : (
          <HelpText>Enter a market price to back-solve volatility.</HelpText>
        )}
      </Card>
    </Grid>
  );
};

const VolatilitySurface = () => {
  const [form, setForm] = useState({
    spotPrice: "190",
    strikes: "170,180,190,200,210",
    expiries: "0.083,0.25,0.5,1",
    baseVolatility: "0.28",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const strikes = form.strikes
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
      const expiries = form.expiries
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
      const data = await analyticsService.volatilitySurface({
        spotPrice: Number(form.spotPrice),
        strikes,
        expiries,
        baseVolatility: Number(form.baseVolatility),
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't build the surface."));
    } finally {
      setLoading(false);
    }
  };

  const chartData =
    result &&
    (() => {
      const expiries = [...new Set(result.surface.map((p) => p.expiry_years))];
      const strikes = [...new Set(result.surface.map((p) => p.strike))].sort(
        (a, b) => a - b,
      );
      return {
        labels: strikes,
        datasets: expiries.map((T, i) => ({
          label: `${T}y`,
          data: strikes.map((K) => {
            const point = result.surface.find(
              (p) => p.strike === K && p.expiry_years === T,
            );
            return point ? point.implied_vol * 100 : null;
          }),
          borderColor: ["#c6a15b", "#3f9d72", "#4f8f74", "#a8843f"][i % 4],
          backgroundColor: "transparent",
          tension: 0.35,
        })),
      };
    })();

  return (
    <Grid $cols={3} $gap="18px">
      <Card>
        <CardHeader>
          <CardTitle>Surface Inputs</CardTitle>
        </CardHeader>
        {error && <Alert $tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <Field>
            <Label>Spot price</Label>
            <Input
              type="number"
              step="0.01"
              value={form.spotPrice}
              onChange={update("spotPrice")}
            />
          </Field>
          <Field>
            <Label>Strikes (comma-separated)</Label>
            <Input value={form.strikes} onChange={update("strikes")} />
          </Field>
          <Field>
            <Label>Expiries in years (comma-separated)</Label>
            <Input value={form.expiries} onChange={update("expiries")} />
            <HelpText>e.g. 0.083 ≈ 1 month, 1 = 1 year</HelpText>
          </Field>
          <Field>
            <Label>Base volatility</Label>
            <Input
              type="number"
              step="0.01"
              value={form.baseVolatility}
              onChange={update("baseVolatility")}
            />
          </Field>
          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Building…" : "Generate Surface"}
          </Button>
        </form>
      </Card>

      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>Implied Vol by Strike</CardTitle>
        </CardHeader>
        {chartData ? (
          <ThemedLine data={chartData} height={260} showLegend yPrefix="" />
        ) : (
          <HelpText>Generate a surface to see the smile per expiry.</HelpText>
        )}
      </Card>
    </Grid>
  );
};

const QuickGreeks = ({ initialSymbol }) => {
  const [form, setForm] = useState({
    symbol: initialSymbol || "AAPL",
    spot: "190",
    strike: "195",
    expiryDays: "30",
    volatility: "0.28",
    optionType: "call",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialSymbol) {
      setForm((f) => ({ ...f, symbol: initialSymbol }));
    }
  }, [initialSymbol]);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await analyticsService.quickGreeks(form.symbol, {
        spot: Number(form.spot),
        strike: Number(form.strike),
        expiryDays: Number(form.expiryDays),
        volatility: Number(form.volatility),
        optionType: form.optionType,
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't fetch Greeks."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid $cols={3} $gap="18px">
      <Card>
        <CardHeader>
          <CardTitle>Lookup</CardTitle>
        </CardHeader>
        {error && <Alert $tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <Field>
            <Label>Symbol</Label>
            <Input
              value={form.symbol}
              onChange={update("symbol")}
              style={{ textTransform: "uppercase" }}
            />
          </Field>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Spot</Label>
              <Input
                type="number"
                step="0.01"
                value={form.spot}
                onChange={update("spot")}
              />
            </Field>
            <Field>
              <Label>Strike</Label>
              <Input
                type="number"
                step="0.01"
                value={form.strike}
                onChange={update("strike")}
              />
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Expiry (days)</Label>
              <Input
                type="number"
                value={form.expiryDays}
                onChange={update("expiryDays")}
              />
            </Field>
            <Field>
              <Label>Volatility</Label>
              <Input
                type="number"
                step="0.01"
                value={form.volatility}
                onChange={update("volatility")}
              />
            </Field>
          </Grid>
          <Field>
            <Label>Option type</Label>
            <Select value={form.optionType} onChange={update("optionType")}>
              <option value="call">Call</option>
              <option value="put">Put</option>
            </Select>
          </Field>
          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Fetching…" : "Get Greeks"}
          </Button>
        </form>
      </Card>

      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>{result?.symbol || form.symbol}</CardTitle>
        </CardHeader>
        {result ? (
          <ResultGrid
            items={Object.entries(result.greeks).map(([k, v]) => [
              k,
              Number(v).toFixed(4),
            ])}
          />
        ) : (
          <HelpText>Look up a symbol to see its live Greeks.</HelpText>
        )}
      </Card>
    </Grid>
  );
};

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

const VolatilityForecast = ({ onUseVolatility }) => {
  const [form, setForm] = useState({
    symbol: "AAPL",
    open: "190",
    high: "194",
    low: "188",
    close: "192",
    volume: "1000000",
    timeframe: "1d",
  });
  const [result, setResult] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    marketService
      .getModelInfo()
      .then((data) => active && setInfo(data))
      .catch(() => active && setInfo(null));
    return () => {
      active = false;
    };
  }, []);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await marketService.predictVolatility({
        symbol: form.symbol.trim().toUpperCase(),
        open: Number(form.open),
        high: Number(form.high),
        low: Number(form.low),
        close: Number(form.close),
        volume: Number(form.volume),
        timeframe: form.timeframe,
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Forecast failed."));
    } finally {
      setLoading(false);
    }
  };

  const annualised = result ? Number(result.volatility) : null;
  const usingFallback = result
    ? result.model_version === "fallback_statistical"
    : info?.fallback_active;

  return (
    <Grid $cols={3} $gap="18px">
      <Card>
        <CardHeader>
          <CardTitle>Latest Bar</CardTitle>
        </CardHeader>
        {error && <Alert $tone="danger">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Symbol</Label>
              <Input
                value={form.symbol}
                maxLength={10}
                onChange={update("symbol")}
              />
            </Field>
            <Field>
              <Label>Timeframe</Label>
              <Select value={form.timeframe} onChange={update("timeframe")}>
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </Grid>
          <Grid $cols={2} $gap="12px">
            {["open", "high", "low", "close"].map((field) => (
              <Field key={field}>
                <Label>{field[0].toUpperCase() + field.slice(1)}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form[field]}
                  onChange={update(field)}
                />
              </Field>
            ))}
          </Grid>
          <Field>
            <Label>Volume</Label>
            <Input
              type="number"
              min="0"
              required
              value={form.volume}
              onChange={update("volume")}
            />
          </Field>
          <Button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Forecasting…" : "Forecast Volatility"}
          </Button>
        </form>
      </Card>

      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>Model Forecast</CardTitle>
        </CardHeader>
        {result ? (
          <>
            <ResultGrid
              items={[
                ["Annualised volatility", `${(annualised * 100).toFixed(2)}%`],
                [
                  "Confidence",
                  result.confidence != null
                    ? `${(Number(result.confidence) * 100).toFixed(1)}%`
                    : "n/a",
                ],
                ["Horizon", result.prediction_horizon],
                ["Model version", result.model_version],
                ["Symbol", result.symbol],
              ]}
            />
            <div style={{ marginTop: 16 }}>
              <Button
                type="button"
                onClick={() => onUseVolatility(annualised.toFixed(4))}
              >
                Price an option with this volatility
              </Button>
            </div>
          </>
        ) : (
          <HelpText>
            Enter the most recent OHLC bar to forecast forward volatility.
          </HelpText>
        )}
        {usingFallback && (
          <Alert $tone="warning" style={{ marginTop: 16 }}>
            The trained model is not loaded. Forecasts use a statistical range
            estimator until model artifacts are generated.
          </Alert>
        )}
      </Card>
    </Grid>
  );
};

const Analytics = () => {
  const [searchParams] = useSearchParams();
  const symbolParam = searchParams.get("symbol");
  const [tab, setTab] = useState(symbolParam ? "quick" : "price");
  const [forecastVolatility, setForecastVolatility] = useState(null);

  const applyForecast = (value) => {
    setForecastVolatility(value);
    setTab("price");
  };

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Analytics</PageTitle>
          <PageSubtitle>
            Price options, solve implied volatility, explore the vol surface,
            and forecast volatility with the AI model.
          </PageSubtitle>
        </div>
      </PageHeader>

      <Segmented style={{ marginBottom: 22 }}>
        {TABS.map((t) => (
          <SegmentedBtn
            key={t.key}
            type="button"
            $active={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </SegmentedBtn>
        ))}
      </Segmented>

      {tab === "price" && (
        <OptionPricer initialVolatility={forecastVolatility} />
      )}
      {tab === "iv" && <ImpliedVolatility />}
      {tab === "surface" && <VolatilitySurface />}
      {tab === "quick" && <QuickGreeks initialSymbol={symbolParam} />}
      {tab === "forecast" && (
        <VolatilityForecast onUseVolatility={applyForecast} />
      )}
    </PageWrap>
  );
};

export default Analytics;
