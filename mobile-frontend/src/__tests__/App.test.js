import { render, screen } from "@testing-library/react-native";
import App from "../../App";
import { useAuth } from "../context/AuthContext";

jest.mock("../context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: jest.fn(),
}));
jest.mock("../context/WalletContext", () => ({
  WalletProvider: ({ children }) => children,
}));
jest.mock("../navigation/AuthNavigator", () => {
  const { Text } = require("react-native");
  const AuthNavigator = () => <Text>AuthNavigator</Text>;
  return AuthNavigator;
});
jest.mock("../navigation/AppNavigator", () => {
  const { Text } = require("react-native");
  const MainNavigator = () => <Text>MainNavigator</Text>;
  return MainNavigator;
});

const auth = (o) =>
  useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, ...o });

describe("App", () => {
  it("shows a spinner while the session is restored", () => {
    auth({ isLoading: true });
    render(<App />);
    expect(screen.queryByText("AuthNavigator")).toBeNull();
    expect(screen.queryByText("MainNavigator")).toBeNull();
    expect(
      screen.UNSAFE_getByType(require("react-native").ActivityIndicator),
    ).toBeTruthy();
  });

  it("shows the auth flow to signed-out users", () => {
    auth({});
    render(<App />);
    expect(screen.getByText("AuthNavigator")).toBeTruthy();
    expect(screen.queryByText("MainNavigator")).toBeNull();
  });

  it("shows the main app to signed-in users", () => {
    auth({ isAuthenticated: true });
    render(<App />);
    expect(screen.getByText("MainNavigator")).toBeTruthy();
    expect(screen.queryByText("AuthNavigator")).toBeNull();
  });
});
