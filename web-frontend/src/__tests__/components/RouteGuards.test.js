import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  LoadingScreen,
  ProtectedRoute,
  PublicOnlyRoute,
} from "../../components/common/RouteGuards";
import { useAuth } from "../../utils/AuthContext";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));

const Where = () => {
  const loc = useLocation();
  return (
    <div data-testid="where">
      {loc.pathname}|{loc.state?.from?.pathname || ""}
    </div>
  );
};

const mountAt = (path, element, routePath = path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="/login" element={<Where />} />
        <Route path="/dashboard" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const auth = (o) =>
  useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, ...o });

describe("LoadingScreen", () => {
  it("shows the loading copy", () => {
    render(<LoadingScreen />);
    expect(screen.getByText(/Loading Optionix/)).toBeInTheDocument();
  });
});

describe("ProtectedRoute", () => {
  it("shows the loading screen while the session is restored", () => {
    auth({ isLoading: true });
    mountAt(
      "/dashboard/trading",
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByText(/Loading Optionix/)).toBeInTheDocument();
  });

  it("redirects visitors to /login and remembers where they were going", () => {
    auth({});
    mountAt(
      "/dashboard/trading",
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/login|/dashboard/trading",
    );
  });

  it("renders children for signed-in users", () => {
    auth({ isAuthenticated: true });
    mountAt(
      "/dashboard",
      <ProtectedRoute>
        <p>secret</p>
      </ProtectedRoute>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute", () => {
  it("shows the loading screen while loading", () => {
    auth({ isLoading: true });
    mountAt(
      "/login",
      <PublicOnlyRoute>
        <p>form</p>
      </PublicOnlyRoute>,
    );
    expect(screen.queryByText("form")).not.toBeInTheDocument();
    expect(screen.getByText(/Loading Optionix/)).toBeInTheDocument();
  });

  it("renders children for signed-out visitors", () => {
    auth({});
    mountAt(
      "/login",
      <PublicOnlyRoute>
        <p>form</p>
      </PublicOnlyRoute>,
    );
    expect(screen.getByText("form")).toBeInTheDocument();
  });

  it("sends signed-in users to the dashboard", () => {
    auth({ isAuthenticated: true });
    mountAt(
      "/login",
      <PublicOnlyRoute>
        <p>form</p>
      </PublicOnlyRoute>,
    );
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });
});
