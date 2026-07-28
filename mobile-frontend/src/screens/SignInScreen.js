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
import { Button, TextInput } from "react-native-paper";
import { AlertBanner } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import colors from "../theme";

const SignInScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // RootNavigator swaps to the main tabs automatically once isAuthenticated flips.
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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to access your dashboard, positions, and live analytics.
        </Text>

        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}

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

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitBtn}
          contentStyle={{ height: 48 }}
        >
          Sign In
        </Button>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.switchLink}>Create one free</Text>
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
    justifyContent: "center",
    padding: 24,
  },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 28,
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
    marginBottom: 24,
    lineHeight: 19,
  },
  input: {
    marginBottom: 14,
    backgroundColor: colors.surfaceElevated,
  },
  submitBtn: {
    borderRadius: 12,
    marginTop: 6,
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

export default SignInScreen;
