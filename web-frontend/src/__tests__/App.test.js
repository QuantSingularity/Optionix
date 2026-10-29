import { render, screen } from "@testing-library/react";
import App from "../App";
import { useAuth } from "../utils/AuthContext";

jest.mock("../utils/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: jest.fn(),
}));
jest.mock("../utils/WalletContext", () => ({
  WalletProvider: ({ children }) => children,
}));
// Pages are stubbed: this suite verifies routing, not page behaviour.
jest.mock("../pages/Home", () => require("../testUtils/mockPage")("Home"));
jest.mock("../pages/SignIn", () => require("../testUtils/mockPage")("SignIn"));
jest.mock("../pages/SignUp", () => require("../testUtils/mockPage")("SignUp"));
jest.mock("../pages/Dashboard", () =>
  require("../testUtils/mockPage")("Dashboard"),
);
jest.mock("../pages/Trading", () =>
  require("../testUtils/mockPage")("Trading"),
);
jest.mock("../pages/Portfolio", () =>
  require("../testUtils/mockPage")("Portfolio"),
);
jest.mock("../pages/Wallet", () => require("../testUtils/mockPage")("Wallet"));
jest.mock("../pages/Analytics", () =>
  require("../testUtils/mockPage")("Analytics"),
);
jest.mock("../pages/Risk", () => require("../testUtils/mockPage")("Risk"));
jest.mock("../pages/Compliance", () =>
  require("../testUtils/mockPage")("Compliance"),
);
jest.mock("../pages/Settings", () =>
  require("../testUtils/mockPage")("Settings"),
);
jest.mock("../services/riskService", () => ({
  __esModule: true,
  default: {
    getCircuitBreakers: jest.fn().mockResolvedValue({ circuit_breakers: [] }),
  },
}));
jest.mock("../services/complianceService", () => ({
  __esModule: true,
  default: { getAmlAlerts: jest.fn().mockResolvedValue({ alerts: [] }) },
}));

const signedOut = () =>
  useAuth.mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: jest.fn(),
  });
const signedIn = () =>
  useAuth.mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    user: { full_name: "Ada Lovelace", email: "a@b.co" },
    logout: jest.fn(),
  });

const visit = (path) => {
  window.history.pushState({}, "", path);
  return render(<App />);
};

describe("public routes", () => {
  beforeEach(signedOut);

  it.each([
    ["/", "Home"],
    ["/login", "SignIn"],
    ["/signup", "SignUp"],
  ])("serves %s", (path, name) => {
    visit(path);
    expect(screen.getByText(`${name} page`)).toBeInTheDocument();
  });

  it.each([
    "/dashboard",
    "/dashboard/trading",
    "/dashboard/portfolio",
    "/dashboard/wallet",
    "/dashboard/analytics",
    "/dashboard/risk",
    "/dashboard/compliance",
    "/dashboard/settings",
  ])("redirects %s to the login page", (path) => {
    visit(path);
    expect(screen.getByText("SignIn page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("shows the 404 page for unknown URLs", () => {
    visit("/definitely-not-a-page");
    expect(screen.getByText("404")).toBeInTheDocument();
  });
});

describe("signed-in routes", () => {
  beforeEach(signedIn);

  it.each([
    ["/dashboard", "Dashboard"],
    ["/dashboard/trading", "Trading"],
    ["/dashboard/portfolio", "Portfolio"],
    ["/dashboard/wallet", "Wallet"],
    ["/dashboard/analytics", "Analytics"],
    ["/dashboard/risk", "Risk"],
    ["/dashboard/compliance", "Compliance"],
    ["/dashboard/settings", "Settings"],
  ])("serves %s inside the dashboard layout", async (path, name) => {
    visit(path);
    expect(await screen.findByText(`${name} page`)).toBeInTheDocument();
    expect(screen.getByLabelText("Toggle sidebar")).toBeInTheDocument();
  });

  it.each(["/login", "/signup"])(
    "bounces %s to the dashboard",
    async (path) => {
      visit(path);
      expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
      expect(window.location.pathname).toBe("/dashboard");
    },
  );

  it("redirects unknown dashboard sub-pages to the dashboard", async () => {
    visit("/dashboard/does-not-exist");
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
  });
});

describe("session restore", () => {
  it("shows a loader instead of redirecting while the session is restored", () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });
    visit("/dashboard");
    expect(screen.getByText(/Loading Optionix/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
  });
});
