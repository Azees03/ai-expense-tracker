import { createContext, useContext, useState, useCallback } from "react";
import { expenseAPI } from "../api/expenses";

const ExpenseContext = createContext(null);

export function ExpenseProvider({ children }) {
  const [expenses, setExpenses]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });

  const fetchExpenses = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const data = await expenseAPI.getAll(params);
      setExpenses(data.expenses);
      setPagination({ page: data.page, total: data.total, pages: data.pages });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addExpense = async (expense) => {
    const data = await expenseAPI.create(expense);
    setExpenses((prev) => [data, ...prev]);
    return data;
  };

  const updateExpense = async (id, updates) => {
    const data = await expenseAPI.update(id, updates);
    setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    return data;
  };

  const deleteExpense = async (id) => {
    await expenseAPI.delete(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <ExpenseContext.Provider
      value={{ expenses, loading, pagination, fetchExpenses, addExpense, updateExpense, deleteExpense }}
    >
      {children}
    </ExpenseContext.Provider>
  );
}

export const useExpenses = () => useContext(ExpenseContext);
