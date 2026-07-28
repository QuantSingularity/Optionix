import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiArrowDownRight,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
  FiClipboard,
  FiPieChart,
  FiPlus,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import CreateAccountPrompt from "../components/common/CreateAccountPrompt";
import { CHART_PALETTE, ThemedDoughnut } from "../components/common/Charts";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CenteredSpinner,
  EmptyState,
  Grid,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageWrap,
  StatCard,
  StatDelta,
  StatLabel,
  StatValue,
  Table,
  TableScroll,
} from "../components/common/UI";
import portfolioService from "../services/portfolioService";
import tradingService from "../services/tradingService";
import { extractErrorMessage } from "../services/apiClient";
import { formatCurrency, formatDateTime, formatPercent } from "../utils/format";
import { useAuth } from "../utils/AuthContext";

const STATUS_TONE = {
  executed: "success",
  pending: "warning",
  cancelled: "neutral",
  rejected: "danger",
  failed: "danger",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [greeks, setGreeks] = useState(null);
  const [orders, setOrders] = useState([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const accts = await tradingService.listAccounts();
      setAccounts(accts);

      if (accts.length > 0) {
        const [ov, alloc, gk, ord] = await Promise.all([
          portfolioService.getOverview(),
          portfolioService.getAllocation(),
          portfolioService.getGreeksSummary(),
          tradingService.listOrders({ limit: 6 }),
        ]);
        setOverview(ov);
        setAllocation(alloc);
        setGreeks(gk);
        setOrders(ord);
      }
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load your dashboard."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const firstName = user?.full_name?.split(" ")[0] || "there";
  const hasAccount = accounts.length > 0;
  const pnl = Number(overview?.total_unrealised_pnl || 0);

  const doughnutData =
    allocation?.allocations?.length > 0
      ? {
          labels: allocation.allocations.map((a) => a.symbol),
          datasets: [
            {
              data: allocation.allocations.map((a) => Number(a.weight_pct)),
              backgroundColor: CHART_PALETTE,
              borderWidth: 0,
            },
          ],
        }
      : null;

  if (isLoading) {
    return (
      <PageWrap>
        <CenteredSpinner $minHeight="60vh" />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Welcome back, {firstName}</PageTitle>
          <PageSubtitle>
            Here's what's happening across your accounts right now.
          </PageSubtitle>
        </div>
        {hasAccount && (
          <Button as={Link} to="/dashboard/trading">
            <FiPlus /> New Order
          </Button>
        )}
      </PageHeader>

      {error && <Alert $tone="danger">{error}</Alert>}

      {!hasAccount ? (
        <CreateAccountPrompt onCreated={loadData} />
      ) : (
        <>
          <Grid $cols={4} style={{ marginBottom: 20 }}>
            <StatCard>
              <StatLabel>
                <FiBriefcase /> Total Equity
              </StatLabel>
              <StatValue>
                {formatCurrency(overview?.total_equity || 0)}
              </StatValue>
            </StatCard>

            <StatCard>
              <StatLabel>
                <FiActivity /> Unrealized P&amp;L
              </StatLabel>
              <StatValue>{formatCurrency(pnl)}</StatValue>
              <StatDelta $negative={pnl < 0}>
                {pnl >= 0 ? <FiArrowUpRight /> : <FiArrowDownRight />}
                {pnl >= 0 ? "Positive" : "Negative"} exposure
              </StatDelta>
            </StatCard>

            <StatCard>
              <StatLabel>
                <FiShield /> Margin Utilization
              </StatLabel>
              <StatValue>
                {formatPercent(overview?.margin_utilisation_pct || 0)}
              </StatValue>
            </StatCard>

            <StatCard>
              <StatLabel>
                <FiTrendingUp /> Open Positions
              </StatLabel>
              <StatValue>{overview?.open_positions ?? 0}</StatValue>
            </StatCard>
          </Grid>

          <Grid $cols={3} style={{ marginBottom: 20, alignItems: "stretch" }}>
            <Card style={{ gridColumn: "span 2" }}>
              <CardHeader>
                <CardTitle>
                  <FiPieChart /> Allocation by Symbol
                </CardTitle>
                <Link
                  to="/dashboard/portfolio"
                  style={{ fontSize: 12.5, color: "var(--primary)" }}
                >
                  View portfolio →
                </Link>
              </CardHeader>
              {doughnutData ? (
                <ThemedDoughnut data={doughnutData} height={220} />
              ) : (
                <EmptyState>
                  <FiPieChart />
                  <h4>No open positions yet</h4>
                  <p>
                    Place your first trade to see your allocation breakdown
                    here.
                  </p>
                </EmptyState>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <FiBarChart2 /> Net Greeks
                </CardTitle>
              </CardHeader>
              {greeks && Number(greeks.open_positions) > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  {Object.entries(greeks.net_greeks).map(([k, v]) => (
                    <div key={k}>
                      <StatLabel style={{ marginBottom: 4 }}>{k}</StatLabel>
                      <StatValue style={{ fontSize: 16 }}>
                        {Number(v).toFixed(4)}
                      </StatValue>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>
                  <FiBarChart2 />
                  <h4>No Greeks yet</h4>
                  <p>Open a position to track live sensitivity here.</p>
                </EmptyState>
              )}
            </Card>
          </Grid>

          <Card>
            <CardHeader>
              <CardTitle>
                <FiClipboard /> Recent Orders
              </CardTitle>
              <Link
                to="/dashboard/trading"
                style={{ fontSize: 12.5, color: "var(--primary)" }}
              >
                View all →
              </Link>
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
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            ) : (
              <EmptyState>
                <FiClipboard />
                <h4>No orders yet</h4>
                <p>Your executed and pending orders will show up here.</p>
              </EmptyState>
            )}
          </Card>
        </>
      )}
    </PageWrap>
  );
};

export default Dashboard;
