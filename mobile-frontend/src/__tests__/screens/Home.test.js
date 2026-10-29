import { fireEvent, render, screen } from "@testing-library/react-native";
import HomeScreen from "../../screens/HomeScreen";

const navigation = { navigate: jest.fn() };
beforeEach(() => navigation.navigate.mockClear());

describe("HomeScreen", () => {
  it("shows the brand, headline and feature list", () => {
    render(<HomeScreen navigation={navigation} />);
    expect(screen.getByText(/institutional discipline/)).toBeTruthy();
    expect(screen.getByText("Live options analytics")).toBeTruthy();
    expect(screen.getByText("Institutional-grade risk")).toBeTruthy();
    expect(screen.getByText("Built-in compliance")).toBeTruthy();
    [
      "chart-line",
      "shield-check-outline",
      "file-document-check-outline",
    ].forEach((icon) => expect(screen.getByText(icon)).toBeTruthy());
  });

  it("routes the primary action to sign up", () => {
    render(<HomeScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("Get Started Free"));
    expect(navigation.navigate).toHaveBeenCalledWith("SignUp");
  });

  it("routes the secondary action to sign in", () => {
    render(<HomeScreen navigation={navigation} />);
    fireEvent.press(screen.getByText("I already have an account"));
    expect(navigation.navigate).toHaveBeenCalledWith("SignIn");
  });
});
