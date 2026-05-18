import { useState } from "react";
import { FiBell, FiMenu, FiSearch, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../../utils/AuthContext";

const Bar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  z-index: 100;
  background: rgba(17, 24, 39, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid ${(p) => p.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MenuBtn = styled.button`
  background: none;
  border: none;
  color: ${(p) => p.theme.colors.textSecondary};
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
  &:hover {
    color: ${(p) => p.theme.colors.textPrimary};
    background: rgba(255, 255, 255, 0.05);
  }
`;

const Brand = styled.div`
  font-family: ${(p) => p.theme.fonts.display};
  font-size: 19px;
  font-weight: 800;
  color: ${(p) => p.theme.colors.primary};
  letter-spacing: -0.4px;
  margin-right: 8px;
  span {
    color: ${(p) => p.theme.colors.secondary};
  }
  @media (max-width: ${(p) => p.theme.breakpoints.tablet}) {
    display: none;
  }
`;

const Search = styled.div`
  position: relative;
  @media (max-width: ${(p) => p.theme.breakpoints.tablet}) {
    display: none;
  }
`;
const SearchInput = styled.input`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 14px 8px 38px;
  width: 260px;
  color: ${(p) => p.theme.colors.textPrimary};
  font-size: 13.5px;
  &:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.05);
  }
  &::placeholder {
    color: #475569;
  }
`;
const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #475569;
  font-size: 15px;
  display: flex;
  pointer-events: none;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  color: ${(p) => p.theme.colors.textSecondary};
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 8px;
  position: relative;
  transition: all 0.2s;
  &:hover {
    color: ${(p) => p.theme.colors.textPrimary};
    background: rgba(255, 255, 255, 0.05);
  }
`;
const Badge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Avatar = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 6px 12px 6px 8px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
`;
const AvatarCircle = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
`;
const AvatarName = styled.span`
  font-size: 13.5px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.textPrimary};
  @media (max-width: ${(p) => p.theme.breakpoints.tablet}) {
    display: none;
  }
`;

const Navbar = ({ toggleSidebar }) => {
  const [notifs] = useState(3);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Bar>
      <Left>
        <MenuBtn onClick={toggleSidebar}>
          <FiMenu />
        </MenuBtn>
        <Brand>
          Option<span>ix</span>
        </Brand>
        <Search>
          <SearchIcon>
            <FiSearch />
          </SearchIcon>
          <SearchInput placeholder="Search markets, assets…" />
        </Search>
      </Left>

      <Right>
        <IconBtn>
          <FiBell />
          {notifs > 0 && <Badge>{notifs}</Badge>}
        </IconBtn>

        <Avatar onClick={() => navigate("/dashboard")}>
          <AvatarCircle>
            <FiUser />
          </AvatarCircle>
          <AvatarName>{user?.full_name?.split(" ")[0] || "Trader"}</AvatarName>
        </Avatar>
      </Right>
    </Bar>
  );
};

export default Navbar;
