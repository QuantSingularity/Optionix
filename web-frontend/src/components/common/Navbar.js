import { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiMenu,
  FiSearch,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useAuth } from "../../utils/AuthContext";
import riskService from "../../services/riskService";
import complianceService from "../../services/complianceService";
import { Badge as StatusBadge } from "./UI";

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

const Search = styled.form`
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
  text-transform: uppercase;
  &:focus {
    outline: none;
    border-color: rgba(198, 161, 91, 0.4);
    background: rgba(198, 161, 91, 0.05);
  }
  &::placeholder {
    color: #57574d;
    text-transform: none;
  }
`;
const SearchIcon = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #57574d;
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
const NotifDot = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #c2483f;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AvatarWrap = styled.div`
  position: relative;
`;

const Avatar = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 6px 10px 6px 8px;
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
  background: linear-gradient(135deg, #d6b578, #c6a15b);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #14110a;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
`;
const AvatarName = styled.span`
  font-size: 13.5px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.textPrimary};
  @media (max-width: ${(p) => p.theme.breakpoints.tablet}) {
    display: none;
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 240px;
  background: ${(p) => p.theme.colors.backgroundLight};
  border: 1px solid ${(p) => p.theme.colors.border};
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
`;
const DropName = styled.div`
  font-weight: 700;
  font-size: 14px;
  color: ${(p) => p.theme.colors.textPrimary};
`;
const DropEmail = styled.div`
  font-size: 12.5px;
  color: ${(p) => p.theme.colors.textSecondary};
  margin-top: 2px;
  word-break: break-all;
`;
const DropDivider = styled.div`
  height: 1px;
  background: ${(p) => p.theme.colors.border};
  margin: 12px 0;
`;
const DropItem = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${(p) => (p.$danger ? "#cf6b61" : p.theme.colors.textPrimary)};
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  &:hover {
    background: ${(p) =>
      p.$danger ? "rgba(194, 72, 63,.1)" : "rgba(255,255,255,.06)"};
  }
`;

const KYC_TONE = {
  verified: "success",
  under_review: "warning",
  pending: "neutral",
  rejected: "danger",
};

const Navbar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [query, setQuery] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadAlerts = async () => {
      try {
        const [breakers, alerts] = await Promise.all([
          riskService.getCircuitBreakers(),
          complianceService.getAmlAlerts({ limit: 50 }),
        ]);
        if (!mounted) return;
        const tripped = (breakers?.circuit_breakers || []).filter(
          (b) => b.triggered,
        ).length;
        const openAlerts = (alerts?.alerts || []).filter(
          (a) => a.status && a.status !== "resolved" && a.status !== "closed",
        ).length;
        setAlertCount(tripped + openAlerts);
      } catch {
        // Non-critical: the bell simply shows no badge if these can't load.
      }
    };
    loadAlerts();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(
      `/dashboard/analytics?symbol=${encodeURIComponent(query.trim().toUpperCase())}`,
    );
    setQuery("");
  };

  const initials = (user?.full_name || "Trader")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Bar>
      <Left>
        <MenuBtn onClick={toggleSidebar} aria-label="Toggle sidebar">
          <FiMenu />
        </MenuBtn>
        <Brand>
          Option<span>ix</span>
        </Brand>
        <Search onSubmit={handleSearch}>
          <SearchIcon>
            <FiSearch />
          </SearchIcon>
          <SearchInput
            placeholder="Look up a symbol…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Search>
      </Left>

      <Right>
        <IconBtn
          onClick={() => navigate("/dashboard/risk")}
          aria-label="Alerts"
        >
          <FiBell />
          {alertCount > 0 && (
            <NotifDot>{alertCount > 9 ? "9+" : alertCount}</NotifDot>
          )}
        </IconBtn>

        <AvatarWrap ref={menuRef}>
          <Avatar onClick={() => setMenuOpen((o) => !o)}>
            <AvatarCircle>{initials || <FiUser />}</AvatarCircle>
            <AvatarName>
              {user?.full_name?.split(" ")[0] || "Trader"}
            </AvatarName>
            <FiChevronDown size={14} />
          </Avatar>
          {menuOpen && (
            <Dropdown>
              <DropName>{user?.full_name || "Trader"}</DropName>
              <DropEmail>{user?.email}</DropEmail>
              {user?.kyc_status && (
                <div style={{ marginTop: 8 }}>
                  <StatusBadge $tone={KYC_TONE[user.kyc_status] || "neutral"}>
                    KYC · {user.kyc_status.replace("_", " ")}
                  </StatusBadge>
                </div>
              )}
              <DropDivider />
              <DropItem
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/dashboard/settings");
                }}
              >
                <FiSettings /> Settings
              </DropItem>
              <DropItem $danger onClick={handleLogout}>
                <FiLogOut /> Sign out
              </DropItem>
            </Dropdown>
          )}
        </AvatarWrap>
      </Right>
    </Bar>
  );
};

export default Navbar;
