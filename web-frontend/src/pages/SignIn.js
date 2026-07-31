import { useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiLogIn, FiMail } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Input,
  Label,
} from "../components/common/UI";
import { useAuth } from "../utils/AuthContext";

const SignIn = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = "Email is required.";
    if (!form.password) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(from, { replace: true });
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
          "The market rewards <span>discipline</span>, not intuition. Trade with
          the data on your side."
        </BrandQuote>
        <BrandFeatures>
          <BrandFeature>
            <FiLock /> Bank-grade encryption on every account
          </BrandFeature>
          <BrandFeature>
            <FiLogIn /> Institutional-quality risk & Greeks analytics
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

          <FormTitle>Welcome back</FormTitle>
          <FormSubtitle>
            Sign in to access your dashboard, positions, and live analytics.
          </FormSubtitle>

          {submitError && <Alert $tone="danger">{submitError}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
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
              {errors.email && (
                <ErrorText>
                  <FiMail /> {errors.email}
                </ErrorText>
              )}
            </Field>

            <Field>
              <Label htmlFor="password">Password</Label>
              <div style={{ position: "relative" }}>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
              {errors.password && <ErrorText>{errors.password}</ErrorText>}
            </Field>

            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ width: "100%", marginTop: 6 }}
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <SwitchLine>
            Don't have an account? <Link to="/signup">Create one free</Link>
          </SwitchLine>
        </FormCard>
      </FormSide>
    </Shell>
  );
};

export default SignIn;
