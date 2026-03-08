import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth }   from "./context/AuthContext";
import { ThemeProvider }           from "./context/ThemeContext";
import { ExpenseProvider }         from "./context/ExpenseContext";
import Layout                      from "./components/Layout/Layout";
import Login                       from "./components/Auth/Login";
import Signup                      from "./components/Auth/Signup";
import Dashboard                   from "./pages/Dashboard";
import Transactions                from "./pages/Transactions";
import Budget                      from "./pages/Budget";
import Analytics                   from "./pages/Analytics";
import "./index.css";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh" }}>
        <div className="spinner" />
      </div>
    );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <ExpenseProvider>
              <Layout />
            </ExpenseProvider>
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="budget"       element={<Budget />} />
        <Route path="analytics"    element={<Analytics />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
