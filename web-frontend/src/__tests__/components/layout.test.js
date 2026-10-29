import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import theme from "../../theme";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import DashboardLayout from "../../components/common/DashboardLayout";
import Footer from "../../components/common/Footer";
import Navbar from "../../components/common/Navbar";
import Sidebar from "../../components/common/Sidebar";
import { useAuth } from "../../utils/AuthContext";
import riskService from "../../services/riskService";
import complianceService from "../../services/complianceService";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/riskService", () => ({
  __esModule: true,
  default: { getCircuitBreakers: jest.fn() },
}));
jest.mock("../../services/complianceService", () => ({
  __esModule: true,
  default: { getAmlAlerts: jest.fn() },
}));

const logout = jest.fn();
const Where = () => {
  const l = useLocation();
  return (
    <div data-testid="where">
      {l.pathname}
      {l.search}
    </div>
  );
};
const mount = (ui, path = "/dashboard") =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
        <Where />
      </MemoryRouter>
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: {
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      kyc_status: "under_review",
    },
    logout,
  });
  riskService.getCircuitBreakers.mockResolvedValue({ circuit_breakers: [] });
  complianceService.getAmlAlerts.mockResolvedValue({ alerts: [] });
});

describe("Footer", () => {
  it("shows the brand and the current year", () => {
    render(
      <ThemeProvider theme={theme}>
        <Footer />
      </ThemeProvider>,
    );
    expect(
      screen.getByText(
        new RegExp(`© ${new Date().getFullYear()} Optionix Inc.`),
      ),
    ).toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  const nav = [
    ["Dashboard", "/dashboard"],
    ["Trading", "/dashboard/trading"],
    ["Portfolio", "/dashboard/portfolio"],
    ["Wallet", "/dashboard/wallet"],
    ["Analytics", "/dashboard/analytics"],
    ["Risk", "/dashboard/risk"],
    ["Compliance", "/dashboard/compliance"],
    ["Settings", "/dashboard/settings"],
  ];

  it.each(nav)("links %s to %s", (label, href) => {
    mount(<Sidebar isOpen onClose={() => {}} />);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
  });

  it("closes via the backdrop", () => {
    const onClose = jest.fn();
    const { container } = mount(<Sidebar isOpen onClose={onClose} />);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("logs out and returns home", () => {
    mount(<Sidebar isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Logout/ }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("highlights the current section and nothing else", () => {
    mount(<Sidebar isOpen onClose={() => {}} />, "/dashboard/trading");
    const color = (label) =>
      getComputedStyle(screen.getByRole("link", { name: label })).color;
    const active = color("Trading");
    [
      "Dashboard",
      "Portfolio",
      "Wallet",
      "Analytics",
      "Risk",
      "Compliance",
      "Settings",
    ].forEach((l) => expect(color(l)).not.toBe(active));
  });

  it("matches Dashboard exactly, so it is not active on sub-pages", () => {
    mount(<Sidebar isOpen onClose={() => {}} />, "/dashboard/risk");
    const color = (label) =>
      getComputedStyle(screen.getByRole("link", { name: label })).color;
    expect(color("Dashboard")).not.toBe(color("Risk"));
    expect(color("Dashboard")).toBe(color("Trading"));
  });

  it("shows the sidebar closed or open from its isOpen prop", () => {
    const { container } = mount(<Sidebar isOpen={false} onClose={() => {}} />);
    const sideEl = screen
      .getByRole("link", { name: "Trading" })
      .closest("nav").parentElement;
    expect(sideEl).toHaveStyle("transform: translateX(-100%)");
    expect(container).toBeTruthy();
  });
});

describe("Navbar", () => {
  it("shows the first name and initials", () => {
    mount(<Navbar toggleSidebar={() => {}} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("falls back to a generic identity", () => {
    useAuth.mockReturnValue({ user: null, logout });
    mount(<Navbar toggleSidebar={() => {}} />);
    expect(screen.getByText("Trader")).toBeInTheDocument();
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("toggles the sidebar", () => {
    const toggle = jest.fn();
    mount(<Navbar toggleSidebar={toggle} />);
    fireEvent.click(screen.getByLabelText("Toggle sidebar"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  describe("alerts bell", () => {
    it("shows no badge when nothing needs attention", async () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      await waitFor(() =>
        expect(complianceService.getAmlAlerts).toHaveBeenCalledWith({
          limit: 50,
        }),
      );
      expect(
        within(screen.getByLabelText("Alerts")).queryByText(/\d/),
      ).toBeNull();
    });

    it("counts tripped breakers plus open (non-resolved) AML alerts", async () => {
      riskService.getCircuitBreakers.mockResolvedValue({
        circuit_breakers: [{ triggered: true }, { triggered: false }],
      });
      complianceService.getAmlAlerts.mockResolvedValue({
        alerts: [
          { status: "open" },
          { status: "resolved" },
          { status: "closed" },
          { status: "investigating" },
          {},
        ],
      });
      mount(<Navbar toggleSidebar={() => {}} />);
      expect(
        await within(screen.getByLabelText("Alerts")).findByText("3"),
      ).toBeInTheDocument();
    });

    it("caps the badge at 9+", async () => {
      complianceService.getAmlAlerts.mockResolvedValue({
        alerts: Array.from({ length: 12 }, () => ({ status: "open" })),
      });
      mount(<Navbar toggleSidebar={() => {}} />);
      expect(
        await within(screen.getByLabelText("Alerts")).findByText("9+"),
      ).toBeInTheDocument();
    });

    it("hides the badge if the alert requests fail", async () => {
      riskService.getCircuitBreakers.mockRejectedValue(new Error("x"));
      mount(<Navbar toggleSidebar={() => {}} />);
      await waitFor(() =>
        expect(riskService.getCircuitBreakers).toHaveBeenCalled(),
      );
      expect(
        within(screen.getByLabelText("Alerts")).queryByText(/\d/),
      ).toBeNull();
    });

    it("opens the risk page when clicked", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      fireEvent.click(screen.getByLabelText("Alerts"));
      expect(screen.getByTestId("where")).toHaveTextContent("/dashboard/risk");
    });
  });

  describe("symbol search", () => {
    const search = () => screen.getByPlaceholderText("Look up a symbol…");

    it("navigates to analytics with an upper-cased, encoded symbol and clears the box", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      fireEvent.change(search(), { target: { value: " aapl&x " } });
      fireEvent.submit(search().closest("form"));
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/dashboard/analytics?symbol=AAPL%26X",
      );
      expect(search()).toHaveValue("");
    });

    it("ignores blank searches", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      fireEvent.change(search(), { target: { value: "   " } });
      fireEvent.submit(search().closest("form"));
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/dashboard$/);
    });
  });

  describe("user menu", () => {
    const open = () => fireEvent.click(screen.getByText("Ada"));

    it("is closed by default and opens on click", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      expect(screen.queryByText("ada@example.com")).toBeNull();
      open();
      expect(screen.getByText("ada@example.com")).toBeInTheDocument();
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("KYC · under review")).toBeInTheDocument();
    });

    it("omits the KYC badge when no status is known", () => {
      useAuth.mockReturnValue({
        user: { full_name: "Ada Lovelace", email: "a@b.co" },
        logout,
      });
      mount(<Navbar toggleSidebar={() => {}} />);
      open();
      expect(screen.queryByText(/KYC ·/)).toBeNull();
    });

    it("closes when clicking elsewhere", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      open();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText("ada@example.com")).toBeNull();
    });

    it("navigates to settings and closes", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      open();
      fireEvent.click(screen.getByText("Settings"));
      expect(screen.getByTestId("where")).toHaveTextContent(
        "/dashboard/settings",
      );
      expect(screen.queryByText("ada@example.com")).toBeNull();
    });

    it("signs out and returns home", () => {
      mount(<Navbar toggleSidebar={() => {}} />);
      open();
      fireEvent.click(screen.getByText("Sign out"));
      expect(logout).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
    });
  });
});

describe("DashboardLayout", () => {
  const mountLayout = () =>
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<p>page content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

  it("renders navbar, sidebar and the routed page", () => {
    mountLayout();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle sidebar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trading" })).toBeInTheDocument();
  });

  const side = () =>
    screen.getByRole("link", { name: "Trading" }).closest("nav").parentElement;
  const content = () => screen.getByText("page content").parentElement;

  it("starts with the sidebar open on wide screens", () => {
    mountLayout();
    expect(side()).toHaveStyle("transform: translateX(0)");
    expect(content()).toHaveStyle("margin-left: 240px");
  });

  it("collapses the sidebar when the viewport shrinks and the toggle reopens it", () => {
    mountLayout();
    act(() => {
      window.innerWidth = 600;
      window.dispatchEvent(new Event("resize"));
    });
    expect(side()).toHaveStyle("transform: translateX(-100%)");
    expect(content()).toHaveStyle("margin-left: 0px");

    fireEvent.click(screen.getByLabelText("Toggle sidebar"));
    expect(side()).toHaveStyle("transform: translateX(0)");
    window.innerWidth = 1024;
  });

  it("does not force the sidebar open when the window grows", () => {
    mountLayout();
    fireEvent.click(screen.getByLabelText("Toggle sidebar"));
    expect(side()).toHaveStyle("transform: translateX(-100%)");
    act(() => {
      window.innerWidth = 1400;
      window.dispatchEvent(new Event("resize"));
    });
    expect(side()).toHaveStyle("transform: translateX(-100%)");
  });

  it("removes its resize listener on unmount", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { unmount } = mountLayout();
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    remove.mockRestore();
  });
});
