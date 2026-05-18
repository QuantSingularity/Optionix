import { useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiLock,
  FiMail,
  FiUser,
} from "react-icons/fi";
import { Link, Navigate, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { useAuth } from "../utils/AuthContext";

const fadeIn = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`;

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  background: #0b0e17;
  position: relative;
  overflow: hidden;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(
      ellipse 80% 80% at 50% 50%,
      black 30%,
      transparent 100%
    );
  }
`;

const GlowLeft = styled.div`
  position: absolute;
  top: -10%;
  left: -5%;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.1);
  filter: blur(90px);
  pointer-events: none;
`;
const GlowRight = styled.div`
  position: absolute;
  bottom: -10%;
  right: -5%;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.08);
  filter: blur(80px);
  pointer-events: none;
`;

const Card = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 460px;
  margin: auto;
  padding: 48px 44px;
  background: rgba(17, 24, 39, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  animation: ${fadeIn} 0.5s ease both;

  @media (max-width: 520px) {
    padding: 36px 24px;
    margin: 24px;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 32px;
  transition: color 0.2s;
  &:hover {
    color: #94a3b8;
  }
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: 36px;
`;
const LogoText = styled.div`
  font-family: "Syne", sans-serif;
  font-size: 26px;
  font-weight: 800;
  color: #3b82f6;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
  span {
    color: #f97316;
  }
`;
const LogoSub = styled.p`
  color: #64748b;
  font-size: 14px;
`;

const Tabs = styled.div`
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 32px;
  gap: 4px;
`;
const Tab = styled.button`
  flex: 1;
  padding: 9px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  font-family: "DM Sans", sans-serif;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  ${(p) =>
    p.$active
      ? `background:#3b82f6;color:#fff;box-shadow:0 2px 12px rgba(59,130,246,.4);`
      : `background:transparent;color:#64748b;&:hover{color:#94a3b8;}`}
`;

const Field = styled.div`
  margin-bottom: 20px;
`;
const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
`;
const InputWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;
const InputIcon = styled.div`
  position: absolute;
  left: 14px;
  color: #475569;
  font-size: 16px;
  display: flex;
  align-items: center;
  pointer-events: none;
`;
const Input = styled.input`
  width: 100%;
  padding: 12px 14px 12px 42px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #f1f5f9;
  font-size: 14px;
  transition: all 0.2s;
  &:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.5);
    background: rgba(59, 130, 246, 0.05);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
  }
  &::placeholder {
    color: #334155;
  }
`;

const ErrorBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 20px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  color: #f87171;
  font-size: 13.5px;
  line-height: 1.5;
  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
`;

const SubmitBtn = styled.button`
  width: 100%;
  padding: 14px;
  margin-top: 4px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-family: "DM Sans", sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(59, 130, 246, 0.45);
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.07);
  }
  span {
    color: #334155;
    font-size: 12px;
    white-space: nowrap;
  }
`;

const DemoBtn = styled.button`
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #64748b;
  font-family: "DM Sans", sans-serif;
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.2s;
  strong {
    color: #3b82f6;
  }
  &:hover {
    background: rgba(59, 130, 246, 0.06);
    border-color: rgba(59, 130, 246, 0.2);
    color: #94a3b8;
  }
`;

const Login = () => {
  const [tab, setTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const { login, register, loading, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result =
      tab === "signin"
        ? await login(email, password)
        : await register(email, password, fullName);
    if (result.success) navigate("/dashboard");
  };

  const fillDemo = () => {
    setEmail("demo@optionix.com");
    setPassword("demo123");
    setTab("signin");
  };

  return (
    <Page>
      <GlowLeft />
      <GlowRight />
      <Card>
        <BackLink to="/">
          <FiArrowLeft /> Back to home
        </BackLink>

        <Logo>
          <LogoText>
            Option<span>ix</span>
          </LogoText>
          <LogoSub>
            {tab === "signin"
              ? "Welcome back — sign in to continue"
              : "Create your free account"}
          </LogoSub>
        </Logo>

        <Tabs>
          <Tab $active={tab === "signin"} onClick={() => setTab("signin")}>
            Sign In
          </Tab>
          <Tab $active={tab === "register"} onClick={() => setTab("register")}>
            Register
          </Tab>
        </Tabs>

        <form onSubmit={handleSubmit}>
          {tab === "register" && (
            <Field>
              <Label>Full Name</Label>
              <InputWrap>
                <InputIcon>
                  <FiUser />
                </InputIcon>
                <Input
                  type="text"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </InputWrap>
            </Field>
          )}

          <Field>
            <Label>Email Address</Label>
            <InputWrap>
              <InputIcon>
                <FiMail />
              </InputIcon>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </InputWrap>
          </Field>

          <Field>
            <Label>Password</Label>
            <InputWrap>
              <InputIcon>
                <FiLock />
              </InputIcon>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </InputWrap>
          </Field>

          {error && (
            <ErrorBox>
              <FiAlertCircle size={16} />
              <span>{error}</span>
            </ErrorBox>
          )}

          <SubmitBtn type="submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : tab === "signin"
                ? "Sign In to Dashboard"
                : "Create Account"}
          </SubmitBtn>
        </form>

        <Divider>
          <span>or try the demo</span>
        </Divider>

        <DemoBtn type="button" onClick={fillDemo}>
          <strong>Demo account:</strong> &nbsp;demo@optionix.com &nbsp;/&nbsp;
          demo123
        </DemoBtn>
      </Card>
    </Page>
  );
};

export default Login;
