export const CATEGORIES = [
  { id: "food",          label: "Food & Dining",   icon: "🍔", color: "#f59e0b" },
  { id: "transport",     label: "Transport",        icon: "🚗", color: "#3b82f6" },
  { id: "shopping",      label: "Shopping",         icon: "🛍️", color: "#8b5cf6" },
  { id: "bills",         label: "Bills & Utilities",icon: "⚡", color: "#ef4444" },
  { id: "healthcare",    label: "Healthcare",       icon: "🏥", color: "#10b981" },
  { id: "entertainment", label: "Entertainment",    icon: "🎬", color: "#f97316" },
  { id: "groceries",     label: "Groceries",        icon: "🛒", color: "#06b6d4" },
  { id: "education",     label: "Education",        icon: "📚", color: "#6366f1" },
  { id: "travel",        label: "Travel",           icon: "✈️", color: "#14b8a6" },
  { id: "other",         label: "Other",            icon: "📌", color: "#64748b" },
];

export const PAYMENT_METHODS = [
  "Cash", "Credit Card", "Debit Card", "UPI", "Net Banking", "Wallet",
];

export const getCategoryInfo = (id) =>
  CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
