const express = require("express");
const supabase = require("../db/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/groups ──────────────────────────────────────────────────────────
// List all groups the user is a member of
router.get("/", async (req, res) => {
  const uid = req.user.id;

  // First get the group IDs for this user
  const { data: memberships, error: memError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", uid);

  if (memError) return res.status(500).json({ message: memError.message });
  if (!memberships || memberships.length === 0) return res.json([]);

  const groupIds = memberships.map(m => m.group_id);

  // Then fetch the group details
  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("*, group_members(count)")
    .in("id", groupIds)
    .order("created_at", { ascending: false });

  if (groupsError) return res.status(500).json({ message: groupsError.message });

  res.json(groups);
});

// ── POST /api/groups ─────────────────────────────────────────────────────────
// Create a new group
router.post("/", async (req, res) => {
  const { name } = req.body;
  const uid = req.user.id;

  if (!name) return res.status(400).json({ message: "Group name is required" });

  // 1. Create the group
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ name, created_by: uid })
    .select()
    .single();

  if (groupError) return res.status(500).json({ message: groupError.message });

  // 2. Add the creator as the first member
  const { error: memError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: uid });

  if (memError) return res.status(500).json({ message: memError.message });

  res.status(201).json(group);
});

// ── GET /api/groups/:id ──────────────────────────────────────────────────────
// Get detailed info for a specific group
router.get("/:id", async (req, res) => {
  const gid = req.params.id;
  const uid = req.user.id;

  // Check if user is a member
  const { data: member } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", gid)
    .eq("user_id", uid)
    .single();

  if (!member) return res.status(403).json({ message: "Not a member of this group" });

  // Fetch group details
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", gid)
    .single();

  if (groupError) return res.status(500).json({ message: groupError.message });

  // Fetch members
  const { data: members, error: memError } = await supabase
    .from("group_members")
    .select("user_id, users(id, name, email)")
    .eq("group_id", gid);

  if (memError) return res.status(500).json({ message: memError.message });

  // Fetch recent expenses
  const { data: expenses, error: expError } = await supabase
    .from("group_expenses")
    .select("*, users!group_expenses_paid_by_fkey(id, name)")
    .eq("group_id", gid)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (expError) return res.status(500).json({ message: expError.message });

  // Fetch recent settlements
  const { data: settlements, error: setError } = await supabase
    .from("settlements")
    .select("*, payer:users!settlements_paid_by_fkey(id, name), receiver:users!settlements_paid_to_fkey(id, name)")
    .eq("group_id", gid)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (setError) return res.status(500).json({ message: setError.message });

  res.json({
    ...group,
    members: members.map(m => m.users),
    expenses: expenses || [],
    settlements: settlements || []
  });
});

// ── POST /api/groups/:id/members ─────────────────────────────────────────────
// Add a member to a group by email
router.post("/:id/members", async (req, res) => {
  const gid = req.params.id;
  const uid = req.user.id;
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  // 0. Check if requester is a member
  const { data: requester } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", gid)
    .eq("user_id", uid)
    .single();

  if (!requester) return res.status(403).json({ message: "Only group members can add others" });

  // 1. Find the user by email
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (userError || !user) return res.status(404).json({ message: "User not found with this email" });

  // 2. Check if already a member
  const { data: existing } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", gid)
    .eq("user_id", user.id)
    .single();

  if (existing) return res.status(400).json({ message: "User is already a member" });

  // 3. Add to group
  const { error: memError } = await supabase
    .from("group_members")
    .insert({ group_id: gid, user_id: user.id });

  if (memError) return res.status(500).json({ message: memError.message });

  res.json({ success: true });
});

// ── POST /api/groups/:id/expenses ────────────────────────────────────────────
// Add a shared expense
router.post("/:id/expenses", async (req, res) => {
  const gid = req.params.id;
  const { amount, description, date, paid_by } = req.body;
  const amountNum = parseFloat(amount);

  if (!amount || !description || !date || !paid_by) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 1. Create the group expense
  const { data: expense, error: expError } = await supabase
    .from("group_expenses")
    .insert({
      group_id: gid,
      paid_by,
      amount: amountNum,
      description,
      date
    })
    .select()
    .single();

  if (expError) return res.status(500).json({ message: expError.message });

  // 2. Calculate splits (Equal splitting)
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", gid);

  const splitAmount = amountNum / members.length;

  const splits = members.map(m => ({
    expense_id: expense.id,
    user_id: m.user_id,
    amount_owed: splitAmount
  }));

  const { error: splitError } = await supabase
    .from("group_expense_splits")
    .insert(splits);

  if (splitError) return res.status(500).json({ message: splitError.message });

  res.status(201).json(expense);
});

// ── PUT /api/groups/:id/expenses/:expenseId ──────────────────────────────────
// Edit a shared expense and update splits
router.put("/:id/expenses/:expenseId", async (req, res) => {
  const gid = parseInt(req.params.id);
  const eid = parseInt(req.params.expenseId);
  const { amount, description, date, paid_by } = req.body;
  const amountNum = parseFloat(amount);

  console.log(`[Groups] Editing expense ${eid} in group ${gid}`);

  if (!amount || !description || !date || !paid_by) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 1. Update the group expense
  const { data: expense, error: expError } = await supabase
    .from("group_expenses")
    .update({
      paid_by: parseInt(paid_by),
      amount: amountNum,
      description,
      date
    })
    .eq("id", eid)
    .eq("group_id", gid)
    .select()
    .single();

  if (expError) {
    console.error("[Groups] Update Expense Error:", expError);
    return res.status(500).json({ message: expError.message });
  }

  if (!expense) {
    return res.status(404).json({ message: "Expense not found" });
  }

  // 2. Recalculate splits (Equal splitting)
  const { data: members, error: memError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", gid);

  if (memError) {
    console.error("[Groups] Fetch Members Error:", memError);
    return res.status(500).json({ message: memError.message });
  }

  const splitAmount = amountNum / members.length;

  // 3. Delete old splits and insert new ones
  const { error: delError } = await supabase
    .from("group_expense_splits")
    .delete()
    .eq("expense_id", eid);

  if (delError) {
    console.error("[Groups] Delete Splits Error:", delError);
    return res.status(500).json({ message: delError.message });
  }

  const splits = members.map(m => ({
    expense_id: eid,
    user_id: m.user_id,
    amount_owed: splitAmount
  }));

  const { error: splitError } = await supabase
    .from("group_expense_splits")
    .insert(splits);

  if (splitError) {
    console.error("[Groups] Insert Splits Error:", splitError);
    return res.status(500).json({ message: splitError.message });
  }

  res.json(expense);
});

// ── GET /api/groups/:id/balances ─────────────────────────────────────────────
// Calculate net balances for all members in the group
router.get("/:id/balances", async (req, res) => {
  const gid = req.params.id;

  // 1. Get all members
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, users(id, name)")
    .eq("group_id", gid);

  const memberInfo = members.map(m => m.users);

  // 2. Get all expenses and their splits
  const { data: expenses } = await supabase
    .from("group_expenses")
    .select("id, paid_by, amount")
    .eq("group_id", gid);

  const { data: splits } = await supabase
    .from("group_expense_splits")
    .select("user_id, amount_owed")
    .in("expense_id", expenses.map(e => e.id) || []);

  // 3. Get all settlements
  const { data: settlements } = await supabase
    .from("settlements")
    .select("paid_by, paid_to, amount")
    .eq("group_id", gid);

  // 4. Calculate net balance for each user
  // Net balance = (What they are owed) - (What they owe)
  // Owed = Total they paid + Total they received in settlements
  // Owes = Total they were split into + Total they paid in settlements
  
  const balances = {};
  memberInfo.forEach(m => { balances[m.id] = 0; });

  // Add what they paid for expenses
  expenses?.forEach(e => {
    balances[e.paid_by] += parseFloat(e.amount);
  });

  // Subtract what they owe from splits
  splits?.forEach(s => {
    balances[s.user_id] -= parseFloat(s.amount_owed);
  });

  // Handle settlements
  settlements?.forEach(s => {
    balances[s.paid_by] += parseFloat(s.amount); // Reducing their debt/increasing their surplus
    balances[s.paid_to] -= parseFloat(s.amount); // Reducing what they are owed
  });

  // Format response: separate users into "positive" (owed) and "negative" (owe)
  const results = Object.entries(balances).map(([uid, balance]) => {
    const user = memberInfo.find(m => m.id == uid);
    return {
      user_id: parseInt(uid),
      name: user?.name,
      balance: parseFloat(balance.toFixed(2))
    };
  });

  res.json(results);
});

// ── POST /api/groups/:id/settlements ──────────────────────────────────────────
// Record a settlement between two users
router.post("/:id/settlements", async (req, res) => {
  const gid = req.params.id;
  const { paid_by, paid_to, amount, date } = req.body;

  if (!paid_by || !paid_to || !amount || !date) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const { data: settlement, error } = await supabase
    .from("settlements")
    .insert({
      group_id: gid,
      paid_by,
      paid_to,
      amount: parseFloat(amount),
      date
    })
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  res.status(201).json(settlement);
});

module.exports = router;
