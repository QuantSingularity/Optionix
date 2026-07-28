import { FiArrowLeft, FiHome } from "react-icons/fi";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Button } from "../components/common/UI";

const Wrap = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  background: var(--bg-dark);
`;

const Code = styled.div`
  font-family: "Syne", sans-serif;
  font-size: clamp(4rem, 12vw, 7rem);
  font-weight: 800;
  background: linear-gradient(135deg, #3b82f6, var(--gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
`;

const Title = styled.h1`
  font-family: "Syne", sans-serif;
  font-size: 1.6rem;
  color: var(--text-primary);
  margin-top: 12px;
`;

const Subtitle = styled.p`
  color: var(--text-secondary);
  font-size: 14.5px;
  margin: 10px 0 28px;
  max-width: 400px;
`;

const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

const NotFound = () => (
  <Wrap>
    <Code>404</Code>
    <Title>This page doesn't exist</Title>
    <Subtitle>
      The page you're looking for may have been moved or never existed. Let's
      get you back on track.
    </Subtitle>
    <Actions>
      <Button as={Link} to="/" $variant="ghost">
        <FiHome /> Go home
      </Button>
      <Button as="button" onClick={() => window.history.back()}>
        <FiArrowLeft /> Go back
      </Button>
    </Actions>
  </Wrap>
);

export default NotFound;
