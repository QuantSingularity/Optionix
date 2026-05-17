import { useState } from "react";
import { FiAlertCircle, FiLock, FiMail } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../utils/AuthContext";

const LoginContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: ${(props) => props.theme.colors.backgroundDark};
  padding: 20px;
`;

const LoginCard = styled.div`
  background-color: ${(props) => props.theme.colors.cardBg};
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const LogoText = styled.h1`
  color: ${(props) => props.theme.colors.primary};
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  color: ${(props) => props.theme.colors.textPrimary};
  font-size: 14px;
  font-weight: 500;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 12px;
  color: ${(props) => props.theme.colors.textSecondary};
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 12px 12px 40px;
  background-color: ${(props) => props.theme.colors.backgroundLight};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: 6px;
  color: ${(props) => props.theme.colors.textPrimary};
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primary};
  }

  &::placeholder {
    color: ${(props) => props.theme.colors.textSecondary};
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: rgba(239, 83, 80, 0.1);
  border: 1px solid ${(props) => props.theme.colors.danger};
  border-radius: 6px;
  color: ${(props) => props.theme.colors.danger};
  font-size: 14px;
`;

const Button = styled.button`
  padding: 14px;
  background-color: ${(props) => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 8px;

  &:hover {
    background-color: ${(props) => props.theme.colors.primaryDark};
  }

  &:disabled {
    background-color: ${(props) => props.theme.colors.border};
    cursor: not-allowed;
  }
`;

const Footer = styled.div`
  margin-top: 24px;
  text-align: center;
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const Link = styled.a`
  color: ${(props) => props.theme.colors.primary};
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const DemoHint = styled.div`
  margin-top: 16px;
  padding: 10px 14px;
  background-color: rgba(41, 98, 255, 0.08);
  border: 1px solid rgba(41, 98, 255, 0.25);
  border-radius: 6px;
  font-size: 13px;
  color: ${(props) => props.theme.colors.textSecondary};
  text-align: center;

  strong {
    color: ${(props) => props.theme.colors.primary};
  }
`;

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const { login, register, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isRegistering) {
      const result = await register(email, password, fullName);
      if (result.success) {
        navigate("/");
      }
    } else {
      const result = await login(email, password);
      if (result.success) {
        navigate("/");
      }
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setFullName("");
  };

  return (
    <LoginContainer>
      <LoginCard>
        <Logo>
          <LogoText>Optionix</LogoText>
          <Subtitle>
            {isRegistering ? "Create your account" : "Welcome back"}
          </Subtitle>
        </Logo>

        <Form onSubmit={handleSubmit}>
          {isRegistering && (
            <InputGroup>
              <Label htmlFor="fullName">Full Name</Label>
              <InputWrapper>
                <InputIcon>
                  <FiMail size={18} />
                </InputIcon>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </InputWrapper>
            </InputGroup>
          )}

          <InputGroup>
            <Label htmlFor="email">Email</Label>
            <InputWrapper>
              <InputIcon>
                <FiMail size={18} />
              </InputIcon>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </InputWrapper>
          </InputGroup>

          <InputGroup>
            <Label htmlFor="password">Password</Label>
            <InputWrapper>
              <InputIcon>
                <FiLock size={18} />
              </InputIcon>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </InputWrapper>
          </InputGroup>

          {error && (
            <ErrorMessage>
              <FiAlertCircle size={18} />
              <span>{error}</span>
            </ErrorMessage>
          )}

          <Button type="submit" disabled={loading}>
            {loading
              ? "Loading..."
              : isRegistering
                ? "Create Account"
                : "Sign In"}
          </Button>
        </Form>

        <Footer>
          {isRegistering
            ? "Already have an account?"
            : "Don't have an account?"}{" "}
          <Link onClick={toggleMode}>
            {isRegistering ? "Sign In" : "Sign Up"}
          </Link>
        </Footer>

        {!isRegistering && (
          <DemoHint>
            <strong>Demo:</strong> demo@optionix.com &nbsp;/&nbsp; demo123
          </DemoHint>
        )}
      </LoginCard>
    </LoginContainer>
  );
};

export default Login;
