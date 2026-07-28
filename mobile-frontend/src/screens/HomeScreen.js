import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import colors from "../theme";

const FEATURES = [
  {
    icon: "chart-line",
    title: "Live options analytics",
    desc: "Black-Scholes & Monte Carlo pricing, Greeks, and implied volatility in real time.",
  },
  {
    icon: "shield-check-outline",
    title: "Institutional-grade risk",
    desc: "Value-at-Risk, stress testing, and circuit breakers on every position.",
  },
  {
    icon: "file-document-check-outline",
    title: "Built-in compliance",
    desc: "KYC, sanctions screening, and audit-ready regulatory reporting.",
  },
];

const HomeScreen = ({ navigation }) => (
  <View style={styles.container}>
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.logoRow}>
        <Text style={styles.logo}>
          Option<Text style={styles.logoAccent}>ix</Text>
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          Trade options with{" "}
          <Text style={styles.heroAccent}>institutional discipline</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          Real-time pricing, portfolio risk, and compliance tooling — all in one
          platform.
        </Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons
                name={f.icon}
                size={22}
                color={colors.gold}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>

    <View style={styles.actions}>
      <Button
        mode="contained"
        onPress={() => navigation.navigate("SignUp")}
        style={styles.primaryBtn}
        contentStyle={styles.btnContent}
        labelStyle={styles.primaryBtnLabel}
      >
        Get Started Free
      </Button>
      <Button
        mode="outlined"
        onPress={() => navigation.navigate("SignIn")}
        style={styles.secondaryBtn}
        contentStyle={styles.btnContent}
        textColor={colors.textPrimary}
      >
        I already have an account
      </Button>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoRow: {
    marginBottom: 36,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: colors.gold,
  },
  hero: {
    marginBottom: 36,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 38,
  },
  heroAccent: {
    color: colors.gold,
    fontStyle: "italic",
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 14,
    lineHeight: 22,
  },
  features: {
    gap: 16,
  },
  featureCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(212,175,106,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: "700",
    marginBottom: 4,
  },
  featureDesc: {
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  actions: {
    padding: 24,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryBtn: {
    borderRadius: 12,
  },
  primaryBtnLabel: {
    fontWeight: "700",
  },
  secondaryBtn: {
    borderRadius: 12,
    borderColor: colors.border,
  },
  btnContent: {
    height: 48,
  },
});

export default HomeScreen;
