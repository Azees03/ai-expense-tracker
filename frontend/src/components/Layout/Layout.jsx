import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Chatbot from "../Chatbot/Chatbot";
import "./Layout.css";

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
          ☰
        </button>
        <span className="mobile-logo">💰 SpendSmart</span>
        <button className="mobile-chat-toggle" onClick={() => setChatOpen(!chatOpen)}>
          🤖
        </button>
      </header>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar}></div>}

      <Sidebar 
        chatOpen={chatOpen} 
        setChatOpen={setChatOpen} 
        mobileOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      
      <main className={`main-content${chatOpen ? " chat-open" : ""}`}>
        <Outlet />
      </main>
      
      {chatOpen && <Chatbot onClose={() => setChatOpen(false)} />}
    </div>
  );
}
