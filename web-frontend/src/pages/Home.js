import {
  FiArrowRight,
  FiBarChart2,
  FiCpu,
  FiLock,
  FiShield,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ─── Animations ─────────────────────────────────────────── */
const fadeUp = keyframes`from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}`;
const glow = keyframes`0%,100%{text-shadow:0 0 40px rgba(59,130,246,.45)}50%{text-shadow:0 0 80px rgba(59,130,246,.8),0 0 160px rgba(59,130,246,.3)}`;
const scroll = keyframes`0%{transform:translateX(0)}100%{transform:translateX(-50%)}`;
const pulse = keyframes`0%,100%{opacity:.6}50%{opacity:1}`;

/* ─── Layout ─────────────────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  background: #0b0e17;
  overflow-x: hidden;
`;

/* ─── NAV ─────────────────────────────────────────────────── */
const Nav = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  height: 68px;
  background: rgba(11, 14, 23, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`;
const NavLogo = styled.div`
  font-family: "Syne", sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #3b82f6;
  letter-spacing: -0.5px;
  span {
    color: #f97316;
  }
`;
const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  @media (max-width: 600px) {
    gap: 4px;
  }
`;
const NavBtn = styled(Link)`
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: "DM Sans", sans-serif;
  ${(p) =>
    p.$primary
      ? `background:#3b82f6;color:#fff;&:hover{background:#2563eb;transform:translateY(-1px);box-shadow:0 4px 20px rgba(59,130,246,.4);}`
      : `background:rgba(255,255,255,.06);color:#f1f5f9;border:1px solid rgba(255,255,255,.1);&:hover{background:rgba(255,255,255,.1);}`}
`;

/* ─── TICKER ─────────────────────────────────────────────── */
const TickerWrap = styled.div`
  margin-top: 68px;
  background: rgba(59, 130, 246, 0.08);
  border-bottom: 1px solid rgba(59, 130, 246, 0.18);
  overflow: hidden;
  padding: 10px 0;
`;
const TickerTrack = styled.div`
  display: flex;
  width: max-content;
  animation: ${scroll} 28s linear infinite;
`;
const TickerItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 32px;
  white-space: nowrap;
  font-size: 13px;
  font-family: "DM Mono", monospace;
  span:first-child {
    color: #94a3b8;
  }
  span.up {
    color: #10b981;
  }
  span.dn {
    color: #ef4444;
  }
`;

const TICKERS = [
  { sym: "BTC/USD", price: "$67,420", chg: "+2.34%", up: true },
  { sym: "ETH/USD", price: "$3,891", chg: "+1.87%", up: true },
  { sym: "SOL/USD", price: "$182.45", chg: "-0.62%", up: false },
  { sym: "AAPL", price: "$189.30", chg: "+0.91%", up: true },
  { sym: "TSLA", price: "$248.76", chg: "-1.45%", up: false },
  { sym: "NVDA", price: "$875.20", chg: "+3.12%", up: true },
  { sym: "SPX", price: "$5,234", chg: "+0.43%", up: true },
  { sym: "VIX", price: "$14.82", chg: "-2.10%", up: false },
];

/* ─── HERO ───────────────────────────────────────────────── */
const HeroSection = styled.section`
  position: relative;
  min-height: 88vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px 60px;
  overflow: hidden;
`;

const GridBg = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(
    ellipse 80% 70% at 50% 40%,
    black 40%,
    transparent 100%
  );
`;
const GlowOrb = styled.div`
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(80px);
  ${(p) => (p.$top ? `top:${p.$top};` : "")}
  ${(p) => (p.$left ? `left:${p.$left};` : "")}
  ${(p) => (p.$right ? `right:${p.$right};` : "")}
  ${(p) => (p.$bottom ? `bottom:${p.$bottom};` : "")}
  width:${(p) => p.$size || "420px"};
  height: ${(p) => p.$size || "420px"};
  background: ${(p) => p.$color || "rgba(59,130,246,.12)"};
`;

const Badge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 100px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #93c5fd;
  margin-bottom: 28px;
  animation: ${fadeUp} 0.6s ease both;
`;
const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  animation: ${pulse} 2s ease infinite;
  display: inline-block;
`;

const HeroTitle = styled.h1`
  font-size: clamp(2.6rem, 6vw, 5.2rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.08;
  margin-bottom: 24px;
  max-width: 860px;
  animation: ${fadeUp} 0.7s 0.1s ease both;
`;
const Gradient = styled.span`
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${glow} 4s ease infinite;
`;

const HeroSub = styled.p`
  font-size: clamp(1rem, 2vw, 1.2rem);
  color: #94a3b8;
  max-width: 580px;
  line-height: 1.7;
  margin-bottom: 44px;
  animation: ${fadeUp} 0.7s 0.2s ease both;
`;

const HeroBtns = styled.div`
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  animation: ${fadeUp} 0.7s 0.3s ease both;
`;
const PrimaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  font-family: "DM Sans", sans-serif;
  box-shadow: 0 4px 24px rgba(59, 130, 246, 0.4);
  transition: all 0.25s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(59, 130, 246, 0.55);
  }
`;
const SecondaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #f1f5f9;
  padding: 14px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-family: "DM Sans", sans-serif;
  transition: all 0.25s;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }
`;

/* ─── STATS ──────────────────────────────────────────────── */
const StatsRow = styled.div`
  display: flex;
  gap: 1px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  overflow: hidden;
  margin-top: 72px;
  width: 100%;
  max-width: 720px;
  animation: ${fadeUp} 0.7s 0.4s ease both;
`;
const StatBox = styled.div`
  flex: 1;
  padding: 24px 20px;
  text-align: center;
  background: #111827;
  &:not(:last-child) {
    border-right: 1px solid rgba(255, 255, 255, 0.06);
  }
`;
const StatNum = styled.div`
  font-family: "Syne", sans-serif;
  font-size: 1.7rem;
  font-weight: 800;
  color: #f1f5f9;
  margin-bottom: 4px;
`;
const StatLabel = styled.div`
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

/* ─── FEATURES ───────────────────────────────────────────── */
const Section = styled.section`
  padding: 100px 24px;
  max-width: 1200px;
  margin: 0 auto;
`;
const SectionTag = styled.div`
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3b82f6;
  margin-bottom: 16px;
`;
const SectionTitle = styled.h2`
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 16px;
`;
const SectionSub = styled.p`
  color: #64748b;
  font-size: 1.05rem;
  max-width: 520px;
  line-height: 1.7;
  margin-bottom: 60px;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
`;
const FeatureCard = styled.div`
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 32px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      ${(p) => p.$color || "#3b82f6"},
      transparent
    );
    opacity: 0;
    transition: opacity 0.3s;
  }
  &:hover {
    transform: translateY(-4px);
    border-color: rgba(59, 130, 246, 0.25);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.4);
    &::before {
      opacity: 1;
    }
  }
`;
const FIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: ${(p) => p.$bg || "rgba(59,130,246,.15)"};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  svg {
    color: ${(p) => p.$color || "#3b82f6"};
    font-size: 22px;
  }
`;
const FTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 10px;
`;
const FDesc = styled.p`
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
`;

/* ─── HOW IT WORKS ───────────────────────────────────────── */
const StepsSection = styled.section`
  padding: 80px 24px;
  background: linear-gradient(180deg, #0b0e17 0%, #0f1520 50%, #0b0e17 100%);
`;
const StepsInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const Steps = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-top: 56px;
  position: relative;
  &::before {
    content: "";
    position: absolute;
    top: 36px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(59, 130, 246, 0.35),
      transparent
    );
    @media (max-width: 700px) {
      display: none;
    }
  }
`;
const Step = styled.div`
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  position: relative;
`;
const StepNum = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 50%;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Syne", sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
`;
const StepTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 10px;
`;
const StepDesc = styled.p`
  color: #64748b;
  font-size: 13.5px;
  line-height: 1.7;
`;

/* ─── CTA ────────────────────────────────────────────────── */
const CTASection = styled.section`
  padding: 80px 24px;
`;
const CTABox = styled.div`
  max-width: 860px;
  margin: 0 auto;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.12),
    rgba(139, 92, 246, 0.08)
  );
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 24px;
  padding: 72px 48px;
  text-align: center;
  position: relative;
  overflow: hidden;
  &::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: 24px;
    z-index: -1;
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.2),
      rgba(139, 92, 246, 0.1)
    );
  }
`;
const CTATitle = styled.h2`
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 16px;
`;
const CTASub = styled.p`
  color: #94a3b8;
  font-size: 1.05rem;
  margin-bottom: 40px;
`;

/* ─── FOOTER ─────────────────────────────────────────────── */
const Footer = styled.footer`
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 36px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
`;
const FooterLogo = styled.div`
  font-family: "Syne", sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #3b82f6;
  span {
    color: #f97316;
  }
`;
const FooterCopy = styled.p`
  color: #334155;
  font-size: 13px;
`;

/* ─── COMPONENT ───────────────────────────────────────────── */
const Home = () => {
  const tickerItems = [...TICKERS, ...TICKERS]; // double for seamless loop

  return (
    <Page>
      {/* NAV */}
      <Nav>
        <NavLogo>
          Option<span>ix</span>
        </NavLogo>
        <NavLinks>
          <NavBtn to="/login">Sign In</NavBtn>
          <NavBtn to="/login" $primary="true">
            Get Started <FiArrowRight />
          </NavBtn>
        </NavLinks>
      </Nav>

      {/* TICKER */}
      <TickerWrap>
        <TickerTrack>
          {tickerItems.map((t, i) => (
            <TickerItem key={i}>
              <span>{t.sym}</span>
              <span>{t.price}</span>
              <span className={t.up ? "up" : "dn"}>{t.chg}</span>
            </TickerItem>
          ))}
        </TickerTrack>
      </TickerWrap>

      {/* HERO */}
      <HeroSection>
        <GridBg />
        <GlowOrb
          $top="-10%"
          $left="5%"
          $size="500px"
          $color="rgba(59,130,246,.1)"
        />
        <GlowOrb
          $top="20%"
          $right="0%"
          $size="380px"
          $color="rgba(139,92,246,.08)"
        />
        <GlowOrb
          $bottom="0"
          $left="30%"
          $size="300px"
          $color="rgba(6,182,212,.07)"
        />

        <Badge>
          <Dot /> Live trading platform
        </Badge>

        <HeroTitle>
          Trade Derivatives with
          <br />
          <Gradient>AI-Powered Precision</Gradient>
        </HeroTitle>

        <HeroSub>
          Optionix gives you institutional-grade options analytics, real-time
          risk assessment, and intelligent execution tools — all in one sleek
          platform.
        </HeroSub>

        <HeroBtns>
          <PrimaryBtn to="/login">
            Start Trading Free <FiArrowRight />
          </PrimaryBtn>
          <SecondaryBtn to="/login">
            View Dashboard <FiBarChart2 />
          </SecondaryBtn>
        </HeroBtns>

        <StatsRow>
          {[
            { num: "$2.4B+", label: "Volume Traded" },
            { num: "48k+", label: "Active Traders" },
            { num: "<0.1ms", label: "Execution Time" },
            { num: "99.98%", label: "Uptime SLA" },
          ].map((s, i) => (
            <StatBox key={i}>
              <StatNum>{s.num}</StatNum>
              <StatLabel>{s.label}</StatLabel>
            </StatBox>
          ))}
        </StatsRow>
      </HeroSection>

      {/* FEATURES */}
      <Section>
        <SectionTag>Platform Features</SectionTag>
        <SectionTitle>Everything you need to trade smarter</SectionTitle>
        <SectionSub>
          From real-time Greeks to portfolio risk heatmaps — built for serious
          options traders.
        </SectionSub>

        <FeatureGrid>
          {[
            {
              icon: <FiCpu />,
              $color: "#3b82f6",
              $bg: "rgba(59,130,246,.12)",
              title: "AI Risk Engine",
              desc: "Our machine-learning model evaluates your entire options portfolio in real-time, flagging tail risks before they become losses.",
            },
            {
              icon: <FiTrendingUp />,
              $color: "#10b981",
              $bg: "rgba(16,185,129,.12)",
              title: "Live Option Chain",
              desc: "Full Greeks (Δ, Γ, Θ, Vega) refreshed every tick. Filter by strike, expiry, and IV percentile with one click.",
            },
            {
              icon: <FiZap />,
              $color: "#f97316",
              $bg: "rgba(249,115,22,.12)",
              title: "Lightning Execution",
              desc: "Sub-millisecond order routing across multiple venues. Smart order splitting minimises market impact automatically.",
            },
            {
              icon: <FiBarChart2 />,
              $color: "#8b5cf6",
              $bg: "rgba(139,92,246,.12)",
              title: "Volatility Analytics",
              desc: "Implied vs historical volatility overlays, skew charts, and term-structure analysis — all on a single screen.",
            },
            {
              icon: <FiShield />,
              $color: "#06b6d4",
              $bg: "rgba(6,182,212,.12)",
              title: "Portfolio Stress Test",
              desc: "Simulate 2008, COVID crash, or any custom macro scenario against your book in seconds.",
            },
            {
              icon: <FiLock />,
              $color: "#f43f5e",
              $bg: "rgba(244,63,94,.12)",
              title: "Institutional Security",
              desc: "SOC 2 Type II, 256-bit AES encryption, and hardware-backed MFA protect every transaction.",
            },
          ].map((f, i) => (
            <FeatureCard key={i} $color={f.$color}>
              <FIcon $bg={f.$bg} $color={f.$color}>
                {f.icon}
              </FIcon>
              <FTitle>{f.title}</FTitle>
              <FDesc>{f.desc}</FDesc>
            </FeatureCard>
          ))}
        </FeatureGrid>
      </Section>

      {/* HOW IT WORKS */}
      <StepsSection>
        <StepsInner>
          <SectionTag>How It Works</SectionTag>
          <SectionTitle>Up and running in minutes</SectionTitle>
          <Steps>
            {[
              {
                n: "01",
                title: "Create your account",
                desc: "Sign up in under 60 seconds. No KYC friction, just a verified email to get started.",
              },
              {
                n: "02",
                title: "Connect your portfolio",
                desc: "Import positions via CSV or link your broker. We support 40+ major brokerages.",
              },
              {
                n: "03",
                title: "Analyse & trade",
                desc: "Explore the live option chain, run risk scenarios, and execute with a single click.",
              },
              {
                n: "04",
                title: "Monitor in real-time",
                desc: "Your dashboard updates live — P&L, Greeks, margin usage, and alert triggers.",
              },
            ].map((s, i) => (
              <Step key={i}>
                <StepNum>{s.n}</StepNum>
                <StepTitle>{s.title}</StepTitle>
                <StepDesc>{s.desc}</StepDesc>
              </Step>
            ))}
          </Steps>
        </StepsInner>
      </StepsSection>

      {/* CTA */}
      <CTASection>
        <CTABox>
          <CTATitle>Ready to trade with an edge?</CTATitle>
          <CTASub>
            Join 48,000+ traders who rely on Optionix every day. No credit card
            required — start with our demo account instantly.
          </CTASub>
          <PrimaryBtn
            to="/login"
            style={{ display: "inline-flex", margin: "0 auto" }}
          >
            Open Free Account <FiArrowRight />
          </PrimaryBtn>
        </CTABox>
      </CTASection>

      {/* FOOTER */}
      <Footer>
        <FooterLogo>
          Option<span>ix</span>
        </FooterLogo>
        <FooterCopy>
          © {new Date().getFullYear()} Optionix Inc. All rights reserved.
        </FooterCopy>
      </Footer>
    </Page>
  );
};

export default Home;
