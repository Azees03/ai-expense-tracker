import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useGroups } from "../context/GroupContext";
import { useAuth } from "../context/AuthContext";
import { groupAPI } from "../api/groups";
import "./GroupDetails.css";

const SPLIT_METHODS = [
  { value: "equal", label: "Equally" },
  { value: "exact", label: "Exact amounts" },
  { value: "percentage", label: "Percentages" },
  { value: "shares", label: "Shares" },
  { value: "adjustment", label: "Equal with adjustment" },
];

export default function GroupDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { currentGroup, fetchGroupDetails, loading } = useGroups();

  const [activeTab, setActiveTab] = useState("expenses");
  const [balancesData, setBalancesData] = useState([]);
  const [settlementPlan, setSettlementPlan] = useState([]);
  const [verification, setVerification] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Form states
  const [memberEmail, setMemberEmail] = useState("");
  const [editExpenseId, setEditExpenseId] = useState(null);
  const [splitMethod, setSplitMethod] = useState("equal");
  const [splitData, setSplitData] = useState({});
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paid_by: user?.id
  });
  const [settleForm, setSettleForm] = useState({
    paid_by: user?.id || "",
    paid_to: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGroupDetails(id);
    loadBalances();
  }, [id, fetchGroupDetails]);

  const loadBalances = async () => {
    try {
      const data = await groupAPI.getBalances(id);
      setBalancesData(data.balances || data);
      setVerification(data.verification || null);
      setSettlementPlan(data.settlementPlan || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await groupAPI.addMember(id, memberEmail);
      setMemberEmail("");
      setShowMemberModal(false);
      fetchGroupDetails(id);
    } catch (err) {
      alert(err?.message || "Error adding member");
    } finally {
      setSubmitting(false);
    }
  };

  const resetExpenseForm = () => {
    setEditExpenseId(null);
    setExpenseForm({
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      paid_by: user?.id
    });
    setSplitMethod("equal");
    setSplitData({});
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await groupAPI.deleteExpense(id, expenseId);
      fetchGroupDetails(id);
      loadBalances();
    } catch (err) {
      alert(err?.message || "Error deleting expense");
    }
  };

  const handleEdit = (exp) => {
    setEditExpenseId(exp.id);
    setExpenseForm({
      description: exp.description,
      amount: exp.amount,
      date: exp.date?.split("T")[0] || "",
      paid_by: exp.paid_by
    });
    setSplitMethod(exp.split_method || "equal");
    setSplitData(exp.split_data || {});
    setShowExpenseModal(true);
  };

  const openAddExpense = () => {
    resetExpenseForm();
    setShowExpenseModal(true);
  };

  const buildPayload = () => {
    const payload = {
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      date: expenseForm.date,
      paid_by: expenseForm.paid_by,
      split_method: splitMethod,
    };
    if (splitMethod !== "equal" && Object.keys(splitData).length > 0) {
      payload.split_data = splitData;
    }
    return payload;
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = buildPayload();

      // Client-side validation for exact/percentage/shares
      if (splitMethod === "exact" && splitData.amounts) {
        const total = Object.values(splitData.amounts).reduce((s, v) => s + parseFloat(v || 0), 0);
        if (Math.abs(total - parseFloat(expenseForm.amount)) > 0.01) {
          alert(`Exact amounts total ₹${total.toFixed(2)}, but bill is ₹${parseFloat(expenseForm.amount).toFixed(2)}. Adjust amounts.`);
          setSubmitting(false);
          return;
        }
      }
      if (splitMethod === "percentage" && splitData.percentages) {
        const total = Object.values(splitData.percentages).reduce((s, v) => s + parseFloat(v || 0), 0);
        if (Math.abs(total - 100) > 0.01) {
          alert(`Percentages total ${total}%, must be 100%.`);
          setSubmitting(false);
          return;
        }
      }

      if (editExpenseId) {
        await groupAPI.updateExpense(id, editExpenseId, payload);
      } else {
        await groupAPI.addExpense(id, payload);
      }
      resetExpenseForm();
      setShowExpenseModal(false);
      fetchGroupDetails(id);
      loadBalances();
    } catch (err) {
      alert(err?.message || "Error saving expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await groupAPI.addSettlement(id, settleForm);
      setSettleForm({ paid_by: user?.id || "", paid_to: "", amount: "", date: new Date().toISOString().split("T")[0], description: "" });
      setShowSettleModal(false);
      fetchGroupDetails(id);
      loadBalances();
    } catch (err) {
      alert(err?.message || "Error settling up");
    } finally {
      setSubmitting(false);
    }
  };

  const openSettleUp = () => {
    const defaults = {
      paid_by: user?.id || "",
      paid_to: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    };
    const settlement = settlementPlan.find(s => String(s.from) === String(user.id) || String(s.to) === String(user.id));
    if (settlement) {
      if (String(settlement.from) === String(user.id)) {
        defaults.paid_by = user.id;
        defaults.paid_to = settlement.to;
      } else {
        defaults.paid_by = settlement.from;
        defaults.paid_to = user.id;
      }
      defaults.amount = settlement.amount;
    }
    setSettleForm(defaults);
    setShowSettleModal(true);
  };

  const updateSplitEntry = (key, value) => {
    const field = splitMethod === "exact" ? "amounts"
      : splitMethod === "percentage" ? "percentages"
      : splitMethod === "shares" ? "shares"
      : splitMethod === "adjustment" ? "adjustments"
      : null;
    if (!field) return;
    setSplitData(prev => ({
      ...prev,
      [field]: { ...(prev[field] || {}), [key]: value }
    }));
  };

  const getSplitValue = (userId) => {
    const field = splitMethod === "exact" ? "amounts"
      : splitMethod === "percentage" ? "percentages"
      : splitMethod === "shares" ? "shares"
      : splitMethod === "adjustment" ? "adjustments"
      : null;
    if (!field || !splitData[field]) return "";
    return splitData[field][userId] ?? "";
  };

  if (loading && !currentGroup) return <div className="loading-container"><div className="spinner" /></div>;
  if (!currentGroup) return <div className="error-container">Group not found. <Link to="/groups">Go back</Link></div>;

  return (
    <div className="group-details-page">
      <Link to="/groups" className="back-link">← Back to Groups</Link>

      <header className="group-header">
        <div className="header-main">
          <h1>{currentGroup.name}</h1>
          <div className="member-tags">
            {currentGroup.members?.map(m => (
              <span key={m.id} className="member-tag" title={m.email}>{m.name}</span>
            ))}
            <button className="add-member-pill" title="Add Member" onClick={() => setShowMemberModal(true)}>+</button>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={openSettleUp}>🤝 Settle Up</button>
          <button className="btn btn-primary" onClick={openAddExpense}>+ Add Expense</button>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${activeTab === "expenses" ? "active" : ""}`} onClick={() => setActiveTab("expenses")}>Expenses</button>
        <button className={`tab ${activeTab === "balances" ? "active" : ""}`} onClick={() => setActiveTab("balances")}>Balances</button>
      </div>

      <main className="tab-content">
        {activeTab === "expenses" ? (
          <div className="activity-feed">
            {[...currentGroup.expenses, ...currentGroup.settlements]
              .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
              .map((item, idx) => (
                <div key={idx} className={`activity-item ${item.paid_to ? "settlement" : "expense"}`}>
                  <div className="activity-date">
                    {new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </div>
                  <div className="activity-icon">
                    {item.paid_to ? "🤝" : "🧾"}
                  </div>
                  <div className="activity-info">
                    {item.paid_to ? (
                      <p><strong>{item.payer?.name}</strong> paid <strong>{item.receiver?.name}</strong></p>
                    ) : (
                      <>
                        <p className="desc">{item.description}</p>
                        <p className="meta">
                          Paid by {item.users?.name}
                          {item.split_method && item.split_method !== "equal" && (
                            <span className="split-badge"> · {item.split_method}</span>
                          )}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="activity-right">
                    <div className={`activity-amount ${item.paid_to ? "settlement" : ""}`}>
                      ₹{item.amount}
                    </div>
                    {!item.paid_to && (
                      Number(item.created_by || item.paid_by) === Number(user.id)
                    ) && (
                      <>
                        <button className="edit-btn" title="Edit Expense" onClick={() => handleEdit(item)}>✏️</button>
                        <button className="edit-btn" title="Delete Expense" onClick={() => handleDeleteExpense(item.id)}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            {currentGroup.expenses.length === 0 && currentGroup.settlements.length === 0 && (
              <p className="empty-msg">No activity yet. Start by adding an expense!</p>
            )}
          </div>
        ) : (
          <div className="balances-section">
            {/* Your Balance Summary */}
            {(() => {
              const myBalance = balancesData.find(b => String(b.user_id) === String(user.id))?.balance || 0;
              return (
                <div className={`balance-summary ${myBalance > 0 ? "positive" : myBalance < 0 ? "negative" : "zero"}`}>
                  <span className="balance-summary-label">
                    {myBalance > 0 ? "You are owed" : myBalance < 0 ? "You owe" : "All settled up"}
                  </span>
                  <span className="balance-summary-amount">
                    {myBalance !== 0 && (myBalance > 0 ? "+" : "-")} ₹{Math.abs(myBalance).toFixed(2)}
                  </span>
                </div>
              );
            })()}

            {/* Per-Person Balances */}
            <div className="balances-list">
              {balancesData.filter(b => String(b.user_id) !== String(user.id)).map(b => (
                <div key={b.user_id} className="balance-item">
                  <div className="user-avatar">{b.name?.[0]}</div>
                  <div className="balance-item-info">
                    <div className="balance-item-name">{b.name}</div>
                    <div className={`balance-item-detail ${b.balance < 0 ? "positive" : b.balance > 0 ? "negative" : "zero"}`}>
                      {b.balance < 0
                        ? `${b.name} owes you ₹${Math.abs(b.balance).toFixed(2)}`
                        : b.balance > 0
                          ? `You owe ${b.name} ₹${Math.abs(b.balance).toFixed(2)}`
                          : "Settled up ✓"}
                    </div>
                  </div>
                  <div className={`balance-item-amount ${b.balance < 0 ? "positive" : b.balance > 0 ? "negative" : "zero"}`}>
                    {b.balance < 0 ? "+" : b.balance > 0 ? "-" : ""}₹{Math.abs(b.balance).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Settlement Plan */}
            {settlementPlan.length > 0 && (
              <>
                <h4 className="section-title">Suggested payments</h4>
                <div className="settlement-plan">
                  {settlementPlan.map((t, i) => (
                    <div key={i} className="settlement-item" onClick={() => {
                      setSettleForm({
                        paid_by: t.from,
                        paid_to: t.to,
                        amount: t.amount,
                        date: new Date().toISOString().split("T")[0],
                        description: "",
                      });
                      setShowSettleModal(true);
                    }}>
                      <span className="settle-from">{t.fromName}</span>
                      <span className="settle-arrow">pays</span>
                      <span className="settle-to">{t.toName}</span>
                      <span className="settle-badge">₹{t.amount.toFixed(2)}</span>
                      <button className="settle-cta" title="Record this payment">Record</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {balancesData.length === 0 && <p className="empty-msg">No expenses yet.</p>}
          </div>
        )}
      </main>

      {/* Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Member</h2>
            <form onSubmit={handleAddMember}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>User Email</label>
                <input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="friend@example.com" required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-text" onClick={() => setShowMemberModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editExpenseId ? "Edit Shared Expense" : "Add Shared Expense"}</h2>
            <form onSubmit={handleAddExpense}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Description</label>
                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="e.g. Dinner" required autoFocus />
              </div>
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Amount</label>
                  <input type="number" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Paid By</label>
                <select value={expenseForm.paid_by} onChange={e => setExpenseForm({...expenseForm, paid_by: e.target.value})}>
                  {currentGroup.members?.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.email === user?.email && "(You)"}</option>
                  ))}
                </select>
              </div>

              {/* Split Method Selector */}
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Split Method</label>
                <select value={splitMethod} onChange={e => { setSplitMethod(e.target.value); setSplitData({}); }}>
                  {SPLIT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Split Inputs */}
              {splitMethod !== "equal" && (
                <div className="split-inputs">
                  {currentGroup.members?.map(m => (
                    <div key={m.id} className="split-input-row">
                      <span className="split-label">
                        {m.name} {m.email === user?.email && "(You)"} <strong>owes</strong>
                      </span>
                      <div className="split-input-wrap">
                        <input
                          type="number"
                          step={splitMethod === "percentage" ? "1" : "0.01"}
                          min="0"
                          placeholder={splitMethod === "exact" ? "Amount"
                            : splitMethod === "percentage" ? "%"
                            : splitMethod === "shares" ? "Shares"
                            : "Adjustment"}
                          value={getSplitValue(m.id)}
                          onChange={e => updateSplitEntry(m.id, e.target.value)}
                        />
                        {splitMethod === "percentage" && <span className="split-suffix">%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-text" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editExpenseId ? "Update Expense" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {showSettleModal && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal-content settle-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Settle Up</h2>
            <p className="settle-modal-hint">Record a payment between members to settle debts.</p>
            <form onSubmit={handleSettle}>
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Payer</label>
                  <select value={settleForm.paid_by} onChange={e => setSettleForm({...settleForm, paid_by: e.target.value})} required>
                    <option value="">Select payer</option>
                    {currentGroup.members?.map(m => (
                      <option key={m.id} value={m.id}>{m.name} {m.email === user?.email && "(You)"}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Receiver</label>
                  <select value={settleForm.paid_to} onChange={e => setSettleForm({...settleForm, paid_to: e.target.value})} required>
                    <option value="">Select receiver</option>
                    {currentGroup.members?.filter(m => String(m.id) !== String(settleForm.paid_by)).map(m => (
                      <option key={m.id} value={m.id}>{m.name} {m.email === user?.email && "(You)"}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div className="form-group">
                  <label>Amount (₹)</label>
                  <input type="number" step="0.01" value={settleForm.amount} onChange={e => setSettleForm({...settleForm, amount: e.target.value})} placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={settleForm.date} onChange={e => setSettleForm({...settleForm, date: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Description (optional)</label>
                <input type="text" value={settleForm.description} onChange={e => setSettleForm({...settleForm, description: e.target.value})} placeholder="e.g. UPI payment" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-text" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
