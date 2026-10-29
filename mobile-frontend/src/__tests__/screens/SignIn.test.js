import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { paperInputs, pressRightIcon, typeInto } from "../../testUtils/paper";
import SignInScreen from "../../screens/SignInScreen";
import { useAuth } from "../../context/AuthContext";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const login = jest.fn();
const navigation = { navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ login });
});

const fill = (email, password) => {
  typeInto(0, email);
  typeInto(1, password);
};

describe("SignInScreen", () => {
  it("renders the form with a hidden password", () => {
    render(<SignInScreen navigation={navigation} />);
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(paperInputs()[1].props.secureTextEntry).toBe(true);
  });

  it("requires both fields before calling the API", async () => {
    render(<SignInScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("Sign In"));
    expect(
      await screen.findByText("Enter your email and password."),
    ).toBeTruthy();
    fill("a@b.co", "");
    fireEvent.press(screen.getByText("Sign In"));
    expect(login).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only email as empty", async () => {
    render(<SignInScreen navigation={navigation} />);
    fill("   ", "pw");
    fireEvent.press(screen.getByText("Sign In"));
    expect(
      await screen.findByText("Enter your email and password."),
    ).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in with a trimmed email", async () => {
    login.mockResolvedValue({});
    render(<SignInScreen navigation={navigation} />);
    fill("  ada@example.com ", "Secret123!");
    fireEvent.press(screen.getByText("Sign In"));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "Secret123!",
      }),
    );
  });

  it("shows the error when sign in fails, and clears it on retry", async () => {
    login.mockRejectedValueOnce(new Error("Invalid credentials"));
    render(<SignInScreen navigation={navigation} />);
    fill("a@b.co", "bad");
    fireEvent.press(screen.getByText("Sign In"));
    expect(await screen.findByText("Invalid credentials")).toBeTruthy();

    login.mockResolvedValueOnce({});
    fireEvent.press(screen.getByText("Sign In"));
    await waitFor(() =>
      expect(screen.queryByText("Invalid credentials")).toBeNull(),
    );
  });

  it("toggles password visibility", () => {
    render(<SignInScreen navigation={navigation} />);
    pressRightIcon();
    expect(paperInputs()[1].props.secureTextEntry).toBe(false);
  });

  it("links to registration", () => {
    render(<SignInScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("Create one free"));
    expect(navigation.navigate).toHaveBeenCalledWith("SignUp");
  });
});
