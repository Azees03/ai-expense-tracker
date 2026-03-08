import { useState, useRef, useEffect, useCallback } from "react";
import { chatAPI } from "../../api/expenses";
import { useExpenses } from "../../context/ExpenseContext";
import "./Chatbot.css";

// ── Welcome message shown before first real AI response ──────────────────────
const WELCOME = {
  role: "assistant",
  content: `👋 Hi! I'm **SpendSmart AI**, your personal finance assistant.

I can handle all your expense needs through natural chat:

• **Add expenses** — *"Spent ₹450 on lunch at Annapoorna today"*
• **Multiple at once** — *"Coffee ₹60, metro ₹40, groceries ₹800"*
• **Query spending** — *"How much did I spend on food this month?"*
• **Biggest expenses** — *"Show my top 5 expenses this week"*
• **Update records** — *"Change my last grocery entry to ₹520"*
• **Delete expenses** — *"Remove the coffee expense I just added"*
• **Budget check** — *"Am I on track with my budget?"*
• **Insights** — *"Analyse my spending and give me tips"*
• **General questions** — *"What is the 50/30/20 budgeting rule?"*

What would you like to do?`,
};

const QUICK_ACTIONS = [
  "How much did I spend this month?",
  "Show my biggest expenses this week",
  "Am I on track with my budget?",
  "Give me insights on my spending",
  "Compare this month vs last month",
];

// ═══════════════════════════════════════════════════════════════════════════
// Markdown-lite renderer
// Handles: **bold**, bullet lines (•, -, *), numbered lists, blank lines
// ═══════════════════════════════════════════════════════════════════════════

function renderInline(str) {
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

function MessageContent({ text }) {
  const lines = text.split("\n");
  return (
    <div className="msg-content">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="msg-spacer" />;

        if (/^[•\-\*]\s+/.test(line.trim())) {
          const content = line.trim().replace(/^[•\-\*]\s+/, "");
          return (
            <div key={i} className="msg-bullet">
              <span className="bullet-dot">•</span>
              <span>{renderInline(content)}</span>
            </div>
          );
        }

        if (/^\d+\.\s+/.test(line.trim())) {
          return (
            <div key={i} className="msg-numbered">
              {renderInline(line.trim())}
            </div>
          );
        }

        return <div key={i} className="msg-line">{renderInline(line)}</div>;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Chatbot component
// ═══════════════════════════════════════════════════════════════════════════

export default function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const endRef                   = useRef(null);
  const inputRef                 = useRef(null);
  const { fetchExpenses }        = useExpenses();

  // Auto-scroll to latest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  const send = useCallback(async (override) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    const userMsg    = { role: "user", content: text };
    const newHistory = [...messages, userMsg];

    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      // Send only real conversation turns (skip the local welcome message)
      // The client interceptor already unwraps res.data so chatAPI.send returns the object directly
      const payload = newHistory
        .filter((m, i) => !(i === 0 && m.role === "assistant"))
        .map(m => ({ role: m.role, content: m.content }));

      const res = await chatAPI.send(payload);

      setMessages(prev => [...prev, { role: "assistant", content: res.message }]);

      // Refresh the expenses list in the background if a mutation happened
      if (res.mutated) fetchExpenses({});

    } catch (err) {
      // Surface meaningful error messages from the server
      const msg = err?.message || err?.error || "Something went wrong. Please try again.";
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [input, loading, messages, fetchExpenses]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => { setMessages([WELCOME]); setInput(""); };

  const showQuickActions = messages.length === 1; // Only on fresh chat

  return (
    <div className="chatbot">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="chat-title">
          <div className="chat-avatar">🤖</div>
          <div>
            <div className="chat-name">SpendSmart AI</div>
            <div className="chat-status">
              {loading ? <span className="status-typing">Thinking…</span> : "Powered by Gemini"}
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-icon-btn" onClick={clearChat} title="Clear chat">🗑️</button>
          <button className="chat-close" onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === "assistant" && <div className="msg-avatar">🤖</div>}
            <div className="msg-bubble">
              <MessageContent text={msg.content} />
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="message assistant">
            <div className="msg-avatar">🤖</div>
            <div className="msg-bubble typing-bubble">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Quick actions (first open only) ────────────────────── */}
      {showQuickActions && (
        <div className="quick-actions">
          <p className="quick-label">Try asking:</p>
          {QUICK_ACTIONS.map(q => (
            <button
              key={q}
              className="quick-btn"
              onClick={() => send(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────── */}
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          disabled={loading}
        />
        <button
          className="send-btn"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          title="Send"
        >
          {loading
            ? <span className="spinner" style={{ width: 15, height: 15 }} />
            : <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M2 21L23 12 2 3v7l15 2-15 2v7z"/>
              </svg>
          }
        </button>
      </div>

    </div>
  );
}
