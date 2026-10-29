import { NavigationContainer } from "@react-navigation/native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import AuthNavigator from "../../navigation/AuthNavigator";

jest.mock("../../screens/HomeScreen", () => {
  const { Text: T, Pressable: P } = require("react-native");
  const HomeScreen = ({ navigation }) => (
    <>
      <T>HomeScreen</T>
      <P onPress={() => navigation.navigate("SignIn")}>
        <T>go-signin</T>
      </P>
      <P onPress={() => navigation.navigate("SignUp")}>
        <T>go-signup</T>
      </P>
    </>
  );
  return HomeScreen;
});
jest.mock("../../screens/SignInScreen", () => {
  const { Text: T } = require("react-native");
  const SignInScreen = () => <T>SignInScreen</T>;
  return SignInScreen;
});
jest.mock("../../screens/SignUpScreen", () => {
  const { Text: T } = require("react-native");
  const SignUpScreen = () => <T>SignUpScreen</T>;
  return SignUpScreen;
});

const mount = () =>
  render(
    <NavigationContainer>
      <AuthNavigator />
    </NavigationContainer>,
  );

describe("AuthNavigator", () => {
  it("starts on the Home screen", async () => {
    mount();
    expect(await screen.findByText("HomeScreen")).toBeTruthy();
    expect(screen.queryByText("SignInScreen")).toBeNull();
  });

  it("navigates to Sign in", async () => {
    mount();
    fireEvent.press(await screen.findByText("go-signin"));
    expect(await screen.findByText("SignInScreen")).toBeTruthy();
  });

  it("navigates to Sign up", async () => {
    mount();
    fireEvent.press(await screen.findByText("go-signup"));
    expect(await screen.findByText("SignUpScreen")).toBeTruthy();
  });
});
