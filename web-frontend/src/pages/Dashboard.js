import {
  FiActivity,
  FiArrowDown,
  FiArrowUp,
  FiDollarSign,
  FiPieChart,
  FiTrendingUp,
} from "react-icons/fi";
import styled, { keyframes } from "styled-components";
import MarketOverview from "../components/dashboard/MarketOverview";
import PortfolioSummary from "../components/dashboard/PortfolioSummary";
import PriceChart from "../components/dashboard/PriceChart";
import RecentTransactions from "../components/dashboard/RecentTransactions";
import { useAuth } from "../utils/AuthContext";

const fadeUp = keyframes`from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}`;

const Page = styled.div`
  animation: ${fadeUp} 0.4s ease both;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  flex-wrap: wrap;
  gap: 12px;
`;
const Greeting = styled.div``;
const GreetName = styled.h1`
  font-family: ${(p) => p.theme.fonts.display};
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: ${(p) => p.theme.colors.textPrimary};
  margin-bottom: 4px;
`;
const GreetSub = styled.p`
  color: ${(p) => p.theme.colors.textSecondary};
  font-size: 14px;
`;

const LiveBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 100px;
  padding: 6px 14px;
  font-size: 12.5px;
  color: #10b981;
  font-weight: 600;
`;
const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s infinite;
  display: inline-block;
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
`;

/* ─── Stat Cards ─────────────────────────────────────────── */
const StatCard = styled.div`
  grid-column: span 3;
  background: ${(p) => p.theme.colors.cardBg};
  border: 1px solid ${(p) => p.theme.colors.border};
  border-radius: 14px;
  padding: 22px;
  position: relative;
  overflow: hidden;
  transition: all 0.25s;
  &:hover {
    border-color: ${(p) => p.$accent || p.theme.colors.borderAccent};
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  }
  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${(p) => p.$accent || p.theme.colors.primary};
    opacity: 0.7;
  }
  @media (max-width: ${(p) => p.theme.breakpoints.desktop}) {
    grid-column: span 6;
  }
  @media (max-width: ${(p) => p.theme.breakpoints.mobile}) {
    grid-column: span 12;
  }
`;
const StatTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
`;
const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${(p) => p.$bg || "rgba(59,130,246,.12)"};
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    color: ${(p) => p.$color || "#3b82f6"};
    font-size: 19px;
  }
`;
const StatLabel = styled.p`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.textSecondary};
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;
const StatValue = styled.div`
  font-family: ${(p) => p.theme.fonts.display};
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: ${(p) => p.theme.colors.textPrimary};
  margin-bottom: 6px;
`;
const StatChange = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${(p) => (p.$up ? "#10b981" : "#ef4444")};
  padding: 3px 8px;
  border-radius: 100px;
  background: ${(p) => (p.$up ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)")};
`;

/* ─── Content cards ──────────────────────────────────────── */
const Card = styled.div`
  background: ${(p) => p.theme.colors.cardBg};
  border: 1px solid ${(p) => p.theme.colors.border};
  border-radius: 14px;
  padding: 24px;
  grid-column: span ${(p) => p.$span || 12};
  @media (max-width: ${(p) => p.theme.breakpoints.tablet}) {
    grid-column: span 12;
  }
`;
const CardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;
const CardTitle = styled.h3`
  font-family: ${(p) => p.theme.fonts.display};
  font-size: 1rem;
  font-weight: 700;
  color: ${(p) => p.theme.colors.textPrimary};
`;
const CardBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${(p) => p.$color || p.theme.colors.textSecondary};
  background: ${(p) => p.$bg || "rgba(255,255,255,.05)"};
  padding: 3px 10px;
  border-radius: 100px;
  border: 1px solid ${(p) => p.$border || "rgba(255,255,255,.08)"};
`;

const STATS = [
  {
    label: "Portfolio Value",
    value: "$24,875",
    change: "+5.27%",
    up: true,
    icon: <FiDollarSign />,
    $accent: "#3b82f6",
    $bg: "rgba(59,130,246,.12)",
    $color: "#3b82f6",
  },
  {
    label: "Open Positions",
    value: "12",
    change: "+2 today",
    up: true,
    icon: <FiActivity />,
    $accent: "#10b981",
    $bg: "rgba(16,185,129,.12)",
    $color: "#10b981",
  },
  {
    label: "Profit / Loss",
    value: "+$1,244",
    change: "+12.3%",
    up: true,
    icon: <FiTrendingUp />,
    $accent: "#f97316",
    $bg: "rgba(249,115,22,.12)",
    $color: "#f97316",
  },
  {
    label: "Portfolio Risk",
    value: "Medium",
    change: "+2.1%",
    up: false,
    icon: <FiPieChart />,
    $accent: "#ef4444",
    $bg: "rgba(239,68,68,.12)",
    $color: "#ef4444",
  },
];

const Dashboard = () => {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] || "Trader";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Page>
      <Header>
        <Greeting>
          <GreetName>
            {greeting}, {firstName} 👋
          </GreetName>
          <GreetSub>
            Here's what's happening with your portfolio today.
          </GreetSub>
        </Greeting>
        <LiveBadge>
          <Dot /> Markets Live
        </LiveBadge>
      </Header>

      <Grid>
        {STATS.map((s, i) => (
          <StatCard key={i} $accent={s.$accent}>
            <StatTop>
              <StatLabel>{s.label}</StatLabel>
              <StatIcon $bg={s.$bg} $color={s.$color}>
                {s.icon}
              </StatIcon>
            </StatTop>
            <StatValue>{s.value}</StatValue>
            <StatChange $up={s.up}>
              {s.up ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}
              {s.change}
            </StatChange>
          </StatCard>
        ))}

        <Card $span={8}>
          <CardHead>
            <CardTitle>BTC / USD Price Chart</CardTitle>
            <CardBadge
              $color="#10b981"
              $bg="rgba(16,185,129,.1)"
              $border="rgba(16,185,129,.2)"
            >
              Live
            </CardBadge>
          </CardHead>
          <PriceChart />
        </Card>

        <Card $span={4}>
          <CardHead>
            <CardTitle>Allocation</CardTitle>
            <CardBadge>Portfolio</CardBadge>
          </CardHead>
          <PortfolioSummary />
        </Card>

        <Card $span={6}>
          <CardHead>
            <CardTitle>Recent Transactions</CardTitle>
            <CardBadge>Latest</CardBadge>
          </CardHead>
          <RecentTransactions />
        </Card>

        <Card $span={6}>
          <CardHead>
            <CardTitle>Market Overview</CardTitle>
            <CardBadge
              $color="#3b82f6"
              $bg="rgba(59,130,246,.1)"
              $border="rgba(59,130,246,.2)"
            >
              Watchlist
            </CardBadge>
          </CardHead>
          <MarketOverview />
        </Card>
      </Grid>
    </Page>
  );
};

export default Dashboard;
