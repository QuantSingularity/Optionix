import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import CreateAccountPrompt from "../components/CreateAccountPrompt";
import {
  AlertBanner,
  CardHeaderRow,
  CardTitle,
  EmptyState,
  Grid2,
  Screen,
  SectionCard,
  SimpleBarRow,
  StatLabel,
  StatValue,
} from "../components/UI";
import { extractErrorMessage } from "../services/api";
import portfolioService from "../services/portfolioService";
import tradingService from "../services/tradingService";
import colors, { CHART_COLORS } from "../theme";
import { formatCurrency } from "../utils/format";

const PortfolioScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasAccount, setHasAccount] = useState(true);

  const [overview, setOverview] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState(null);
  const [greeks, setGreeks] = useState(null);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const accounts = await tradingService.listAccounts();
      if (accounts.length === 0) {
        setHasAccount(false);
        return;
      }
      setHasAccount(true);
      const [ov, alloc, perf, risk, gk] = await Promise.all([
        portfolioService.getOverview(),
        portfolioService.getAllocation(),
        portfolioService.getPerformance(30),
        portfolioService.getRiskMetrics(),
        portfolioService.getGreeksSummary(),
      ]);
      setOverview(ov);
      setAllocation(alloc);
      setPerformance(perf);
      setRiskMetrics(risk);
      setGreeks(gk);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load portfolio data."));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadAll();
      setIsLoading(false);
    })();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (!hasAccount) {
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <CreateAccountPrompt onCreated={loadAll} />
      </ScrollView>
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
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      <Grid2>
        <View style={{ width: "50%", padding: 6 }}>
          <View style={styles.miniStat}>
            <StatLabel style={{ marginBottom: 4 }}>Total Equity</StatLabel>
            <StatValue style={{ fontSize: 16 }}>
              {formatCurrency(overview?.total_equity || 0)}
            </StatValue>
          </View>
        </View>
        <View style={{ width: "50%", padding: 6 }}>
          <View style={styles.miniStat}>
            <StatLabel style={{ marginBottom: 4 }}>VaR (95%)</StatLabel>
            <StatValue style={{ fontSize: 16 }}>
              {formatCurrency(riskMetrics?.var_95 || 0)}
            </StatValue>
          </View>
        </View>
      </Grid2>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Allocation</CardTitle>
        </CardHeaderRow>
        {allocation?.allocations?.length > 0 ? (
          allocation.allocations.map((a, i) => (
            <SimpleBarRow
              key={a.symbol}
              label={a.symbol}
              valueLabel={`${formatCurrency(a.exposure)}`}
              pct={Number(a.weight_pct)}
              color={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))
        ) : (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="chart-donut"
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No open positions"
          />
        )}
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Net Greeks</CardTitle>
        </CardHeaderRow>
        {greeks && Number(greeks.open_positions) > 0 ? (
          <Grid2>
            {Object.entries(greeks.net_greeks).map(([k, v]) => (
              <View key={k} style={{ width: "33.33%", padding: 6 }}>
                <StatLabel style={{ marginBottom: 4 }}>{k}</StatLabel>
                <StatValue style={{ fontSize: 14 }}>
                  {Number(v).toFixed(4)}
                </StatValue>
              </View>
            ))}
          </Grid2>
        ) : (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="function-variant"
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No Greeks yet"
          />
        )}
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>30-Day Performance</CardTitle>
        </CardHeaderRow>
        {performance && performance.total_trades > 0 ? (
          <Grid2>
            <View style={{ width: "50%", padding: 6 }}>
              <StatLabel style={{ marginBottom: 4 }}>Trades</StatLabel>
              <StatValue style={{ fontSize: 15 }}>
                {performance.total_trades}
              </StatValue>
            </View>
            <View style={{ width: "50%", padding: 6 }}>
              <StatLabel style={{ marginBottom: 4 }}>Net P&L</StatLabel>
              <StatValue style={{ fontSize: 15 }}>
                {formatCurrency(performance.total_pnl)}
              </StatValue>
            </View>
          </Grid2>
        ) : (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="chart-timeline-variant"
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No trades in this window"
          />
        )}
      </SectionCard>

      {riskMetrics?.methodology && (
        <Text style={styles.footnote}>
          Risk figures computed via {riskMetrics.methodology}.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  miniStat: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
});

export default PortfolioScreen;
