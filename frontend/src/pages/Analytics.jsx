import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { expenseAPI } from "../api/expenses";
import { getCategoryInfo, formatCurrency } from "../utils/constants";
import "./Analytics.css";

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    expenseAPI.getAnalytics()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const categoryData = (analytics?.byCategory || []).map((c) => ({
    name:   getCategoryInfo(c.category).label,
    amount: c.total,
    fill:   getCategoryInfo(c.category).color,
  }));

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>Deep dive into your spending patterns</p>
      </div>

      <div className="analytics-grid">
        {/* ── Monthly Trend (full width) ─────────────────────────── */}
        <div className="card analytics-card span-2">
          <h3>Monthly Spending Trend</h3>
          {analytics?.monthly?.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "var(--primary)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart" style={{ textAlign: "center", color: "var(--text-muted)", padding: "60px 0" }}>
              Not enough data yet
            </div>
          )}
        </div>

        {/* ── Category Bar Chart ────────────────────────────────── */}
        <div className="card analytics-card">
          <h3>Spending by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={95} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">No data yet</div>
          )}
        </div>

        {/* ── Month vs Last Month ───────────────────────────────── */}
        <div className="card analytics-card">
          <h3>This Month vs Last Month</h3>
          {analytics?.comparison?.length > 0 ? (
            <div className="comparison-list">
              {analytics.comparison.map((c) => {
                const cat    = getCategoryInfo(c.category);
                const change = c.current - c.previous;
                const pct    = c.previous
                  ? ((change / c.previous) * 100).toFixed(0)
                  : null;

                return (
                  <div key={c.category} className="comparison-item">
                    <span>{cat.icon} {cat.label}</span>
                    <div className="comparison-right">
                      <span className="comp-curr">{formatCurrency(c.current)}</span>
                      {pct !== null && (
                        <span className={`comp-change ${change > 0 ? "up" : change < 0 ? "down" : "neutral"}`}>
                          {change > 0 ? "▲" : "▼"} {Math.abs(pct)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">Not enough data to compare</div>
          )}
        </div>
      </div>
    </div>
  );
}
