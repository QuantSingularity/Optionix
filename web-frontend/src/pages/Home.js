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
const fadeUp = keyframes`from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}`;
const scroll = keyframes`0%{transform:translateX(0)}100%{transform:translateX(-50%)}`;
const pulse = keyframes`0%,100%{opacity:.55}50%{opacity:1}`;
const drift = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}`;

/* ─── Layout ─────────────────────────────────────────────── */
const Page = styled.div`
  min-height: 100vh;
  background: #08090b;
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
  padding: 0 clamp(20px, 4vw, 44px);
  height: 68px;
  background: rgba(8, 9, 11, 0.86);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(243, 241, 234, 0.07);
`;
const NavLogo = styled.div`
  font-family: "DM Sans", sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: #f3f1ea;
  letter-spacing: -0.02em;
  font-style: normal;
  span {
    font-family: "Cormorant Garamond", serif;
    font-style: italic;
    font-weight: 600;
    color: #c6a15b;
  }
`;
const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  @media (max-width: 600px) {
    gap: 6px;
  }
`;
const NavBtn = styled(Link)`
  padding: 9px 20px;
  border-radius: 3px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: "DM Sans", sans-serif;
  letter-spacing: 0.01em;
  ${(p) =>
    p.$primary
      ? `background:#c6a15b;color:#14110a;&:hover{background:#d6b578;}`
      : `background:transparent;color:#e7e5dc;border:1px solid rgba(243,241,234,.16);&:hover{border-color:rgba(198,161,91,.5);color:#c6a15b;}`}
`;

/* ─── TICKER ─────────────────────────────────────────────── */
const TickerWrap = styled.div`
  margin-top: 68px;
  background: #0c0d10;
  border-bottom: 1px solid rgba(243, 241, 234, 0.07);
  overflow: hidden;
  padding: 9px 0;
`;
const TickerTrack = styled.div`
  display: flex;
  width: max-content;
  animation: ${scroll} 32s linear infinite;
`;
const TickerItem = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 30px;
  white-space: nowrap;
  font-size: 12.5px;
  font-family: "DM Mono", monospace;
  border-right: 1px solid rgba(243, 241, 234, 0.06);
  span:first-child {
    color: #77776e;
    letter-spacing: 0.03em;
  }
  span.up {
    color: #6bb994;
  }
  span.dn {
    color: #cf6b61;
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
  padding: clamp(64px, 10vw, 120px) clamp(20px, 4vw, 44px) 90px;
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  align-items: center;
  gap: 48px;
  overflow: hidden;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    text-align: center;
    padding-bottom: 60px;
  }
`;

const GridBg = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(198, 161, 91, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(198, 161, 91, 0.045) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(
    ellipse 70% 60% at 20% 30%,
    black 30%,
    transparent 100%
  );
`;

const HeroLeft = styled.div`
  position: relative;
  z-index: 1;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(198, 161, 91, 0.3);
  border-radius: 3px;
  padding: 6px 13px;
  font-family: "DM Mono", monospace;
  font-size: 11.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #c6a15b;
  margin-bottom: 30px;
  animation: ${fadeUp} 0.6s ease both;
`;
const Dot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6bb994;
  animation: ${pulse} 2s ease infinite;
  display: inline-block;
`;

const HeroTitle = styled.h1`
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
  font-size: clamp(2.6rem, 5.2vw, 4.4rem);
  letter-spacing: -0.01em;
  line-height: 1.08;
  color: #f3f1ea;
  margin-bottom: 26px;
  max-width: 620px;
  animation: ${fadeUp} 0.7s 0.1s ease both;

  @media (max-width: 980px) {
    max-width: 100%;
  }
`;
const Emphasis = styled.em`
  font-style: italic;
  color: #c6a15b;
`;

const HeroSub = styled.p`
  font-family: "DM Sans", sans-serif;
  font-size: 1.02rem;
  color: #93938a;
  max-width: 480px;
  line-height: 1.75;
  margin-bottom: 38px;
  animation: ${fadeUp} 0.7s 0.2s ease both;

  @media (max-width: 980px) {
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
  }
`;

const HeroBtns = styled.div`
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  animation: ${fadeUp} 0.7s 0.3s ease both;

  @media (max-width: 980px) {
    justify-content: center;
  }
`;
const PrimaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #d6b578, #c6a15b);
  color: #14110a;
  padding: 14px 28px;
  border-radius: 3px;
  font-size: 14.5px;
  font-weight: 700;
  font-family: "DM Sans", sans-serif;
  transition: all 0.25s;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 28px rgba(198, 161, 91, 0.3);
  }
`;
const SecondaryBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #e7e5dc;
  padding: 14px 28px;
  border-radius: 3px;
  font-size: 14.5px;
  font-weight: 600;
  border: 1px solid rgba(243, 241, 234, 0.16);
  font-family: "DM Sans", sans-serif;
  transition: all 0.25s;
  &:hover {
    border-color: rgba(198, 161, 91, 0.5);
    color: #c6a15b;
  }
`;

/* ─── HERO TICKET (signature element) ───────────────────── */
const TicketWrap = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  animation: ${fadeUp} 0.8s 0.35s ease both;
`;
const Ticket = styled.div`
  width: 100%;
  max-width: 340px;
  background: #101114;
  border: 1px solid rgba(243, 241, 234, 0.09);
  border-radius: 10px;
  padding: 24px;
  animation: ${drift} 6s ease-in-out infinite;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45);
`;
const TicketRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px dashed rgba(243, 241, 234, 0.1);
`;
const TicketSym = styled.div`
  font-family: "DM Sans", sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: #f3f1ea;
`;
const TicketTag = styled.span`
  font-family: "DM Mono", monospace;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6bb994;
  border: 1px solid rgba(63, 157, 114, 0.35);
  background: rgba(63, 157, 114, 0.1);
  padding: 3px 8px;
  border-radius: 3px;
`;
const TicketGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 18px;
  margin-bottom: 18px;
`;
const TicketStat = styled.div`
  span {
    display: block;
  }
  span:first-child {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6f6f66;
    margin-bottom: 4px;
  }
  span:last-child {
    font-family: "DM Mono", monospace;
    font-size: 14.5px;
    color: #e7e5dc;
  }
`;
const TicketSpark = styled.svg`
  display: block;
  width: 100%;
  height: 46px;
`;
const TicketFoot = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-family: "DM Mono", monospace;
  font-size: 11.5px;
  color: #77776e;
`;

/* ─── STATS ──────────────────────────────────────────────── */
const StatsRow = styled.div`
  display: flex;
  gap: 0;
  border-top: 1px solid rgba(243, 241, 234, 0.08);
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 clamp(20px, 4vw, 44px);
`;
const StatBox = styled.div`
  flex: 1;
  padding: 28px 20px;
  &:not(:last-child) {
    border-right: 1px solid rgba(243, 241, 234, 0.08);
  }
  @media (max-width: 700px) {
    padding: 20px 10px;
  }
`;
const StatNum = styled.div`
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
  font-size: 2rem;
  color: #f3f1ea;
  margin-bottom: 4px;
`;
const StatLabel = styled.div`
  font-size: 11.5px;
  color: #6f6f66;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

/* ─── FEATURES ───────────────────────────────────────────── */
const Section = styled.section`
  padding: 110px 24px;
  max-width: 1200px;
  margin: 0 auto;
`;
const SectionHead = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 56px;
  flex-wrap: wrap;
`;
const SectionTag = styled.div`
  font-family: "DM Mono", monospace;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #c6a15b;
  margin-bottom: 14px;
`;
const SectionTitle = styled.h2`
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
  font-size: clamp(1.9rem, 3.6vw, 2.7rem);
  letter-spacing: -0.01em;
  color: #f3f1ea;
`;
const SectionSub = styled.p`
  color: #6f6f66;
  font-size: 0.98rem;
  max-width: 360px;
  line-height: 1.7;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1px;
  background: rgba(243, 241, 234, 0.07);
  border: 1px solid rgba(243, 241, 234, 0.07);
`;
const FeatureCard = styled.div`
  background: #0b0c0e;
  padding: 34px 30px;
  transition: background 0.25s;
  position: relative;
  &:hover {
    background: #121316;
  }
`;
const FIndex = styled.div`
  font-family: "DM Mono", monospace;
  font-size: 11.5px;
  color: #57574d;
  margin-bottom: 22px;
`;
const FIcon = styled.div`
  color: ${(p) => p.$color || "#c6a15b"};
  font-size: 20px;
  margin-bottom: 18px;
`;
const FTitle = styled.h3`
  font-family: "DM Sans", sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f3f1ea;
  margin-bottom: 10px;
`;
const FDesc = styled.p`
  color: #85857c;
  font-size: 13.5px;
  line-height: 1.75;
`;

/* ─── HOW IT WORKS ───────────────────────────────────────── */
const StepsSection = styled.section`
  padding: 90px 24px;
  background: #0b0c0e;
  border-top: 1px solid rgba(243, 241, 234, 0.07);
  border-bottom: 1px solid rgba(243, 241, 234, 0.07);
`;
const StepsInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const Steps = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 0;
  margin-top: 56px;
  border-top: 1px solid rgba(243, 241, 234, 0.08);
`;
const Step = styled.div`
  padding: 30px 28px 0;
  border-right: 1px solid rgba(243, 241, 234, 0.08);
  &:last-child {
    border-right: none;
  }
  @media (max-width: 700px) {
    border-right: none;
    border-bottom: 1px solid rgba(243, 241, 234, 0.08);
    padding-bottom: 24px;
  }
`;
const StepNum = styled.div`
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 2.1rem;
  color: #c6a15b;
  margin-bottom: 14px;
`;
const StepTitle = styled.h3`
  font-family: "DM Sans", sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #f3f1ea;
  margin-bottom: 10px;
`;
const StepDesc = styled.p`
  color: #6f6f66;
  font-size: 13.5px;
  line-height: 1.7;
  max-width: 260px;
`;

/* ─── CTA ────────────────────────────────────────────────── */
const CTASection = styled.section`
  padding: 100px 24px 120px;
`;
const CTABox = styled.div`
  max-width: 780px;
  margin: 0 auto;
  border: 1px solid rgba(198, 161, 91, 0.28);
  border-radius: 4px;
  padding: 72px 48px;
  text-align: center;
  position: relative;
`;
const CTATag = styled.div`
  font-family: "DM Mono", monospace;
  font-size: 11.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #c6a15b;
  margin-bottom: 20px;
`;
const CTATitle = styled.h2`
  font-family: "Cormorant Garamond", serif;
  font-weight: 600;
  font-size: clamp(1.9rem, 3.6vw, 2.7rem);
  letter-spacing: -0.01em;
  color: #f3f1ea;
  margin-bottom: 18px;
`;
const CTASub = styled.p`
  color: #85857c;
  font-size: 1rem;
  margin-bottom: 40px;
  max-width: 460px;
  margin-left: auto;
  margin-right: auto;
`;

/* ─── FOOTER ─────────────────────────────────────────────── */
const Footer = styled.footer`
  border-top: 1px solid rgba(243, 241, 234, 0.07);
  padding: 36px clamp(20px, 4vw, 44px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
`;
const FooterLogo = styled.div`
  font-family: "DM Sans", sans-serif;
  font-size: 16px;
  font-weight: 800;
  color: #f3f1ea;
  span {
    font-family: "Cormorant Garamond", serif;
    font-style: italic;
    font-weight: 600;
    color: #c6a15b;
  }
`;
const FooterCopy = styled.p`
  color: #4a4a41;
  font-size: 12.5px;
`;

/* ─── COMPONENT ───────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <FiCpu />,
    color: "#c6a15b",
    title: "AI Risk Engine",
    desc: "Our machine-learning model evaluates your entire options portfolio in real time, flagging tail risks before they become losses.",
  },
  {
    icon: <FiTrendingUp />,
    color: "#3f9d72",
    title: "Live Option Chain",
    desc: "Full Greeks (Δ, Γ, Θ, Vega) refreshed every tick. Filter by strike, expiry, and IV percentile with one click.",
  },
  {
    icon: <FiZap />,
    color: "#4f8f74",
    title: "Lightning Execution",
    desc: "Sub-millisecond order routing across multiple venues. Smart order splitting minimises market impact automatically.",
  },
  {
    icon: <FiBarChart2 />,
    color: "#a8843f",
    title: "Volatility Analytics",
    desc: "Implied vs. historical volatility overlays, skew charts, and term-structure analysis, all on a single screen.",
  },
  {
    icon: <FiShield />,
    color: "#6ea88c",
    title: "Portfolio Stress Test",
    desc: "Simulate 2008, the COVID crash, or any custom macro scenario against your book in seconds.",
  },
  {
    icon: <FiLock />,
    color: "#c2483f",
    title: "Institutional Security",
    desc: "SOC 2 Type II, 256-bit AES encryption, and hardware-backed MFA protect every transaction.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    desc: "Sign up in under 60 seconds. No KYC friction, just a verified email to get started.",
  },
  {
    title: "Connect your portfolio",
    desc: "Import positions via CSV or link your broker. We support 40+ major brokerages.",
  },
  {
    title: "Analyse & trade",
    desc: "Explore the live option chain, run risk scenarios, and execute with a single click.",
  },
  {
    title: "Monitor in real time",
    desc: "Your dashboard updates live: P&L, Greeks, margin usage, and alert triggers.",
  },
];

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
          <NavBtn to="/signup" $primary="true">
            Get Started <FiArrowRight size={14} />
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

        <HeroLeft>
          <Eyebrow>
            <Dot /> Live trading platform
          </Eyebrow>

          <HeroTitle>
            Trade derivatives with
            <br />
            <Emphasis>institutional precision.</Emphasis>
          </HeroTitle>

          <HeroSub>
            Optionix gives you institutional-grade options analytics, real-time
            risk assessment, and intelligent execution tools, all in one
            disciplined platform.
          </HeroSub>

          <HeroBtns>
            <PrimaryBtn to="/signup">
              Start Trading Free <FiArrowRight size={15} />
            </PrimaryBtn>
            <SecondaryBtn to="/login">
              View Dashboard <FiBarChart2 size={15} />
            </SecondaryBtn>
          </HeroBtns>
        </HeroLeft>

        <TicketWrap>
          <Ticket>
            <TicketRow>
              <TicketSym>SPX 5250C · 07/31</TicketSym>
              <TicketTag>Call</TicketTag>
            </TicketRow>
            <TicketGrid>
              <TicketStat>
                <span>Delta</span>
                <span>0.62</span>
              </TicketStat>
              <TicketStat>
                <span>IV</span>
                <span>18.4%</span>
              </TicketStat>
              <TicketStat>
                <span>Bid / Ask</span>
                <span>4.85 / 4.95</span>
              </TicketStat>
              <TicketStat>
                <span>Theta</span>
                <span>-0.18</span>
              </TicketStat>
            </TicketGrid>
            <TicketSpark viewBox="0 0 300 46" preserveAspectRatio="none">
              <polyline
                points="0,34 25,30 50,36 75,22 100,26 125,14 150,18 175,8 200,16 225,6 250,12 275,4 300,10"
                fill="none"
                stroke="#3f9d72"
                strokeWidth="1.6"
              />
            </TicketSpark>
            <TicketFoot>
              <span>Updated 0.2s ago</span>
              <span style={{ color: "#6bb994" }}>+12.4%</span>
            </TicketFoot>
          </Ticket>
        </TicketWrap>
      </HeroSection>

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

      {/* FEATURES */}
      <Section>
        <SectionHead>
          <div>
            <SectionTag>Platform Features</SectionTag>
            <SectionTitle>Everything the desk needs</SectionTitle>
          </div>
          <SectionSub>
            From real-time Greeks to portfolio risk heatmaps, built for serious
            options traders.
          </SectionSub>
        </SectionHead>

        <FeatureGrid>
          {FEATURES.map((f, i) => (
            <FeatureCard key={i}>
              <FIndex>{String(i + 1).padStart(2, "0")}</FIndex>
              <FIcon $color={f.color}>{f.icon}</FIcon>
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
            {STEPS.map((s, i) => (
              <Step key={i}>
                <StepNum>{String(i + 1).padStart(2, "0")}</StepNum>
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
          <CTATag>Get Started</CTATag>
          <CTATitle>Ready to trade with an edge?</CTATitle>
          <CTASub>
            Join 48,000+ traders who rely on Optionix every day. No credit card
            required, start with our demo account instantly.
          </CTASub>
          <PrimaryBtn
            to="/signup"
            style={{ display: "inline-flex", margin: "0 auto" }}
          >
            Open Free Account <FiArrowRight size={15} />
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
