import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { extractErrorMessage } from "../services/api";
import tradingService from "../services/tradingService";
import colors from "../theme";
import { generateEthereumAddress } from "../utils/format";
import { AlertBanner, SectionCard } from "./UI";

const CreateAccountPrompt = ({ onCreated }) => {
  const [address, setAddress] = useState(generateEthereumAddress());
  const [initialDeposit, setInitialDeposit] = useState("100000");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const account = await tradingService.createAccount({
        ethereumAddress: address,
        accountType: "demo",
        initialDeposit: initialDeposit ? Number(initialDeposit) : undefined,
      });
      onCreated?.(account);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't create the account."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard>
      <Text style={styles.title}>Open your trading account</Text>
      <Text style={styles.subtitle}>
        One quick step before you can trade, size positions, or run risk
        reports.
      </Text>

      {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

      <TextInput
        mode="outlined"
        label="Initial deposit (USD)"
        keyboardType="numeric"
        value={initialDeposit}
        onChangeText={setInitialDeposit}
        style={styles.input}
      />
      <View style={styles.addressRow}>
        <TextInput
          mode="outlined"
          label="Wallet address"
          value={address}
          onChangeText={setAddress}
          style={[styles.input, { flex: 1 }]}
        />
        <Button
          mode="outlined"
          onPress={() => setAddress(generateEthereumAddress())}
          style={styles.regenBtn}
        >
          New
        </Button>
      </View>
      <Text style={styles.helpText}>
        Auto-generated for demo accounts. Replace it with your own wallet if you
        have one.
      </Text>

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.submitBtn}
      >
        Open Account
      </Button>
    </SectionCard>
  );
};

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    marginBottom: 10,
    backgroundColor: colors.surfaceElevated,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  regenBtn: {
    marginTop: 6,
  },
  helpText: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
    marginBottom: 16,
  },
  submitBtn: {
    borderRadius: 10,
  },
});

export default CreateAccountPrompt;
