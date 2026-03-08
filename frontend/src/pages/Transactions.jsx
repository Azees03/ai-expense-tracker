import { useEffect, useState } from "react";
import { useExpenses } from "../context/ExpenseContext";
import ExportButton from "../components/Export/ExportButton";
import {
  CATEGORIES, PAYMENT_METHODS,
  formatCurrency, formatDate, getCategoryInfo,
} from "../utils/constants";
import "./Transactions.css";

const EMPTY_FORM = {
  amount: "", category: "food", description: "",
  date: new Date().toISOString().split("T")[0],
  payment_method: "Cash", merchant: "",
};

export default function Transactions() {
  const { expenses, loading, pagination, fetchExpenses, addExpense, updateExpense, deleteExpense } =
    useExpenses();

  const [filters,     setFilters]     = useState({ category: "", search: "", page: 1 });
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError,   setFormError]   = useState("");

  useEffect(() => { fetchExpenses(filters); }, [filters, fetchExpenses]);

  const openAdd   = () => { setForm(EMPTY_FORM); setEditId(null); setFormError(""); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditId(null); setFormError(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      if (editId) await updateExpense(editId, form);
      else        await addExpense(form);
      closeForm();
    } catch (err) {
      setFormError(err.message || "Failed to save");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (exp) => {
    setForm({
      amount:         exp.amount,
      category:       exp.category,
      description:    exp.description || "",
      date:           exp.date?.split("T")[0] || "",
      payment_method: exp.payment_method || "Cash",
      merchant:       exp.merchant || "",
    });
    setEditId(exp.id);
    setFormError("");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this expense?")) await deleteExpense(id);
  };

  const upd = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="transactions-page">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div>
          <h1>Transactions</h1>
          <p>Manage all your expenses</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <ExportButton expenses={expenses} label="Export" />
          <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="card filters-card">
        <input
          className="filter-input"
          type="text"
          placeholder="🔍  Search by description or merchant…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
        />
        <select
          className="filter-select"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? "Edit Expense" : "Add Expense"}</h3>

            {formError && <div className="auth-error" style={{ marginBottom: 16 }}>{formError}</div>}

            <form onSubmit={handleSubmit} className="expense-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Amount (₹)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.amount} onChange={upd("amount")} required />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={upd("date")} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={upd("category")}>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select value={form.payment_method} onChange={upd("payment_method")}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input type="text" placeholder="What was this for?"
                  value={form.description} onChange={upd("description")} />
              </div>

              <div className="form-group">
                <label>Merchant</label>
                <input type="text" placeholder="Store / restaurant name"
                  value={form.merchant} onChange={upd("merchant")} />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? <span className="spinner" /> : editId ? "Update" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="card table-card">
        {loading ? (
          <div className="table-loading"><div className="spinner" /></div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">No expenses found</div>
        ) : (
          <table className="expense-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Merchant</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => {
                const cat = getCategoryInfo(exp.category);
                return (
                  <tr key={exp.id}>
                    <td>{formatDate(exp.date)}</td>
                    <td>
                      <span className="cat-badge"
                        style={{ background: cat.color + "18", color: cat.color }}>
                        {cat.icon} {cat.label}
                      </span>
                    </td>
                    <td className="desc-cell">{exp.description || "—"}</td>
                    <td>{exp.merchant || "—"}</td>
                    <td>{exp.payment_method || "—"}</td>
                    <td className="amount-cell">{formatCurrency(exp.amount)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="action-btn" title="Edit"   onClick={() => handleEdit(exp)}>✏️</button>
                        <button className="action-btn" title="Delete" onClick={() => handleDelete(exp.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────── */}
      {pagination.pages > 1 && (
        <div className="pagination">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`page-btn${p === pagination.page ? " active" : ""}`}
              onClick={() => setFilters({ ...filters, page: p })}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
