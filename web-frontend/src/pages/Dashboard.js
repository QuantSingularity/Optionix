import {
  FiActivity,
  FiDollarSign,
  FiPieChart,
  FiTrendingUp,
} from "react-icons/fi";
import styled from "styled-components";
import MarketOverview from "../components/dashboard/MarketOverview";
import PortfolioSummary from "../components/dashboard/PortfolioSummary";
import PriceChart from "../components/dashboard/PriceChart";
import RecentTransactions from "../components/dashboard/RecentTransactions";

const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
`;

const StatCard = styled.div`
  grid-column: span 3;
  background-color: ${(props) => props.theme.colors.cardBg};
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid ${(props) => props.theme.colors.border};
  display: flex;
  flex-direction: column;

  @media (max-width: ${(props) => props.theme.breakpoints.desktop}) {
    grid-column: span 6;
  }

  @media (max-width: ${(props) => props.theme.breakpoints.mobile}) {
    grid-column: span 12;
  }
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const StatTitle = styled.h3`
  font-size: 14px;
  font-weight: 500;
  color: ${(props) => props.theme.colors.textSecondary};
  margin: 0;
`;

const StatIconWrapper = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: ${(props) => props.color || props.theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    color: white;
    font-size: 18px;
  }
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${(props) => props.theme.colors.textPrimary};
  margin-bottom: 4px;
`;

const StatChange = styled.div`
  font-size: 12px;
  color: ${(props) =>
    props.isPositive ? props.theme.colors.success : props.theme.colors.danger};
`;

const ChartCard = styled.div`
  grid-column: span 8;
  background-color: ${(props) => props.theme.colors.cardBg};
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid ${(props) => props.theme.colors.border};

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    grid-column: span 12;
  }
`;

const PortfolioCard = styled.div`
  grid-column: span 4;
  background-color: ${(props) => props.theme.colors.cardBg};
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid ${(props) => props.theme.colors.border};

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    grid-column: span 12;
  }
`;

const TransactionsCard = styled.div`
  grid-column: span 6;
  background-color: ${(props) => props.theme.colors.cardBg};
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid ${(props) => props.theme.colors.border};

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    grid-column: span 12;
  }
`;

const MarketCard = styled.div`
  grid-column: span 6;
  background-color: ${(props) => props.theme.colors.cardBg};
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid ${(props) => props.theme.colors.border};

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    grid-column: span 12;
  }
`;

const CardTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: ${(props) => props.theme.colors.textPrimary};
  margin: 0 0 20px 0;
`;

const Dashboard = () => {
  return (
    <DashboardContainer>
      <StatCard>
        <StatHeader>
          <StatTitle>Total Portfolio Value</StatTitle>
          <StatIconWrapper color="#2962ff">
            <FiDollarSign />
          </StatIconWrapper>
        </StatHeader>
        <StatValue>$24,875.65</StatValue>
        <StatChange isPositive={true}>+5.27% today</StatChange>
      </StatCard>

      <StatCard>
        <StatHeader>
          <StatTitle>Open Positions</StatTitle>
          <StatIconWrapper color="#26a69a">
            <FiActivity />
          </StatIconWrapper>
        </StatHeader>
        <StatValue>12</StatValue>
        <StatChange isPositive={true}>+2 new today</StatChange>
      </StatCard>

      <StatCard>
        <StatHeader>
          <StatTitle>Profit / Loss</StatTitle>
          <StatIconWrapper color="#ff6d00">
            <FiTrendingUp />
          </StatIconWrapper>
        </StatHeader>
        <StatValue>$1,243.89</StatValue>
        <StatChange isPositive={true}>+12.3% this week</StatChange>
      </StatCard>

      <StatCard>
        <StatHeader>
          <StatTitle>Portfolio Risk</StatTitle>
          <StatIconWrapper color="#ef5350">
            <FiPieChart />
          </StatIconWrapper>
        </StatHeader>
        <StatValue>Medium</StatValue>
        <StatChange isPositive={false}>+2.1% since yesterday</StatChange>
      </StatCard>

      <ChartCard>
        <CardTitle>Price Chart</CardTitle>
        <PriceChart />
      </ChartCard>

      <PortfolioCard>
        <CardTitle>Portfolio Allocation</CardTitle>
        <PortfolioSummary />
      </PortfolioCard>

      <TransactionsCard>
        <CardTitle>Recent Transactions</CardTitle>
        <RecentTransactions />
      </TransactionsCard>

      <MarketCard>
        <CardTitle>Market Overview</CardTitle>
        <MarketOverview />
      </MarketCard>
    </DashboardContainer>
  );
};

export default Dashboard;
