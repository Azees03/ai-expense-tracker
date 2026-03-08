import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Chatbot from "../Chatbot/Chatbot";
import "./Layout.css";

export default function Layout() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="layout">
      <Sidebar chatOpen={chatOpen} setChatOpen={setChatOpen} />
      <main className={`main-content${chatOpen ? " chat-open" : ""}`}>
        <Outlet />
      </main>
      {chatOpen && <Chatbot onClose={() => setChatOpen(false)} />}
    </div>
  );
}
