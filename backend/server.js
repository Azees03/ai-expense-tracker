require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const authRoutes    = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");
const budgetRoutes  = require("./routes/budget");
const chatRoutes    = require("./routes/chat");
const receiptRoutes = require("./routes/receipts");
const groupRoutes   = require("./routes/groups");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile, curl)
    if (!origin) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any *.vercel.app subdomain
    if (origin.endsWith(".vercel.app")) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Handle preflight OPTIONS for every route
app.options("*", cors(corsOptions));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ── Request logger ────────────────────────────────────────────────────────────
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
app.use("/api/groups",   groupRoutes);

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