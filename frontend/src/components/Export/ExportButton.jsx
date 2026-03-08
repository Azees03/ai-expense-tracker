import { useState, useRef, useEffect } from "react";
import { getCategoryInfo, formatCurrency, formatDate } from "../../utils/constants";

/* ── helpers ──────────────────────────────────────────────────────────── */

function toCSV(expenses) {
  const headers = ["Date", "Category", "Description", "Merchant", "Payment Method", "Amount (INR)"];
  const rows = expenses.map((e) => [
    formatDate(e.date),
    getCategoryInfo(e.category).label,
    `"${(e.description || "").replace(/"/g, '""')}"`,
    `"${(e.merchant   || "").replace(/"/g, '""')}"`,
    e.payment_method || "",
    parseFloat(e.amount).toFixed(2),
  ]);
  return [headers, ...rows].map((r) => r.join(",")).join("\n");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPDFContent(expenses, title) {
  const total   = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const catMap  = {};
  expenses.forEach((e) => {
    const label = getCategoryInfo(e.category).label;
    catMap[label] = (catMap[label] || 0) + parseFloat(e.amount);
  });

  const catRows = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([cat, amt]) =>
        `<tr><td>${cat}</td><td style="text-align:right">${formatCurrency(amt)}</td></tr>`
    )
    .join("");

  const expRows = expenses
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${getCategoryInfo(e.category).label}</td>
        <td>${e.description || "—"}</td>
        <td>${e.merchant || "—"}</td>
        <td>${e.payment_method || "—"}</td>
        <td style="text-align:right;font-weight:600;color:#ef4444">${formatCurrency(e.amount)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 32px; }
  h1   { font-size: 22px; color: #6366f1; margin-bottom: 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 28px; }
  h2   { font-size: 15px; margin-bottom: 12px; color: #1e293b; }

  .summary { display: flex; gap: 24px; margin-bottom: 28px; }
  .stat    { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 20px; flex: 1; }
  .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
  .stat-value { font-size: 20px; font-weight: 700; margin-top: 4px; color: #1e293b; }

  table        { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  th           { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600;
                 color: #64748b; text-transform: uppercase; letter-spacing: .04em;
                 border-bottom: 2px solid #e2e8f0; background: #f8fafc; }
  td           { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:hover td  { background: #f8fafc; }
  .footer      { color: #94a3b8; font-size: 11px; text-align: center; padding-top: 16px;
                 border-top: 1px solid #e2e8f0; }
</style>
</head>
<body>
  <h1>💰 SpendSmart — Expense Report</h1>
  <p class="sub">Generated on ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} · ${expenses.length} transactions</p>

  <div class="summary">
    <div class="stat">
      <div class="stat-label">Total Spent</div>
      <div class="stat-value">${formatCurrency(total)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Transactions</div>
      <div class="stat-value">${expenses.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Avg per Transaction</div>
      <div class="stat-value">${formatCurrency(expenses.length ? total / expenses.length : 0)}</div>
    </div>
  </div>

  <h2>Category Breakdown</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <h2>All Transactions</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Category</th><th>Description</th>
        <th>Merchant</th><th>Payment</th><th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${expRows}</tbody>
  </table>

  <div class="footer">SpendSmart AI Expense Tracker — ${title}</div>
</body>
</html>`;
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function ExportButton({ expenses = [], label = "Export" }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState("");
  const ref                   = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filename = `expenses_${new Date().toISOString().split("T")[0]}`;

  const handleCSV = () => {
    setLoading("csv");
    try {
      downloadFile(toCSV(expenses), `${filename}.csv`, "text/csv;charset=utf-8;");
    } finally {
      setLoading("");
      setOpen(false);
    }
  };

  const handlePDF = () => {
    setLoading("pdf");
    try {
      const html   = buildPDFContent(expenses, filename);
      const win    = window.open("", "_blank");
      win.document.write(html);
      win.document.close();
      // Give browser a moment to render then trigger print dialog
      setTimeout(() => {
        win.focus();
        win.print();
        setLoading("");
        setOpen(false);
      }, 600);
    } catch {
      setLoading("");
      setOpen(false);
    }
  };

  const disabled = expenses.length === 0;

  return (
    <div className="export-wrapper" ref={ref}>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title={disabled ? "No expenses to export" : "Export expenses"}
      >
        📤 {label}
      </button>

      {open && (
        <div className="export-dropdown">
          <button className="export-option" onClick={handleCSV} disabled={!!loading}>
            {loading === "csv" ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "📊"}
            Export as CSV
          </button>
          <button className="export-option" onClick={handlePDF} disabled={!!loading}>
            {loading === "pdf" ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "📄"}
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
