const express = require("express");
const supabase = require("../db/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// GET /api/budgets
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", req.user.id)
    .order("category");
  if (error) return res.status(500).json({ message: error.message });
  res.json(data);
});

// POST /api/budgets  (upsert by user_id + category)
router.post("/", async (req, res) => {
  const { category, amount, period } = req.body;
  if (!category || !amount)
    return res.status(400).json({ message: "Category and amount are required" });

  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { user_id: req.user.id, category, amount: parseFloat(amount), period: period || "monthly" },
      { onConflict: "user_id,category" }
    )
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  res.status(201).json(data);
});

// DELETE /api/budgets/:id
router.delete("/:id", async (req, res) => {
  const { data: existing } = await supabase
    .from("budgets").select("*").eq("id", req.params.id).eq("user_id", req.user.id).single();
  if (!existing) return res.status(404).json({ message: "Budget not found" });

  const { error } = await supabase.from("budgets").delete().eq("id", req.params.id).eq("user_id", req.user.id);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ success: true });
});

module.exports = router;
