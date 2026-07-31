import { FiArrowLeft, FiShield, FiTrendingUp, FiZap } from "react-icons/fi";
import { Link } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const fadeUp = keyframes`from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}`;

export const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #08090b;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const Brand = styled.div`
  position: relative;
  overflow: hidden;
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background:
    radial-gradient(
      ellipse 70% 55% at 25% 0%,
      rgba(198, 161, 91, 0.1),
      transparent 60%
    ),
    #08090b;
  background-image:
    linear-gradient(rgba(198, 161, 91, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(198, 161, 91, 0.045) 1px, transparent 1px),
    radial-gradient(
      ellipse 70% 55% at 25% 0%,
      rgba(198, 161, 91, 0.1),
      transparent 60%
    );
  background-size:
    56px 56px,
    56px 56px,
    auto;
  border-right: 1px solid rgba(243, 241, 234, 0.07);

  @media (max-width: 900px) {
    display: none;
  }
`;

export const BrandLogo = styled(Link)`
  font-family: "DM Sans", sans-serif;
  font-size: 21px;
  font-weight: 800;
  color: #f3f1ea;
  letter-spacing: -0.02em;
  span {
    font-family: "Cormorant Garamond", serif;
    font-style: italic;
    font-weight: 600;
    color: var(--gold);
  }
`;

export const BrandQuote = styled.div`
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(1.8rem, 2.7vw, 2.5rem);
  line-height: 1.32;
  color: #f3f1ea;
  max-width: 460px;
  animation: ${fadeUp} 0.7s ease both;

  span {
    color: var(--gold);
  }
`;

export const BrandFeatures = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: ${fadeUp} 0.7s 0.15s ease both;
`;

export const BrandFeature = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: #c7c5ba;
  font-size: 14px;
  font-family: "DM Sans", sans-serif;

  svg {
    color: var(--gold);
    font-size: 17px;
    flex-shrink: 0;
  }
`;

export const FEATURE_ICONS = { FiShield, FiTrendingUp, FiZap };

export const FormSide = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
`;

export const FormCard = styled.div`
  width: 100%;
  max-width: 400px;
  animation: ${fadeUp} 0.5s ease both;
`;

export const MobileLogo = styled(Link)`
  display: none;
  font-family: "DM Sans", sans-serif;
  font-size: 19px;
  font-weight: 800;
  color: #f3f1ea;
  margin-bottom: 32px;
  span {
    font-family: "Cormorant Garamond", serif;
    font-style: italic;
    font-weight: 600;
    color: var(--gold);
  }
  @media (max-width: 900px) {
    display: block;
  }
`;

export const BackHome = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6f6f66;
  margin-bottom: 28px;
  transition: color 0.15s;
  &:hover {
    color: #93938a;
  }
`;

export const FormTitle = styled.h1`
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
  font-size: 30px;
  color: #f3f1ea;
  margin-bottom: 8px;
`;

export const FormSubtitle = styled.p`
  font-size: 14px;
  color: #93938a;
  margin-bottom: 32px;
  line-height: 1.6;
`;

export const SwitchLine = styled.p`
  text-align: center;
  margin-top: 24px;
  font-size: 13.5px;
  color: #93938a;

  a {
    color: var(--gold);
    font-weight: 600;
    &:hover {
      text-decoration: underline;
    }
  }
`;

export const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
  color: #57574d;
  font-size: 12px;
  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(243, 241, 234, 0.08);
  }
`;

export const BackHomeIcon = FiArrowLeft;
