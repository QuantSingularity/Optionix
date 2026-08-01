import { useState } from "react";
import {
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiShield,
  FiZap,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import {
  BackHome,
  BackHomeIcon,
  Brand,
  BrandFeature,
  BrandFeatures,
  BrandLogo,
  BrandQuote,
  FormCard,
  FormSide,
  FormSubtitle,
  FormTitle,
  MobileLogo,
  Shell,
  SwitchLine,
} from "../components/common/AuthShell";
import {
  Alert,
  Button,
  ErrorText,
  Field,
  HelpText,
  Input,
  Label,
} from "../components/common/UI";
import { useAuth } from "../utils/AuthContext";

// Mirrors the backend's validate_password_strength check exactly
// (app/security.py) so a password that passes here is guaranteed
// to pass server-side validation too.
const SEQUENTIAL_PATTERNS = [
  /(.)\1{3,}/,
  /(0123|1234|2345|3456|4567|5678|6789|7890)/,
  /(abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/,
];
const hasSequentialPattern = (p) =>
  SEQUENTIAL_PATTERNS.some((re) => re.test(p.toLowerCase()));

const PASSWORD_RULES = [
  { test: (p) => p.length >= 12, label: "At least 12 characters" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One special character" },
  {
    test: (p) => p.length > 0 && !hasSequentialPattern(p),
    label: "No repeated or sequential characters",
  },
];

const SignUp = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const passedRules = PASSWORD_RULES.filter((r) => r.test(form.password));

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    else if (!/^[a-zA-Z\s'-]{2,100}$/.test(form.fullName.trim()))
      next.fullName = "Use letters, spaces, hyphens or apostrophes only.";
    if (!form.email.trim()) next.email = "Email is required.";
    if (passedRules.length < PASSWORD_RULES.length)
      next.password = "Password doesn't meet all requirements.";
    if (form.password !== form.confirmPassword)
      next.confirmPassword = "Passwords don't match.";
    if (!form.agreeTerms) next.agreeTerms = "You must agree to continue.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Shell>
      <Brand>
        <BrandLogo to="/">
          Option<span>ix</span>
        </BrandLogo>
        <BrandQuote>
          "Give every trade the same <span>rigor</span> an institutional desk
          would. That's the whole idea."
        </BrandQuote>
        <BrandFeatures>
          <BrandFeature>
            <FiShield /> KYC-ready compliance tooling built in
          </BrandFeature>
          <BrandFeature>
            <FiZap /> Live Greeks, VaR, and stress testing
          </BrandFeature>
        </BrandFeatures>
      </Brand>

      <FormSide>
        <FormCard>
          <MobileLogo to="/">
            Option<span>ix</span>
          </MobileLogo>
          <BackHome to="/">
            <BackHomeIcon /> Back to home
          </BackHome>

          <FormTitle>Create your account</FormTitle>
          <FormSubtitle>
            Open a free demo account and start exploring the platform in
            minutes.
          </FormSubtitle>

          {submitError && <Alert $tone="danger">{submitError}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            <Field>
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Jane Trader"
                value={form.fullName}
                onChange={update("fullName")}
              />
              {errors.fullName && <ErrorText>{errors.fullName}</ErrorText>}
            </Field>

            <Field>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update("email")}
              />
              {errors.email && <ErrorText>{errors.email}</ErrorText>}
            </Field>

            <Field>
              <Label htmlFor="password">Password</Label>
              <div style={{ position: "relative" }}>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update("password")}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                  }}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px 12px",
                    marginTop: 4,
                  }}
                >
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(form.password);
                    return (
                      <HelpText
                        key={rule.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          color: passed ? "var(--success)" : undefined,
                        }}
                      >
                        <FiCheckCircle
                          size={12}
                          style={{ opacity: passed ? 1 : 0.35 }}
                        />
                        {rule.label}
                      </HelpText>
                    );
                  })}
                </div>
              )}
              {errors.password && <ErrorText>{errors.password}</ErrorText>}
            </Field>

            <Field>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={update("confirmPassword")}
              />
              {errors.confirmPassword && (
                <ErrorText>{errors.confirmPassword}</ErrorText>
              )}
            </Field>

            <Field style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  lineHeight: 1.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.agreeTerms}
                  onChange={update("agreeTerms")}
                  style={{ marginTop: 3, accentColor: "#c6a15b" }}
                />
                I agree to the Terms of Service and consent to Optionix
                processing my data to provide trading, risk, and compliance
                services.
              </label>
              {errors.agreeTerms && <ErrorText>{errors.agreeTerms}</ErrorText>}
            </Field>

            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ width: "100%" }}
            >
              {isSubmitting ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <SwitchLine>
            Already have an account? <Link to="/login">Sign in</Link>
          </SwitchLine>
        </FormCard>
      </FormSide>
    </Shell>
  );
};

export default SignUp;
