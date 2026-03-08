const express = require("express");
const supabase = require("../db/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// ── helpers ──────────────────────────────────────────────────────────────────

function monthBounds(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1 + offset;   // offset: 0 = this month, -1 = last
  const date = new Date(y, m - 1, 1);
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  return { start, end };
}

// ── GET /api/expenses/summary ─────────────────────────────────────────────────
router.get("/summary", async (req, res) => {
  const uid = req.user.id;
  const { start: thisStart } = monthBounds(0);
  const { start: lastStart, end: lastEnd } = monthBounds(-1);

  // This month total + count
  const { data: thisMonth } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", uid)
    .gte("date", thisStart);

  const monthTotal = thisMonth?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  const monthCount = thisMonth?.length || 0;

  // Last month total
  const { data: lastMonth } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", uid)
    .gte("date", lastStart)
    .lte("date", lastEnd);

  const lastTotal = lastMonth?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  const monthChange = lastTotal > 0 ? ((monthTotal - lastTotal) / lastTotal) * 100 : 0;

  // By category this month
  const { data: all } = await supabase
    .from("expenses")
    .select("category, amount")
    .eq("user_id", uid)
    .gte("date", thisStart);

  const catMap = {};
  all?.forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + parseFloat(e.amount);
  });
  const byCategory = Object.entries(catMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // Recent 5
  const { data: recent } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", uid)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const daysInMonth = new Date().getDate();
  const topCat = byCategory[0];

  res.json({
    monthTotal,
    monthCount,
    dailyAvg: daysInMonth > 0 ? monthTotal / daysInMonth : 0,
    monthChange: parseFloat(monthChange.toFixed(1)),
    byCategory,
    topCategory: topCat?.category || null,
    topCategoryAmount: topCat?.total || 0,
    recent: recent || [],
  });
});

// ── GET /api/expenses/analytics ───────────────────────────────────────────────
router.get("/analytics", async (req, res) => {
  const uid = req.user.id;

  // All expenses last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  const { data: all } = await supabase
    .from("expenses")
    .select("amount, category, date")
    .eq("user_id", uid)
    .gte("date", fromDate);

  // Monthly totals
  const monthMap = {};
  all?.forEach(e => {
    const month = e.date.substring(0, 7); // YYYY-MM
    monthMap[month] = (monthMap[month] || 0) + parseFloat(e.amount);
  });
  const monthly = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));

  // By category (all time)
  const { data: allTime } = await supabase
    .from("expenses")
    .select("amount, category")
    .eq("user_id", uid);

  const catMap = {};
  allTime?.forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + parseFloat(e.amount);
  });
  const byCategory = Object.entries(catMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // Month vs last month comparison
  const { start: thisStart } = monthBounds(0);
  const { start: lastStart, end: lastEnd } = monthBounds(-1);

  const { data: thisMonthData } = await supabase.from("expenses").select("amount,category").eq("user_id", uid).gte("date", thisStart);
  const { data: lastMonthData } = await supabase.from("expenses").select("amount,category").eq("user_id", uid).gte("date", lastStart).lte("date", lastEnd);

  const thisMap = {}, lastMap = {};
  thisMonthData?.forEach(e => { thisMap[e.category] = (thisMap[e.category] || 0) + parseFloat(e.amount); });
  lastMonthData?.forEach(e => { lastMap[e.category] = (lastMap[e.category] || 0) + parseFloat(e.amount); });

  const comparison = Object.entries(thisMap).map(([category, current]) => ({
    category, current, previous: lastMap[category] || 0
  }));

  res.json({ monthly, byCategory, comparison });
});

// ── GET /api/expenses ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const uid = req.user.id;
  const { category, search, page = 1, limit = 20, sort = "date", order = "DESC" } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  const validSorts = ["date", "amount", "category"];
  const sortCol = validSorts.includes(sort) ? sort : "date";
  const ascending = order === "ASC";

  let query = supabase.from("expenses").select("*", { count: "exact" }).eq("user_id", uid);
  if (category) query = query.eq("category", category);
  if (search) query = query.or(`description.ilike.%${search}%,merchant.ilike.%${search}%`);
  query = query.order(sortCol, { ascending }).order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ message: error.message });

  res.json({ expenses: data, total: count, page: pageNum, pages: Math.ceil(count / limitNum) });
});

// ── GET /api/expenses/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ message: "Expense not found" });
  res.json(data);
});

// ── POST /api/expenses ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { amount, category, description, date, payment_method, merchant } = req.body;
  if (!amount || !date) return res.status(400).json({ message: "Amount and date are required" });

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: req.user.id,
      amount: parseFloat(amount),
      category: category || "other",
      description: description || "",
      date,
      payment_method: payment_method || "Cash",
      merchant: merchant || "",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  res.status(201).json(data);
});

// ── PUT /api/expenses/:id ─────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const { data: existing } = await supabase
    .from("expenses").select("*").eq("id", req.params.id).eq("user_id", req.user.id).single();
  if (!existing) return res.status(404).json({ message: "Expense not found" });

  const updates = {};
  const allowed = ["amount", "category", "description", "date", "payment_method", "merchant"];
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("expenses").update(updates).eq("id", req.params.id).eq("user_id", req.user.id).select().single();
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

// ── DELETE /api/expenses/:id ──────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const { data: existing } = await supabase
    .from("expenses").select("*").eq("id", req.params.id).eq("user_id", req.user.id).single();
  if (!existing) return res.status(404).json({ message: "Expense not found" });

  const { error } = await supabase.from("expenses").delete().eq("id", req.params.id).eq("user_id", req.user.id);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ success: true, deleted: existing });
});

module.exports = router;
