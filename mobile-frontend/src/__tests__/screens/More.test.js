import { fireEvent, render, screen } from "@testing-library/react-native";
import MoreScreen from "../../screens/MoreScreen";
import { useAuth } from "../../context/AuthContext";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const navigation = { navigate: jest.fn() };
const logout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    user: { full_name: "ada lovelace", email: "ada@example.com" },
    logout,
  });
});

describe("MoreScreen", () => {
  it("shows the user's initial, name and email", () => {
    render(<MoreScreen navigation={navigation} />);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("ada lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
  });

  it("falls back to a generic identity", () => {
    useAuth.mockReturnValue({ user: null, logout });
    render(<MoreScreen navigation={navigation} />);
    expect(screen.getByText("U")).toBeTruthy();
    expect(screen.getByText("Trader")).toBeTruthy();
  });

  it.each([
    ["Wallet", "Connect a wallet, manage on-chain margin", "Wallet"],
    ["Risk Management", "VaR, stress tests, circuit breakers", "Risk"],
    ["Compliance", "KYC, sanctions, AML alerts", "Compliance"],
    ["Settings", "Profile, accounts, security", "SettingsScreen"],
  ])("lists %s and navigates to %s", (title, desc, route) => {
    render(<MoreScreen navigation={navigation} />);
    expect(screen.getByText(desc)).toBeTruthy();
    fireEvent.press(screen.getByText(title));
    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });

  it("signs out", () => {
    render(<MoreScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("Sign out"));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
