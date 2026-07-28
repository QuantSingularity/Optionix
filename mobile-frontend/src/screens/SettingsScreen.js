import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ActivityIndicator, Button } from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import CreateAccountPrompt from "../components/CreateAccountPrompt";
import {
  AlertBanner,
  Badge,
  CardHeaderRow,
  CardMeta,
  CardTitle,
  EmptyState,
  Grid2,
  SectionCard,
  StatLabel,
  StatValue,
} from "../components/UI";
import { extractErrorMessage } from "../services/api";
import tradingService from "../services/tradingService";
import colors from "../theme";
import { formatCurrency, formatDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";

const KYC_TONE = {
  verified: "success",
  approved: "success",
  under_review: "warning",
  pending: "neutral",
  rejected: "danger",
};

const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadAccounts = useCallback(async () => {
    setError("");
    try {
      const accts = await tradingService.listAccounts();
      setAccounts(accts);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load your accounts."));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadAccounts();
      setIsLoading(false);
    })();
  }, [loadAccounts]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={styles.title}>Settings</Text>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Profile</CardTitle>
        </CardHeaderRow>
        <Grid2>
          <View style={{ width: "50%", padding: 6 }}>
            <StatLabel style={{ marginBottom: 4 }}>Name</StatLabel>
            <StatValue style={{ fontSize: 14 }}>
              {user?.full_name || "—"}
            </StatValue>
          </View>
          <View style={{ width: "50%", padding: 6 }}>
            <StatLabel style={{ marginBottom: 4 }}>Email</StatLabel>
            <StatValue style={{ fontSize: 13 }}>{user?.email || "—"}</StatValue>
          </View>
          <View style={{ width: "50%", padding: 6 }}>
            <StatLabel style={{ marginBottom: 4 }}>Member since</StatLabel>
            <StatValue style={{ fontSize: 13 }}>
              {formatDate(user?.created_at)}
            </StatValue>
          </View>
          <View style={{ width: "50%", padding: 6 }}>
            <StatLabel style={{ marginBottom: 4 }}>Verified</StatLabel>
            <Badge tone={user?.is_verified ? "success" : "neutral"}>
              {user?.is_verified ? "Verified" : "Unverified"}
            </Badge>
          </View>
        </Grid2>
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Security</CardTitle>
        </CardHeaderRow>
        <View style={styles.securityRow}>
          <StatLabel style={{ marginBottom: 0 }}>KYC status</StatLabel>
          <Badge tone={KYC_TONE[user?.kyc_status] || "neutral"}>
            {user?.kyc_status?.replace("_", " ") || "—"}
          </Badge>
        </View>
        <View style={styles.securityRow}>
          <StatLabel style={{ marginBottom: 0 }}>Two-factor auth</StatLabel>
          <Badge tone={user?.mfa_enabled ? "success" : "neutral"}>
            {user?.mfa_enabled ? "Enabled" : "Not enabled"}
          </Badge>
        </View>
        <View style={styles.securityRow}>
          <StatLabel style={{ marginBottom: 0 }}>Risk score</StatLabel>
          <StatValue style={{ fontSize: 14 }}>
            {user?.risk_score ?? "—"}/100
          </StatValue>
        </View>
        <Button
          mode="outlined"
          onPress={logout}
          textColor={colors.danger}
          style={{
            borderColor: colors.danger,
            borderRadius: 10,
            marginTop: 12,
          }}
          icon="logout"
        >
          Sign out
        </Button>
      </SectionCard>

      <SectionCard>
        <CardHeaderRow>
          <CardTitle>Trading Accounts</CardTitle>
          <CardMeta>{accounts.length} total</CardMeta>
        </CardHeaderRow>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : accounts.length > 0 ? (
          accounts.map((a) => (
            <View key={a.account_id} style={styles.accountRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountType}>{a.account_type}</Text>
                <Text style={styles.accountId}>
                  {a.account_id.slice(0, 12)}…
                </Text>
              </View>
              <Text style={styles.accountBalance}>
                {formatCurrency(a.balance_usd)}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="briefcase-outline"
                size={26}
                color={colors.borderAccent}
              />
            }
            title="No trading accounts"
          />
        )}

        <Button
          mode="text"
          onPress={() => setShowCreate((s) => !s)}
          style={{ marginTop: 8 }}
        >
          {showCreate ? "Cancel" : "+ New Account"}
        </Button>

        {showCreate && (
          <View style={{ marginTop: 8 }}>
            <CreateAccountPrompt
              onCreated={() => {
                setShowCreate(false);
                loadAccounts();
              }}
            />
          </View>
        )}
      </SectionCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  securityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountType: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  accountId: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  accountBalance: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default SettingsScreen;
