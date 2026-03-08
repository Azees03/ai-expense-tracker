import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { expenseAPI } from "../api/expenses";
import { formatCurrency, getCategoryInfo } from "../utils/constants";
import "./Dashboard.css";

export default function Dashboard() {
  const [summary,   setSummary]   = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([expenseAPI.getSummary(), expenseAPI.getAnalytics()])
      .then(([s, a]) => { setSummary(s); setAnalytics(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="page-loading"><div className="spinner" /></div>;

  const categoryData = (summary?.byCategory || []).map((c) => ({
    name:  getCategoryInfo(c.category).label,
    value: c.total,
    color: getCategoryInfo(c.category).color,
  }));

  const monthChange = summary?.monthChange || 0;

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your financial overview for this month</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card card">
          <div className="stat-icon" style={{ background: "#e0e7ff" }}>💰</div>
          <div>
            <div className="stat-label">Total This Month</div>
            <div className="stat-value">{formatCurrency(summary?.monthTotal)}</div>
            <div className="stat-sub" style={{ color: monthChange > 0 ? "var(--danger)" : "var(--success)" }}>
              {monthChange > 0 ? "▲" : "▼"} {Math.abs(monthChange).toFixed(1)}% vs last month
            </div>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon" style={{ background: "#d1fae5" }}>📋</div>
          <div>
            <div className="stat-label">Transactions</div>
            <div className="stat-value">{summary?.monthCount || 0}</div>
            <div className="stat-sub">This month</div>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon" style={{ background: "#fef3c7" }}>📅</div>
          <div>
            <div className="stat-label">Daily Average</div>
            <div className="stat-value">{formatCurrency(summary?.dailyAvg)}</div>
            <div className="stat-sub">This month</div>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon" style={{ background: "#fce7f3" }}>🏆</div>
          <div>
            <div className="stat-label">Top Category</div>
            <div className="stat-value">
              {getCategoryInfo(summary?.topCategory)?.label || "—"}
            </div>
            <div className="stat-sub">{formatCurrency(summary?.topCategoryAmount)}</div>
          </div>
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────── */}
      <div className="charts-grid">
        <div className="card chart-card">
          <h3>Spending by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%" cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">No data yet — add some expenses!</div>
          )}
        </div>

        <div className="card chart-card">
          <h3>Monthly Spending Trend</h3>
          {analytics?.monthly?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">No data yet</div>
          )}
        </div>
      </div>

      {/* ── Recent transactions ──────────────────────────────────────── */}
      <div className="card recent-card">
        <h3>Recent Transactions</h3>
        {summary?.recent?.length > 0 ? (
          <div className="recent-list">
            {summary.recent.map((exp) => {
              const cat = getCategoryInfo(exp.category);
              return (
                <div key={exp.id} className="recent-item">
                  <div
                    className="recent-item-icon"
                    style={{ background: cat.color + "20" }}
                  >
                    {cat.icon}
                  </div>
                  <div className="recent-info">
                    <div className="recent-desc">{exp.description || cat.label}</div>
                    <div className="recent-meta">
                      {cat.label} ·{" "}
                      {new Date(exp.date).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short",
                      })}
                    </div>
                  </div>
                  <div className="recent-amount">{formatCurrency(exp.amount)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No expenses yet. Add your first one!</div>
        )}
      </div>
    </div>
  );
}
