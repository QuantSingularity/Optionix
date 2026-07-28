import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiBriefcase,
  FiClipboard,
  FiPlus,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import CreateAccountPrompt from "../components/common/CreateAccountPrompt";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardMeta,
  CardTitle,
  CenteredSpinner,
  EmptyState,
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
  Table,
  TableScroll,
} from "../components/common/UI";
import tradingService from "../services/tradingService";
import { extractErrorMessage } from "../services/apiClient";
import { formatCurrency, formatDateTime } from "../utils/format";

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
  stopLoss: "",
  takeProfit: "",
};

const Trading = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

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
    setIsLoading(true);
    setError("");
    try {
      const accts = await tradingService.listAccounts();
      setAccounts(accts);
      if (accts.length > 0) {
        const primary = accts[0];
        setActiveAccountId(primary.id);
        await loadAccountData(primary.id);
      }
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load trading data."));
    } finally {
      setIsLoading(false);
    }
  }, [loadAccountData]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
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

    setIsSubmitting(true);
    try {
      await tradingService.placeOrder({
        accountId: activeAccountId,
        symbol: form.symbol.trim().toUpperCase(),
        tradeType: form.tradeType,
        orderType: form.orderType,
        quantity: Number(form.quantity),
        price: form.price ? Number(form.price) : undefined,
        stopLoss: form.stopLoss ? Number(form.stopLoss) : undefined,
        takeProfit: form.takeProfit ? Number(form.takeProfit) : undefined,
      });
      setFormSuccess("Order submitted successfully.");
      setForm(emptyForm);
      await loadAccountData(activeAccountId);
    } catch (err) {
      setFormError(extractErrorMessage(err, "Couldn't place that order."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (tradeId) => {
    setCancellingId(tradeId);
    try {
      await tradingService.cancelOrder(tradeId);
      await loadAccountData(activeAccountId);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't cancel that order."));
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) {
    return (
      <PageWrap>
        <CenteredSpinner $minHeight="60vh" />
      </PageWrap>
    );
  }

  if (accounts.length === 0) {
    return (
      <PageWrap>
        <PageHeader>
          <div>
            <PageTitle>Trading</PageTitle>
            <PageSubtitle>
              Place market, limit, and stop orders once your account is set up.
            </PageSubtitle>
          </div>
        </PageHeader>
        <CreateAccountPrompt onCreated={loadAll} />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Trading</PageTitle>
          <PageSubtitle>
            Execute orders and monitor open positions in real time.
          </PageSubtitle>
        </div>
      </PageHeader>

      {error && <Alert $tone="danger">{error}</Alert>}

      {summary && (
        <Grid $cols={4} style={{ marginBottom: 20 }}>
          <Card $pad="16px">
            <StatLabel>
              <FiBriefcase /> Balance
            </StatLabel>
            <StatValue style={{ fontSize: 18, marginTop: 4 }}>
              {formatCurrency(summary.balance_usd)}
            </StatValue>
          </Card>
          <Card $pad="16px">
            <StatLabel>Margin Used</StatLabel>
            <StatValue style={{ fontSize: 18, marginTop: 4 }}>
              {formatCurrency(summary.margin_used)}
            </StatValue>
          </Card>
          <Card $pad="16px">
            <StatLabel>Margin Available</StatLabel>
            <StatValue style={{ fontSize: 18, marginTop: 4 }}>
              {formatCurrency(summary.margin_available)}
            </StatValue>
          </Card>
          <Card $pad="16px">
            <StatLabel>
              <FiActivity /> Unrealized P&amp;L
            </StatLabel>
            <StatValue style={{ fontSize: 18, marginTop: 4 }}>
              {formatCurrency(summary.total_unrealised_pnl)}
            </StatValue>
          </Card>
        </Grid>
      )}

      <Grid $cols={3} style={{ alignItems: "start", marginBottom: 20 }}>
        <Card>
          <CardHeader>
            <CardTitle>
              <FiPlus /> Place Order
            </CardTitle>
          </CardHeader>

          {formError && <Alert $tone="danger">{formError}</Alert>}
          {formSuccess && <Alert $tone="success">{formSuccess}</Alert>}

          <form onSubmit={handlePlaceOrder}>
            <Field>
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                placeholder="AAPL240119C00190000"
                value={form.symbol}
                onChange={updateField("symbol")}
                style={{ textTransform: "uppercase" }}
              />
              <HelpText>OCC-style option symbol or underlying ticker.</HelpText>
            </Field>

            <Field>
              <Label>Side</Label>
              <Segmented>
                <SegmentedBtn
                  type="button"
                  $active={form.tradeType === "buy"}
                  $tone="success"
                  onClick={() => setForm((f) => ({ ...f, tradeType: "buy" }))}
                >
                  Buy
                </SegmentedBtn>
                <SegmentedBtn
                  type="button"
                  $active={form.tradeType === "sell"}
                  $tone="danger"
                  onClick={() => setForm((f) => ({ ...f, tradeType: "sell" }))}
                >
                  Sell
                </SegmentedBtn>
              </Segmented>
            </Field>

            <Field>
              <Label htmlFor="orderType">Order type</Label>
              <Select
                id="orderType"
                value={form.orderType}
                onChange={updateField("orderType")}
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
                <option value="stop_limit">Stop-Limit</option>
              </Select>
            </Field>

            <Field>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={updateField("quantity")}
              />
            </Field>

            {form.orderType !== "market" && (
              <Field>
                <Label htmlFor="price">
                  {form.orderType === "stop" ? "Stop price" : "Limit price"}
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={updateField("price")}
                />
              </Field>
            )}

            <Grid $cols={2} $gap="12px">
              <Field>
                <Label htmlFor="stopLoss">Stop loss (optional)</Label>
                <Input
                  id="stopLoss"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.stopLoss}
                  onChange={updateField("stopLoss")}
                />
              </Field>
              <Field>
                <Label htmlFor="takeProfit">Take profit (optional)</Label>
                <Input
                  id="takeProfit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.takeProfit}
                  onChange={updateField("takeProfit")}
                />
              </Field>
            </Grid>

            <Button
              type="submit"
              disabled={isSubmitting}
              $variant={form.tradeType === "buy" ? "success" : "danger"}
              style={{ width: "100%", marginTop: 4 }}
            >
              {isSubmitting
                ? "Submitting…"
                : `${form.tradeType === "buy" ? "Buy" : "Sell"} ${form.symbol || "Order"}`}
            </Button>
          </form>
        </Card>

        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader>
            <CardTitle>
              <FiTrendingUp /> Open Positions
            </CardTitle>
            <CardMeta>{positions.length} open</CardMeta>
          </CardHeader>
          {positions.length > 0 ? (
            <TableScroll>
              <Table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Entry</th>
                    <th>Current</th>
                    <th>Unrealized P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.position_id}>
                      <td>{p.symbol}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        {p.position_type}
                      </td>
                      <td>{p.size}</td>
                      <td>{formatCurrency(p.entry_price)}</td>
                      <td>
                        {formatCurrency(p.current_price || p.entry_price)}
                      </td>
                      <td
                        style={{
                          color:
                            Number(p.unrealized_pnl) >= 0
                              ? "var(--success)"
                              : "var(--danger)",
                        }}
                      >
                        {formatCurrency(p.unrealized_pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          ) : (
            <EmptyState>
              <FiTrendingUp />
              <h4>No open positions</h4>
              <p>Positions opened from executed orders will appear here.</p>
            </EmptyState>
          )}
        </Card>
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>
            <FiClipboard /> Order History
          </CardTitle>
          <CardMeta>{orders.length} total</CardMeta>
        </CardHeader>
        {orders.length > 0 ? (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.trade_id}>
                    <td>{o.symbol}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {o.trade_type}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {o.order_type}
                    </td>
                    <td>{o.quantity}</td>
                    <td>{formatCurrency(o.executed_price || o.price)}</td>
                    <td>
                      <Badge $tone={STATUS_TONE[o.status] || "neutral"}>
                        {o.status}
                      </Badge>
                    </td>
                    <td>{formatDateTime(o.created_at)}</td>
                    <td>
                      {o.status === "pending" && (
                        <Button
                          type="button"
                          $variant="ghost"
                          $sm
                          disabled={cancellingId === o.trade_id}
                          onClick={() => handleCancel(o.trade_id)}
                        >
                          <FiX />{" "}
                          {cancellingId === o.trade_id
                            ? "Cancelling…"
                            : "Cancel"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        ) : (
          <EmptyState>
            <FiAlertTriangle />
            <h4>No orders placed yet</h4>
            <p>Use the form above to submit your first order.</p>
          </EmptyState>
        )}
      </Card>
    </PageWrap>
  );
};

export default Trading;
