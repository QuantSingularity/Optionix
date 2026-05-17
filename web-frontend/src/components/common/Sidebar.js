import {
  FiBriefcase,
  FiHome,
  FiLogOut,
  FiPieChart,
  FiSettings,
  FiTrendingUp,
} from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../../utils/AuthContext";

const SidebarContainer = styled.aside`
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 240px;
  background-color: ${(props) => props.theme.colors.backgroundLight};
  border-right: 1px solid ${(props) => props.theme.colors.border};
  padding-top: 70px;
  transition: transform 0.3s ease;
  z-index: 90;

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    transform: translateX(${(props) => (props.isOpen ? "0" : "-100%")});
  }
`;

const Logo = styled.div`
  padding: 16px 20px 20px;
  display: flex;
  align-items: center;
  justify-content: center;

  h1 {
    font-size: 22px;
    font-weight: 700;
    color: ${(props) => props.theme.colors.primary};
    margin: 0;
  }

  span {
    color: ${(props) => props.theme.colors.secondary};
  }
`;

const NavMenu = styled.nav`
  margin-top: 8px;
`;

/* Use transient prop $active to avoid passing it to the DOM */
const NavItem = styled(Link)`
  display: flex;
  align-items: center;
  padding: 12px 20px;
  color: ${(props) =>
    props.$active
      ? props.theme.colors.primary
      : props.theme.colors.textSecondary};
  background-color: ${(props) =>
    props.$active ? "rgba(41, 98, 255, 0.1)" : "transparent"};
  border-left: 3px solid
    ${(props) => (props.$active ? props.theme.colors.primary : "transparent")};
  transition: all 0.2s ease;
  text-decoration: none;

  &:hover {
    color: ${(props) => props.theme.colors.primary};
    background-color: rgba(41, 98, 255, 0.05);
  }

  svg {
    margin-right: 12px;
    font-size: 18px;
    flex-shrink: 0;
  }
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 20px;
  color: ${(props) => props.theme.colors.textSecondary};
  background-color: transparent;
  border: none;
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;

  &:hover {
    color: ${(props) => props.theme.colors.danger};
    background-color: rgba(239, 83, 80, 0.05);
  }

  svg {
    margin-right: 12px;
    font-size: 18px;
    flex-shrink: 0;
  }
`;

const SidebarFooter = styled.div`
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 12px 0;
  border-top: 1px solid ${(props) => props.theme.colors.border};
`;

const FooterText = styled.p`
  font-size: 11px;
  color: ${(props) => props.theme.colors.textSecondary};
  text-align: center;
  margin: 0 0 8px;
  opacity: 0.6;
`;

const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const navItems = [
    { icon: <FiHome />, label: "Dashboard", path: "/" },
    { icon: <FiTrendingUp />, label: "Trading", path: "/trading" },
    { icon: <FiBriefcase />, label: "Portfolio", path: "/portfolio" },
    { icon: <FiPieChart />, label: "Analytics", path: "/analytics" },
    { icon: <FiSettings />, label: "Settings", path: "/settings" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <SidebarContainer isOpen={isOpen}>
      <Logo>
        <h1>
          Option<span>ix</span>
        </h1>
      </Logo>

      <NavMenu>
        {navItems.map((item, index) => (
          <NavItem
            key={index}
            to={item.path}
            $active={location.pathname === item.path}
          >
            {item.icon}
            {item.label}
          </NavItem>
        ))}
      </NavMenu>

      <SidebarFooter>
        <FooterText>Optionix v1.0.0</FooterText>
        <LogoutButton onClick={handleLogout}>
          <FiLogOut />
          Logout
        </LogoutButton>
      </SidebarFooter>
    </SidebarContainer>
  );
};

export default Sidebar;
