import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import colors from "../theme";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import ComplianceScreen from "../screens/ComplianceScreen";
import DashboardScreen from "../screens/DashboardScreen";
import MoreScreen from "../screens/MoreScreen";
import PortfolioScreen from "../screens/PortfolioScreen";
import RiskScreen from "../screens/RiskScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TradingScreen from "../screens/TradingScreen";

import WalletScreen from "../screens/WalletScreen";

const Tab = createBottomTabNavigator();
const MoreStack = createStackNavigator();

const headerOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
    shadowColor: "transparent",
    elevation: 0,
  },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: "700" },
};

const MoreStackNavigator = () => (
  <MoreStack.Navigator screenOptions={headerOptions}>
    <MoreStack.Screen
      name="MoreMenu"
      component={MoreScreen}
      options={{ title: "More" }}
    />
    <MoreStack.Screen
      name="Wallet"
      component={WalletScreen}
      options={{ title: "Wallet" }}
    />
    <MoreStack.Screen
      name="Risk"
      component={RiskScreen}
      options={{ title: "Risk Management" }}
    />
    <MoreStack.Screen
      name="Compliance"
      component={ComplianceScreen}
      options={{ title: "Compliance" }}
    />
    <MoreStack.Screen
      name="SettingsScreen"
      component={SettingsScreen}
      options={{ title: "Settings" }}
    />
  </MoreStack.Navigator>
);

const ICONS = {
  Dashboard: ["view-dashboard", "view-dashboard-outline"],
  Trading: ["swap-horizontal-bold", "swap-horizontal"],
  Portfolio: ["briefcase", "briefcase-outline"],
  Analytics: ["chart-line", "chart-line-variant"],
  More: ["dots-horizontal-circle", "dots-horizontal-circle-outline"],
};

const MainNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        const [on, off] = ICONS[route.name] || ["circle", "circle-outline"];
        return (
          <MaterialCommunityIcons
            name={focused ? on : off}
            size={size}
            color={color}
          />
        );
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        height: 60,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      headerShown: true,
      ...headerOptions,
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Trading" component={TradingScreen} />
    <Tab.Screen name="Portfolio" component={PortfolioScreen} />
    <Tab.Screen name="Analytics" component={AnalyticsScreen} />
    <Tab.Screen
      name="More"
      component={MoreStackNavigator}
      options={{ headerShown: false }}
    />
  </Tab.Navigator>
);

export default MainNavigator;
