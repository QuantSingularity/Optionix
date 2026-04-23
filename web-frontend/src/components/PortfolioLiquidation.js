import { useCallback, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fmt = (n, d = 2) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const MOCK_POSITIONS = [
  {
    id: "p1",
    symbol: "AAPL",
    side: "long",
    size: 100,
    entryPrice: 172.5,
    currentPrice: 182.34,
    liqPrice: 140.0,
    margin: 1725,
    unrealisedPnl: 984,
    healthScore: 87,
  },
  {
    id: "p2",
    symbol: "GOOGL",
    side: "long",
    size: 20,
    entryPrice: 2850.0,
    currentPrice: 2791.2,
    liqPrice: 2400.0,
    margin: 5700,
    unrealisedPnl: -1176,
    healthScore: 62,
  },
  {
    id: "p3",
    symbol: "MSFT",
    side: "short",
    size: 50,
    entryPrice: 415.0,
    currentPrice: 408.7,
    liqPrice: 480.0,
    margin: 2075,
    unrealisedPnl: 315,
    healthScore: 78,
  },
  {
    id: "p4",
    symbol: "TSLA",
    side: "long",
    size: 30,
    entryPrice: 245.0,
    currentPrice: 218.9,
    liqPrice: 195.0,
    margin: 735,
    unrealisedPnl: -783,
    healthScore: 31,
  },
  {
    id: "p5",
    symbol: "NVDA",
    side: "long",
    size: 25,
    entryPrice: 880.0,
    currentPrice: 924.6,
    liqPrice: 740.0,
    margin: 2200,
    unrealisedPnl: 1115,
    healthScore: 91,
  },
];

function healthColour(score) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  if (score >= 25) return "#ef4444";
  return "#7c3aed";
}
function healthLabel(score) {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Watch";
  if (score >= 25) return "At Risk";
  return "Critical";
}

function HealthBar({ score }) {
  const c = healthColour(score);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: c }}
        />
      </div>
      <span
        className="text-xs font-semibold w-14 text-right"
        style={{ color: c }}
      >
        {healthLabel(score)}
      </span>
    </div>
  );
}

function ConfirmModal({ position, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-600 space-y-4">
        <h3 className="text-lg font-bold text-white">Confirm Liquidation</h3>
        <p className="text-slate-300 text-sm">
          You are about to liquidate your{" "}
          <strong className="text-white">{position.symbol}</strong> position.
        </p>
        <div className="bg-slate-700/50 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Position size</span>
            <span className="text-white font-mono">
              {position.size} contracts
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Current Price</span>
            <span className="text-white font-mono">
              ${fmt(position.currentPrice)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Est. proceeds</span>
            <span className="text-white font-mono">
              ${fmt(position.size * position.currentPrice * 0.999)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Unrealised P&L</span>
            <span
              className={`font-mono ${position.unrealisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {position.unrealisedPnl >= 0 ? "+" : ""}$
              {fmt(position.unrealisedPnl)}
            </span>
          </div>
        </div>
        <p className="text-amber-400 text-xs">
          ⚠ This action is irreversible. The position will be closed at market
          price.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm font-semibold disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Closing…" : "Confirm Liquidation"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioLiquidation() {
  const [positions, setPositions] = useState(MOCK_POSITIONS);
  const [selectedPos, setSelectedPos] = useState(null);
  const [liquidating, setLiquidating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLiquidate = useCallback(() => {
    if (!selectedPos) return;
    setLiquidating(true);
    // In production: DELETE /api/trading/positions/{id} or POST /api/trading/orders (market sell)
    setTimeout(() => {
      setPositions((prev) => prev.filter((p) => p.id !== selectedPos.id));
      showToast(
        `${selectedPos.symbol} position closed successfully`,
        "success",
      );
      setSelectedPos(null);
      setLiquidating(false);
    }, 800);
  }, [selectedPos]);

  const totalPnl = positions.reduce((s, p) => s + p.unrealisedPnl, 0);
  const totalMargin = positions.reduce((s, p) => s + p.margin, 0);
  const atRisk = positions.filter((p) => p.healthScore < 50).length;

  const chartData = positions.map((p) => ({
    name: p.symbol,
    pnl: p.unrealisedPnl,
    health: p.healthScore,
  }));

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {selectedPos && (
        <ConfirmModal
          position={selectedPos}
          onConfirm={handleLiquidate}
          onCancel={() => !liquidating && setSelectedPos(null)}
          loading={liquidating}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Portfolio Liquidation Manager</h2>
          <p className="text-xs text-slate-400">
            Manage and close open positions
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-800 rounded-xl px-4 py-2 text-center">
            <div className="text-xs text-slate-400">Total Unrealised P&L</div>
            <div
              className={`font-bold font-mono text-lg ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl px-4 py-2 text-center">
            <div className="text-xs text-slate-400">Margin In Use</div>
            <div className="font-bold font-mono text-lg text-white">
              ${fmt(totalMargin)}
            </div>
          </div>
          {atRisk > 0 && (
            <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-2 text-center">
              <div className="text-xs text-red-300">At Risk</div>
              <div className="font-bold text-lg text-red-400">
                {atRisk} position{atRisk > 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* P&L bar chart */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Unrealised P&L by Position
        </h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => `$${v >= 0 ? "" : ""}${fmt(v, 0)}`}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "none",
                borderRadius: 8,
              }}
              formatter={(v) => [`$${fmt(v)}`, "P&L"]}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Position table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-700">
          <span>Symbol</span>
          <span>Side</span>
          <span>Size</span>
          <span>Entry / Current</span>
          <span>Liq. Price</span>
          <span className="col-span-1">Health</span>
          <span className="text-right">Action</span>
        </div>
        {positions.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-10">
            No open positions
          </p>
        ) : (
          positions.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-7 gap-2 px-4 py-3 items-center text-sm border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition-colors"
            >
              <span className="font-mono font-bold text-white">{p.symbol}</span>
              <span
                className={
                  p.side === "long"
                    ? "text-emerald-400 font-semibold"
                    : "text-red-400 font-semibold"
                }
              >
                {p.side.toUpperCase()}
              </span>
              <span className="text-slate-300 font-mono">{p.size}</span>
              <div className="font-mono text-xs">
                <div className="text-slate-400">${fmt(p.entryPrice)}</div>
                <div
                  className={
                    p.currentPrice >= p.entryPrice
                      ? "text-emerald-400"
                      : "text-red-400"
                  }
                >
                  ${fmt(p.currentPrice)}
                </div>
              </div>
              <span className="font-mono text-xs text-amber-400">
                ${fmt(p.liqPrice)}
              </span>
              <HealthBar score={p.healthScore} />
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedPos(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    p.healthScore < 50
                      ? "bg-red-600 hover:bg-red-500 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
