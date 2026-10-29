import { fireEvent, screen } from "@testing-library/react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CenteredSpinner,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Label,
  ModalBox,
  ModalOverlay,
  PageHeader,
  PageSubtitle,
  PageTitle,
  Segmented,
  SegmentedBtn,
  Select,
  Spinner,
  StatCard,
  StatLabel,
  StatValue,
  Table,
  TextArea,
} from "../../components/common/UI";
import { renderWithTheme } from "../../testUtils/render";

describe("text and layout primitives", () => {
  it.each([
    ["PageTitle", PageTitle, "H1"],
    ["PageSubtitle", PageSubtitle, "P"],
    ["Label", Label, "LABEL"],
    ["ErrorText", ErrorText, "SPAN"],
    ["StatLabel", StatLabel, "SPAN"],
    ["StatValue", StatValue, "SPAN"],
  ])("%s renders its children as a %s", (_n, Component, tag) => {
    renderWithTheme(<Component>hello</Component>);
    expect(screen.getByText("hello").tagName).toBe(tag);
  });

  it("composes Card, StatCard and PageHeader", () => {
    renderWithTheme(
      <PageHeader>
        <Card>
          <StatCard>inner</StatCard>
        </Card>
      </PageHeader>,
    );
    expect(screen.getByText("inner")).toBeInTheDocument();
  });
});

describe("Button", () => {
  it("renders a clickable native button", () => {
    const onClick = jest.fn();
    renderWithTheme(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", () => {
    const onClick = jest.fn();
    renderWithTheme(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("styles variants differently", () => {
    renderWithTheme(
      <>
        <Button>primary</Button>
        <Button $variant="ghost">ghost</Button>
        <Button $variant="danger">danger</Button>
      </>,
    );
    const bg = (n) => getComputedStyle(screen.getByText(n)).backgroundColor;
    expect(
      new Set([bg("primary"), bg("ghost"), bg("danger")]).size,
    ).toBeGreaterThan(1);
  });
});

describe("Badge", () => {
  it("renders and varies colour by tone", () => {
    renderWithTheme(
      <>
        <Badge>neutral</Badge>
        <Badge $tone="success">ok</Badge>
        <Badge $tone="danger">bad</Badge>
      </>,
    );
    const color = (n) => getComputedStyle(screen.getByText(n)).color;
    expect(color("ok")).not.toBe(color("bad"));
    expect(color("ok")).not.toBe(color("neutral"));
  });
});

describe("form controls", () => {
  it("Field + Label + Input are associated", () => {
    renderWithTheme(
      <Field>
        <Label htmlFor="x">Name</Label>
        <Input id="x" defaultValue="Ada" />
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
  });

  it("Select and TextArea are native controls", () => {
    renderWithTheme(
      <>
        <Select aria-label="s" defaultValue="b">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
        <TextArea aria-label="t" defaultValue="hi" />
      </>,
    );
    expect(screen.getByLabelText("s")).toHaveValue("b");
    expect(screen.getByLabelText("t")).toHaveValue("hi");
  });
});

describe("feedback", () => {
  it("Alert shows its message with different tones", () => {
    renderWithTheme(
      <>
        <Alert $tone="success">saved</Alert>
        <Alert $tone="danger">failed</Alert>
      </>,
    );
    expect(getComputedStyle(screen.getByText("saved")).color).not.toBe(
      getComputedStyle(screen.getByText("failed")).color,
    );
  });

  it("EmptyState and spinners render", () => {
    const { container } = renderWithTheme(
      <>
        <EmptyState>nothing</EmptyState>
        <Spinner />
        <CenteredSpinner>
          <Spinner />
        </CenteredSpinner>
      </>,
    );
    expect(screen.getByText("nothing")).toBeInTheDocument();
    expect(container.querySelectorAll("div").length).toBeGreaterThan(2);
  });
});

describe("table, modal and segmented control", () => {
  it("Table renders rows", () => {
    renderWithTheme(
      <Table>
        <thead>
          <tr>
            <th>Col</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("cell")).toBeInTheDocument();
  });

  it("Modal overlay forwards clicks and the box can stop propagation", () => {
    const onClose = jest.fn();
    renderWithTheme(
      <ModalOverlay onClick={onClose}>
        <ModalBox onClick={(e) => e.stopPropagation()}>content</ModalBox>
      </ModalOverlay>,
    );
    fireEvent.click(screen.getByText("content"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("content").parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Segmented buttons are clickable and visually distinguish the active one", () => {
    const onClick = jest.fn();
    renderWithTheme(
      <Segmented>
        <SegmentedBtn $active onClick={onClick}>
          One
        </SegmentedBtn>
        <SegmentedBtn onClick={onClick}>Two</SegmentedBtn>
      </Segmented>,
    );
    expect(getComputedStyle(screen.getByText("One")).color).not.toBe(
      getComputedStyle(screen.getByText("Two")).color,
    );
    fireEvent.click(screen.getByText("Two"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
