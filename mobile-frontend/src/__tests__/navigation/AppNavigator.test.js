import { NavigationContainer } from "@react-navigation/native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import MainNavigator from "../../navigation/AppNavigator";

jest.mock("../../screens/DashboardScreen", () =>
  require("../../testUtils/mockScreen")("DashboardScreen"),
);
jest.mock("../../screens/TradingScreen", () =>
  require("../../testUtils/mockScreen")("TradingScreen"),
);
jest.mock("../../screens/PortfolioScreen", () =>
  require("../../testUtils/mockScreen")("PortfolioScreen"),
);
jest.mock("../../screens/AnalyticsScreen", () =>
  require("../../testUtils/mockScreen")("AnalyticsScreen"),
);
jest.mock("../../screens/MoreScreen", () =>
  require("../../testUtils/mockScreen")("MoreScreen", [
    "Wallet",
    "Risk",
    "Compliance",
    "SettingsScreen",
  ]),
);
jest.mock("../../screens/WalletScreen", () =>
  require("../../testUtils/mockScreen")("WalletScreen"),
);
jest.mock("../../screens/RiskScreen", () =>
  require("../../testUtils/mockScreen")("RiskScreen"),
);
jest.mock("../../screens/ComplianceScreen", () =>
  require("../../testUtils/mockScreen")("ComplianceScreen"),
);
jest.mock("../../screens/SettingsScreen", () =>
  require("../../testUtils/mockScreen")("SettingsScreen"),
);

const mount = () =>
  render(
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>,
  );

describe("MainNavigator", () => {
  it("opens on the Dashboard", async () => {
    mount();
    expect(await screen.findByText("DashboardScreen")).toBeTruthy();
  });

  it("shows all five tabs", async () => {
    mount();
    await screen.findByText("DashboardScreen");
    ["Dashboard", "Trading", "Portfolio", "Analytics", "More"].forEach((tab) =>
      expect(screen.getAllByText(tab).length).toBeGreaterThanOrEqual(1),
    );
  });

  it("uses the filled icon for the active tab and outline for the others", async () => {
    mount();
    await screen.findByText("DashboardScreen");
    expect(screen.getByText("view-dashboard")).toBeTruthy();
    expect(screen.getByText("swap-horizontal")).toBeTruthy();
    expect(screen.getByText("briefcase-outline")).toBeTruthy();
    expect(screen.getByText("chart-line-variant")).toBeTruthy();
    expect(screen.getByText("dots-horizontal-circle-outline")).toBeTruthy();
  });

  it.each([
    ["Trading", "TradingScreen"],
    ["Portfolio", "PortfolioScreen"],
    ["Analytics", "AnalyticsScreen"],
    ["More", "MoreScreen"],
  ])("switches to the %s tab", async (tab, content) => {
    mount();
    await screen.findByText("DashboardScreen");
    fireEvent.press(screen.getAllByText(tab)[0]);
    expect(await screen.findByText(content)).toBeTruthy();
  });

  it.each(["Wallet", "Risk", "Compliance", "SettingsScreen"])(
    "pushes %s from the More menu",
    async (route) => {
      mount();
      await screen.findByText("DashboardScreen");
      fireEvent.press(screen.getAllByText("More")[0]);
      fireEvent.press(await screen.findByText(`open-${route}`));
      const label =
        route === "SettingsScreen" ? "SettingsScreen" : `${route}Screen`;
      expect(await screen.findByText(label)).toBeTruthy();
    },
  );
});
