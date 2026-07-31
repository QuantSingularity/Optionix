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
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 600;
  font-size: clamp(4.5rem, 13vw, 8rem);
  color: var(--gold);
  line-height: 1;
`;

const Title = styled.h1`
  font-family: "DM Sans", sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-top: 14px;
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
