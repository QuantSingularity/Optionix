import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  SegmentedButtons,
} from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import {
  AlertBanner,
  Badge,
  CardHeaderRow,
  CardMeta,
  CardTitle,
  EmptyState,
  Grid2,
  Screen,
  SectionCard,
  StatLabel,
  StatValue,
} from "../components/UI";
import { extractErrorMessage } from "../services/api";
import riskService from "../services/riskService";
import colors from "../theme";
import { formatCurrency, formatPercent } from "../utils/format";

const LIMIT_TONE = {
  healthy: "success",
  warning: "warning",
  critical: "danger",
};
const SCENARIOS = [
  "market_crash",
  "volatility_spike",
  "rate_hike",
  "liquidity_crisis",
];

const RiskScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [limits, setLimits] = useState(null);
  const [breakers, setBreakers] = useState(null);
  const [greeks, setGreeks] = useState(null);

  const [varMethod, setVarMethod] = useState("historical");
  const [varResult, setVarResult] = useState(null);
  const [varLoading, setVarLoading] = useState(false);

  const [selectedScenarios, setSelectedScenarios] = useState(["market_crash"]);
  const [stressResult, setStressResult] = useState(null);
  const [stressLoading, setStressLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setError("");
    try {
      const [lim, brk, gk] = await Promise.all([
        riskService.getLimits(),
        riskService.getCircuitBreakers(),
        riskService.getPortfolioGreeks(),
      ]);
      setLimits(lim);
      setBreakers(brk);
      setGreeks(gk);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load risk data."));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadOverview();
      setIsLoading(false);
    })();
  }, [loadOverview]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOverview();
    setRefreshing(false);
  };

  const toggleScenario = (s) =>
    setSelectedScenarios((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const runVar = async () => {
    setVarLoading(true);
    try {
      const data = await riskService.calculateVar({ method: varMethod });
      setVarResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "VaR calculation failed."));
    } finally {
      setVarLoading(false);
    }
  };

  const runStress = async () => {
    setStressLoading(true);
    try {
      const data = await riskService.stressTest({
        scenarios: selectedScenarios,
        portfolioValue: 100000,
      });
      setStressResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Stress test failed."));
    } finally {
      setStressLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Risk Management</Text>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      <Grid2>
        <View style={{ width: "50%", padding: 6 }}>
          <View style={styles.miniStat}>
            <StatLabel style={{ marginBottom: 4 }}>Utilisation</StatLabel>
            <StatValue style={{ fontSize: 16 }}>
              {formatPercent(limits?.utilisation_pct || 0)}
            </StatValue>
          </View>
        </View>
        <View style={{ width: "50%", padding: 6 }}>
          <View style={styles.miniStat}>
            <StatLabel style={{ marginBottom: 4 }}>Status</StatLabel>
            <Badge tone={LIMIT_TONE[limits?.status] || "neutral"}>
              {limits?.status || "—"}
            </Badge>
          </View>
        </View>
      </Grid2>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Circuit Breakers</CardTitle>
          <Badge tone={breakers?.all_clear ? "success" : "danger"}>
            {breakers?.all_clear ? "All Clear" : "Attention"}
          </Badge>
        </CardHeaderRow>
        {breakers?.circuit_breakers?.map((b) => (
          <View key={b.name} style={styles.breakerRow}>
            <MaterialCommunityIcons
              name={b.triggered ? "close-circle" : "check-circle"}
              size={18}
              color={b.triggered ? colors.danger : colors.success}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.breakerName}>
                {b.name.replace(/_/g, " ")}
              </Text>
              <Text style={styles.breakerDesc}>{b.description}</Text>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Value at Risk</CardTitle>
        </CardHeaderRow>
        <SegmentedButtons
          value={varMethod}
          onValueChange={setVarMethod}
          buttons={[
            { value: "historical", label: "Historical" },
            { value: "parametric", label: "Parametric" },
            { value: "monte_carlo", label: "Monte Carlo" },
          ]}
          style={styles.segmented}
        />
        <Button
          mode="contained"
          onPress={runVar}
          loading={varLoading}
          disabled={varLoading}
          style={styles.submitBtn}
        >
          Calculate VaR
        </Button>
        {varResult && (
          <View style={{ marginTop: 14 }}>
            {Object.values(varResult.var_results).map((r) => (
              <View key={r.confidence_level} style={styles.varRow}>
                <Text style={styles.varLabel}>
                  {(r.confidence_level * 100).toFixed(0)}% confidence
                </Text>
                <Text style={styles.varValue}>{formatCurrency(r.var)}</Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Stress Testing</CardTitle>
        </CardHeaderRow>
        <View style={styles.chipRow}>
          {SCENARIOS.map((s) => (
            <Chip
              key={s}
              selected={selectedScenarios.includes(s)}
              onPress={() => toggleScenario(s)}
              style={styles.chip}
              selectedColor={colors.primary}
            >
              {s.replace(/_/g, " ")}
            </Chip>
          ))}
        </View>
        <Button
          mode="contained"
          onPress={runStress}
          loading={stressLoading}
          disabled={stressLoading || selectedScenarios.length === 0}
          style={styles.submitBtn}
        >
          Run Stress Test
        </Button>
        {stressResult && (
          <View style={{ marginTop: 14 }}>
            {stressResult.results.map((r) => (
              <View key={r.scenario} style={styles.varRow}>
                <Text style={styles.varLabel}>
                  {r.scenario.replace(/_/g, " ")}
                </Text>
                <Text style={[styles.varValue, { color: colors.danger }]}>
                  {formatCurrency(r.estimated_pnl)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Portfolio Greeks</CardTitle>
          <CardMeta>{greeks?.open_positions ?? 0} open</CardMeta>
        </CardHeaderRow>
        {greeks?.position_greeks?.length > 0 ? (
          <Grid2>
            {Object.entries(greeks.net_greeks).map(([k, v]) => (
              <View key={k} style={{ width: "33.33%", padding: 6 }}>
                <StatLabel style={{ marginBottom: 4 }}>Net {k}</StatLabel>
                <StatValue style={{ fontSize: 13 }}>
                  {Number(v).toFixed(4)}
                </StatValue>
              </View>
            ))}
          </Grid2>
        ) : (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="shield-outline"
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No open positions"
          />
        )}
      </SectionCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  miniStat: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  breakerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakerName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  breakerDesc: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
  },
  segmented: { marginBottom: 14 },
  submitBtn: { borderRadius: 10 },
  varRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  varLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textTransform: "capitalize",
  },
  varValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { backgroundColor: colors.surfaceElevated },
});

export default RiskScreen;
