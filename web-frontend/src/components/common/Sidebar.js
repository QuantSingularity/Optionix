import {
  FiBarChart2,
  FiBriefcase,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiLogOut,
  FiSettings,
  FiShield,
  FiTrendingUp,
} from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../../utils/AuthContext";

const Side = styled.aside`
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 240px;
  background: ${(p) => p.theme.colors.backgroundLight};
  border-right: 1px solid ${(p) => p.theme.colors.border};
  padding-top: 70px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s ease;
  transform: translateX(${(p) => (p.$open ? "0" : "-100%")});
`;

const Backdrop = styled.div`
  display: none;
  @media (max-width: ${(p) => p.theme.breakpoints.tablet}) {
    display: ${(p) => (p.$show ? "block" : "none")};
    position: fixed;
    inset: 0;
    top: 70px;
    background: rgba(0, 0, 0, 0.5);
    z-index: 85;
  }
`;

const Logo = styled(Link)`
  display: block;
  padding: 20px 20px 16px;
  font-family: ${(p) => p.theme.fonts.display};
  font-size: 20px;
  font-weight: 800;
  color: ${(p) => p.theme.colors.primary};
  letter-spacing: -0.4px;
  span {
    color: ${(p) => p.theme.colors.secondary};
  }
`;

const Nav = styled.nav`
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
`;

const NavItem = styled(Link)`
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 2px;
  font-size: 14px;
  font-weight: ${(p) => (p.$active ? "600" : "500")};
  color: ${(p) =>
    p.$active ? p.theme.colors.primary : p.theme.colors.textSecondary};
  background: ${(p) => (p.$active ? "rgba(198, 161, 91,.1)" : "transparent")};
  border-left: 2px solid
    ${(p) => (p.$active ? p.theme.colors.primary : "transparent")};
  transition: all 0.18s;
  &:hover {
    color: ${(p) => p.theme.colors.primary};
    background: rgba(198, 161, 91, 0.06);
  }
  svg {
    font-size: 17px;
    flex-shrink: 0;
  }
`;

const Footer = styled.div`
  padding: 12px;
  border-top: 1px solid ${(p) => p.theme.colors.border};
`;
const LogoutBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${(p) => p.theme.colors.textSecondary};
  font-family: ${(p) => p.theme.fonts.body};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;
  &:hover {
    color: #c2483f;
    background: rgba(194, 72, 63, 0.07);
  }
  svg {
    font-size: 17px;
  }
`;

const NAV = [
  { icon: <FiGrid />, label: "Dashboard", path: "/dashboard" },
  { icon: <FiTrendingUp />, label: "Trading", path: "/dashboard/trading" },
  { icon: <FiBriefcase />, label: "Portfolio", path: "/dashboard/portfolio" },
  { icon: <FiCreditCard />, label: "Wallet", path: "/dashboard/wallet" },
  { icon: <FiBarChart2 />, label: "Analytics", path: "/dashboard/analytics" },
  { icon: <FiShield />, label: "Risk", path: "/dashboard/risk" },
  {
    icon: <FiClipboard />,
    label: "Compliance",
    path: "/dashboard/compliance",
  },
  { icon: <FiSettings />, label: "Settings", path: "/dashboard/settings" },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path) =>
    path === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      <Backdrop $show={isOpen} onClick={onClose} />
      <Side $open={isOpen}>
        <Logo to="/dashboard">
          Option<span>ix</span>
        </Logo>
        <Nav>
          {NAV.map((item) => (
            <NavItem
              key={item.path}
              to={item.path}
              $active={isActive(item.path)}
            >
              {item.icon}
              {item.label}
            </NavItem>
          ))}
        </Nav>
        <Footer>
          <LogoutBtn onClick={handleLogout}>
            <FiLogOut /> Logout
          </LogoutBtn>
        </Footer>
      </Side>
    </>
  );
};

export default Sidebar;
