import { useState } from "react";
import { FiBell, FiMenu, FiSearch, FiUser } from "react-icons/fi";
import styled from "styled-components";

const NavbarContainer = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  background-color: ${(props) => props.theme.colors.backgroundLight};
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
`;

const BrandLogo = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: ${(props) => props.theme.colors.primary};
  margin-right: 20px;
  white-space: nowrap;
  user-select: none;

  span {
    color: ${(props) => props.theme.colors.secondary};
  }

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    display: none;
  }
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 24px;
  cursor: pointer;
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${(props) => props.theme.colors.textPrimary};
  }
`;

const SearchBar = styled.div`
  position: relative;
  width: 300px;

  @media (max-width: ${(props) => props.theme.breakpoints.tablet}) {
    display: none;
  }
`;

const SearchInput = styled.input`
  background-color: ${(props) => props.theme.colors.backgroundDark};
  border: 1px solid ${(props) => props.theme.colors.border};
  border-radius: 4px;
  padding: 8px 12px 8px 36px;
  color: ${(props) => props.theme.colors.textPrimary};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.colors.primary};
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 16px;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  color: ${(props) => props.theme.colors.textSecondary};
  font-size: 20px;
  cursor: pointer;
  margin-left: 16px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${(props) => props.theme.colors.textPrimary};
  }
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: ${(props) => props.theme.colors.danger};
  color: white;
  font-size: 10px;
  font-weight: bold;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const UserAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: ${(props) => props.theme.colors.primary};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 16px;
  cursor: pointer;

  &:hover {
    background-color: ${(props) => props.theme.colors.primaryDark};
  }
`;

const Navbar = ({ toggleSidebar }) => {
  const [notifications] = useState(3);

  return (
    <NavbarContainer>
      <LeftSection>
        <MenuButton onClick={toggleSidebar}>
          <FiMenu />
        </MenuButton>

        <BrandLogo>
          Option<span>ix</span>
        </BrandLogo>

        <SearchBar>
          <SearchIcon>
            <FiSearch />
          </SearchIcon>
          <SearchInput placeholder="Search..." />
        </SearchBar>
      </LeftSection>

      <RightSection>
        <IconButton>
          <FiBell />
          {notifications > 0 && (
            <NotificationBadge>{notifications}</NotificationBadge>
          )}
        </IconButton>

        <UserAvatar>
          <FiUser />
        </UserAvatar>
      </RightSection>
    </NavbarContainer>
  );
};

export default Navbar;
