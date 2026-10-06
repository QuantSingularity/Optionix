import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, SegmentedButtons, TextInput } from "react-native-paper";
import {
  AlertBanner,
  Grid2,
  SectionCard,
  StatLabel,
  StatValue,
} from "../components/UI";
import analyticsService from "../services/analyticsService";
import { extractErrorMessage } from "../services/api";
import marketService from "../services/marketService";
import colors from "../theme";
import { formatCurrency } from "../utils/format";

const TABS = [
  { value: "price", label: "Pricer" },
  { value: "iv", label: "Implied Vol" },
  { value: "greeks", label: "Greeks" },
  { value: "forecast", label: "Forecast" },
];

const ResultGrid = ({ items }) => (
  <Grid2>
    {items.map(([label, value]) => (
      <View key={label} style={{ width: "50%", padding: 8 }}>
        <StatLabel style={{ marginBottom: 4 }}>{label}</StatLabel>
        <StatValue style={{ fontSize: 15 }}>{value}</StatValue>
      </View>
    ))}
  </Grid2>
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

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const updateStyle = (optionStyle) =>
    setForm((f) => {
      let pricingMethod = f.pricingMethod;
      if (optionStyle === "american") pricingMethod = "black_scholes";
      if (optionStyle !== "european" && pricingMethod === "heston") {
        pricingMethod = "black_scholes";
      }
      return { ...f, optionStyle, pricingMethod };
    });

  const submit = async () => {
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
    <SectionCard>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <TextInput
        mode="outlined"
        label="Spot price"
        keyboardType="numeric"
        value={form.spotPrice}
        onChangeText={update("spotPrice")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Strike price"
        keyboardType="numeric"
        value={form.strikePrice}
        onChangeText={update("strikePrice")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Time to expiry (yrs)"
        keyboardType="numeric"
        value={form.timeToExpiry}
        onChangeText={update("timeToExpiry")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Volatility (σ)"
        keyboardType="numeric"
        value={form.volatility}
        onChangeText={update("volatility")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Dividend yield"
        keyboardType="numeric"
        value={form.dividendYield}
        onChangeText={update("dividendYield")}
        style={styles.input}
      />
      <SegmentedButtons
        value={form.optionType}
        onValueChange={update("optionType")}
        buttons={[
          { value: "call", label: "Call" },
          { value: "put", label: "Put" },
        ]}
        style={styles.segmented}
      />
      <SegmentedButtons
        value={form.optionStyle}
        onValueChange={updateStyle}
        buttons={[
          { value: "european", label: "European" },
          { value: "american", label: "American" },
          { value: "barrier", label: "Barrier" },
        ]}
        style={styles.segmented}
      />
      {form.optionStyle === "barrier" && (
        <>
          <TextInput
            mode="outlined"
            label="Barrier level"
            keyboardType="numeric"
            value={form.barrierLevel}
            onChangeText={update("barrierLevel")}
            style={styles.input}
          />
          <SegmentedButtons
            value={form.barrierType}
            onValueChange={update("barrierType")}
            buttons={[
              { value: "up_and_out", label: "Up out" },
              { value: "up_and_in", label: "Up in" },
              { value: "down_and_out", label: "Down out" },
              { value: "down_and_in", label: "Down in" },
            ]}
            style={styles.segmented}
          />
        </>
      )}
      <SegmentedButtons
        value={form.pricingMethod}
        onValueChange={update("pricingMethod")}
        buttons={[
          {
            value: "black_scholes",
            label: form.optionStyle === "american" ? "Lattice" : "Analytic",
          },
          {
            value: "monte_carlo",
            label: "Monte Carlo",
            disabled: form.optionStyle === "american",
          },
          {
            value: "heston",
            label: "Heston",
            disabled: form.optionStyle !== "european",
          },
        ]}
        style={styles.segmented}
      />
      <Button
        mode="contained"
        onPress={submit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
      >
        Calculate
      </Button>

      {result && (
        <View style={{ marginTop: 16 }}>
          <ResultGrid
            items={[
              ["Price", formatCurrency(result.price)],
              ["Delta", result.delta.toFixed(4)],
              ["Gamma", result.gamma.toFixed(4)],
              ["Theta", result.theta.toFixed(4)],
              ["Vega", result.vega.toFixed(4)],
              ["Rho", result.rho != null ? result.rho.toFixed(4) : "-"],
              ["Method", result.method],
              ...(result.std_error != null
                ? [["Std error", result.std_error.toFixed(4)]]
                : []),
            ]}
          />
        </View>
      )}
    </SectionCard>
  );
};

const ImpliedVol = () => {
  const [form, setForm] = useState({
    marketPrice: "12.50",
    spotPrice: "190",
    strikePrice: "195",
    timeToExpiry: "0.25",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await analyticsService.impliedVolatility({
        marketPrice: Number(form.marketPrice),
        spotPrice: Number(form.spotPrice),
        strikePrice: Number(form.strikePrice),
        timeToExpiry: Number(form.timeToExpiry),
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't solve for IV."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <TextInput
        mode="outlined"
        label="Market price"
        keyboardType="numeric"
        value={form.marketPrice}
        onChangeText={update("marketPrice")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Spot price"
        keyboardType="numeric"
        value={form.spotPrice}
        onChangeText={update("spotPrice")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Strike price"
        keyboardType="numeric"
        value={form.strikePrice}
        onChangeText={update("strikePrice")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Time to expiry (yrs)"
        keyboardType="numeric"
        value={form.timeToExpiry}
        onChangeText={update("timeToExpiry")}
        style={styles.input}
      />
      <Button
        mode="contained"
        onPress={submit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
      >
        Solve for IV
      </Button>
      {result && (
        <View style={{ marginTop: 16 }}>
          <ResultGrid
            items={[
              ["Implied Vol", `${result.implied_volatility_pct.toFixed(2)}%`],
            ]}
          />
        </View>
      )}
    </SectionCard>
  );
};

const QuickGreeks = () => {
  const [form, setForm] = useState({
    symbol: "AAPL",
    spot: "190",
    strike: "195",
    expiryDays: "30",
    volatility: "0.28",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await analyticsService.quickGreeks(form.symbol, {
        spot: Number(form.spot),
        strike: Number(form.strike),
        expiryDays: Number(form.expiryDays),
        volatility: Number(form.volatility),
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't fetch Greeks."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <TextInput
        mode="outlined"
        label="Symbol"
        autoCapitalize="characters"
        value={form.symbol}
        onChangeText={update("symbol")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Spot"
        keyboardType="numeric"
        value={form.spot}
        onChangeText={update("spot")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Strike"
        keyboardType="numeric"
        value={form.strike}
        onChangeText={update("strike")}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Expiry (days)"
        keyboardType="numeric"
        value={form.expiryDays}
        onChangeText={update("expiryDays")}
        style={styles.input}
      />
      <Button
        mode="contained"
        onPress={submit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
      >
        Get Greeks
      </Button>
      {result && (
        <View style={{ marginTop: 16 }}>
          <ResultGrid
            items={Object.entries(result.greeks).map(([k, v]) => [
              k,
              Number(v).toFixed(4),
            ])}
          />
        </View>
      )}
    </SectionCard>
  );
};

const TIMEFRAME_ROWS = [
  ["1m", "5m", "15m"],
  ["1h", "4h", "1d"],
];

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

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
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
    <SectionCard>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
      <TextInput
        mode="outlined"
        label="Symbol"
        autoCapitalize="characters"
        value={form.symbol}
        onChangeText={update("symbol")}
        style={styles.input}
      />
      {["open", "high", "low", "close", "volume"].map((field) => (
        <TextInput
          key={field}
          mode="outlined"
          label={field[0].toUpperCase() + field.slice(1)}
          keyboardType="numeric"
          value={form[field]}
          onChangeText={update(field)}
          style={styles.input}
        />
      ))}
      {TIMEFRAME_ROWS.map((row) => (
        <SegmentedButtons
          key={row.join("")}
          value={row.includes(form.timeframe) ? form.timeframe : ""}
          onValueChange={update("timeframe")}
          buttons={row.map((t) => ({ value: t, label: t }))}
          style={styles.segmented}
        />
      ))}
      <Button
        mode="contained"
        onPress={submit}
        loading={loading}
        disabled={loading}
        style={styles.submitBtn}
      >
        Forecast Volatility
      </Button>

      {usingFallback ? (
        <View style={{ marginTop: 16 }}>
          <AlertBanner tone="warning">
            The trained model is not loaded. Forecasts use a statistical range
            estimator.
          </AlertBanner>
        </View>
      ) : null}

      {result && (
        <View style={{ marginTop: 16 }}>
          <ResultGrid
            items={[
              ["Annualised vol", `${(annualised * 100).toFixed(2)}%`],
              [
                "Confidence",
                result.confidence != null
                  ? `${(Number(result.confidence) * 100).toFixed(1)}%`
                  : "n/a",
              ],
              ["Horizon", result.prediction_horizon],
              ["Model", result.model_version],
            ]}
          />
          <Button
            mode="outlined"
            onPress={() => onUseVolatility(annualised.toFixed(4))}
            style={{ marginTop: 12, borderRadius: 10 }}
          >
            Price an option with this volatility
          </Button>
        </View>
      )}
    </SectionCard>
  );
};

const AnalyticsScreen = () => {
  const [tab, setTab] = useState("price");
  const [forecastVolatility, setForecastVolatility] = useState(null);

  const applyForecast = (value) => {
    setForecastVolatility(value);
    setTab("price");
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={styles.title}>Analytics</Text>
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        buttons={TABS}
        style={styles.tabs}
      />
      {tab === "price" && (
        <OptionPricer initialVolatility={forecastVolatility} />
      )}
      {tab === "iv" && <ImpliedVol />}
      {tab === "greeks" && <QuickGreeks />}
      {tab === "forecast" && (
        <VolatilityForecast onUseVolatility={applyForecast} />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  tabs: { marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: colors.surfaceElevated },
  segmented: { marginBottom: 14 },
  submitBtn: { borderRadius: 10 },
});

export default AnalyticsScreen;
