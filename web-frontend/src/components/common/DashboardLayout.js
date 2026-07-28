import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import styled from "styled-components";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const Shell = styled.div`
  min-height: 100vh;
  background: var(--bg-dark);
`;

const Content = styled.main`
  margin-left: ${(p) => (p.$sidebarOpen ? "240px" : "0px")};
  padding-top: 70px;
  transition: margin-left 0.25s ease;
  min-height: 100vh;

  @media (max-width: 900px) {
    margin-left: 0;
  }
`;

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth > 900 : true,
  );

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth <= 900) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <Shell>
      <Navbar toggleSidebar={() => setSidebarOpen((o) => !o)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Content $sidebarOpen={sidebarOpen}>
        <Outlet />
      </Content>
    </Shell>
  );
};

export default DashboardLayout;
