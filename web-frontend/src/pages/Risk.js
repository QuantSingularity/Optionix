import { useCallback, useEffect, useState } from "react";
import {
  FiAlertOctagon,
  FiCheckCircle,
  FiShield,
  FiSliders,
  FiTrendingDown,
  FiXCircle,
} from "react-icons/fi";
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
  StatLabel,
  StatValue,
  Table,
  TableScroll,
} from "../components/common/UI";
import riskService from "../services/riskService";
import { extractErrorMessage } from "../services/apiClient";
import { formatCurrency, formatPercent } from "../utils/format";

const LIMIT_TONE = {
  healthy: "success",
  warning: "warning",
  critical: "danger",
};
const SEVERITY_TONE = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

const SCENARIOS = [
  "market_crash",
  "volatility_spike",
  "rate_hike",
  "liquidity_crisis",
  "black_swan",
  "mild_correction",
];

const Risk = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [limits, setLimits] = useState(null);
  const [breakers, setBreakers] = useState(null);
  const [greeks, setGreeks] = useState(null);

  const [varResult, setVarResult] = useState(null);
  const [varLoading, setVarLoading] = useState(false);
  const [varMethod, setVarMethod] = useState("historical");
  const [varHorizon, setVarHorizon] = useState("1");

  const [stressResult, setStressResult] = useState(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [stressValue, setStressValue] = useState("100000");
  const [selectedScenarios, setSelectedScenarios] = useState([
    "market_crash",
    "volatility_spike",
    "rate_hike",
  ]);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const toggleScenario = (s) =>
    setSelectedScenarios((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const runVar = async () => {
    setVarLoading(true);
    try {
      const data = await riskService.calculateVar({
        timeHorizonDays: Number(varHorizon),
        method: varMethod,
      });
      setVarResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "VaR calculation failed."));
    } finally {
      setVarLoading(false);
    }
  };

  const runStressTest = async () => {
    setStressLoading(true);
    try {
      const data = await riskService.stressTest({
        scenarios: selectedScenarios,
        portfolioValue: Number(stressValue),
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
      <PageWrap>
        <CenteredSpinner $minHeight="60vh" />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Risk Management</PageTitle>
          <PageSubtitle>
            Monitor exposure limits, run VaR and stress scenarios, and track
            portfolio Greeks.
          </PageSubtitle>
        </div>
      </PageHeader>

      {error && <Alert $tone="danger">{error}</Alert>}

      <Grid $cols={4} style={{ marginBottom: 20 }}>
        <Card $pad="16px">
          <StatLabel>
            <FiShield /> Risk Limit
          </StatLabel>
          <StatValue style={{ fontSize: 18, marginTop: 4 }}>
            {formatCurrency(limits?.risk_limit_usd || 0)}
          </StatValue>
        </Card>
        <Card $pad="16px">
          <StatLabel>Margin Used</StatLabel>
          <StatValue style={{ fontSize: 18, marginTop: 4 }}>
            {formatCurrency(limits?.margin_used_usd || 0)}
          </StatValue>
        </Card>
        <Card $pad="16px">
          <StatLabel>Utilisation</StatLabel>
          <StatValue style={{ fontSize: 18, marginTop: 4 }}>
            {formatPercent(limits?.utilisation_pct || 0)}
          </StatValue>
        </Card>
        <Card $pad="16px">
          <StatLabel>Status</StatLabel>
          <div style={{ marginTop: 8 }}>
            <Badge $tone={LIMIT_TONE[limits?.status] || "neutral"}>
              {limits?.status || "-"}
            </Badge>
          </div>
        </Card>
      </Grid>

      <Card style={{ marginBottom: 20 }}>
        <CardHeader>
          <CardTitle>
            <FiAlertOctagon /> Circuit Breakers
          </CardTitle>
          <Badge $tone={breakers?.all_clear ? "success" : "danger"}>
            {breakers?.all_clear ? "All Clear" : "Attention Needed"}
          </Badge>
        </CardHeader>
        <Grid $cols={4}>
          {breakers?.circuit_breakers?.map((b) => (
            <Card
              key={b.name}
              $pad="14px"
              style={{ background: "var(--bg-elevated)" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  color: b.triggered ? "var(--danger)" : "var(--success)",
                }}
              >
                {b.triggered ? <FiXCircle /> : <FiCheckCircle />}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {b.name.replace(/_/g, " ")}
                </span>
              </div>
              <HelpText>{b.description}</HelpText>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 12.5,
                  color: "var(--text-secondary)",
                }}
              >
                {b.current_pct}% / {b.threshold_pct}% threshold
              </div>
            </Card>
          ))}
        </Grid>
      </Card>

      <Grid $cols={2} style={{ marginBottom: 20, alignItems: "start" }}>
        <Card>
          <CardHeader>
            <CardTitle>
              <FiTrendingDown /> Value at Risk
            </CardTitle>
          </CardHeader>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Method</Label>
              <select
                value={varMethod}
                onChange={(e) => setVarMethod(e.target.value)}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  color: "var(--text-primary)",
                  width: "100%",
                }}
              >
                <option value="historical">Historical</option>
                <option value="parametric">Parametric</option>
                <option value="monte_carlo">Monte Carlo</option>
              </select>
            </Field>
            <Field>
              <Label>Horizon (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={varHorizon}
                onChange={(e) => setVarHorizon(e.target.value)}
              />
            </Field>
          </Grid>
          <Button
            onClick={runVar}
            disabled={varLoading}
            style={{ width: "100%" }}
          >
            {varLoading ? "Calculating…" : "Calculate VaR"}
          </Button>

          {varResult && (
            <TableScroll style={{ marginTop: 18 }}>
              <Table>
                <thead>
                  <tr>
                    <th>Confidence</th>
                    <th>VaR</th>
                    <th>CVaR</th>
                    <th>% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(varResult.var_results).map((r) => (
                    <tr key={r.confidence_level}>
                      <td>{(r.confidence_level * 100).toFixed(0)}%</td>
                      <td>{formatCurrency(r.var)}</td>
                      <td>{formatCurrency(r.cvar)}</td>
                      <td>{formatPercent(r.var_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <FiSliders /> Stress Testing
            </CardTitle>
          </CardHeader>
          <Field>
            <Label>Portfolio value (USD)</Label>
            <Input
              type="number"
              min="0"
              value={stressValue}
              onChange={(e) => setStressValue(e.target.value)}
            />
          </Field>
          <Field>
            <Label>Scenarios</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SCENARIOS.map((s) => (
                <Badge
                  key={s}
                  as="button"
                  onClick={() => toggleScenario(s)}
                  $tone={selectedScenarios.includes(s) ? "info" : "neutral"}
                  style={{
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                  }}
                >
                  {s.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </Field>
          <Button
            onClick={runStressTest}
            disabled={stressLoading || selectedScenarios.length === 0}
            style={{ width: "100%" }}
          >
            {stressLoading ? "Running…" : "Run Stress Test"}
          </Button>

          {stressResult && (
            <TableScroll style={{ marginTop: 18 }}>
              <Table>
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Est. P&amp;L</th>
                    <th>%</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {stressResult.results.map((r) => (
                    <tr key={r.scenario}>
                      <td style={{ textTransform: "capitalize" }}>
                        {r.scenario.replace(/_/g, " ")}
                      </td>
                      <td style={{ color: "var(--danger)" }}>
                        {formatCurrency(r.estimated_pnl)}
                      </td>
                      <td>{formatPercent(r.estimated_pnl_pct)}</td>
                      <td>
                        <Badge $tone={SEVERITY_TONE[r.severity] || "neutral"}>
                          {r.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Card>
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Greeks</CardTitle>
          <CardMeta>{greeks?.open_positions ?? 0} open positions</CardMeta>
        </CardHeader>
        {greeks?.position_greeks?.length > 0 ? (
          <>
            <Grid $cols={5} style={{ marginBottom: 18 }}>
              {Object.entries(greeks.net_greeks).map(([k, v]) => (
                <div key={k}>
                  <StatLabel style={{ marginBottom: 4 }}>Net {k}</StatLabel>
                  <StatValue style={{ fontSize: 16 }}>
                    {Number(v).toFixed(4)}
                  </StatValue>
                </div>
              ))}
            </Grid>
            <TableScroll>
              <Table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Delta</th>
                    <th>Gamma</th>
                    <th>Theta</th>
                    <th>Vega</th>
                    <th>Rho</th>
                  </tr>
                </thead>
                <tbody>
                  {greeks.position_greeks.map((p) => (
                    <tr key={p.position_id}>
                      <td>{p.symbol}</td>
                      <td>{Number(p.delta).toFixed(4)}</td>
                      <td>{Number(p.gamma).toFixed(4)}</td>
                      <td>{Number(p.theta).toFixed(4)}</td>
                      <td>{Number(p.vega).toFixed(4)}</td>
                      <td>{Number(p.rho).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          </>
        ) : (
          <EmptyState>
            <FiShield />
            <h4>No open positions</h4>
            <p>Portfolio-level Greeks will appear once you open a position.</p>
          </EmptyState>
        )}
      </Card>
    </PageWrap>
  );
};

export default Risk;
