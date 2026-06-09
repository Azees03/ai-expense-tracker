const express = require("express");
const supabase = require("../db/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Round a number to 2 decimal places
 */
function r2(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Compute per-user splits from the given method and data.
 * @param {'equal'|'exact'|'percentage'|'shares'|'adjustment'} method
 * @param {number} amount        – total expense amount
 * @param {Array<{user_id:number,name:string}>} members – all group members
 * @param {object|null} splitData  – configuration for the method
 * @returns {{splits:Array<{user_id:number,amount_owed:number}>, verification:{totalPaid:number,totalSplit:number,difference:number,note:string}}}
 */
function computeSplits(method, amount, members, splitData) {
  const totalPaid = amount;
  let rawSplits = [];
  let note = "";

  switch (method) {
    case "equal": {
      const raw = amount / members.length;
      const floored = Math.floor(raw * 100) / 100;
      const remainder = r2(amount - floored * members.length);
      const remainderCents = Math.round(remainder * 100);
      rawSplits = members.map((m, i) => ({
        user_id: m.user_id,
        amount_owed: i < remainderCents ? r2(floored + 0.01) : floored
      }));
      note = remainderCents > 0
        ? `Split equally (${remainderCents}¢ rounding adjustment applied)`
        : "Split equally";
      break;
    }

    case "exact": {
      if (!splitData || !splitData.amounts) {
        throw new Error("exact split requires splitData.amounts");
      }
      rawSplits = members.map(m => ({
        user_id: m.user_id,
        amount_owed: parseFloat(splitData.amounts[m.user_id]) || 0
      }));
      const totalSplit = rawSplits.reduce((s, x) => s + x.amount_owed, 0);
      note = `Exact amounts specified (total ${totalSplit.toFixed(2)} vs bill ${amount.toFixed(2)})`;
      break;
    }

    case "percentage": {
      if (!splitData || !splitData.percentages) {
        throw new Error("percentage split requires splitData.percentages");
      }
      rawSplits = members.map(m => ({
        user_id: m.user_id,
        amount_owed: r2(amount * (parseFloat(splitData.percentages[m.user_id]) || 0) / 100)
      }));
      // Adjust rounding so total matches exactly
      const currentTotal = rawSplits.reduce((s, x) => s + x.amount_owed, 0);
      const diff = r2(amount - currentTotal);
      if (diff !== 0) {
        rawSplits[0].amount_owed = r2(rawSplits[0].amount_owed + diff);
      }
      note = `Split by percentage (${diff !== 0 ? Math.round(diff * 100) + "¢ rounding adjustment" : "exact"})`;
      break;
    }

    case "shares": {
      if (!splitData || !splitData.shares) {
        throw new Error("shares split requires splitData.shares");
      }
      const totalShares = Object.values(splitData.shares).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (totalShares <= 0) throw new Error("Total shares must be positive");
      rawSplits = members.map(m => ({
        user_id: m.user_id,
        amount_owed: r2(amount * (parseFloat(splitData.shares[m.user_id]) || 0) / totalShares)
      }));
      const currentTotal = rawSplits.reduce((s, x) => s + x.amount_owed, 0);
      const diff = r2(amount - currentTotal);
      if (diff !== 0) {
        rawSplits[0].amount_owed = r2(rawSplits[0].amount_owed + diff);
      }
      note = `Split by shares (${totalShares} total shares${diff !== 0 ? ", " + Math.round(diff * 100) + "¢ rounding adjustment" : ""})`;
      break;
    }

    case "adjustment": {
      if (!splitData || !splitData.adjustments) {
        throw new Error("adjustment split requires splitData.adjustments");
      }
      const equalShare = amount / members.length;
      rawSplits = members.map(m => ({
        user_id: m.user_id,
        amount_owed: r2(equalShare + (parseFloat(splitData.adjustments[m.user_id]) || 0))
      }));
      const currentTotal = rawSplits.reduce((s, x) => s + x.amount_owed, 0);
      const diff = r2(amount - currentTotal);
      if (diff !== 0) {
        rawSplits[0].amount_owed = r2(rawSplits[0].amount_owed + diff);
      }
      note = `Equal split with adjustments${diff !== 0 ? " (" + Math.round(diff * 100) + "¢ rounding adjustment)" : ""}`;
      break;
    }

    default:
      throw new Error(`Unknown split method: ${method}`);
  }

  const totalSplit = rawSplits.reduce((s, x) => s + x.amount_owed, 0);
  return {
    splits: rawSplits,
    verification: {
      totalPaid: r2(totalPaid),
      totalSplit: r2(totalSplit),
      difference: r2(totalPaid - totalSplit),
      note
    }
  };
}

/**
 * Simplify debts using the greedy "match largest debtor with largest creditor" algorithm.
 * @param {Array<{user_id:number,name:string,balance:number}>} balances
 * @returns {Array<{from:number,fromName:string,to:number,toName:string,amount:number}>}
 */
function simplifyDebts(balances) {
  const debtors = balances.filter(b => b.balance < 0).map(b => ({ ...b, balance: Math.abs(b.balance) }));
  const creditors = balances.filter(b => b.balance > 0).map(b => ({ ...b }));
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const txns = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].balance, creditors[j].balance);
    txns.push({
      from: debtors[i].user_id,
      fromName: debtors[i].name,
      to: creditors[j].user_id,
      toName: creditors[j].name,
      amount: r2(payment)
    });
    debtors[i].balance -= payment;
    creditors[j].balance -= payment;
    if (debtors[i].balance < 0.005) i++;
    if (creditors[j].balance < 0.005) j++;
  }
  return txns;
}

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
    .select("*, split_method, split_data, users!group_expenses_paid_by_fkey(id, name)")
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
// Add a shared expense (supports all split methods)
router.post("/:id/expenses", async (req, res) => {
  const gid = req.params.id;
  const { amount, description, date, paid_by, split_method, split_data } = req.body;
  const amountNum = parseFloat(amount);
  const method = split_method || "equal";

  if (!amount || !description || !date || !paid_by) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 1. Get members to compute splits
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, users!inner(id, name)")
    .eq("group_id", gid);

  const memberList = members.map(m => ({ user_id: m.user_id, name: m.users?.name || "Unknown" }));

  let computed;
  try {
    computed = computeSplits(method, amountNum, memberList, split_data);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  // 2. Create the group expense
  const insertData = {
    group_id: gid,
    paid_by,
    amount: amountNum,
    description,
    date,
    split_method: method,
    split_data: split_data || null
  };

  const { data: expense, error: expError } = await supabase
    .from("group_expenses")
    .insert(insertData)
    .select()
    .single();

  if (expError) return res.status(500).json({ message: expError.message });

  // 3. Insert splits
  const splits = computed.splits.map(s => ({
    expense_id: expense.id,
    user_id: s.user_id,
    amount_owed: s.amount_owed
  }));

  const { error: splitError } = await supabase
    .from("group_expense_splits")
    .insert(splits);

  if (splitError) return res.status(500).json({ message: splitError.message });

  res.status(201).json({
    ...expense,
    verification: computed.verification
  });
});

// ── PUT /api/groups/:id/expenses/:expenseId ──────────────────────────────────
// Edit a shared expense and update splits (supports all split methods)
router.put("/:id/expenses/:expenseId", async (req, res) => {
  const gid = parseInt(req.params.id);
  const eid = parseInt(req.params.expenseId);
  const { amount, description, date, paid_by, split_method, split_data } = req.body;
  const amountNum = parseFloat(amount);
  const method = split_method || "equal";

  console.log(`[Groups] Editing expense ${eid} in group ${gid}`);

  if (!amount || !description || !date || !paid_by) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 1. Get members to compute splits
  const { data: members, error: memError } = await supabase
    .from("group_members")
    .select("user_id, users!inner(id, name)")
    .eq("group_id", gid);

  if (memError) {
    console.error("[Groups] Fetch Members Error:", memError);
    return res.status(500).json({ message: memError.message });
  }

  const memberList = members.map(m => ({ user_id: m.user_id, name: m.users?.name || "Unknown" }));

  let computed;
  try {
    computed = computeSplits(method, amountNum, memberList, split_data);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  // 2. Update the group expense
  const { data: expense, error: expError } = await supabase
    .from("group_expenses")
    .update({
      paid_by: parseInt(paid_by),
      amount: amountNum,
      description,
      date,
      split_method: method,
      split_data: split_data || null
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

  // 3. Delete old splits and insert new ones
  const { error: delError } = await supabase
    .from("group_expense_splits")
    .delete()
    .eq("expense_id", eid);

  if (delError) {
    console.error("[Groups] Delete Splits Error:", delError);
    return res.status(500).json({ message: delError.message });
  }

  const splits = computed.splits.map(s => ({
    expense_id: eid,
    user_id: s.user_id,
    amount_owed: s.amount_owed
  }));

  const { error: splitError } = await supabase
    .from("group_expense_splits")
    .insert(splits);

  if (splitError) {
    console.error("[Groups] Insert Splits Error:", splitError);
    return res.status(500).json({ message: splitError.message });
  }

  res.json({ ...expense, verification: computed.verification });
});

// ── GET /api/groups/:id/balances ─────────────────────────────────────────────
// Calculate net balances + math verification for all members in the group
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
    .select("id, paid_by, amount, split_method")
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
  const balances = {};
  memberInfo.forEach(m => { balances[m.id] = 0; });

  expenses?.forEach(e => { balances[e.paid_by] += parseFloat(e.amount); });
  splits?.forEach(s => { balances[s.user_id] -= parseFloat(s.amount_owed); });
  settlements?.forEach(s => {
    balances[s.paid_by] += parseFloat(s.amount);
    balances[s.paid_to] -= parseFloat(s.amount);
  });

  // 5. Math verification
  const totalPaid = (expenses || []).reduce((s, e) => s + parseFloat(e.amount), 0);
  const totalSplit = (splits || []).reduce((s, sp) => s + parseFloat(sp.amount_owed), 0);

  // 6. Build result
  const result = Object.entries(balances).map(([uid, balance]) => {
    const user = memberInfo.find(m => m.id == uid);
    return {
      user_id: parseInt(uid),
      name: user?.name,
      balance: parseFloat(balance.toFixed(2))
    };
  });

  res.json({
    balances: result,
    verification: {
      totalPaid: r2(totalPaid),
      totalSplit: r2(totalSplit),
      difference: r2(totalPaid - totalSplit)
    },
    settlementPlan: simplifyDebts(result)
  });
});

// ── GET /api/groups/:id/simplify-debts ─────────────────────────────────────────
// Get optimized settlement plan (fewest transactions)
router.get("/:id/simplify-debts", async (req, res) => {
  const gid = req.params.id;

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, users(id, name)")
    .eq("group_id", gid);

  const memberInfo = members.map(m => m.users);

  const { data: expenses } = await supabase
    .from("group_expenses")
    .select("id, paid_by, amount")
    .eq("group_id", gid);

  const { data: splits } = await supabase
    .from("group_expense_splits")
    .select("user_id, amount_owed")
    .in("expense_id", expenses.map(e => e.id) || []);

  const { data: settlements } = await supabase
    .from("settlements")
    .select("paid_by, paid_to, amount")
    .eq("group_id", gid);

  const balances = {};
  memberInfo.forEach(m => { balances[m.id] = 0; });
  expenses?.forEach(e => { balances[e.paid_by] += parseFloat(e.amount); });
  splits?.forEach(s => { balances[s.user_id] -= parseFloat(s.amount_owed); });
  settlements?.forEach(s => {
    balances[s.paid_by] += parseFloat(s.amount);
    balances[s.paid_to] -= parseFloat(s.amount);
  });

  const result = Object.entries(balances).map(([uid, balance]) => {
    const user = memberInfo.find(m => m.id == uid);
    return { user_id: parseInt(uid), name: user?.name, balance: parseFloat(balance.toFixed(2)) };
  });

  res.json({
    balances: result,
    settlementPlan: simplifyDebts(result)
  });
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
