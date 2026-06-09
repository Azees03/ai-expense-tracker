import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useGroups } from "../context/GroupContext";
import { useAuth } from "../context/AuthContext";
import { groupAPI } from "../api/groups";
import "./GroupDetails.css";

export default function GroupDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { currentGroup, fetchGroupDetails, loading } = useGroups();
  
  const [activeTab, setActiveTab] = useState("expenses"); // expenses | balances
  const [balances, setBalances] = useState([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  
  // Form states
  const [memberEmail, setMemberEmail] = useState("");
  const [editExpenseId, setEditExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: "", date: new Date().toISOString().split("T")[0], paid_by: user?.id });
  const [settleForm, setSettleForm] = useState({ paid_to: "", amount: "", date: new Date().toISOString().split("T")[0] });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchGroupDetails(id);
    loadBalances();
  }, [id, fetchGroupDetails]);

  const loadBalances = async () => {
    try {
      const data = await groupAPI.getBalances(id);
      setBalances(data);
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

  const handleEdit = (exp) => {
    setEditExpenseId(exp.id);
    setExpenseForm({
      description: exp.description,
      amount: exp.amount,
      date: exp.date?.split("T")[0] || "",
      paid_by: exp.paid_by
    });
    setShowExpenseModal(true);
  };

  const openAddExpense = () => {
    setEditExpenseId(null);
    setExpenseForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0], paid_by: user?.id });
    setShowExpenseModal(true);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editExpenseId) {
        await groupAPI.updateExpense(id, editExpenseId, expenseForm);
      } else {
        await groupAPI.addExpense(id, expenseForm);
      }
      setExpenseForm({ description: "", amount: "", date: new Date().toISOString().split("T")[0], paid_by: user?.id });
      setEditExpenseId(null);
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
      await groupAPI.addSettlement(id, { ...settleForm, paid_by: user.id });
      setSettleForm({ paid_to: "", amount: "", date: new Date().toISOString().split("T")[0] });
      setShowSettleModal(false);
      fetchGroupDetails(id);
      loadBalances();
    } catch (err) {
      alert(err?.message || "Error settling up");
    } finally {
      setSubmitting(false);
    }
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
          <button className="btn btn-ghost" onClick={() => setShowSettleModal(true)}>🤝 Settle Up</button>
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
                        <p className="meta">Paid by {item.users?.name}</p>
                      </>
                    )}
                  </div>
                  <div className="activity-right">
                    <div className={`activity-amount ${item.paid_to ? "settlement" : ""}`}>
                      ₹{item.amount}
                    </div>
                    {!item.paid_to && (
                      <button className="edit-btn" title="Edit Expense" onClick={() => handleEdit(item)}>✏️</button>
                    )}
                  </div>
                </div>
              ))}
            {currentGroup.expenses.length === 0 && currentGroup.settlements.length === 0 && (
              <p className="empty-msg">No activity yet. Start by adding an expense!</p>
            )}
          </div>
        ) : (
          <div className="balances-list">
            {balances.map(b => (
              <div key={b.user_id} className="balance-item">
                <div className="user-avatar">{b.name[0]}</div>
                <div className="user-name">{b.name} {b.user_id === user.id && "(You)"}</div>
                <div className={`user-status ${b.balance > 0 ? "positive" : b.balance < 0 ? "negative" : ""}`}>
                  {b.balance > 0 ? `is owed ₹${b.balance}` : b.balance < 0 ? `owes ₹${Math.abs(b.balance)}` : "is settled up"}
                </div>
              </div>
            ))}
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
                  <label>Amount (₹)</label>
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
                    <option key={m.id} value={m.id}>{m.name} {m.id === user.id && "(You)"}</option>
                  ))}
                </select>
              </div>
              <p className="split-note">This expense will be split equally among all members.</p>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Settle Up</h2>
            <form onSubmit={handleSettle}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Pay To</label>
                <select value={settleForm.paid_to} onChange={e => setSettleForm({...settleForm, paid_to: e.target.value})} required>
                  <option value="">Select a member</option>
                  {currentGroup.members?.filter(m => m.id !== user.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
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
              <div className="modal-actions">
                <button type="button" className="btn btn-text" onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
