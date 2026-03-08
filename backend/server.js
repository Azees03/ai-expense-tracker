require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes    = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");
const budgetRoutes  = require("./routes/budget");
const chatRoutes    = require("./routes/chat");
const receiptRoutes = require("./routes/receipts");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/budgets",  budgetRoutes);
app.use("/api/chat",     chatRoutes);
app.use("/api/receipts", receiptRoutes);

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server running on http://localhost:${PORT}`);
  console.log(`🗄️   Supabase: ${process.env.SUPABASE_URL ? "✅ connected" : "❌ SUPABASE_URL missing"}`);
  console.log(`🔑  JWT:      ${process.env.JWT_SECRET   ? "✅ set"       : "❌ JWT_SECRET missing"}\n`);
});
