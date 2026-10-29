import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { paperInputs, pressRightIcon, typeInto } from "../../testUtils/paper";
import SignUpScreen from "../../screens/SignUpScreen";
import { useAuth } from "../../context/AuthContext";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const register = jest.fn();
const navigation = { navigate: jest.fn() };
const STRONG = "Zq8!vLm3#Rt7";

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ register });
});

const fill = ({
  name = "Ada Lovelace",
  email = " ada@example.com ",
  password = STRONG,
  confirm,
} = {}) => {
  typeInto(0, name);
  typeInto(1, email);
  typeInto(2, password);
  typeInto(3, confirm ?? password);
};
const agree = () => fireEvent.press(screen.getByText(/I agree to the Terms/));
const submit = () => fireEvent.press(screen.getByText("Create Account"));

describe("password rules", () => {
  const rule = (label) => screen.getByText(new RegExp(label));

  it("is hidden until the user types", () => {
    render(<SignUpScreen navigation={navigation} />);
    expect(screen.queryByText(/At least 12 characters/)).toBeNull();
  });

  it("lists six rules and ticks the ones that pass", () => {
    render(<SignUpScreen navigation={navigation} />);
    typeInto(2, "abc");
    expect(rule("○ At least 12 characters")).toBeTruthy();
    expect(rule("✓ One lowercase letter")).toBeTruthy();
    expect(rule("○ One uppercase letter")).toBeTruthy();
    expect(rule("○ One number")).toBeTruthy();
    expect(rule("○ One special character")).toBeTruthy();
    expect(rule("✓ No repeated or sequential characters")).toBeTruthy();
  });

  it("ticks everything for a strong password", () => {
    render(<SignUpScreen navigation={navigation} />);
    typeInto(2, STRONG);
    expect(screen.queryAllByText(/^○/)).toHaveLength(0);
    expect(screen.getAllByText(/^✓/)).toHaveLength(6);
  });

  it.each(["aaaa", "1234", "abcd", "WXYZ"])(
    "flags repeated or sequential pattern %s",
    (chunk) => {
      render(<SignUpScreen navigation={navigation} />);
      typeInto(2, `Zq!${chunk}vLm#Rt`);
      expect(rule("○ No repeated or sequential characters")).toBeTruthy();
    },
  );

  it.each(["-", "_", "+", "=", "~", " "])(
    'does not count %p as a special character (backend only accepts !@#$%%^&*(),.?":{}|<>)',
    (ch) => {
      render(<SignUpScreen navigation={navigation} />);
      typeInto(2, `Zq8${ch}vLm3Rt7`);
      expect(rule("○ One special character")).toBeTruthy();
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
  ])("counts %s as a special character", (ch) => {
    render(<SignUpScreen navigation={navigation} />);
    typeInto(2, `Zq8${ch}vLm3Rt7`);
    expect(rule("✓ One special character")).toBeTruthy();
  });
});

describe("SignUpScreen submit", () => {
  it("requires a name and email", async () => {
    render(<SignUpScreen navigation={navigation} />);
    fill({ name: "  ", email: "a@b.co" });
    submit();
    expect(
      await screen.findByText("Fill in your name and email."),
    ).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects a weak password", async () => {
    render(<SignUpScreen navigation={navigation} />);
    fill({ password: "short1!" });
    submit();
    expect(
      await screen.findByText("Password doesn't meet all requirements."),
    ).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    render(<SignUpScreen navigation={navigation} />);
    fill({ confirm: "different" });
    submit();
    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("requires consent", async () => {
    render(<SignUpScreen navigation={navigation} />);
    fill();
    submit();
    expect(await screen.findByText("You must agree to continue.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("registers with trimmed values once consent is given", async () => {
    register.mockResolvedValue({});
    render(<SignUpScreen navigation={navigation} />);
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

  it("can withdraw consent again", async () => {
    render(<SignUpScreen navigation={navigation} />);
    fill();
    agree();
    agree();
    submit();
    expect(await screen.findByText("You must agree to continue.")).toBeTruthy();
  });

  it("shows server errors", async () => {
    register.mockRejectedValue(new Error("Email already registered"));
    render(<SignUpScreen navigation={navigation} />);
    fill();
    agree();
    submit();
    expect(await screen.findByText("Email already registered")).toBeTruthy();
  });

  it("toggles password visibility for both fields", () => {
    render(<SignUpScreen navigation={navigation} />);
    expect(paperInputs()[3].props.secureTextEntry).toBe(true);
    pressRightIcon();
    expect(paperInputs()[2].props.secureTextEntry).toBe(false);
    expect(paperInputs()[3].props.secureTextEntry).toBe(false);
  });

  it("links to sign in", () => {
    render(<SignUpScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("Sign in"));
    expect(navigation.navigate).toHaveBeenCalledWith("SignIn");
  });
});
