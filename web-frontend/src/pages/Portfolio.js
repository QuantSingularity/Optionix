import { useCallback, useEffect, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiPieChart,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";
import CreateAccountPrompt from "../components/common/CreateAccountPrompt";
import { CHART_PALETTE, ThemedDoughnut } from "../components/common/Charts";
import {
  Alert,
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
  Segmented,
  SegmentedBtn,
  StatCard,
  StatLabel,
  StatValue,
  Table,
  TableScroll,
} from "../components/common/UI";
import portfolioService from "../services/portfolioService";
import tradingService from "../services/tradingService";
import { extractErrorMessage } from "../services/apiClient";
import { formatCurrency, formatPercent } from "../utils/format";

const PERIODS = [7, 30, 90];

const Portfolio = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAccount, setHasAccount] = useState(true);

  const [overview, setOverview] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [riskMetrics, setRiskMetrics] = useState(null);
  const [greeks, setGreeks] = useState(null);
  const [period, setPeriod] = useState(30);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
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
        portfolioService.getPerformance(period),
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
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (isLoading) {
    return (
      <PageWrap>
        <CenteredSpinner $minHeight="60vh" />
      </PageWrap>
    );
  }

  if (!hasAccount) {
    return (
      <PageWrap>
        <PageHeader>
          <div>
            <PageTitle>Portfolio</PageTitle>
            <PageSubtitle>
              Allocation, performance, and risk in one place.
            </PageSubtitle>
          </div>
        </PageHeader>
        <CreateAccountPrompt onCreated={loadAll} />
      </PageWrap>
    );
  }

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

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Portfolio</PageTitle>
          <PageSubtitle>
            Allocation, performance, and risk in one place.
          </PageSubtitle>
        </div>
      </PageHeader>

      {error && <Alert $tone="danger">{error}</Alert>}

      <Grid $cols={4} style={{ marginBottom: 20 }}>
        <StatCard>
          <StatLabel>Total Equity</StatLabel>
          <StatValue>{formatCurrency(overview?.total_equity || 0)}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Unrealized P&amp;L</StatLabel>
          <StatValue>
            {formatCurrency(overview?.total_unrealised_pnl || 0)}
          </StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>VaR (95%)</StatLabel>
          <StatValue>{formatCurrency(riskMetrics?.var_95 || 0)}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>CVaR (95%)</StatLabel>
          <StatValue>{formatCurrency(riskMetrics?.cvar_95 || 0)}</StatValue>
        </StatCard>
      </Grid>

      <Grid $cols={3} style={{ marginBottom: 20, alignItems: "start" }}>
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader>
            <CardTitle>
              <FiPieChart /> Allocation
            </CardTitle>
          </CardHeader>
          {doughnutData ? (
            <Grid $cols={2}>
              <ThemedDoughnut data={doughnutData} height={220} />
              <TableScroll>
                <Table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Exposure</th>
                      <th>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocation.allocations.map((a) => (
                      <tr key={a.symbol}>
                        <td>{a.symbol}</td>
                        <td>{formatCurrency(a.exposure)}</td>
                        <td>{formatPercent(a.weight_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            </Grid>
          ) : (
            <EmptyState>
              <FiPieChart />
              <h4>No open positions</h4>
              <p>Your allocation breakdown appears once you hold a position.</p>
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
              <p>Open a position to see portfolio sensitivity.</p>
            </EmptyState>
          )}
        </Card>
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>
            <FiTrendingUp /> Trading Performance
          </CardTitle>
          <Segmented>
            {PERIODS.map((p) => (
              <SegmentedBtn
                key={p}
                type="button"
                $active={period === p}
                onClick={() => setPeriod(p)}
              >
                {p}d
              </SegmentedBtn>
            ))}
          </Segmented>
        </CardHeader>

        {performance && performance.total_trades > 0 ? (
          <Grid $cols={4}>
            <div>
              <StatLabel>Trades</StatLabel>
              <StatValue style={{ fontSize: 18 }}>
                {performance.total_trades}
              </StatValue>
            </div>
            <div>
              <StatLabel>Net P&amp;L</StatLabel>
              <StatValue style={{ fontSize: 18 }}>
                {formatCurrency(performance.total_pnl)}
              </StatValue>
            </div>
            <div>
              <StatLabel>Fees Paid</StatLabel>
              <StatValue style={{ fontSize: 18 }}>
                {formatCurrency(performance.total_fees || 0)}
              </StatValue>
            </div>
            <div>
              <StatLabel>Avg Trade Value</StatLabel>
              <StatValue style={{ fontSize: 18 }}>
                {formatCurrency(performance.avg_trade_value)}
              </StatValue>
            </div>
          </Grid>
        ) : (
          <EmptyState>
            <FiActivity />
            <h4>No trades in this window</h4>
            <p>Execute an order to start tracking performance over time.</p>
          </EmptyState>
        )}
      </Card>

      {riskMetrics?.methodology && (
        <div
          style={{
            marginTop: 14,
            fontSize: 12.5,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FiShield /> Risk figures computed via {riskMetrics.methodology}.
        </div>
      )}
    </PageWrap>
  );
};

export default Portfolio;
