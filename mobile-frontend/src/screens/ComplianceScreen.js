import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  SegmentedButtons,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import {
  AlertBanner,
  Badge,
  CardHeaderRow,
  CardMeta,
  CardTitle,
  EmptyState,
  Grid2,
  Screen,
  SectionCard,
  StatLabel,
  StatValue,
} from "../components/UI";
import complianceService from "../services/complianceService";
import { extractErrorMessage } from "../services/api";
import colors from "../theme";
import { useAuth } from "../context/AuthContext";

const KYC_TONE = {
  verified: "success",
  approved: "success",
  under_review: "warning",
  pending: "neutral",
  rejected: "danger",
};
const COMPLIANCE_TONE = {
  compliant: "success",
  under_review: "warning",
  pending: "neutral",
  non_compliant: "danger",
};

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "kyc", label: "KYC" },
];

const emptyKyc = {
  fullName: "",
  dateOfBirth: "",
  nationality: "",
  street: "",
  city: "",
  postalCode: "",
  country: "",
  documentNumber: "",
  documentCountry: "",
  documentExpiry: "",
};

const ComplianceScreen = () => {
  const { refreshProfile } = useAuth();
  const [tab, setTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [status, setStatus] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [amlAlerts, setAmlAlerts] = useState([]);
  const [sanctionsResult, setSanctionsResult] = useState(null);
  const [sanctionsLoading, setSanctionsLoading] = useState(false);

  const [kycForm, setKycForm] = useState(emptyKyc);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycMessage, setKycMessage] = useState("");

  const loadAll = useCallback(async () => {
    setError("");
    try {
      const [st, kyc, aml] = await Promise.all([
        complianceService.getOverallStatus(),
        complianceService.getKycStatus(),
        complianceService.getAmlAlerts({ limit: 10 }),
      ]);
      setStatus(st);
      setKycStatus(kyc);
      setAmlAlerts(aml.alerts || []);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load compliance data."));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadAll();
      setIsLoading(false);
    })();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const runSanctionsCheck = async () => {
    setSanctionsLoading(true);
    try {
      const data = await complianceService.runSanctionsCheck();
      setSanctionsResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Sanctions check failed."));
    } finally {
      setSanctionsLoading(false);
    }
  };

  const updateKyc = (k) => (v) => setKycForm((f) => ({ ...f, [k]: v }));

  const submitKyc = async () => {
    setKycMessage("");
    setKycSubmitting(true);
    try {
      await complianceService.submitKyc({
        fullName: kycForm.fullName,
        dateOfBirth: kycForm.dateOfBirth,
        nationality: kycForm.nationality,
        address: {
          street: kycForm.street,
          city: kycForm.city,
          postal_code: kycForm.postalCode,
          country: kycForm.country,
        },
        documentType: "passport",
        documentNumber: kycForm.documentNumber,
        documentCountry: kycForm.documentCountry,
        documentExpiry: kycForm.documentExpiry,
      });
      setKycMessage("Submitted. Review typically takes 1-3 business days.");
      setKycForm(emptyKyc);
      await loadAll();
      await refreshProfile();
    } catch (err) {
      setKycMessage(extractErrorMessage(err, "Couldn't submit KYC documents."));
    } finally {
      setKycSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </Screen>
    );
  }

  const alreadyApproved = kycStatus?.kyc_status === "approved";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Compliance</Text>
      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        buttons={TABS}
        style={styles.tabs}
      />

      {tab === "overview" && (
        <>
          <Grid2>
            <View style={{ width: "50%", padding: 6 }}>
              <View style={styles.miniStat}>
                <StatLabel style={{ marginBottom: 4 }}>Compliance</StatLabel>
                <Badge tone={COMPLIANCE_TONE[status?.status] || "neutral"}>
                  {status?.status?.replace("_", " ") || "—"}
                </Badge>
              </View>
            </View>
            <View style={{ width: "50%", padding: 6 }}>
              <View style={styles.miniStat}>
                <StatLabel style={{ marginBottom: 4 }}>KYC Status</StatLabel>
                <Badge tone={KYC_TONE[kycStatus?.kyc_status] || "neutral"}>
                  {kycStatus?.kyc_status?.replace("_", " ") || "—"}
                </Badge>
              </View>
            </View>
          </Grid2>

          <SectionCard>
            <CardHeaderRow>
              <CardTitle>Sanctions Screening</CardTitle>
            </CardHeaderRow>
            <Button
              mode="contained"
              onPress={runSanctionsCheck}
              loading={sanctionsLoading}
              disabled={sanctionsLoading}
              style={styles.submitBtn}
            >
              Run Sanctions Check
            </Button>
            {sanctionsResult && (
              <AlertBanner
                tone={sanctionsResult.matches_found ? "danger" : "success"}
              >
                {sanctionsResult.matches_found
                  ? "Potential matches found."
                  : "No matches found across all screened lists."}
              </AlertBanner>
            )}
          </SectionCard>

          <SectionCard>
            <CardHeaderRow>
              <CardTitle>AML Alerts</CardTitle>
              <CardMeta>{amlAlerts.length} total</CardMeta>
            </CardHeaderRow>
            {amlAlerts.length > 0 ? (
              amlAlerts.map((a) => (
                <View key={a.alert_id} style={styles.alertRow}>
                  <Text style={styles.alertType}>{a.alert_type}</Text>
                  <Badge tone="warning">{a.status}</Badge>
                </View>
              ))
            ) : (
              <EmptyState
                icon={
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={26}
                    color={colors.borderAccent}
                  />
                }
                title="No active alerts"
              />
            )}
          </SectionCard>
        </>
      )}

      {tab === "kyc" && (
        <SectionCard>
          {alreadyApproved ? (
            <AlertBanner tone="success">
              Your identity has already been verified.
            </AlertBanner>
          ) : (
            <>
              {kycMessage ? (
                <AlertBanner
                  tone={
                    kycMessage.startsWith("Submitted") ? "success" : "danger"
                  }
                >
                  {kycMessage}
                </AlertBanner>
              ) : null}
              <TextInput
                mode="outlined"
                label="Full legal name"
                value={kycForm.fullName}
                onChangeText={updateKyc("fullName")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Date of birth (YYYY-MM-DD)"
                value={kycForm.dateOfBirth}
                onChangeText={updateKyc("dateOfBirth")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Nationality (e.g. US)"
                autoCapitalize="characters"
                maxLength={2}
                value={kycForm.nationality}
                onChangeText={updateKyc("nationality")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Street address"
                value={kycForm.street}
                onChangeText={updateKyc("street")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="City"
                value={kycForm.city}
                onChangeText={updateKyc("city")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Postal code"
                value={kycForm.postalCode}
                onChangeText={updateKyc("postalCode")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Country (e.g. US)"
                autoCapitalize="characters"
                maxLength={2}
                value={kycForm.country}
                onChangeText={updateKyc("country")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Passport number"
                value={kycForm.documentNumber}
                onChangeText={updateKyc("documentNumber")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Document country (e.g. US)"
                autoCapitalize="characters"
                maxLength={2}
                value={kycForm.documentCountry}
                onChangeText={updateKyc("documentCountry")}
                style={styles.input}
              />
              <TextInput
                mode="outlined"
                label="Document expiry (YYYY-MM-DD)"
                value={kycForm.documentExpiry}
                onChangeText={updateKyc("documentExpiry")}
                style={styles.input}
              />
              <Button
                mode="contained"
                onPress={submitKyc}
                loading={kycSubmitting}
                disabled={kycSubmitting}
                style={styles.submitBtn}
              >
                Submit for Verification
              </Button>
            </>
          )}

          <View style={{ marginTop: 18 }}>
            <StatLabel>Documents submitted</StatLabel>
            <StatValue style={{ fontSize: 15 }}>
              {kycStatus?.documents_submitted ?? 0}
            </StatValue>
          </View>
        </SectionCard>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: { justifyContent: "center", alignItems: "center" },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  tabs: { marginBottom: 14 },
  miniStat: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  submitBtn: { borderRadius: 10, marginBottom: 8 },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  alertType: { color: colors.textPrimary, fontSize: 13 },
  input: { marginBottom: 12, backgroundColor: colors.surfaceElevated },
});

export default ComplianceScreen;
