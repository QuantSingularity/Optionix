import { fireEvent, screen, waitFor } from "@testing-library/react";
import SignUp from "../../pages/SignUp";
import { useAuth } from "../../utils/AuthContext";
import { renderWithRouter } from "../../testUtils/render";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));

const register = jest.fn();
const STRONG = "Zq8!vLm3#Rt7";

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ register });
});

const type = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = ({
  name = "Ada Lovelace",
  email = " ada@example.com ",
  password = STRONG,
  confirm,
} = {}) => {
  type("Full name", name);
  type("Email", email);
  type("Password", password);
  type("Confirm password", confirm ?? password);
};
const agree = () => fireEvent.click(screen.getByRole("checkbox"));
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /Create Account/ }));
const mount = () => renderWithRouter(<SignUp />, { route: "/signup" });

describe("password rules", () => {
  const rule = (label) => screen.getByText(label).closest("li, div, span");
  const mark = (label) =>
    screen.getByText(label).parentElement.textContent || "";

  it("lists the six rules", () => {
    mount();
    type("Password", "a");
    [
      "At least 12 characters",
      "One lowercase letter",
      "One uppercase letter",
      "One number",
      "One special character",
      "No repeated or sequential characters",
    ].forEach((l) => expect(screen.getByText(l)).toBeInTheDocument());
    expect(rule).toBeDefined();
    expect(mark).toBeDefined();
  });

  it("shows a strong password as satisfying every rule (no form error on submit)", async () => {
    register.mockResolvedValue({});
    mount();
    fill();
    agree();
    submit();
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(
      screen.queryByText("Password doesn't meet all requirements."),
    ).not.toBeInTheDocument();
  });

  it.each(["-", "_", "+", "=", "~", " "])(
    "rejects %p as the only special character (the backend does not count it)",
    (ch) => {
      mount();
      fill({ password: `Zq8${ch}vLm3Rt79` });
      agree();
      submit();
      expect(
        screen.getByText("Password doesn't meet all requirements."),
      ).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    },
  );

  it.each([
    "!",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "(",
    ")",
    ",",
    ".",
    "?",
    '"',
    ":",
    "{",
    "}",
    "|",
    "<",
    ">",
  ])("accepts %s as a special character", async (ch) => {
    register.mockResolvedValue({});
    mount();
    fill({ password: `Zq8${ch}vLm3Rt79` });
    agree();
    submit();
    await waitFor(() => expect(register).toHaveBeenCalled());
  });

  it.each([
    ["too short", "Zq8!vLm3#R"],
    ["no uppercase", "zq8!vlm3#rt7"],
    ["no lowercase", "ZQ8!VLM3#RT7"],
    ["no digit", "Zq!!vLmx#RtZ"],
    ["repeated characters", "Zq8!aaaavLm#"],
    ["numeric sequence", "Zq!1234vLm#R"],
    ["alphabetic sequence", "Zq8!abcdvLm#"],
  ])("rejects a weak password (%s)", (_l, password) => {
    mount();
    fill({ password });
    agree();
    submit();
    expect(
      screen.getByText("Password doesn't meet all requirements."),
    ).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});

describe("full name validation (mirrors the backend's isalpha-based rule)", () => {
  it.each([
    "José García",
    "Zoë O'Neil",
    "Anne-Marie Müller",
    "John Q. Public",
    "李 雷",
  ])("accepts %s", async (name) => {
    register.mockResolvedValue({});
    mount();
    fill({ name });
    agree();
    submit();
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: name }),
      ),
    );
  });

  it.each(["Ada3", "Ada<script>", "A", "Ada_Lovelace", "Ada\tLovelace", "a@b"])(
    "rejects %p",
    (name) => {
      mount();
      fill({ name });
      agree();
      submit();
      expect(
        screen.getByText(
          "Use letters, spaces, hyphens, apostrophes or periods only.",
        ),
      ).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    },
  );

  it("requires a name", () => {
    mount();
    fill({ name: "  " });
    agree();
    submit();
    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
  });
});

describe("SignUp submit", () => {
  it("requires an email", () => {
    mount();
    fill({ email: "  " });
    agree();
    submit();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
  });

  it("rejects mismatched confirmation", () => {
    mount();
    fill({ confirm: "different" });
    agree();
    submit();
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("requires consent", () => {
    mount();
    fill();
    submit();
    expect(screen.getByText("You must agree to continue.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("reports every problem at once", () => {
    mount();
    submit();
    expect(screen.getByText("Full name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Password doesn't meet all requirements."),
    ).toBeInTheDocument();
    expect(screen.getByText("You must agree to continue.")).toBeInTheDocument();
  });

  it("registers with trimmed values and goes to the dashboard", async () => {
    register.mockResolvedValue({});
    mount();
    fill({ name: "  Ada Lovelace " });
    agree();
    submit();
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: STRONG,
        fullName: "Ada Lovelace",
      }),
    );
  });

  it("shows server errors and re-enables the button", async () => {
    register.mockRejectedValue(new Error("Email already registered"));
    mount();
    fill();
    agree();
    submit();
    expect(
      await screen.findByText("Email already registered"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Account/ }),
    ).toBeEnabled();
  });

  it("disables the button while submitting", async () => {
    register.mockReturnValue(new Promise(() => {}));
    mount();
    fill();
    agree();
    submit();
    expect(
      await screen.findByRole("button", { name: "Creating account…" }),
    ).toBeDisabled();
  });

  it("toggles password visibility", () => {
    mount();
    fireEvent.click(screen.getByLabelText("Show password"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("links to sign in", () => {
    mount();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
