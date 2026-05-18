import styled from "styled-components";

const Bar = styled.footer`
  background: ${(p) => p.theme.colors.backgroundLight};
  border-top: 1px solid ${(p) => p.theme.colors.border};
  padding: 14px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
`;
const Logo = styled.span`
  font-family: ${(p) => p.theme.fonts.display};
  font-size: 14px;
  font-weight: 800;
  color: ${(p) => p.theme.colors.primary};
  span {
    color: ${(p) => p.theme.colors.secondary};
  }
`;
const Copy = styled.span`
  color: ${(p) => p.theme.colors.textSecondary};
  font-size: 12px;
`;

const Footer = () => (
  <Bar>
    <Logo>
      Option<span>ix</span>
    </Logo>
    <Copy>© {new Date().getFullYear()} Optionix Inc.</Copy>
  </Bar>
);

export default Footer;
