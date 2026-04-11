import { Routes, Route, Navigate } from 'react-router-dom';
import AutoUpdater from './components/elements/AutoUpdater';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './features/dashboard/Dashboard';
import Billing from './features/billing/Billing';
import Orders from './features/orders/Orders';
import BillsList from './features/billing/BillsList';
import OrdersList from './features/orders/OrdersList';
import Inventory from './features/inventory/Inventory';
import RateChart from './features/rates/RateChart';
import Customers from './features/customers/Customers';
import Settings from './features/settings/Settings';

// Auth Components
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthGuard from './features/auth/AuthGuard';
import AuthLayout from './features/auth/AuthLayout';
import Login from './features/auth/Login';
import Register from './features/auth/Register';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AutoUpdater />
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected App Routes */}
          <Route element={<AuthGuard><MainLayout /></AuthGuard>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/list" element={<BillsList />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/list" element={<OrdersList />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/rates" element={<RateChart />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}
