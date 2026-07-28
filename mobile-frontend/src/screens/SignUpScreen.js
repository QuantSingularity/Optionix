import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Checkbox, TextInput } from "react-native-paper";
import { AlertBanner } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import colors from "../theme";

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
];

const SignUpScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passedRules = PASSWORD_RULES.filter((r) => r.test(password));

  const handleSubmit = async () => {
    setError("");
    if (!fullName.trim() || !email.trim()) {
      setError("Fill in your name and email.");
      return;
    }
    if (passedRules.length < PASSWORD_RULES.length) {
      setError("Password doesn't meet all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to continue.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>
          Option<Text style={{ color: colors.gold }}>ix</Text>
        </Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Open a free demo account and start exploring the platform in minutes.
        </Text>

        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

        <TextInput
          mode="outlined"
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          right={
            <TextInput.Icon
              icon={showPassword ? "eye-off" : "eye"}
              onPress={() => setShowPassword((s) => !s)}
            />
          }
        />
        {password.length > 0 && (
          <View style={styles.rulesGrid}>
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(password);
              return (
                <Text
                  key={rule.label}
                  style={[styles.ruleText, passed && { color: colors.success }]}
                >
                  {passed ? "✓" : "○"} {rule.label}
                </Text>
              );
            })}
          </View>
        )}
        <TextInput
          mode="outlined"
          label="Confirm password"
          secureTextEntry={!showPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreeTerms((a) => !a)}
          activeOpacity={0.7}
        >
          <Checkbox
            status={agreeTerms ? "checked" : "unchecked"}
            onPress={() => setAgreeTerms((a) => !a)}
            color={colors.primary}
          />
          <Text style={styles.checkboxText}>
            I agree to the Terms of Service and consent to Optionix processing
            my data to provide trading, risk, and compliance services.
          </Text>
        </TouchableOpacity>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitBtn}
          contentStyle={{ height: 48 }}
        >
          Create Account
        </Button>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.switchLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginBottom: 22,
    lineHeight: 19,
  },
  input: {
    marginBottom: 12,
    backgroundColor: colors.surfaceElevated,
  },
  rulesGrid: {
    marginBottom: 12,
    marginTop: -4,
  },
  ruleText: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginBottom: 2,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    marginTop: 4,
  },
  checkboxText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 10,
  },
  submitBtn: {
    borderRadius: 12,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 22,
  },
  switchText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  switchLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});

export default SignUpScreen;
