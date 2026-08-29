import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import CalendarTasks from "./pages/CalendarTasks";
import Reports from "./pages/Reports";
import Products from "./pages/Products";
import Settings from "./pages/Settings";

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="customers" element={<Customers lifecycle="customer" title="Aktif Müşteriler" />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="graduates" element={<Customers lifecycle="graduate" title="Mezunlar Arşivi" />} />
            <Route path="calendar" element={<CalendarTasks />} />
            <Route path="reports" element={<Reports />} />
            <Route path="products" element={<Products />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
