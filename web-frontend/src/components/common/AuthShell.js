import { FiArrowLeft, FiShield, FiTrendingUp, FiZap } from "react-icons/fi";
import { Link } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const fadeUp = keyframes`from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}`;

export const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #0b0e17;

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
      ellipse 80% 60% at 30% 0%,
      rgba(59, 130, 246, 0.16),
      transparent 60%
    ),
    radial-gradient(
      ellipse 60% 50% at 90% 100%,
      rgba(212, 175, 106, 0.12),
      transparent 60%
    ),
    #0b0e17;
  border-right: 1px solid rgba(255, 255, 255, 0.06);

  @media (max-width: 900px) {
    display: none;
  }
`;

export const BrandLogo = styled(Link)`
  font-family: "Syne", sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #3b82f6;
  letter-spacing: -0.4px;
  span {
    color: var(--gold);
  }
`;

export const BrandQuote = styled.div`
  font-family: "Playfair Display", serif;
  font-style: italic;
  font-size: clamp(1.7rem, 2.6vw, 2.4rem);
  line-height: 1.35;
  color: #f1f5f9;
  max-width: 460px;
  animation: ${fadeUp} 0.7s ease both;

  span {
    background: linear-gradient(135deg, #3b82f6, var(--gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
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
  color: #cbd5e1;
  font-size: 14px;

  svg {
    color: var(--gold);
    font-size: 18px;
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
  font-family: "Syne", sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: #3b82f6;
  margin-bottom: 32px;
  span {
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
  color: #64748b;
  margin-bottom: 28px;
  transition: color 0.15s;
  &:hover {
    color: #94a3b8;
  }
`;

export const FormTitle = styled.h1`
  font-family: "Syne", sans-serif;
  font-size: 26px;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 8px;
`;

export const FormSubtitle = styled.p`
  font-size: 14px;
  color: #94a3b8;
  margin-bottom: 32px;
  line-height: 1.6;
`;

export const SwitchLine = styled.p`
  text-align: center;
  margin-top: 24px;
  font-size: 13.5px;
  color: #94a3b8;

  a {
    color: #3b82f6;
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
  color: #475569;
  font-size: 12px;
  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }
`;

export const BackHomeIcon = FiArrowLeft;
