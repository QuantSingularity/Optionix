import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ActivityIndicator, Button } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import CreateAccountPrompt from "../components/CreateAccountPrompt";
import {
  Badge,
  CardHeaderRow,
  CardMeta,
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
import { formatCurrency, formatDateTime, formatPercent } from "../utils/format";
import { useAuth } from "../context/AuthContext";

const STATUS_TONE = {
  executed: "success",
  pending: "warning",
  cancelled: "neutral",
  rejected: "danger",
  failed: "danger",
};

const StatCard = ({ icon, label, value, sub, subColor }) => (
  <View style={styles.statCard}>
    <View style={styles.statHeader}>
      <MaterialCommunityIcons
        name={icon}
        size={14}
        color={colors.textSecondary}
      />
      <StatLabel style={{ marginBottom: 0 }}>{label}</StatLabel>
    </View>
    <StatValue style={{ fontSize: 18, marginTop: 6 }}>{value}</StatValue>
    {sub ? (
      <Text
        style={[styles.statSub, { color: subColor || colors.textSecondary }]}
      >
        {sub}
      </Text>
    ) : null}
  </View>
);

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [orders, setOrders] = useState([]);

  const loadData = useCallback(async () => {
    setError("");
    try {
      const accts = await tradingService.listAccounts();
      setAccounts(accts);
      if (accts.length > 0) {
        const [ov, alloc, ord] = await Promise.all([
          portfolioService.getOverview(),
          portfolioService.getAllocation(),
          tradingService.listOrders({ limit: 5 }),
        ]);
        setOverview(ov);
        setAllocation(alloc);
        setOrders(ord);
      }
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load your dashboard."));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadData();
      setIsLoading(false);
    })();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const firstName = user?.full_name?.split(" ")[0] || "there";
  const hasAccount = accounts.length > 0;
  const pnl = Number(overview?.total_unrealised_pnl || 0);

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
      <Text style={styles.welcome}>Welcome back, {firstName}</Text>
      <Text style={styles.welcomeSub}>
        Here's what's happening across your accounts.
      </Text>

      {error ? (
        <SectionCard>
          <Text style={{ color: colors.danger }}>{error}</Text>
        </SectionCard>
      ) : null}

      {!hasAccount ? (
        <CreateAccountPrompt onCreated={loadData} />
      ) : (
        <>
          <Grid2>
            <View style={{ width: "50%", padding: 6 }}>
              <StatCard
                icon="briefcase-outline"
                label="Total Equity"
                value={formatCurrency(overview?.total_equity || 0)}
              />
            </View>
            <View style={{ width: "50%", padding: 6 }}>
              <StatCard
                icon="chart-line"
                label="Unrealized P&L"
                value={formatCurrency(pnl)}
                sub={pnl >= 0 ? "Positive exposure" : "Negative exposure"}
                subColor={pnl >= 0 ? colors.success : colors.danger}
              />
            </View>
            <View style={{ width: "50%", padding: 6 }}>
              <StatCard
                icon="shield-outline"
                label="Margin Utilization"
                value={formatPercent(overview?.margin_utilisation_pct || 0)}
              />
            </View>
            <View style={{ width: "50%", padding: 6 }}>
              <StatCard
                icon="trending-up"
                label="Open Positions"
                value={String(overview?.open_positions ?? 0)}
              />
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
                  valueLabel={`${formatCurrency(a.exposure)} · ${formatPercent(a.weight_pct)}`}
                  pct={Number(a.weight_pct)}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))
            ) : (
              <EmptyState
                icon={
                  <MaterialCommunityIcons
                    name="chart-donut"
                    size={28}
                    color={colors.borderAccent}
                  />
                }
                title="No open positions yet"
                description="Place your first trade to see your allocation here."
              />
            )}
          </SectionCard>

          <SectionCard>
            <CardHeaderRow>
              <CardTitle>Recent Orders</CardTitle>
              <CardMeta>{orders.length} shown</CardMeta>
            </CardHeaderRow>
            {orders.length > 0 ? (
              orders.map((o) => (
                <View key={o.trade_id} style={styles.orderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderSymbol}>{o.symbol}</Text>
                    <Text style={styles.orderMeta}>
                      {o.trade_type.toUpperCase()} · {o.quantity} ·{" "}
                      {formatDateTime(o.created_at)}
                    </Text>
                  </View>
                  <Badge tone={STATUS_TONE[o.status] || "neutral"}>
                    {o.status}
                  </Badge>
                </View>
              ))
            ) : (
              <EmptyState
                icon={
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={28}
                    color={colors.borderAccent}
                  />
                }
                title="No orders yet"
                description="Your executed and pending orders show up here."
              />
            )}
            <Button
              mode="text"
              onPress={() => navigation.navigate("Trading")}
              style={{ marginTop: 4 }}
            >
              Go to Trading →
            </Button>
          </SectionCard>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  welcome: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  welcomeSub: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 18,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statSub: {
    fontSize: 11.5,
    marginTop: 4,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderSymbol: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: "600",
  },
  orderMeta: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
  },
});

export default DashboardScreen;
