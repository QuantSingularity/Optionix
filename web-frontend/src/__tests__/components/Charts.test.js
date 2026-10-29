import { render, screen } from "@testing-library/react";
import {
  CHART_PALETTE,
  ThemedBar,
  ThemedDoughnut,
  ThemedLine,
} from "../../components/common/Charts";

const mockCalls = {};
jest.mock("react-chartjs-2", () => {
  const make = (name) => (props) => {
    mockCalls[name] = props;
    return <canvas data-testid={name} data-height={props.height} />;
  };
  return { Line: make("line"), Bar: make("bar"), Doughnut: make("doughnut") };
});
jest.mock("chart.js", () => {
  const registered = [];
  return {
    Chart: { register: (...a) => registered.push(...a) },
    ArcElement: "ArcElement",
    BarElement: "BarElement",
    CategoryScale: "CategoryScale",
    Filler: "Filler",
    Legend: "Legend",
    LinearScale: "LinearScale",
    LineElement: "LineElement",
    PointElement: "PointElement",
    Tooltip: "Tooltip",
  };
});

const data = {
  labels: ["a", "b"],
  datasets: [{ label: "Equity", data: [1, 2] }],
};

describe("ThemedLine", () => {
  it("passes data and the default height through", () => {
    render(<ThemedLine data={data} />);
    expect(screen.getByTestId("line")).toHaveAttribute("data-height", "240");
    expect(mockCalls.line.data).toBe(data);
  });

  it("hides the legend by default and shows it on request", () => {
    render(<ThemedLine data={data} />);
    expect(mockCalls.line.options.plugins.legend.display).toBe(false);
    render(<ThemedLine data={data} showLegend />);
    expect(mockCalls.line.options.plugins.legend.display).toBe(true);
  });

  it("formats the y axis and tooltip with the prefix", () => {
    render(<ThemedLine data={data} yPrefix="$" height={100} />);
    const { options } = mockCalls.line;
    expect(options.scales.y.ticks.callback(1500)).toBe("$1500");
    expect(
      options.plugins.tooltip.callbacks.label({
        dataset: { label: "Equity" },
        parsed: { y: 1234.5 },
      }),
    ).toMatch(/^Equity: \$1,234\.5/);
    expect(
      options.plugins.tooltip.callbacks.label({
        dataset: {},
        parsed: { y: 2 },
      }),
    ).toMatch(/^: ?\$?2/);
    expect(screen.getAllByTestId("line").pop()).toHaveAttribute(
      "data-height",
      "100",
    );
  });

  it("is responsive and ignores the aspect ratio", () => {
    render(<ThemedLine data={data} />);
    expect(mockCalls.line.options).toMatchObject({
      responsive: true,
      maintainAspectRatio: false,
    });
  });
});

describe("ThemedBar", () => {
  it("is vertical by default", () => {
    render(<ThemedBar data={data} />);
    expect(mockCalls.bar.options.indexAxis).toBe("x");
    expect(mockCalls.bar.options.scales.x.grid).toEqual({ display: false });
    expect(screen.getByTestId("bar")).toHaveAttribute("data-height", "240");
  });

  it("flips axes and gridlines when horizontal", () => {
    render(<ThemedBar data={data} horizontal height={300} />);
    expect(mockCalls.bar.options.indexAxis).toBe("y");
    expect(mockCalls.bar.options.scales.y.grid).toEqual({ display: false });
    expect(mockCalls.bar.options.scales.x.grid.display).toBeUndefined();
  });

  it("never shows a legend", () => {
    render(<ThemedBar data={data} />);
    expect(mockCalls.bar.options.plugins.legend.display).toBe(false);
  });
});

describe("ThemedDoughnut", () => {
  it("renders a ring with a right-hand legend", () => {
    render(<ThemedDoughnut data={data} />);
    expect(screen.getByTestId("doughnut")).toHaveAttribute(
      "data-height",
      "220",
    );
    expect(mockCalls.doughnut.options.cutout).toBe("68%");
    expect(mockCalls.doughnut.options.plugins.legend.position).toBe("right");
  });
});

describe("CHART_PALETTE", () => {
  it("provides distinct hex colours", () => {
    expect(CHART_PALETTE.length).toBeGreaterThanOrEqual(6);
    expect(new Set(CHART_PALETTE).size).toBe(CHART_PALETTE.length);
    CHART_PALETTE.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
  });
});
