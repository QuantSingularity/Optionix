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
  backgroundColor: "#1a1b1f",
  borderColor: "rgba(243,241,234,0.1)",
  borderWidth: 1,
  titleColor: "#f3f1ea",
  bodyColor: "#dad8cc",
  padding: 10,
  titleFont: { family: "'DM Sans', sans-serif", size: 12, weight: "700" },
  bodyFont: MONO_FONT,
  cornerRadius: 8,
  displayColors: false,
};

const gridOpts = {
  color: "rgba(243,241,234,0.05)",
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
            labels: { color: "#93938a", font: FONT, usePointStyle: true },
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
            ticks: { color: "#6f6f66", font: MONO_FONT },
          },
          y: {
            grid: gridOpts,
            ticks: {
              color: "#6f6f66",
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
            ticks: { color: "#6f6f66", font: MONO_FONT },
          },
          y: {
            grid: horizontal ? { display: false } : gridOpts,
            ticks: { color: "#6f6f66", font: MONO_FONT },
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
              color: "#93938a",
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
  "#c6a15b",
  "#4f8f74",
  "#3f9d72",
  "#a8843f",
  "#8a6a8f",
  "#c2483f",
  "#6ea88c",
  "#93938a",
];
