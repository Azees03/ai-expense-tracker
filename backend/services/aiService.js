const Anthropic = require("@anthropic-ai/sdk");
const { getDB } = require("../db/database");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool Definitions ───────────────────────────────────────────────────────

const tools = [
  {
    name: "create_expense",
    description: "Create one or more expense records in the database. Use this when the user mentions spending money, buying something, or paying for something.",
    input_schema: {
      type: "object",
      properties: {
        expenses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "The expense amount in INR (rupees)" },
              category: {
                type: "string",
                enum: ["food", "transport", "shopping", "bills", "healthcare", "entertainment", "groceries", "education", "travel", "other"],
                description: "The category of the expense"
              },
              description: { type: "string", description: "Brief description of the expense" },
              date: { type: "string", description: "Date in YYYY-MM-DD format. Use today's date if not specified." },
              payment_method: { type: "string", description: "Payment method used", default: "Cash" },
              merchant: { type: "string", description: "Merchant or place name if mentioned" }
            },
            required: ["amount", "category", "date"]
          }
        }
      },
      required: ["expenses"]
    }
  },
  {
    name: "get_expenses",
    description: "Query expenses from the database with optional filters. Use this to answer questions about spending.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
        start_date: { type: "string", description: "Start date YYYY-MM-DD" },
        end_date: { type: "string", description: "End date YYYY-MM-DD" },
        limit: { type: "number", description: "Max number of results", default: 20 },
        sort_by: { type: "string", enum: ["date", "amount"], default: "date" },
        sort_order: { type: "string", enum: ["ASC", "DESC"], default: "DESC" },
        search: { type: "string", description: "Search in description or merchant" }
      }
    }
  },
  {
    name: "get_summary",
    description: "Get spending summary and totals grouped by period or category. Use for analytics questions.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["this_month", "last_month", "this_week", "last_week", "all_time"], description: "Time period to summarize" },
        group_by: { type: "string", enum: ["category", "day", "month"], description: "How to group the results" }
      },
      required: ["period"]
    }
  },
  {
    name: "update_expense",
    description: "Update an existing expense record. Use when user wants to change details of an expense.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "The expense ID to update" },
        amount: { type: "number" },
        category: { type: "string" },
        description: { type: "string" },
        date: { type: "string" },
        payment_method: { type: "string" },
        merchant: { type: "string" }
      },
      required: ["id"]
    }
  },
  {
    name: "delete_expense",
    description: "Delete one or more expense records.",
    input_schema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "number" }, description: "Array of expense IDs to delete" },
        confirm: { type: "boolean", description: "Must be true to proceed with deletion" }
      },
      required: ["ids", "confirm"]
    }
  },
  {
    name: "get_budgets",
    description: "Get user's budget limits and compare with current spending.",
    input_schema: { type: "object", properties: {} }
  }
];

// ─── Tool Executors ─────────────────────────────────────────────────────────

function getDateRange(period) {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case "this_month":
      return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: fmt(now) };
    case "last_month": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(lm), end: fmt(lmEnd) };
    }
    case "this_week": {
      const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day);
      return { start: fmt(start), end: fmt(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const end = new Date(now); end.setDate(now.getDate() - day - 1);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      return { start: fmt(start), end: fmt(end) };
    }
    default:
      return { start: "2000-01-01", end: fmt(now) };
  }
}

function executeTool(toolName, toolInput, userId) {
  const db = getDB();

  if (toolName === "create_expense") {
    const created = [];
    const stmt = db.prepare(
      "INSERT INTO expenses (user_id, amount, category, description, date, payment_method, merchant) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const exp of toolInput.expenses) {
      const result = stmt.run(userId, exp.amount, exp.category, exp.description || "", exp.date, exp.payment_method || "Cash", exp.merchant || "");
      created.push({ id: result.lastInsertRowid, ...exp });
    }
    return { success: true, created, count: created.length, total: created.reduce((s, e) => s + e.amount, 0) };
  }

  if (toolName === "get_expenses") {
    let where = "WHERE user_id = ?";
    const params = [userId];
    if (toolInput.category) { where += " AND category = ?"; params.push(toolInput.category); }
    if (toolInput.start_date) { where += " AND date >= ?"; params.push(toolInput.start_date); }
    if (toolInput.end_date) { where += " AND date <= ?"; params.push(toolInput.end_date); }
    if (toolInput.search) { where += " AND (description LIKE ? OR merchant LIKE ?)"; params.push(`%${toolInput.search}%`, `%${toolInput.search}%`); }

    const sortBy = toolInput.sort_by === "amount" ? "amount" : "date";
    const sortOrder = toolInput.sort_order === "ASC" ? "ASC" : "DESC";
    const limit = Math.min(toolInput.limit || 20, 50);

    const rows = db.prepare(`SELECT * FROM expenses ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ?`).all(...params, limit);
    const sumRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses ${where}`).get(...params);
    return { expenses: rows, total: sumRow.total, count: sumRow.count };
  }

  if (toolName === "get_summary") {
    const { start, end } = getDateRange(toolInput.period);
    const groupBy = toolInput.group_by || "category";

    let groupExpr;
    if (groupBy === "day") groupExpr = "strftime('%Y-%m-%d', date)";
    else if (groupBy === "month") groupExpr = "strftime('%Y-%m', date)";
    else groupExpr = "category";

    const rows = db.prepare(`
      SELECT ${groupExpr} as label, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM expenses
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY label ORDER BY total DESC
    `).all(userId, start, end);

    const overall = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?"
    ).get(userId, start, end);

    return { period: toolInput.period, start, end, breakdown: rows, total: overall.total, count: overall.count };
  }

  if (toolName === "update_expense") {
    const existing = db.prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?").get(toolInput.id, userId);
    if (!existing) return { success: false, error: "Expense not found" };

    db.prepare(`
      UPDATE expenses SET
        amount = ?, category = ?, description = ?, date = ?,
        payment_method = ?, merchant = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(
      toolInput.amount ?? existing.amount,
      toolInput.category ?? existing.category,
      toolInput.description ?? existing.description,
      toolInput.date ?? existing.date,
      toolInput.payment_method ?? existing.payment_method,
      toolInput.merchant ?? existing.merchant,
      toolInput.id,
      userId
    );

    const updated = db.prepare("SELECT * FROM expenses WHERE id = ?").get(toolInput.id);
    return { success: true, updated };
  }

  if (toolName === "delete_expense") {
    if (!toolInput.confirm) return { success: false, error: "Deletion not confirmed" };
    const deleted = [];
    for (const id of toolInput.ids) {
      const exp = db.prepare("SELECT * FROM expenses WHERE id = ? AND user_id = ?").get(id, userId);
      if (exp) {
        db.prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?").run(id, userId);
        deleted.push(exp);
      }
    }
    return { success: true, deleted, count: deleted.length };
  }

  if (toolName === "get_budgets") {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const budgets = db.prepare("SELECT * FROM budgets WHERE user_id = ?").all(userId);
    const spending = db.prepare(
      "SELECT category, COALESCE(SUM(amount), 0) as spent FROM expenses WHERE user_id = ? AND date >= ? GROUP BY category"
    ).all(userId, monthStart);

    const spendMap = {};
    spending.forEach(s => { spendMap[s.category] = s.spent; });

    const result = budgets.map(b => ({
      ...b,
      spent: spendMap[b.category] || 0,
      remaining: b.amount - (spendMap[b.category] || 0),
      over_budget: (spendMap[b.category] || 0) > b.amount
    }));

    return { budgets: result };
  }

  return { error: "Unknown tool" };
}

// ─── Main AI Chat Function ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an intelligent AI expense tracking assistant. You help users manage their personal finances through natural conversation.

Today's date is ${new Date().toISOString().split("T")[0]}.
Currency is Indian Rupees (₹/INR).

## Your Capabilities:
- **Create** expenses from natural language (extract amount, category, date, merchant)
- **Read** and query expenses with filters and analytics  
- **Update** expense records
- **Delete** expense records (always confirm before bulk deletes)
- **Analyze** spending patterns and provide financial insights

## Category Mapping Guide:
- food, restaurant, cafe, coffee, lunch, dinner, breakfast → "food"
- grocery, supermarket, vegetables, fruits → "groceries"  
- uber, ola, auto, bus, train, petrol, fuel, metro → "transport"
- amazon, flipkart, clothes, shoes, electronics → "shopping"
- electricity, water, internet, phone bill, rent → "bills"
- doctor, medicine, hospital, pharmacy → "healthcare"
- movie, netflix, spotify, game → "entertainment"
- school, course, book → "education"
- flight, hotel, vacation → "travel"

## Behavior Rules:
1. Always extract ALL expenses from a single message (user may mention multiple)
2. Infer yesterday/today/this week to exact dates
3. For deletions of multiple records, fetch them first and ask for confirmation
4. Be concise and conversational in responses
5. After CRUD operations, briefly confirm what was done
6. Provide specific numbers and insights when analyzing spending
7. Format currency as ₹X,XXX or ₹X.XX

## Response Style:
- Short and clear confirmations after actions
- Use bullet points for lists of expenses
- Provide totals and percentages in analytics
- Be proactive with insights`;

async function runAIChat(messages, userId) {
  // Build message history for Claude
  const formattedMessages = messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  let mutated = false;
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages: formattedMessages
  });

  // Handle tool use in agentic loop
  let currentMessages = [...formattedMessages];
  let currentResponse = response;

  while (currentResponse.stop_reason === "tool_use") {
    const toolUseBlocks = currentResponse.content.filter(b => b.type === "tool_use");
    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      const result = executeTool(toolUse.name, toolUse.input, userId);
      if (["create_expense", "update_expense", "delete_expense"].includes(toolUse.name) && result.success) {
        mutated = true;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      });
    }

    // Continue conversation with tool results
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: currentResponse.content },
      { role: "user", content: toolResults }
    ];

    currentResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages: currentMessages
    });
  }

  // Extract final text response
  const textBlock = currentResponse.content.find(b => b.type === "text");
  const message = textBlock?.text || "I processed your request.";

  return { message, mutated };
}

module.exports = { runAIChat };
