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
  SegmentedButtons,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import CreateAccountPrompt from "../components/CreateAccountPrompt";
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
import tradingService from "../services/tradingService";
import colors from "../theme";
import { formatCurrency } from "../utils/format";

const STATUS_TONE = {
  executed: "success",
  pending: "warning",
  cancelled: "neutral",
  rejected: "danger",
  failed: "danger",
};

const emptyForm = {
  symbol: "",
  tradeType: "buy",
  orderType: "market",
  quantity: "1",
  price: "",
};

const TradingScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAccountData = useCallback(async (accountId) => {
    const [sum, ord, pos] = await Promise.all([
      tradingService.getAccountSummary(accountId),
      tradingService.listOrders({ limit: 20 }),
      tradingService.listPositions({ status: "open" }),
    ]);
    setSummary(sum);
    setOrders(ord);
    setPositions(pos);
  }, []);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const accts = await tradingService.listAccounts();
      setAccounts(accts);
      if (accts.length > 0) {
        setActiveAccountId(accts[0].id);
        await loadAccountData(accts[0].id);
      }
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load trading data."));
    }
  }, [loadAccountData]);

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

  const handlePlaceOrder = async () => {
    setFormError("");
    setFormSuccess("");
    if (!form.symbol.trim()) {
      setFormError("Enter a symbol, e.g. AAPL240119C00190000.");
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }
    if (form.orderType !== "market" && !form.price) {
      setFormError("Enter a limit/stop price for this order type.");
      return;
    }

    setSubmitting(true);
    try {
      await tradingService.placeOrder({
        accountId: activeAccountId,
        symbol: form.symbol.trim().toUpperCase(),
        tradeType: form.tradeType,
        orderType: form.orderType,
        quantity: Number(form.quantity),
        price: form.price ? Number(form.price) : undefined,
      });
      setFormSuccess("Order submitted successfully.");
      setForm(emptyForm);
      await loadAccountData(activeAccountId);
    } catch (err) {
      setFormError(extractErrorMessage(err, "Couldn't place that order."));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  if (accounts.length === 0) {
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

      {summary && (
        <Grid2>
          <View style={{ width: "50%", padding: 6 }}>
            <View style={styles.miniStat}>
              <StatLabel style={{ marginBottom: 4 }}>Balance</StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {formatCurrency(summary.balance_usd)}
              </StatValue>
            </View>
          </View>
          <View style={{ width: "50%", padding: 6 }}>
            <View style={styles.miniStat}>
              <StatLabel style={{ marginBottom: 4 }}>
                Margin Available
              </StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {formatCurrency(summary.margin_available)}
              </StatValue>
            </View>
          </View>
        </Grid2>
      )}

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Place Order</CardTitle>
        </CardHeaderRow>
        {formError ? (
          <AlertBanner tone="danger">{formError}</AlertBanner>
        ) : null}
        {formSuccess ? (
          <AlertBanner tone="success">{formSuccess}</AlertBanner>
        ) : null}

        <TextInput
          mode="outlined"
          label="Symbol"
          autoCapitalize="characters"
          placeholder="AAPL240119C00190000"
          value={form.symbol}
          onChangeText={(v) => setForm((f) => ({ ...f, symbol: v }))}
          style={styles.input}
        />

        <SegmentedButtons
          value={form.tradeType}
          onValueChange={(v) => setForm((f) => ({ ...f, tradeType: v }))}
          buttons={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
          style={styles.segmented}
        />

        <SegmentedButtons
          value={form.orderType}
          onValueChange={(v) => setForm((f) => ({ ...f, orderType: v }))}
          buttons={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
            { value: "stop", label: "Stop" },
          ]}
          style={styles.segmented}
        />

        <TextInput
          mode="outlined"
          label="Quantity"
          keyboardType="numeric"
          value={form.quantity}
          onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))}
          style={styles.input}
        />

        {form.orderType !== "market" && (
          <TextInput
            mode="outlined"
            label={form.orderType === "stop" ? "Stop price" : "Limit price"}
            keyboardType="numeric"
            value={form.price}
            onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
            style={styles.input}
          />
        )}

        <Button
          mode="contained"
          onPress={handlePlaceOrder}
          loading={submitting}
          disabled={submitting}
          buttonColor={
            form.tradeType === "buy" ? colors.success : colors.danger
          }
          style={styles.submitBtn}
        >
          {form.tradeType === "buy" ? "Buy" : "Sell"} {form.symbol || "Order"}
        </Button>
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Open Positions</CardTitle>
          <CardMeta>{positions.length} open</CardMeta>
        </CardHeaderRow>
        {positions.length > 0 ? (
          positions.map((p) => (
            <View key={p.position_id} style={styles.positionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.symbol}</Text>
                <Text style={styles.rowMeta}>
                  {p.position_type} · {p.size} @ {formatCurrency(p.entry_price)}
                </Text>
              </View>
              <Text
                style={{
                  color:
                    Number(p.unrealized_pnl) >= 0
                      ? colors.success
                      : colors.danger,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {formatCurrency(p.unrealized_pnl)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="trending-up"
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
          <CardTitle>Order History</CardTitle>
          <CardMeta>{orders.length} total</CardMeta>
        </CardHeaderRow>
        {orders.length > 0 ? (
          orders.map((o) => (
            <View key={o.trade_id} style={styles.positionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{o.symbol}</Text>
                <Text style={styles.rowMeta}>
                  {o.trade_type.toUpperCase()} · {o.order_type} · {o.quantity}
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
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No orders yet"
          />
        )}
      </SectionCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  input: { marginBottom: 12, backgroundColor: colors.surfaceElevated },
  segmented: { marginBottom: 12 },
  submitBtn: { borderRadius: 10, marginTop: 4 },
  miniStat: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  positionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: { color: colors.textPrimary, fontSize: 13.5, fontWeight: "600" },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 11.5,
    marginTop: 2,
    textTransform: "capitalize",
  },
});

export default TradingScreen;
