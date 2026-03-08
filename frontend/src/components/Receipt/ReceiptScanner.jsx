import { useState, useRef, useCallback } from "react";
import { receiptAPI } from "../../api/expenses";
import { useExpenses } from "../../context/ExpenseContext";
import { CATEGORIES, PAYMENT_METHODS, formatCurrency, formatDate } from "../../utils/constants";
import "./ReceiptScanner.css";

const EMPTY = {
  merchant: "", amount: "", category: "other", description: "",
  date: new Date().toISOString().split("T")[0],
  payment_method: "Cash",
};

// Confidence badge colour
function ConfidenceBadge({ value }) {
  const pct   = Math.round((value || 0) * 100);
  const color = pct >= 80 ? "#10b981" : pct >= 55 ? "#f59e0b" : "#ef4444";
  const label = pct >= 80 ? "High confidence" : pct >= 55 ? "Review recommended" : "Low confidence — check fields";
  return (
    <div className="confidence-badge" style={{ "--conf-color": color }}>
      <svg viewBox="0 0 36 36" className="conf-ring">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x="18" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      <div>
        <div className="conf-title">OCR Confidence</div>
        <div className="conf-label" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

// Item chips from receipt line items
function ItemsList({ items }) {
  if (!items?.length) return null;
  return (
    <div className="items-list">
      <div className="items-label">Detected items</div>
      <div className="items-chips">
        {items.map((item, i) => (
          <span key={i} className="item-chip">{item}</span>
        ))}
      </div>
    </div>
  );
}

export default function ReceiptScanner({ onClose }) {
  const [stage,     setStage]     = useState("upload");   // upload | scanning | review | success
  const [file,      setFile]      = useState(null);
  const [preview,   setPreview]   = useState(null);        // data URL for images
  const [isPdf,     setIsPdf]     = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [error,     setError]     = useState("");
  const [extracted, setExtracted] = useState(null);        // raw AI result
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [savedExp,  setSavedExp]  = useState(null);

  const inputRef = useRef(null);
  const { fetchExpenses } = useExpenses();

  // ── File selection ─────────────────────────────────────────────────────────

  const acceptFile = useCallback((f) => {
    if (!f) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(f.type)) {
      setError("Unsupported file type. Please upload a JPG, PNG, WEBP, or PDF.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10 MB.");
      return;
    }
    setError("");
    setFile(f);
    setIsPdf(f.type === "application/pdf");

    if (f.type !== "application/pdf") {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  const onFileInput = (e) => acceptFile(e.target.files[0]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    acceptFile(e.dataTransfer.files[0]);
  }, [acceptFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  // ── Scan ───────────────────────────────────────────────────────────────────

  const startScan = async () => {
    if (!file) return;
    setStage("scanning");
    setError("");

    try {
      const res = await receiptAPI.scan(file);
      const ext = res.extracted;
      setExtracted(ext);

      // Pre-fill the editable form with extracted data
      setForm({
        merchant:       ext.merchant       || "",
        amount:         ext.amount > 0     ? String(ext.amount) : "",
        category:       ext.category       || "other",
        description:    ext.description    || (ext.items?.length ? ext.items.slice(0, 3).join(", ") : ""),
        date:           ext.date           || new Date().toISOString().split("T")[0],
        payment_method: ext.payment_method || "Cash",
      });

      setStage("review");
    } catch (err) {
      setError(err?.message || "Scanning failed. Please try a clearer image.");
      setStage("upload");
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveExpense = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await receiptAPI.save(form);
      setSavedExp(res.expense);
      setStage("success");
      fetchExpenses({});
    } catch (err) {
      setError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStage("upload"); setFile(null); setPreview(null); setIsPdf(false);
    setError(""); setExtracted(null); setForm(EMPTY); setSavedExp(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const upd = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="receipt-overlay" onClick={onClose}>
      <div className="receipt-modal card" onClick={e => e.stopPropagation()}>

        {/* ── Modal header ─────────────────────────────────────── */}
        <div className="receipt-header">
          <div className="receipt-header-left">
            <span className="receipt-header-icon">🧾</span>
            <div>
              <div className="receipt-title">Receipt Scanner</div>
              <div className="receipt-subtitle">Extract expenses from receipts using AI</div>
            </div>
          </div>
          <button className="receipt-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Step indicator ───────────────────────────────────── */}
        <div className="receipt-steps">
          {["Upload", "Scan", "Review", "Done"].map((s, i) => {
            const idx = ["upload","scanning","review","success"].indexOf(stage);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s} className={`step ${active ? "active" : ""} ${done ? "done" : ""}`}>
                <div className="step-dot">{done ? "✓" : i + 1}</div>
                <div className="step-label">{s}</div>
                {i < 3 && <div className="step-line" />}
              </div>
            );
          })}
        </div>

        {/* ── Error banner ─────────────────────────────────────── */}
        {error && (
          <div className="receipt-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")}>✕</button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STAGE: UPLOAD
        ═══════════════════════════════════════════════════════ */}
        {stage === "upload" && (
          <div className="stage-upload">
            {/* Drop zone */}
            <div
              className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              onClick={() => !file && inputRef.current?.click()}
            >
              <input
                ref={inputRef} type="file" hidden
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={onFileInput}
              />

              {/* Preview */}
              {file ? (
                <div className="file-preview">
                  {isPdf ? (
                    <div className="pdf-preview">
                      <div className="pdf-icon">📄</div>
                      <div className="pdf-name">{file.name}</div>
                      <div className="pdf-size">{(file.size / 1024).toFixed(0)} KB</div>
                    </div>
                  ) : (
                    <img src={preview} alt="Receipt preview" className="img-preview" />
                  )}
                  <button className="change-file-btn" onClick={e => { e.stopPropagation(); reset(); }}>
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div className="drop-prompt">
                  <div className="drop-icon">📸</div>
                  <div className="drop-title">Drop your receipt here</div>
                  <div className="drop-sub">or click to browse</div>
                  <div className="drop-formats">JPG · PNG · WEBP · PDF &nbsp;•&nbsp; Max 10 MB</div>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="scan-tips">
              <div className="tips-title">📋 Tips for best results</div>
              <div className="tips-grid">
                <div className="tip">✅ Good lighting, no shadows</div>
                <div className="tip">✅ Receipt fully in frame</div>
                <div className="tip">✅ Text clearly readable</div>
                <div className="tip">✅ Digital PDF receipts work great</div>
              </div>
            </div>

            <button
              className="btn btn-primary scan-btn"
              onClick={startScan}
              disabled={!file}
            >
              🔍 Scan Receipt
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STAGE: SCANNING
        ═══════════════════════════════════════════════════════ */}
        {stage === "scanning" && (
          <div className="stage-scanning">
            <div className="scanning-animation">
              <div className="scan-pulse">
                {isPdf
                  ? <span className="scan-emoji">📄</span>
                  : preview && <img src={preview} alt="Scanning" className="scan-thumb" />}
                <div className="scan-beam" />
              </div>
            </div>
            <div className="scanning-label">Analysing receipt with Gemini AI…</div>
            <div className="scanning-sub">Extracting merchant, amount, date and items</div>
            <div className="scanning-dots"><span /><span /><span /></div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STAGE: REVIEW
        ═══════════════════════════════════════════════════════ */}
        {stage === "review" && extracted && (
          <div className="stage-review">
            <div className="review-layout">

              {/* Left — thumbnail + confidence + items */}
              <div className="review-sidebar">
                {preview && !isPdf && (
                  <img src={preview} alt="Receipt" className="review-thumb" />
                )}
                {isPdf && (
                  <div className="review-pdf-thumb">
                    <div className="pdf-icon-lg">📄</div>
                    <div className="pdf-filename">{file?.name}</div>
                  </div>
                )}
                <ConfidenceBadge value={extracted.confidence} />
                {extracted.tax > 0 && (
                  <div className="tax-info">
                    <div className="tax-row">
                      <span>Subtotal</span><span>{formatCurrency(extracted.subtotal)}</span>
                    </div>
                    <div className="tax-row">
                      <span>Tax / GST</span><span>{formatCurrency(extracted.tax)}</span>
                    </div>
                    <div className="tax-row tax-total">
                      <span>Total</span><span>{formatCurrency(extracted.amount)}</span>
                    </div>
                  </div>
                )}
                <ItemsList items={extracted.items} />
              </div>

              {/* Right — editable form */}
              <div className="review-form">
                <div className="review-form-title">
                  Review & edit extracted details
                  <span className="review-hint">All fields are editable</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.amount}
                      onChange={upd("amount")}
                      className={!form.amount || parseFloat(form.amount) <= 0 ? "input-warn" : ""}
                    />
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" value={form.date} onChange={upd("date")} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Merchant</label>
                  <input
                    type="text" placeholder="Store / restaurant name"
                    value={form.merchant} onChange={upd("merchant")}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select value={form.category} onChange={upd("category")}>
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment Method</label>
                    <select value={form.payment_method} onChange={upd("payment_method")}>
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text" placeholder="What was this for?"
                    value={form.description} onChange={upd("description")}
                  />
                </div>

                <div className="review-actions">
                  <button className="btn btn-ghost" onClick={reset}>← Rescan</button>
                  <button
                    className="btn btn-primary"
                    onClick={saveExpense}
                    disabled={saving || !form.amount}
                  >
                    {saving
                      ? <><span className="spinner" style={{ width: 15, height: 15 }} /> Saving…</>
                      : "✅ Add to Expenses"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            STAGE: SUCCESS
        ═══════════════════════════════════════════════════════ */}
        {stage === "success" && savedExp && (
          <div className="stage-success">
            <div className="success-icon">🎉</div>
            <div className="success-title">Expense Added!</div>
            <div className="success-card card">
              <div className="success-amount">{formatCurrency(savedExp.amount)}</div>
              <div className="success-merchant">{savedExp.merchant || savedExp.description || "Receipt expense"}</div>
              <div className="success-meta">
                <span>📅 {formatDate(savedExp.date)}</span>
                <span>💳 {savedExp.payment_method}</span>
              </div>
            </div>
            <div className="success-actions">
              <button className="btn btn-ghost" onClick={reset}>📸 Scan Another</button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
