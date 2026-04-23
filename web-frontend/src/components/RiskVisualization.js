import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SEVERITY_COLOURS = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#7c3aed",
};
const fmt = (n, d = 2) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const fmtPct = (n) => `${Number(n) >= 0 ? "+" : ""}${fmt(n)}%`;

function buildVolData(days = 60) {
  const seed = (i) => Math.sin(i * 0.42) * 0.04 + Math.cos(i * 0.17) * 0.03;
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    realized: +(0.18 + seed(i) + Math.random() * 0.02).toFixed(4),
    implied: +(0.22 + seed(i + 3) + Math.random() * 0.025).toFixed(4),
  }));
}

const STRESS_SCENARIOS = [
  { scenario: "market_crash", estimated_pnl_pct: -28.4, severity: "critical" },
  { scenario: "volatility_spike", estimated_pnl_pct: -6.1, severity: "medium" },
  { scenario: "rate_hike", estimated_pnl_pct: -10.3, severity: "high" },
  { scenario: "liquidity_crisis", estimated_pnl_pct: -18.7, severity: "high" },
  { scenario: "black_swan", estimated_pnl_pct: -47.0, severity: "critical" },
  { scenario: "mild_correction", estimated_pnl_pct: -4.2, severity: "low" },
];
const VAR_DATA = [
  { cl: "90%", var: -4820, cvar: -6130 },
  { cl: "95%", var: -6940, cvar: -8410 },
  { cl: "99%", var: -11220, cvar: -14600 },
];
const GREEKS = {
  delta: 0.4231,
  gamma: 0.0087,
  theta: -52.14,
  vega: 183.6,
  rho: 29.4,
};

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}
function MetricCard({ label, value, sub, colour = "text-white" }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xl font-bold ${colour}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

export default function RiskVisualization({ portfolioValue = 250000 }) {
  const [volData, setVolData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const load = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setVolData(buildVolData(60));
      setLoading(false);
    }, 400);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Risk Dashboard</h2>
          <p className="text-xs text-slate-400">
            Portfolio value: ${fmt(portfolioValue)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["overview", "stress", "greeks"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${activeTab === t ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={load}
            className="px-3 py-1 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-500 animate-pulse">
          Loading risk metrics…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="1-Day VaR (95%)"
              value={`-$${fmt(6940)}`}
              sub="Monte Carlo"
              colour="text-red-400"
            />
            <MetricCard
              label="CVaR (95%)"
              value={`-$${fmt(8410)}`}
              sub="Expected Shortfall"
              colour="text-orange-400"
            />
            <MetricCard
              label="Net Delta"
              value={fmt(GREEKS.delta, 4)}
              sub="Directional exposure"
              colour="text-indigo-400"
            />
            <MetricCard
              label="Net Vega"
              value={`$${fmt(GREEKS.vega, 0)}`}
              sub="Per 1% vol move"
              colour="text-emerald-400"
            />
          </div>

          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-slate-800 rounded-xl p-4">
                <SectionTitle>
                  Realized vs Implied Volatility (60d)
                </SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={volData}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradIV" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#818cf8"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#818cf8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient id="gradRV" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#34d399"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#34d399"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <YAxis
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "none",
                        borderRadius: 8,
                      }}
                      formatter={(v, n) => [`${(v * 100).toFixed(2)}%`, n]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    <Area
                      type="monotone"
                      dataKey="implied"
                      stroke="#818cf8"
                      fill="url(#gradIV)"
                      name="Implied Vol"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="realized"
                      stroke="#34d399"
                      fill="url(#gradRV)"
                      name="Realized Vol"
                      dot={false}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <SectionTitle>Value-at-Risk (Monte Carlo, 1-day)</SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={VAR_DATA} barCategoryGap="30%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="cl"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        `$${Math.abs(v / 1000).toFixed(0)}k`
                      }
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "none",
                        borderRadius: 8,
                      }}
                      formatter={(v) => [`$${fmt(Math.abs(v))}`]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    <Bar
                      dataKey="var"
                      name="VaR"
                      fill="#f87171"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="cvar"
                      name="CVaR"
                      fill="#fb923c"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === "stress" && (
            <div className="bg-slate-800 rounded-xl p-4">
              <SectionTitle>Stress Test Results</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STRESS_SCENARIOS.map((s) => (
                  <div
                    key={s.scenario}
                    className="rounded-lg p-3 border"
                    style={{
                      borderColor: SEVERITY_COLOURS[s.severity] + "55",
                      background: SEVERITY_COLOURS[s.severity] + "11",
                    }}
                  >
                    <div className="text-xs text-slate-400 mb-1 capitalize">
                      {s.scenario.replace(/_/g, " ")}
                    </div>
                    <div
                      className="text-lg font-bold font-mono"
                      style={{ color: SEVERITY_COLOURS[s.severity] }}
                    >
                      {fmtPct(s.estimated_pnl_pct)}
                    </div>
                    <div
                      className="text-xs mt-1 capitalize font-semibold"
                      style={{ color: SEVERITY_COLOURS[s.severity] }}
                    >
                      {s.severity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "greeks" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-slate-800 rounded-xl p-4">
                <SectionTitle>Net Portfolio Greeks</SectionTitle>
                <div className="space-y-2">
                  {[
                    {
                      label: "Δ Delta",
                      value: fmt(GREEKS.delta, 4),
                      desc: "Price sensitivity",
                    },
                    {
                      label: "Γ Gamma",
                      value: fmt(GREEKS.gamma, 4),
                      desc: "Delta sensitivity",
                    },
                    {
                      label: "Θ Theta",
                      value: `$${fmt(GREEKS.theta, 2)}/day`,
                      desc: "Time decay",
                    },
                    {
                      label: "ν Vega",
                      value: `$${fmt(GREEKS.vega, 2)}/1%`,
                      desc: "Vol sensitivity",
                    },
                    {
                      label: "ρ Rho",
                      value: `$${fmt(GREEKS.rho, 2)}/1%`,
                      desc: "Rate sensitivity",
                    },
                  ].map(({ label, value, desc }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0"
                    >
                      <div>
                        <span className="text-slate-200 font-mono text-sm font-semibold">
                          {label}
                        </span>
                        <span className="text-slate-500 text-xs ml-2">
                          {desc}
                        </span>
                      </div>
                      <span className="text-indigo-400 font-mono text-sm">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4">
                <SectionTitle>Risk Limits Utilisation</SectionTitle>
                <div className="space-y-3 mt-2">
                  {[
                    { label: "Daily Loss Limit", used: 12 },
                    { label: "Margin Utilisation", used: 34 },
                    { label: "Position Concentration", used: 23 },
                    { label: "Volatility Budget", used: 61 },
                  ].map(({ label, used }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{label}</span>
                        <span
                          className={
                            used > 70
                              ? "text-red-400"
                              : used > 50
                                ? "text-amber-400"
                                : "text-emerald-400"
                          }
                        >
                          {used}%
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${used}%`,
                            background:
                              used > 70
                                ? "#ef4444"
                                : used > 50
                                  ? "#f59e0b"
                                  : "#22c55e",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
