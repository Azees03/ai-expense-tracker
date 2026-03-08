import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import "./Sidebar.css";

const navItems = [
  { to: "/dashboard",    icon: "📊", label: "Dashboard"    },
  { to: "/transactions", icon: "💳", label: "Transactions" },
  { to: "/budget",       icon: "🎯", label: "Budget"       },
  { to: "/analytics",   icon: "📈", label: "Analytics"    },
];

export default function Sidebar({ chatOpen, setChatOpen }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">💰</span>
        <span className="logo-text">SpendSmart</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          className={`nav-item ai-assistant-btn${chatOpen ? " active" : ""}`}
          onClick={() => setChatOpen((o) => !o)}
        >
          <span className="nav-icon">🤖</span>
          <span>AI Assistant</span>
          <span className="ai-badge">AI</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div className="user-details">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        
        <div className="footer-actions">
          <button
            className="theme-toggle-footer"
            onClick={toggle}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☀️" : "🌙"}
            <span>{dark ? "Light" : "Dark"} Mode</span>
          </button>
          
          <button className="logout-btn" onClick={logout}>
            <span>⏏</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}