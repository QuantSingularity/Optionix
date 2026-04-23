import { useCallback, useEffect, useState } from "react";

const SYMBOLS = ["AAPL", "GOOGL", "MSFT", "AMZN", "SPX", "VIX", "TSLA", "NVDA"];
const ORDER_TYPES = ["market", "limit", "stop", "stop_limit"];
const SIDES = ["buy", "sell"];

const fmt = (n, d = 2) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

function Badge({ children, colour = "indigo" }) {
  const map = {
    indigo: "bg-indigo-900/50 text-indigo-300 border-indigo-700",
    green: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
    red: "bg-red-900/50 text-red-300 border-red-700",
    yellow: "bg-amber-900/50 text-amber-300 border-amber-700",
    slate: "bg-slate-800 text-slate-300 border-slate-600",
  };
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[colour]}`}
    >
      {children}
    </span>
  );
}

function OrderRow({ order, onCancel }) {
  const statusColour = {
    executed: "green",
    pending: "yellow",
    cancelled: "slate",
    rejected: "red",
  };
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0 text-sm">
      <div className="flex items-center gap-2">
        <Badge colour={order.side === "buy" ? "green" : "red"}>
          {order.side.toUpperCase()}
        </Badge>
        <span className="text-slate-200 font-mono font-semibold">
          {order.symbol}
        </span>
        <span className="text-slate-400">{order.type}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-slate-300 font-mono">
          {order.qty} @ ${fmt(order.price)}
        </span>
        <Badge colour={statusColour[order.status] || "slate"}>
          {order.status}
        </Badge>
        {order.status === "pending" && (
          <button
            onClick={() => onCancel(order.id)}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

let _nextId = 1000;

export default function TradingInterface({ accountId = 1 }) {
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState("buy");
  const [orderType, setOrderType] = useState("market");
  const [quantity, setQuantity] = useState("10");
  const [price, setPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [orders, setOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [marketPrice, setMarketPrice] = useState(182.34);
  const [priceDir, setPriceDir] = useState(0);

  // Simulate live price feed
  useEffect(() => {
    const iv = setInterval(() => {
      setMarketPrice((prev) => {
        const delta = (Math.random() - 0.499) * 0.8;
        const next = +(prev + delta).toFixed(2);
        setPriceDir(delta > 0 ? 1 : -1);
        return next;
      });
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const validate = () => {
    if (!quantity || Number(quantity) <= 0)
      return "Quantity must be greater than zero";
    if (["limit", "stop_limit"].includes(orderType) && !price)
      return "Price is required for limit orders";
    if (price && Number(price) <= 0) return "Price must be positive";
    return null;
  };

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const err = validate();
      if (err) {
        showToast(err, "error");
        return;
      }

      setSubmitting(true);
      // In production: POST /api/trading/orders
      setTimeout(() => {
        const execPrice = orderType === "market" ? marketPrice : Number(price);
        const newOrder = {
          id: String(++_nextId),
          symbol,
          side,
          type: orderType,
          qty: Number(quantity),
          price: execPrice,
          status: orderType === "market" ? "executed" : "pending",
          timestamp: new Date().toLocaleTimeString(),
        };
        setOrders((prev) => [newOrder, ...prev].slice(0, 20));
        showToast(
          `${side.toUpperCase()} ${quantity} ${symbol} @ $${fmt(execPrice)} — ${newOrder.status}`,
          "success",
        );
        setSubmitting(false);
        if (orderType === "market") {
          setQuantity("10");
          setPrice("");
        }
      }, 500);
    },
    [symbol, side, orderType, quantity, price, marketPrice, showToast],
  );

  const cancelOrder = useCallback(
    (id) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)),
      );
      showToast("Order cancelled", "success");
    },
    [showToast],
  );

  const needsPrice = ["limit", "stop_limit"].includes(orderType);
  const estimatedValue =
    Number(quantity) * (needsPrice && price ? Number(price) : marketPrice);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-5">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header with live price */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Trading Interface</h2>
        <div className="flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-slate-800 text-white text-sm rounded-lg px-2 py-1 border border-slate-600"
          >
            {SYMBOLS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div
            className={`text-xl font-bold font-mono transition-colors ${priceDir > 0 ? "text-emerald-400" : priceDir < 0 ? "text-red-400" : "text-white"}`}
          >
            ${fmt(marketPrice)}
          </div>
          <span
            className={`text-xs ${priceDir > 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {priceDir > 0 ? "▲" : "▼"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Order form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-xl p-4 space-y-4"
        >
          {/* Buy / Sell toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            {SIDES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`flex-1 py-2 text-sm font-bold uppercase transition-all ${
                  side === s
                    ? s === "buy"
                      ? "bg-emerald-600 text-white"
                      : "bg-red-600 text-white"
                    : "bg-transparent text-slate-400 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Order Type
            </label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600"
            >
              {ORDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Quantity
            </label>
            <input
              type="number"
              min="0.001"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="Number of contracts"
            />
          </div>

          {/* Price (conditional) */}
          {needsPrice && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Limit Price
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-indigo-500"
                placeholder={`Market: $${fmt(marketPrice)}`}
              />
            </div>
          )}

          {/* Stop Loss / Take Profit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Stop Loss
              </label>
              <input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-red-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Take Profit
              </label>
              <input
                type="number"
                step="0.01"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-emerald-500"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-slate-700/50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Est. Order Value</span>
              <span className="text-white font-mono font-semibold">
                ${fmt(estimatedValue)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Est. Fee (0.1%)</span>
              <span className="text-slate-300 font-mono">
                ${fmt(estimatedValue * 0.001)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Est. Margin Required</span>
              <span className="text-slate-300 font-mono">
                ${fmt(estimatedValue * 0.1)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60 ${
              side === "buy"
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {submitting
              ? "Placing Order…"
              : `Place ${side.toUpperCase()} Order`}
          </button>
        </form>

        {/* Order book / history */}
        <div className="bg-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">
              Order History
            </h3>
            <Badge colour="slate">{orders.length} orders</Badge>
          </div>
          <div className="space-y-0 max-h-96 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No orders placed yet
              </p>
            ) : (
              orders.map((o) => (
                <OrderRow key={o.id} order={o} onCancel={cancelOrder} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
