import { useState } from "react";
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
import colors from "../theme";
import { formatCurrency } from "../utils/format";

const TABS = [
  { value: "price", label: "Pricer" },
  { value: "iv", label: "Implied Vol" },
  { value: "greeks", label: "Quick Greeks" },
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

const OptionPricer = () => {
  const [form, setForm] = useState({
    spotPrice: "190",
    strikePrice: "195",
    timeToExpiry: "0.25",
    volatility: "0.28",
    riskFreeRate: "0.05",
    optionType: "call",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

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
        optionType: form.optionType,
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
      <SegmentedButtons
        value={form.optionType}
        onValueChange={update("optionType")}
        buttons={[
          { value: "call", label: "Call" },
          { value: "put", label: "Put" },
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
              ["Rho", result.rho != null ? result.rho.toFixed(4) : "—"],
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

const AnalyticsScreen = () => {
  const [tab, setTab] = useState("price");

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
      {tab === "price" && <OptionPricer />}
      {tab === "iv" && <ImpliedVol />}
      {tab === "greeks" && <QuickGreeks />}
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
