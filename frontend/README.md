# Expense Tracker — Frontend

React + plain CSS frontend for the AI-Powered Expense Tracker.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Make sure REACT_APP_API_URL points to your backend

# 3. Start dev server
npm start
```

App runs at `http://localhost:3000`

## Environment Variables

| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Backend API base URL (default: http://localhost:5000/api) |

## Project Structure

```
frontend/
├── public/
│   └── index.html
└── src/
    ├── index.js              # Entry point
    ├── index.css             # Global styles + utility classes
    ├── App.jsx               # Router + auth guard
    ├── api/
    │   ├── client.js         # Axios instance with JWT interceptor
    │   └── expenses.js       # All API call functions
    ├── context/
    │   ├── AuthContext.jsx   # User auth state
    │   └── ExpenseContext.jsx# Expense CRUD state
    ├── utils/
    │   └── constants.js      # Categories, formatters
    ├── components/
    │   ├── Auth/             # Login + Signup pages
    │   ├── Layout/           # Sidebar + Layout wrapper
    │   └── Chatbot/          # AI chat panel
    └── pages/
        ├── Dashboard.jsx     # Stats + charts
        ├── Transactions.jsx  # CRUD table
        ├── Budget.jsx        # Budget progress
        └── Analytics.jsx     # Trend charts
```

## Tech Stack

- React 18
- React Router v6
- Axios (API calls)
- Recharts (charts)
- Plain CSS (no Tailwind, no UI library)
