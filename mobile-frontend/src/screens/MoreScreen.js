import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import colors from "../theme";
import { useAuth } from "../context/AuthContext";

const ITEMS = [
  {
    icon: "wallet-outline",
    title: "Wallet",
    desc: "Connect a wallet, manage on-chain margin",
    screen: "Wallet",
  },
  {
    icon: "shield-outline",
    title: "Risk Management",
    desc: "VaR, stress tests, circuit breakers",
    screen: "Risk",
  },
  {
    icon: "clipboard-check-outline",
    title: "Compliance",
    desc: "KYC, sanctions, AML alerts",
    screen: "Compliance",
  },
  {
    icon: "cog-outline",
    title: "Settings",
    desc: "Profile, accounts, security",
    screen: "SettingsScreen",
  },
];

const MoreScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.full_name || "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.full_name || "Trader"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.item}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <View style={styles.itemIcon}>
            <MaterialCommunityIcons
              name={item.icon}
              size={20}
              color={colors.gold}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemDesc}>{item.desc}</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.logoutRow}
        onPress={logout}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  email: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(212,175,106,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  itemDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginTop: 8,
  },
  logoutText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
});

export default MoreScreen;
