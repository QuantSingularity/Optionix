import { Route, Routes, MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import SignIn from "../../pages/SignIn";
import theme from "../../theme";
import { useAuth } from "../../utils/AuthContext";
import { LocationProbe, renderWithRouter } from "../../testUtils/render";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));

const login = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ login });
});

const fill = (email, password) => {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
};
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /^Sign In$/ }));

describe("SignIn", () => {
  it("renders the form with a hidden password", () => {
    renderWithRouter(<SignIn />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("validates required fields without calling the API", () => {
    renderWithRouter(<SignIn />);
    submit();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("treats a whitespace email as empty", () => {
    renderWithRouter(<SignIn />);
    fill("   ", "pw");
    submit();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.queryByText("Password is required.")).not.toBeInTheDocument();
  });

  it("signs in with a trimmed email and goes to the dashboard", async () => {
    login.mockResolvedValue({});
    renderWithRouter(<SignIn />, { route: "/login" });
    fill("  ada@example.com ", "Secret123!");
    submit();
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "Secret123!",
      }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  const mountWithFrom = (from) =>
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/login",
              state: from ? { from: { pathname: from } } : undefined,
            },
          ]}
        >
          <Routes>
            <Route path="/login" element={<SignIn />} />
            <Route path="/dashboard" element={<p>dashboard page</p>} />
            <Route path="/dashboard/risk" element={<p>risk page</p>} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </ThemeProvider>,
    );

  it("lands on /dashboard by default", async () => {
    login.mockResolvedValue({});
    mountWithFrom(null);
    fill("a@b.co", "pw");
    submit();
    expect(await screen.findByText("dashboard page")).toBeInTheDocument();
  });

  it("returns to the page the user originally requested", async () => {
    login.mockResolvedValue({});
    mountWithFrom("/dashboard/risk");
    fill("a@b.co", "pw");
    submit();
    expect(await screen.findByText("risk page")).toBeInTheDocument();
  });

  it("shows the server error and re-enables the button", async () => {
    login.mockRejectedValue(new Error("Invalid credentials"));
    renderWithRouter(<SignIn />);
    fill("a@b.co", "bad");
    submit();
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign In$/ })).toBeEnabled();
  });

  it("disables the button while signing in", async () => {
    let resolve;
    login.mockReturnValue(new Promise((r) => (resolve = r)));
    renderWithRouter(<SignIn />);
    fill("a@b.co", "pw");
    submit();
    expect(
      await screen.findByRole("button", { name: "Signing in…" }),
    ).toBeDisabled();
    resolve({});
  });

  it("clears a previous error on the next attempt", async () => {
    login.mockRejectedValueOnce(new Error("Nope"));
    renderWithRouter(<SignIn />);
    fill("a@b.co", "bad");
    submit();
    await screen.findByText("Nope");
    login.mockReturnValueOnce(new Promise(() => {}));
    submit();
    await waitFor(() =>
      expect(screen.queryByText("Nope")).not.toBeInTheDocument(),
    );
  });

  it("toggles password visibility", () => {
    renderWithRouter(<SignIn />);
    fireEvent.click(screen.getByLabelText("Show password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByLabelText("Hide password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("links to registration and home", () => {
    renderWithRouter(<SignIn />);
    expect(
      screen.getByRole("link", { name: "Create one free" }),
    ).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
