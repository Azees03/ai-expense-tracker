# 💰 SpendSmart — AI-Powered Expense Tracker

> 🔗 **Live Demo:** [https://ai-expense-tracker-olive-beta.vercel.app](https://ai-expense-tracker-olive-beta.vercel.app)

An intelligent expense tracking application where you manage your finances through **natural conversation**. The AI chatbot performs real CRUD operations directly in the database — add, query, update, and delete expenses just by typing naturally.

---

## 📸 Demo

> **Chatbot adding multiple expenses in one message:**
> *"Coffee ₹60, metro ₹40, groceries ₹800 today"* → 3 expenses instantly created in the database

> **Chatbot querying:**
> *"How much did I spend on food this month?"* → Real-time summary with category breakdown

> **Receipt Scanner:**
> Upload any receipt image or PDF → Gemini Vision extracts merchant, amount, date, items → one click to save

*(Add screenshots here before submission)*

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 AI Chatbot | Full CRUD via natural language — Gemini 1.5 Flash with function calling |
| 🧾 Receipt Scanner | OCR for images and PDFs — extracts merchant, amount, date automatically |
| 📊 Analytics Dashboard | Pie charts, bar charts, monthly trends, category breakdowns |
| 🎯 Budget Tracking | Set limits per category with real-time progress bars and over-budget alerts |
| 🌙 Dark Mode | Full dark/light theme, persists across sessions, respects OS preference |
| 📤 Export | Download all expenses as CSV or a formatted PDF report |
| 🔐 Authentication | JWT-based auth with bcrypt password hashing |

---

## 🚀 Live Demo

**URL:** [https://ai-expense-tracker-olive-beta.vercel.app](https://ai-expense-tracker-olive-beta.vercel.app)

**Deployment:**
- **Frontend** — Vercel (auto-deploys on every push to `main`)
- **Backend** — Render (Node.js Web Service, free tier, Singapore region)
- **Database** — Supabase (managed PostgreSQL, always-on cloud)

---

## 🤖 AI Chatbot — CRUD via Natural Language

The chatbot uses **Gemini 1.5 Flash function calling** (tool use) to perform real database operations. It is not a Q&A bot — every relevant message triggers an actual database write or read.

### Create
```
"I spent ₹450 on lunch at Annapoorna today"
→ Extracts: amount=450, category=food, merchant=Annapoorna, date=today
→ Inserts row into expenses table, confirms back to user

"Coffee ₹60, metro ₹40, groceries ₹800"
→ Parses 3 expenses from one message, inserts all 3 in a single tool call
```

### Read & Query
```
"How much did I spend on food this month?"
→ Calls get_spending_summary(period=this_month, category=food)
→ Returns total + breakdown from database

"Show my biggest expenses this week"
→ Calls get_expenses(period=this_week, sort_by=amount, sort_order=DESC)
→ Lists top expenses with amounts and merchants
```

### Update (no ID needed)
```
"Change my last expense to transport"
→ Calls update_expense(filter_period=today, filter_nth=1, new_category=transport)
→ Finds most recent expense, updates category directly

"Update yesterday's grocery entry to ₹520"
→ Calls update_expense(filter_period=yesterday, filter_category=groceries, new_amount=520)
→ No ID required — filters resolve to the exact row
```

### Delete (no ID needed)
```
"Delete my last expense"
→ Calls delete_expenses(filter_period=today, filter_nth=1)
→ Single match: deletes immediately, confirms to user

"Remove all coffee expenses this week"
→ Multiple matches: asks for confirmation first
→ On confirm: bulk deletes, reports count and total
```

### Insights & Budget
```
"Am I on track with my budget?"
→ Calls get_budget_status() — compares actual vs limits for this month

"Give me insights on my spending"
→ Calls get_insights(focus=general) — trends, projections, recommendations
```

### How Function Calling Works

```
User message
     ↓
Gemini receives message + 7 tool definitions
     ↓
Gemini returns: functionCall { name, args }
     ↓
Backend executes tool → queries/writes Supabase
     ↓
Tool result sent back to Gemini
     ↓
Gemini returns plain text confirmation
     ↓
Response shown to user + UI refreshes if data changed
```

The backend runs an **agentic loop** (up to 8 iterations) allowing chained operations — for example, finding an expense and then updating it in a single conversation turn.

**Tools implemented:**

| Tool | DB Operation |
|---|---|
| `create_expenses` | INSERT one or many expenses |
| `get_expenses` | SELECT with filters, sort, limit |
| `get_spending_summary` | Aggregate totals + category breakdown |
| `update_expense` | UPDATE by filter (no ID needed) |
| `delete_expenses` | DELETE by filter, confirms bulk |
| `get_budget_status` | JOIN budgets + expenses for this month |
| `get_insights` | Multi-query analysis + projections |

**Prompt Engineering decisions:**
- Temperature `0.3` for deterministic CRUD (lower = more reliable tool calls)
- Exhaustive category keyword mappings in system prompt (60+ keywords)
- Explicit rules for filter-based update/delete so Gemini never asks for IDs
- General finance questions answered from built-in knowledge without DB calls
- Context-aware: follow-up messages like *"actually make that ₹50"* update the last expense

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│               Frontend — React 18                 │
│                                                  │
│  Pages:       Dashboard, Transactions,           │
│               Budget, Analytics                  │
│                                                  │
│  Components:  Chatbot, ReceiptScanner,           │
│               ExportButton, Sidebar              │
│                                                  │
│  Context:     AuthContext, ExpenseContext,       │
│               ThemeContext                       │
│                                                  │
│  API Layer:   Axios + JWT interceptor            │
└────────────────────┬─────────────────────────────┘
                     │ HTTPS REST API
┌────────────────────▼─────────────────────────────┐
│              Backend — Node.js + Express          │
│                                                  │
│  /api/auth      JWT signup/login                 │
│  /api/expenses  CRUD + summary + analytics       │
│  /api/budgets   Budget management                │
│  /api/chat      Gemini function calling          │
│  /api/receipts  Multer upload + Vision OCR       │
└──────────────┬────────────────┬──────────────────┘
               │                │
┌──────────────▼────┐  ┌────────▼────────────────┐
│  Supabase         │  │  Google Gemini API       │
│  (PostgreSQL)     │  │  gemini-1.5-flash        │
│                   │  │                          │
│  tables:          │  │  • Chat + Function       │
│  • users          │  │    Calling (chatbot)     │
│  • expenses       │  │  • Vision API (OCR)      │
│  • budgets        │  │                          │
└───────────────────┘  └──────────────────────────┘
```

### Design Decisions & Trade-offs

**Filter-based update/delete instead of ID-based**
The chatbot uses descriptive filters (`filter_period`, `filter_category`, `filter_search`, `filter_nth`) to locate expenses rather than passing database IDs. This makes conversations feel completely natural — users never need to know what an ID is. Trade-off: edge cases exist when multiple expenses match the same filter, handled by always picking the most recent match for updates.

**Single Gemini API key for both chatbot and OCR**
Gemini 1.5 Flash natively handles text, images, and PDFs in the same API. This eliminated the need for a separate OCR service (Tesseract, Google Vision) and kept the setup to a single API key.

**Custom JWT auth over Supabase Auth**
Simpler mental model — no Supabase auth configuration, easier to debug, and the code is immediately readable without knowledge of Supabase-specific auth flows. Trade-off: manual session management and no OAuth support.

**Plain CSS with variables over Tailwind/styled-components**
CSS custom properties give full dark/light mode with zero runtime overhead and no build configuration. Every color in the app is a CSS variable so theming is a single attribute change on `<html>`.

**Memory storage for file uploads (no disk/S3)**
Multer memory storage keeps receipt images in RAM just long enough to base64-encode and send to Gemini. No file storage infrastructure needed. Trade-off: 10 MB file size limit and no ability to re-scan a receipt after the session.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18, React Router v6 | Component model, SPA routing |
| Charts | Recharts | Simple React-native charts |
| Styling | Plain CSS + CSS variables | Zero-dependency dark mode |
| Backend | Node.js, Express.js | Fast to build, easy to deploy |
| Database | Supabase (PostgreSQL) | Managed DB, great free tier |
| AI/LLM | Google Gemini 1.5 Flash | Free tier, vision support, function calling |
| Auth | JWT + bcryptjs | Simple, stateless, no vendor lock-in |
| File Upload | Multer (memory storage) | No disk I/O needed for OCR flow |
| Deployment | Vercel + Render | Both free, both connect to GitHub |

---

## ⚙️ Environment Variables

### Backend — `backend/.env`

```env
# Server
PORT=5000

# Auth — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_64_char_random_string_here

# Supabase — from your project: Settings → API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# Google Gemini — https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIza...your-key...

# CORS — your deployed frontend URL
FRONTEND_URL=https://ai-expense-tracker-olive-beta.vercel.app
```

### Frontend — `frontend/.env`

```env
# Your deployed backend URL — must include /api at the end
REACT_APP_API_URL=https://spendsmart-backend-0i2x.onrender.com/api
```

---

## 🖥️ Running Locally

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) project
- A free [Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/spendsmart.git
cd spendsmart
```

### 2. Set up the database

1. Go to your Supabase project → **SQL Editor**
2. Paste the contents of `backend/db/schema.sql` and click **Run**
3. This creates the `users`, `expenses`, and `budgets` tables with RLS disabled

### 3. Configure and run the backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env and fill in your values
npm run dev
# Server starts at http://localhost:5000
# Test: http://localhost:5000/api/health
```

### 4. Configure and run the frontend

```bash
# Open a new terminal
cd frontend
npm install
cp .env.example .env
# Edit .env → set REACT_APP_API_URL=http://localhost:5000/api
npm start
# App opens at http://localhost:3000
```

---

## 📦 Deployment Instructions

### Backend → Render

1. Go to [render.com](https://render.com) → **New + → Web Service** → connect GitHub repo
2. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
3. Add all environment variables (see above)
4. Click **Create Web Service** — live in ~2 minutes

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import GitHub repo
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework:** Create React App (auto-detected)
3. Add environment variable:
   - Name: `REACT_APP_API_URL`
   - Value: `https://your-render-service.onrender.com/api`
4. Click **Deploy** — live in ~60 seconds
5. Go back to Render → update `FRONTEND_URL` to your Vercel URL → Save Changes

---

## 🗄️ Database Schema

```sql
-- Users (custom JWT auth, not Supabase Auth)
users (id, name, email UNIQUE, password [bcrypt], created_at)

-- Expenses
expenses (id, user_id → users, amount, category, description,
          date, payment_method, merchant, created_at, updated_at)

-- Budgets (one per category per user, upserted)
budgets (id, user_id → users, category, amount, period,
         created_at, UNIQUE(user_id, category))
```

Full schema: see `backend/db/schema.sql`

---

## 📁 Project Structure

```
spendsmart/
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client + all API calls
│   │   ├── components/
│   │   │   ├── Auth/       # Login + Signup
│   │   │   ├── Chatbot/    # AI chat panel
│   │   │   ├── Export/     # CSV + PDF export
│   │   │   ├── Layout/     # Sidebar + main layout
│   │   │   └── Receipt/    # Receipt scanner modal
│   │   ├── context/        # Auth, Expense, Theme contexts
│   │   ├── pages/          # Dashboard, Transactions, Budget, Analytics
│   │   └── utils/          # Category constants, formatters
│   ├── public/
│   │   └── _redirects      # Netlify SPA routing
│   └── vercel.json         # Vercel SPA routing
│
└── backend/
    ├── db/
    │   ├── schema.sql       # Supabase table definitions
    │   └── supabase.js      # Supabase client
    ├── middleware/
    │   └── auth.js          # JWT verification middleware
    ├── routes/
    │   ├── auth.js          # Signup, login, /me
    │   ├── expenses.js      # CRUD + summary + analytics
    │   ├── budgets.js       # Budget CRUD
    │   ├── chat.js          # Chatbot endpoint
    │   └── receipts.js      # Receipt OCR + save
    ├── services/
    │   └── aiService.js     # Gemini function calling engine
    ├── server.js            # Express entry point
    └── render.yaml          # Render deployment config
```

---

## 🔮 Future Improvements

- **Voice input** — Web Speech API for hands-free expense logging
- **Recurring expense detection** — Auto-detect and schedule monthly bills
- **Multi-currency support** — Live exchange rates for travel tracking
- **AI learns corrections** — Store category corrections to improve over time
- **WhatsApp integration** — Log expenses via WhatsApp message (Twilio)
- **Unit + integration tests** — Jest for components, Supertest for API routes
- **Offline support** — Service worker queue, syncs when back online

---

## 👥 Collaborators

- `Aswath363`
- `akshaiP`
- `ashwanthnebula`

---

*Built for the Nebula KnowLab AI Expense Tracker Hiring Task.*
