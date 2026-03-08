const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase = require("../db/supabase");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ═══════════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const fmtDate = (d) => d.toISOString().split("T")[0];

function todayStr() { return fmtDate(new Date()); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return fmtDate(d); }

function monthBounds(offset = 0) {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: fmtDate(s), end: fmtDate(e) };
}

function weekBounds(offset = 0) {
  const now = new Date();
  const s = new Date(now); s.setDate(now.getDate() - now.getDay() + offset * 7);
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return { start: fmtDate(s), end: fmtDate(e) };
}

function resolvePeriod(p) {
  switch (p) {
    case "today":         return { start: todayStr(),           end: todayStr() };
    case "yesterday":     return { start: yesterdayStr(),       end: yesterdayStr() };
    case "this_week":     return weekBounds(0);
    case "last_week":     return weekBounds(-1);
    case "this_month":    return monthBounds(0);
    case "last_month":    return monthBounds(-1);
    case "last_3_months": return { start: monthBounds(-2).start, end: monthBounds(0).end };
    case "all_time":      return { start: "2000-01-01",          end: todayStr() };
    default:              return { start: monthBounds(0).start,  end: todayStr() };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS = {
  food: "Food & Dining", transport: "Transport", shopping: "Shopping",
  bills: "Bills & Utilities", healthcare: "Healthcare",
  entertainment: "Entertainment", groceries: "Groceries",
  education: "Education", travel: "Travel", other: "Other",
};
const CATS = Object.keys(CATEGORY_LABELS);

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [{
  functionDeclarations: [

    // 1. CREATE
    {
      name: "create_expenses",
      description: "Add one or more expense records. Use whenever the user says they spent money, bought something, paid for anything, or wants to log an expense. Extract every expense mentioned in a single call.",
      parameters: {
        type: "OBJECT",
        properties: {
          expenses: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                amount:         { type: "NUMBER",  description: "Numeric amount in INR. Required." },
                category:       { type: "STRING",  enum: CATS, description: "Auto-detect from keywords." },
                description:    { type: "STRING",  description: "What the expense was for." },
                date:           { type: "STRING",  description: "YYYY-MM-DD. Resolve relative dates. Default today." },
                payment_method: { type: "STRING",  description: "Cash / UPI / Credit Card / Debit Card / Net Banking / Wallet" },
                merchant:       { type: "STRING",  description: "Store or merchant name if mentioned." },
              },
              required: ["amount", "category", "date"],
            },
          },
        },
        required: ["expenses"],
      },
    },

    // 2. GET EXPENSES (list/search)
    {
      name: "get_expenses",
      description: "Fetch a list of expenses. Use for: showing transactions, listing history, searching by keyword or category, finding recent expenses, biggest expenses.",
      parameters: {
        type: "OBJECT",
        properties: {
          period:     { type: "STRING", enum: ["today","yesterday","this_week","last_week","this_month","last_month","last_3_months","all_time"] },
          category:   { type: "STRING", description: "Filter by category slug e.g. 'food', 'transport'" },
          search:     { type: "STRING", description: "Keyword to match in description or merchant name" },
          sort_by:    { type: "STRING", enum: ["date","amount"], description: "Sort field. Default: date" },
          sort_order: { type: "STRING", enum: ["ASC","DESC"],    description: "Default: DESC" },
          limit:      { type: "NUMBER", description: "Max rows. Default 10, max 50." },
        },
        required: ["period"],
      },
    },

    // 3. SPENDING SUMMARY
    {
      name: "get_spending_summary",
      description: "Get total spend with category breakdown for a period. Use for: 'how much did I spend', totals, summaries, month-vs-month comparison, 'what did I spend on X'.",
      parameters: {
        type: "OBJECT",
        properties: {
          period:       { type: "STRING", enum: ["today","yesterday","this_week","last_week","this_month","last_month","last_3_months","all_time"] },
          compare_with: { type: "STRING", enum: ["yesterday","last_week","last_month"], description: "Optional period to compare against." },
        },
        required: ["period"],
      },
    },

    // 4. UPDATE — filter-based, no ID needed
    {
      name: "update_expense",
      description: "Update an existing expense. No ID needed — describe which expense to change using filters. The system finds the most recent match automatically. Use when user says: change, update, edit, fix, correct, modify an expense.",
      parameters: {
        type: "OBJECT",
        properties: {
          // ─── HOW TO FIND THE EXPENSE ────────────────────────────────────
          filter_period:    { type: "STRING", enum: ["today","yesterday","this_week","last_week","this_month","last_month","all_time"], description: "Date range to search in. Use 'today' or 'yesterday' for recent entries." },
          filter_category:  { type: "STRING", description: "Category slug to narrow the search." },
          filter_search:    { type: "STRING", description: "Keyword in description or merchant name to narrow the search." },
          filter_nth:       { type: "NUMBER", description: "Pick the Nth most recent match: 1=latest (default), 2=second latest, etc." },

          // ─── WHAT TO CHANGE ─────────────────────────────────────────────
          new_amount:         { type: "NUMBER", description: "New amount in INR" },
          new_category:       { type: "STRING", enum: CATS },
          new_description:    { type: "STRING" },
          new_date:           { type: "STRING", description: "YYYY-MM-DD" },
          new_payment_method: { type: "STRING" },
          new_merchant:       { type: "STRING" },
        },
        required: ["filter_period"],
      },
    },

    // 5. DELETE — filter-based, no ID needed
    {
      name: "delete_expenses",
      description: "Delete expenses. No ID needed — describe which expense(s) using filters. Single match: deletes immediately. Multiple matches: confirms count with user first unless confirmed=true. Use when user says: delete, remove, undo, erase an expense.",
      parameters: {
        type: "OBJECT",
        properties: {
          // ─── HOW TO FIND THE EXPENSE(S) ────────────────────────────────
          filter_period:   { type: "STRING", enum: ["today","yesterday","this_week","last_week","this_month","last_month","all_time"] },
          filter_category: { type: "STRING", description: "Category to narrow the search." },
          filter_search:   { type: "STRING", description: "Keyword in description or merchant." },
          filter_nth:      { type: "NUMBER", description: "Delete only the Nth most recent match: 1=latest." },
          confirmed:       { type: "BOOLEAN", description: "Set true only after user has explicitly confirmed a bulk delete." },
        },
        required: ["filter_period"],
      },
    },

    // 6. BUDGET STATUS
    {
      name: "get_budget_status",
      description: "Compare this month's actual spending vs set budget limits. Use when user asks: am I on track, how much left, budget check, over budget.",
      parameters: {
        type: "OBJECT",
        properties: {
          category: { type: "STRING", description: "Check one specific category (optional)." },
        },
      },
    },

    // 7. INSIGHTS
    {
      name: "get_insights",
      description: "Analyse spending patterns and return personalised insights and recommendations. Use when user asks: give me insights, analyse my spending, where am I overspending, savings tips, spending report.",
      parameters: {
        type: "OBJECT",
        properties: {
          focus: { type: "STRING", enum: ["general","category","trends","savings"] },
        },
        required: ["focus"],
      },
    },

  ],
}];

// ═══════════════════════════════════════════════════════════════════════════
// SHARED HELPER — find expenses by filter fields
// ═══════════════════════════════════════════════════════════════════════════

async function findByFilter({ filter_period, filter_category, filter_search, filter_nth }, userId) {
  const { start, end } = resolvePeriod(filter_period || "all_time");

  let q = supabase.from("expenses").select("*")
    .eq("user_id", userId)
    .gte("date", start).lte("date", end)
    .order("date",       { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (filter_category) q = q.eq("category", filter_category);
  if (filter_search)   q = q.or(`description.ilike.%${filter_search}%,merchant.ilike.%${filter_search}%`);

  const { data, error } = await q;
  if (error) return { error: error.message };
  if (!data?.length) return { found: [] };

  // If nth specified, pick that specific record only
  if (filter_nth && filter_nth >= 1) {
    const item = data[filter_nth - 1];
    return { found: item ? [item] : [] };
  }

  return { found: data };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTORS
// ═══════════════════════════════════════════════════════════════════════════

async function execCreate({ expenses }, userId) {
  if (!expenses?.length) return { success: false, error: "No expenses provided." };
  const created = [];
  for (const e of expenses) {
    const { data, error } = await supabase.from("expenses").insert({
      user_id:        userId,
      amount:         parseFloat(e.amount),
      category:       e.category || "other",
      description:    e.description || "",
      date:           e.date,
      payment_method: e.payment_method || "Cash",
      merchant:       e.merchant || "",
    }).select().single();
    if (!error && data) created.push(data);
  }
  return {
    success: true,
    created,
    count: created.length,
    total: created.reduce((s, e) => s + parseFloat(e.amount), 0),
  };
}

async function execGetExpenses({ period, category, search, sort_by, sort_order, limit }, userId) {
  const { start, end } = resolvePeriod(period);
  let q = supabase.from("expenses").select("*")
    .eq("user_id", userId).gte("date", start).lte("date", end);

  if (category) q = q.eq("category", category);
  if (search)   q = q.or(`description.ilike.%${search}%,merchant.ilike.%${search}%`);

  q = q.order(sort_by === "amount" ? "amount" : "date", { ascending: sort_order === "ASC" })
       .limit(Math.min(Number(limit) || 10, 50));

  const { data, error } = await q;
  if (error) return { error: error.message, expenses: [] };

  return {
    expenses: data || [],
    count: data?.length || 0,
    total: (data || []).reduce((s, e) => s + parseFloat(e.amount), 0),
    period, start, end,
  };
}

async function execSummary({ period, compare_with }, userId) {
  const { start, end } = resolvePeriod(period);
  const { data: main } = await supabase.from("expenses")
    .select("amount,category").eq("user_id", userId).gte("date", start).lte("date", end);

  const total = main?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  const catMap = {};
  main?.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + parseFloat(e.amount); });
  const byCategory = Object.entries(catMap).sort(([,a],[,b]) => b - a)
    .map(([cat, amt]) => ({ category: cat, label: CATEGORY_LABELS[cat] || cat, total: amt }));

  let comparison = null;
  if (compare_with) {
    const { start: cs, end: ce } = resolvePeriod(compare_with);
    const { data: prev } = await supabase.from("expenses")
      .select("amount,category").eq("user_id", userId).gte("date", cs).lte("date", ce);
    const prevTotal = prev?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
    const prevMap = {};
    prev?.forEach(e => { prevMap[e.category] = (prevMap[e.category] || 0) + parseFloat(e.amount); });
    comparison = {
      period: compare_with, total: prevTotal,
      change_pct: prevTotal ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : null,
      byCategory: byCategory.map(c => ({
        ...c,
        previous:   prevMap[c.category] || 0,
        change_pct: prevMap[c.category]
          ? (((c.total - prevMap[c.category]) / prevMap[c.category]) * 100).toFixed(1) : null,
      })),
    };
  }
  return { period, start, end, total, count: main?.length || 0, byCategory, comparison };
}

async function execUpdate(args, userId) {
  const result = await findByFilter(args, userId);
  if (result.error)       return { success: false, error: result.error };
  if (!result.found.length) return {
    success: false,
    error: "No matching expense found. Try a broader period or different keyword.",
  };

  // Always update the single most-recent match
  const target = result.found[0];
  const patch  = { updated_at: new Date().toISOString() };
  if (args.new_amount         != null) patch.amount         = parseFloat(args.new_amount);
  if (args.new_category       != null) patch.category       = args.new_category;
  if (args.new_description    != null) patch.description    = args.new_description;
  if (args.new_date           != null) patch.date           = args.new_date;
  if (args.new_payment_method != null) patch.payment_method = args.new_payment_method;
  if (args.new_merchant       != null) patch.merchant       = args.new_merchant;

  if (Object.keys(patch).length === 1) return { success: false, error: "No fields to update were provided." };

  const { data, error } = await supabase.from("expenses")
    .update(patch).eq("id", target.id).eq("user_id", userId).select().single();
  if (error) return { success: false, error: error.message };

  return { success: true, previous: target, updated: data };
}

async function execDelete(args, userId) {
  const result = await findByFilter(args, userId);
  if (result.error)         return { success: false, error: result.error };
  if (!result.found.length) return { success: false, error: "No matching expenses found." };

  const targets = result.found;
  const total   = targets.reduce((s, e) => s + parseFloat(e.amount), 0);

  // Single record → delete right away
  if (targets.length === 1) {
    const { error } = await supabase.from("expenses")
      .delete().eq("id", targets[0].id).eq("user_id", userId);
    if (error) return { success: false, error: error.message };
    return { success: true, deleted: targets, count: 1, total };
  }

  // Multiple records → need confirmation unless already confirmed
  if (!args.confirmed) {
    return {
      success:            false,
      needs_confirmation: true,
      expenses_to_delete: targets,
      count:  targets.length,
      total,
    };
  }

  // Confirmed bulk delete
  const ids = targets.map(e => e.id);
  const { error } = await supabase.from("expenses").delete().in("id", ids).eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true, deleted: targets, count: targets.length, total };
}

async function execBudgetStatus({ category }, userId) {
  const { start } = monthBounds(0);
  let bq = supabase.from("budgets").select("*").eq("user_id", userId);
  if (category) bq = bq.eq("category", category);
  const { data: budgets } = await bq;
  if (!budgets?.length) return { budgets: [], message: "No budgets set yet. Visit the Budget page to create some." };

  const { data: spending } = await supabase.from("expenses")
    .select("amount,category").eq("user_id", userId).gte("date", start);
  const spendMap = {};
  spending?.forEach(e => { spendMap[e.category] = (spendMap[e.category] || 0) + parseFloat(e.amount); });

  return {
    budgets: budgets.map(b => {
      const spent = spendMap[b.category] || 0;
      const pct   = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      return {
        category:  b.category,
        label:     CATEGORY_LABELS[b.category] || b.category,
        budget:    b.amount,
        spent,
        remaining: b.amount - spent,
        percent:   parseFloat(pct.toFixed(1)),
        status:    spent > b.amount ? "OVER" : pct > 80 ? "WARNING" : "OK",
      };
    }),
  };
}

async function execInsights({ focus }, userId) {
  const { start: ts, end: te } = monthBounds(0);
  const { start: ls, end: le } = monthBounds(-1);
  const [{ data: thisMonth }, { data: lastMonth }, { data: budgets }] = await Promise.all([
    supabase.from("expenses").select("*").eq("user_id", userId).gte("date", ts).lte("date", te),
    supabase.from("expenses").select("*").eq("user_id", userId).gte("date", ls).lte("date", le),
    supabase.from("budgets").select("*").eq("user_id", userId),
  ]);

  const thisCat = {}, lastCat = {};
  thisMonth?.forEach(e => { thisCat[e.category] = (thisCat[e.category] || 0) + parseFloat(e.amount); });
  lastMonth?.forEach(e => { lastCat[e.category] = (lastCat[e.category] || 0) + parseFloat(e.amount); });

  const thisTotal = thisMonth?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  const lastTotal = lastMonth?.reduce((s, e) => s + parseFloat(e.amount), 0) || 0;
  const daysGone  = new Date().getDate();
  const daysTotal = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const spendMap  = {};
  thisMonth?.forEach(e => { spendMap[e.category] = (spendMap[e.category] || 0) + parseFloat(e.amount); });

  return {
    focus,
    this_month: {
      total: thisTotal, count: thisMonth?.length || 0,
      top_categories: Object.entries(thisCat).sort(([,a],[,b]) => b - a).slice(0, 5)
        .map(([cat, amt]) => ({
          category: cat, label: CATEGORY_LABELS[cat] || cat, amount: amt,
          vs_last: lastCat[cat] ? (((amt - lastCat[cat]) / lastCat[cat]) * 100).toFixed(1) : null,
        })),
    },
    last_month:      { total: lastTotal, count: lastMonth?.length || 0 },
    change_pct:      lastTotal ? (((thisTotal - lastTotal) / lastTotal) * 100).toFixed(1) : null,
    projected_total: daysGone > 0 ? parseFloat(((thisTotal / daysGone) * daysTotal).toFixed(2)) : 0,
    daily_avg:       daysGone > 0 ? parseFloat((thisTotal / daysGone).toFixed(2)) : 0,
    days_gone:       daysGone,
    days_in_month:   daysTotal,
    budget_status: (budgets || []).map(b => ({
      category: b.category, label: CATEGORY_LABELS[b.category] || b.category,
      budget: b.amount, spent: spendMap[b.category] || 0,
      percent: b.amount > 0 ? (((spendMap[b.category] || 0) / b.amount) * 100).toFixed(1) : "0",
      over: (spendMap[b.category] || 0) > b.amount,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = new Set(["create_expenses", "update_expense", "delete_expenses"]);

async function dispatch(name, args, userId) {
  switch (name) {
    case "create_expenses":      return execCreate(args, userId);
    case "get_expenses":         return execGetExpenses(args, userId);
    case "get_spending_summary": return execSummary(args, userId);
    case "update_expense":       return execUpdate(args, userId);
    case "delete_expenses":      return execDelete(args, userId);
    case "get_budget_status":    return execBudgetStatus(args, userId);
    case "get_insights":         return execInsights(args, userId);
    default:                     return { error: `Unknown tool: ${name}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function buildSystemPrompt() {
  const now = new Date();
  return `You are SpendSmart AI — a smart, friendly personal finance assistant embedded in the SpendSmart expense tracker app.

TODAY: ${now.toISOString().split("T")[0]} (${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })})
CURRENCY: Indian Rupees (₹). All amounts are in INR.

════════════════════════════════════════════════
CAPABILITIES
════════════════════════════════════════════════
You have 7 tools that perform real database operations:
• create_expenses     — Add expense(s) to the database
• get_expenses        — List/search/filter expenses
• get_spending_summary— Totals and category breakdown
• update_expense      — Edit an expense (NO ID needed — use filters)
• delete_expenses     — Remove expense(s) (NO ID needed — use filters)
• get_budget_status   — Budget vs actual spending
• get_insights        — Spending patterns and recommendations

You ALSO answer general finance/budgeting questions from your own knowledge WITHOUT using any tool.

════════════════════════════════════════════════
CATEGORY AUTO-DETECTION
════════════════════════════════════════════════
food         → restaurant, cafe, coffee, tea, lunch, dinner, breakfast, snack, pizza, biryani, zomato, swiggy, hotel (meal)
groceries    → grocery, supermarket, vegetables, fruits, kirana, dmart, reliance fresh, big bazaar, provisions
transport    → uber, ola, auto, bus, train, metro, petrol, fuel, cab, taxi, toll, rapido, namma yatri, rapido
shopping     → amazon, flipkart, myntra, clothes, shoes, electronics, mall, meesho, online order
bills        → electricity, water, internet bill, phone bill, rent, wifi, broadband, gas bill, emi, recharge, subscription
healthcare   → doctor, hospital, medicine, pharmacy, clinic, apollo, medplus, health checkup
entertainment→ movie, netflix, spotify, game, concert, ott, prime video, hotstar, bookmyshow, theatre
education    → school, course, book, tuition, college, exam fee, udemy, coursera, workshop
travel       → flight, hotel stay, vacation, trip, airbnb, oyo, booking.com, makemytrip, holiday

════════════════════════════════════════════════
CRITICAL CRUD RULES
════════════════════════════════════════════════

CREATE:
✓ Parse ALL expenses mentioned in one message — call create_expenses once with all of them
✓ Resolve relative dates: "yesterday" → yesterday's date, "last Monday" → compute it
✓ Infer category from keywords above — never leave as "other" if a better match exists
✓ Default date to today if not mentioned
✓ Reply: "✅ Added ₹X for [desc] on [date]"

READ / QUERY:
✓ Use get_expenses to LIST transactions (show me my expenses, recent transactions)
✓ Use get_spending_summary for TOTALS and analytics (how much did I spend, category breakdown)
✓ For "biggest expenses" use get_expenses with sort_by=amount sort_order=DESC
✓ For "how much on food" use get_spending_summary with appropriate period

UPDATE (NO ID — USE FILTERS):
✓ NEVER ask the user for an expense ID
✓ Use filter_period + filter_category + filter_search to locate the expense
✓ filter_nth=1 means "the most recent match" (default)
✓ Always update only ONE expense — the most recent match
✓ Examples:
  - "change my last expense to transport" → filter_period=today, filter_nth=1, new_category=transport
  - "update yesterday's grocery to ₹52"  → filter_period=yesterday, filter_category=groceries, new_amount=52
  - "fix the uber charge description"     → filter_period=this_week, filter_search=uber, new_description=...
  - "make that ₹50" (follow-up)          → filter_period=today, filter_nth=1, new_amount=50

DELETE (NO ID — USE FILTERS):
✓ NEVER ask the user for an expense ID
✓ Single match → delete immediately without asking for confirmation
✓ Multiple matches → set confirmed=false, describe what will be deleted, ask user to confirm
✓ If user says "yes/confirm/go ahead" after a bulk delete warning → call delete again with confirmed=true
✓ Examples:
  - "delete my last expense"            → filter_period=today, filter_nth=1
  - "remove the coffee I added"         → filter_period=today, filter_search=coffee
  - "delete all food expenses this week"→ filter_period=this_week, filter_category=food (will confirm if >1)

GENERAL QUESTIONS (no tool needed):
✓ "What is a budget?" → answer from your knowledge
✓ "How do I save money?" → give practical advice
✓ "What's the 50/30/20 rule?" → explain it
✓ "Is ₹5000/month on food reasonable?" → give contextual advice
✓ Any question not requiring the user's personal data → answer directly

════════════════════════════════════════════════
RESPONSE STYLE
════════════════════════════════════════════════
• ✅ for success  •  🗑️ for deletions  •  📊 for summaries  •  ⚠️ for warnings
• Bold key figures: **₹1,234**
• Use bullet points for expense lists
• Keep it brief and friendly — no corporate speak
• For analytics, always show total + top categories
• If something goes wrong, explain what happened and suggest a fix`;
}


function buildHistory(messages) {
  // messages is the full array; last item is the current user message — exclude it
  const prior = messages.slice(0, -1);

  const history = [];
  for (const m of prior) {
    const role = m.role === "assistant" ? "model" : "user";
    // Skip welcome messages that contain the intro text
    if (role === "model" && (
      m.content.includes("SpendSmart AI") ||
      m.content.includes("I can help you manage")
    )) continue;

    history.push({ role, parts: [{ text: m.content }] });
  }

  // Gemini requires: starts with user, strictly alternating
  // Remove leading model turns
  while (history.length > 0 && history[0].role === "model") history.shift();

  // Merge consecutive same-role turns
  const clean = [];
  for (const turn of history) {
    if (clean.length > 0 && clean[clean.length - 1].role === turn.role) {
      clean[clean.length - 1].parts[0].text += "\n" + turn.parts[0].text;
    } else {
      clean.push(turn);
    }
  }

  return clean;
}

async function runAIChat(messages, userId) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: buildSystemPrompt(),
    tools: TOOLS,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
  });

  const history     = buildHistory(messages);
  const lastMessage = messages[messages.length - 1];
  const chat        = model.startChat({ history });
  let   mutated     = false;

  let response = await chat.sendMessage(lastMessage.content);
  let result   = response.response;

  // Agentic loop — keep processing tool calls until Gemini returns plain text
  let loopGuard = 0;
  while (result.functionCalls()?.length && loopGuard < 8) {
    loopGuard++;
    const toolResults = [];

    for (const call of result.functionCalls()) {
      console.log(`[Tool] ${call.name}`, JSON.stringify(call.args).slice(0, 300));
      const res = await dispatch(call.name, call.args, userId);
      console.log(`[Tool Result] ${call.name} →`, JSON.stringify(res).slice(0, 300));

      if (MUTATING.has(call.name) && res.success) mutated = true;
      toolResults.push({ functionResponse: { name: call.name, response: res } });
    }

    response = await chat.sendMessage(toolResults);
    result   = response.response;
  }

  return { message: result.text() || "Done!", mutated };
}

module.exports = { runAIChat };
