import { useEffect, useState } from "react";
import { budgetAPI, expenseAPI } from "../api/expenses";
import { CATEGORIES, formatCurrency, getCategoryInfo } from "../utils/constants";
import "./Budget.css";

export default function Budget() {
  const [budgets,  setBudgets]  = useState([]);
  const [spending, setSpending] = useState({});
  const [form,     setForm]     = useState({ category: "food", amount: "", period: "monthly" });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    Promise.all([budgetAPI.getAll(), expenseAPI.getSummary()])
      .then(([b, s]) => {
        setBudgets(b);
        const map = {};
        s.byCategory?.forEach((c) => { map[c.category] = c.total; });
        setSpending(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const b = await budgetAPI.set(form);
      setBudgets((prev) => {
        const idx = prev.findIndex((x) => x.category === b.category);
        if (idx >= 0) { const n = [...prev]; n[idx] = b; return n; }
        return [...prev, b];
      });
      setForm({ ...form, amount: "" });
    } catch (err) {
      alert(err.message || "Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this budget?")) return;
    await budgetAPI.delete(id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="budget-page">
      <div className="page-header">
        <h1>Budget Management</h1>
        <p>Set monthly limits and track your spending</p>
      </div>

      <div className="budget-layout">
        {/* ── Set Budget Form ───────────────────────────────────── */}
        <div className="card budget-form-card">
          <h3>Set Budget</h3>
          <form onSubmit={handleAdd} className="budget-form">
            <div className="form-group">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Monthly Limit (₹)</label>
              <input
                type="number" min="0" placeholder="5000"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : "Set Budget"}
            </button>
          </form>
        </div>

        {/* ── Budget Progress Cards ─────────────────────────────── */}
        <div className="budget-list">
          {budgets.length === 0 ? (
            <div className="card empty-state">No budgets set yet. Add one!</div>
          ) : (
            budgets.map((b) => {
              const cat     = getCategoryInfo(b.category);
              const spent   = spending[b.category] || 0;
              const percent = Math.min((spent / b.amount) * 100, 100);
              const over    = spent > b.amount;
              const barColor = over
                ? "var(--danger)"
                : percent > 80
                ? "var(--warning)"
                : "var(--success)";

              return (
                <div key={b.id} className="budget-item card">
                  <div className="budget-header">
                    <div className="budget-cat">
                      <span style={{ fontSize: 24 }}>{cat.icon}</span>
                      <div>
                        <div className="budget-cat-name">{cat.label}</div>
                        <div className="budget-meta">Monthly Budget</div>
                      </div>
                    </div>
                    <div className="budget-amounts">
                      <div
                        className="budget-spent"
                        style={{ color: over ? "var(--danger)" : "var(--success)" }}
                      >
                        {formatCurrency(spent)}
                      </div>
                      <div className="budget-limit">/ {formatCurrency(b.amount)}</div>
                    </div>
                    <button
                      className="action-btn"
                      title="Remove budget"
                      onClick={() => handleDelete(b.id)}
                      style={{ flexShrink: 0 }}
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${percent}%`, background: barColor }}
                    />
                  </div>

                  <div className="budget-footer">
                    <span style={{ color: over ? "var(--danger)" : "var(--text-muted)" }}>
                      {over
                        ? `⚠️ Over by ${formatCurrency(spent - b.amount)}`
                        : `${formatCurrency(b.amount - spent)} remaining`}
                    </span>
                    <span
                      className="budget-pct"
                      style={{ color: over ? "var(--danger)" : "var(--text-muted)" }}
                    >
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
