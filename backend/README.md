# Expense Tracker — Backend

Express.js + Supabase backend. No native modules — works on Windows/Mac/Linux without any build tools.

---

## ⚡ Quick Start

### 1. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Open **SQL Editor** → paste the contents of `db/schema.sql` → Run
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your values in .env
```

### 3. Install & run

```bash
npm install
npm run dev      # development with auto-reload
npm start        # production
```

Server starts at `http://localhost:5000`

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default 5000) |
| `JWT_SECRET` | Long random string for signing tokens |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret!) |
| `FRONTEND_URL` | Frontend URL for CORS (default: http://localhost:3000) |
| `GEMINI_API_KEY` | Google Gemini API key (for chatbot — coming soon) |

---

## API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login → returns JWT |
| GET  | `/api/auth/me` | Current user (requires token) |

### Expenses
| Method | Route | Description |
|---|---|---|
| GET    | `/api/expenses` | List (filterable, paginated) |
| GET    | `/api/expenses/summary` | Dashboard summary |
| GET    | `/api/expenses/analytics` | Charts data |
| GET    | `/api/expenses/:id` | Single expense |
| POST   | `/api/expenses` | Create expense |
| PUT    | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Budgets
| Method | Route | Description |
|---|---|---|
| GET    | `/api/budgets` | All budgets |
| POST   | `/api/budgets` | Set/update budget (upsert) |
| DELETE | `/api/budgets/:id` | Delete budget |

### Chat (AI — coming soon)
| Method | Route | Description |
|---|---|---|
| POST | `/api/chat` | Send message to AI assistant |

---

## Project Structure

```
backend/
├── server.js             # Express app entry point
├── db/
│   ├── supabase.js       # Supabase client
│   └── schema.sql        # Run this in Supabase SQL Editor
├── middleware/
│   └── auth.js           # JWT verification
├── routes/
│   ├── auth.js           # Auth endpoints
│   ├── expenses.js       # Expense CRUD + analytics
│   ├── budget.js         # Budget management
│   └── chat.js           # AI chat (Gemini — coming soon)
└── services/
    └── aiService.js      # Gemini integration (coming soon)
```
