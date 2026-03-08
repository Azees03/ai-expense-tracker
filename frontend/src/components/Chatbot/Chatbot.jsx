import { useState, useRef, useEffect } from "react";
import { chatAPI } from "../../api/expenses";
import { useExpenses } from "../../context/ExpenseContext";
import "./Chatbot.css";

const WELCOME = {
  role: "assistant",
  content: `👋 Hi! I'm your AI expense assistant powered by Gemini.\n\nI can help you:\n\n• **Add expenses** — "I spent ₹500 on groceries"\n• **Query data** — "How much did I spend this month?"\n• **Update records** — "Change my last expense to transport"\n• **Delete expenses** — "Delete my last expense"\n• **Get insights** — "Analyse my spending patterns"\n\nWhat would you like to do?`,
};

const QUICK_ACTIONS = [
  "How much did I spend this month?",
  "Show my top expenses this week",
  "Add ₹200 for coffee today",
  "Give me spending insights",
];

/* ── Render bold **text** in messages ─────────────────────────────── */
function FormattedText({ text }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        )
      )}
    </span>
  );
}

export default function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const messagesEndRef           = useRef(null);
  const { fetchExpenses }        = useExpenses();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg    = { role: "user", content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const history = newHistory.map((m) => ({ role: m.role, content: m.content }));
      const res     = await chatAPI.send(history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
      if (res.mutated) fetchExpenses({});
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const showQuick = messages.length === 1;

  return (
    <div className="chatbot">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-title">
          <div className="chat-avatar">🤖</div>
          <div>
            <div className="chat-name">AI Assistant</div>
            <div className="chat-status">Powered by Gemini</div>
          </div>
        </div>
        <button className="chat-close" onClick={onClose} title="Close">✕</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === "assistant" && <div className="msg-avatar">🤖</div>}
            <div className="msg-bubble">
              <FormattedText text={msg.content} />
            </div>
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="msg-avatar">🤖</div>
            <div className="msg-bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions (shown only at start) */}
      {showQuick && (
        <div className="quick-actions">
          {QUICK_ACTIONS.map((q) => (
            <button key={q} className="quick-btn" onClick={() => setInput(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask me anything about your expenses…"
          rows={1}
        />
        <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>
          {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "➤"}
        </button>
      </div>
    </div>
  );
}
