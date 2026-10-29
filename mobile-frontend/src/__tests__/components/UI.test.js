import { StyleSheet, Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import {
  AlertBanner,
  Badge,
  CardHeaderRow,
  CardMeta,
  CardTitle,
  Divider,
  EmptyState,
  Grid2,
  Row,
  Screen,
  SectionCard,
  SimpleBarRow,
  StatLabel,
  StatValue,
} from "../../components/UI";
import colors, { TONES } from "../../theme";

describe("layout primitives", () => {
  it.each([
    ["Screen", Screen],
    ["SectionCard", SectionCard],
    ["CardHeaderRow", CardHeaderRow],
    ["Row", Row],
    ["Grid2", Grid2],
  ])("%s renders children and merges custom style", (_n, Component) => {
    render(
      <Component style={{ marginTop: 11 }}>
        <Text>child</Text>
      </Component>,
    );
    expect(screen.getByText("child")).toBeTruthy();
    expect(screen.root).toHaveStyle({ marginTop: 11 });
  });

  it.each([
    ["CardTitle", CardTitle],
    ["CardMeta", CardMeta],
    ["StatLabel", StatLabel],
    ["StatValue", StatValue],
  ])("%s renders text and merges custom style", (_n, Component) => {
    render(<Component style={{ marginTop: 3 }}>hello</Component>);
    expect(screen.getByText("hello")).toHaveStyle({ marginTop: 3 });
  });

  it("Divider renders a view", () => {
    render(<Divider style={{ marginVertical: 9 }} />);
    expect(screen.root).toHaveStyle({ marginVertical: 9 });
  });
});

describe("Badge", () => {
  it("defaults to the neutral tone", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toHaveStyle({ color: TONES.neutral.fg });
    expect(screen.root).toHaveStyle({
      backgroundColor: TONES.neutral.bg,
      borderColor: TONES.neutral.border,
    });
  });

  it.each(Object.keys(TONES))("applies the %s tone", (tone) => {
    render(<Badge tone={tone}>x</Badge>);
    expect(screen.getByText("x")).toHaveStyle({ color: TONES[tone].fg });
    expect(screen.root).toHaveStyle({ backgroundColor: TONES[tone].bg });
  });

  it("falls back to neutral for an unknown tone", () => {
    render(<Badge tone="mystery">x</Badge>);
    expect(screen.getByText("x")).toHaveStyle({ color: TONES.neutral.fg });
  });

  it("supports a text style override", () => {
    render(<Badge textStyle={{ fontSize: 33 }}>x</Badge>);
    expect(screen.getByText("x")).toHaveStyle({ fontSize: 33 });
  });
});

describe("AlertBanner", () => {
  it("defaults to the info tone", () => {
    render(<AlertBanner>Heads up</AlertBanner>);
    expect(screen.getByText("Heads up")).toHaveStyle({ color: TONES.info.fg });
  });

  it.each(["success", "warning", "danger"])("applies the %s tone", (tone) => {
    render(<AlertBanner tone={tone}>msg</AlertBanner>);
    expect(screen.getByText("msg")).toHaveStyle({ color: TONES[tone].fg });
    expect(screen.root).toHaveStyle({ backgroundColor: TONES[tone].bg });
  });

  it("falls back to info for an unknown tone", () => {
    render(<AlertBanner tone="mystery">msg</AlertBanner>);
    expect(screen.getByText("msg")).toHaveStyle({ color: TONES.info.fg });
  });
});

describe("EmptyState", () => {
  it("renders icon, title and description", () => {
    render(
      <EmptyState
        icon={<Text>ICON</Text>}
        title="Nothing"
        description="Try later"
      />,
    );
    expect(screen.getByText("ICON")).toBeTruthy();
    expect(screen.getByText("Nothing")).toBeTruthy();
    expect(screen.getByText("Try later")).toBeTruthy();
  });

  it("omits the description when not provided", () => {
    render(<EmptyState title="Nothing" />);
    expect(screen.getByText("Nothing")).toBeTruthy();
    expect(screen.toJSON().children).toHaveLength(1);
  });
});

describe("SimpleBarRow", () => {
  // root > [header row, track > fill]
  const fill = () =>
    StyleSheet.flatten(screen.toJSON().children[1].children[0].props.style);

  it("shows label and value", () => {
    render(<SimpleBarRow label="Calls" valueLabel="42%" pct={42} />);
    expect(screen.getByText("Calls")).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();
    expect(fill()).toMatchObject({
      width: "42%",
      backgroundColor: colors.primary,
    });
  });

  it.each([
    [0, "2%"],
    [-20, "2%"],
    [1, "2%"],
    [55.5, "55.5%"],
    [100, "100%"],
    [250, "100%"],
  ])("clamps %p to %s", (pct, width) => {
    render(<SimpleBarRow label="x" valueLabel="y" pct={pct} />);
    expect(fill()).toMatchObject({ width });
  });

  it("uses a custom colour", () => {
    render(<SimpleBarRow label="x" valueLabel="y" pct={50} color="#123456" />);
    expect(fill()).toMatchObject({ backgroundColor: "#123456" });
  });
});
