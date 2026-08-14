export function formatCurrency(value, { decimals = 2 } = {}) {
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(value, { decimals = 2 } = {}) {
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value, { decimals = 2 } = {}) {
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return `${num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function formatDate(value, opts = {}) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateEthereumAddress() {
  const chars = "0123456789abcdef";
  let addr = "0x";
  for (let i = 0; i < 40; i += 1) {
    addr += chars[Math.floor(Math.random() * chars.length)];
  }
  return addr;
}

export function shortenAddress(address, chars = 4) {
  if (!address || address.length < 2 + chars * 2) return address || "-";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}
