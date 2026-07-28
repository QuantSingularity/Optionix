import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

const FONT = { family: "'DM Sans', sans-serif", size: 11 };
const MONO_FONT = { family: "'DM Mono', monospace", size: 11 };

const baseTooltip = {
  backgroundColor: "#161d2e",
  borderColor: "rgba(255,255,255,0.1)",
  borderWidth: 1,
  titleColor: "#f1f5f9",
  bodyColor: "#cbd5e1",
  padding: 10,
  titleFont: { family: "'Syne', sans-serif", size: 12, weight: "700" },
  bodyFont: MONO_FONT,
  cornerRadius: 8,
  displayColors: false,
};

const gridOpts = {
  color: "rgba(255,255,255,0.05)",
  drawTicks: false,
};

export function ThemedLine({
  data,
  height = 240,
  showLegend = false,
  yPrefix = "",
}) {
  return (
    <Line
      height={height}
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: showLegend,
            labels: { color: "#94a3b8", font: FONT, usePointStyle: true },
          },
          tooltip: {
            ...baseTooltip,
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label || ""}: ${yPrefix}${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#64748b", font: MONO_FONT },
          },
          y: {
            grid: gridOpts,
            ticks: {
              color: "#64748b",
              font: MONO_FONT,
              callback: (v) => `${yPrefix}${v}`,
            },
          },
        },
      }}
    />
  );
}

export function ThemedBar({ data, height = 240, horizontal = false }) {
  return (
    <Bar
      height={height}
      data={data}
      options={{
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: baseTooltip,
        },
        scales: {
          x: {
            grid: horizontal ? gridOpts : { display: false },
            ticks: { color: "#64748b", font: MONO_FONT },
          },
          y: {
            grid: horizontal ? { display: false } : gridOpts,
            ticks: { color: "#64748b", font: MONO_FONT },
          },
        },
      }}
    />
  );
}

export function ThemedDoughnut({ data, height = 220 }) {
  return (
    <Doughnut
      height={height}
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: "#94a3b8",
              font: FONT,
              usePointStyle: true,
              padding: 14,
              boxWidth: 8,
            },
          },
          tooltip: baseTooltip,
        },
      }}
    />
  );
}

export const CHART_PALETTE = [
  "#3b82f6",
  "#d4af6a",
  "#10b981",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ef4444",
  "#ec4899",
];
