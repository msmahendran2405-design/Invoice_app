import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './components/Auth/LoginPage';
import Dashboard from './components/Dashboard/Dashboard';
import InvoiceList from './components/Invoices/InvoiceList';
import InvoiceForm from './components/Invoices/InvoiceForm';
import InvoicePreview from './components/Invoices/InvoicePreview';
import CustomerList from './components/Customers/CustomerList';
import ProductList from './components/Products/ProductList';
import PaymentList from './components/Payments/PaymentList';
import Reports from './components/Reports/Reports';
import Settings from './components/Settings/Settings';
import UserManagement from './components/Users/UserManagement';
import DatabaseSettings from './components/Admin/DatabaseSettings';
import Profile from './components/Profile/Profile';
import HistoryRecords from './components/History/HistoryRecords';
import ServiceOrderList from './components/Services/ServiceOrderList';
import ExpenseList from './components/Expenses/ExpenseList';
import QuotationList from './components/Quotations/QuotationList';
import PurchaseList from './components/Purchases/PurchaseList';
import CompanyManagement from './components/Companies/CompanyManagement';

function ClientRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/users" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Loading Multi-Company ERP...</p>
        </div>
      </div>
    );
  }

  const defaultLanding = isAdmin ? '/users' : '/dashboard';

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to={defaultLanding} replace /> : <LoginPage />
      } />
      
      <Route path="/" element={
        isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />
      }>
        <Route index element={<Navigate to={defaultLanding} replace />} />
        
        {/* Admin Only Routes: Client User Management & Google Sheet DB */}
        <Route path="users" element={
          <AdminRoute>
            <UserManagement />
          </AdminRoute>
        } />
        <Route path="admin/database" element={
          <AdminRoute>
            <DatabaseSettings />
          </AdminRoute>
        } />
        <Route path="database" element={<Navigate to="/admin/database" replace />} />

        {/* Client Only Routes: 5 Core Shop Pages */}
        <Route path="dashboard" element={
          <ClientRoute>
            <Dashboard />
          </ClientRoute>
        } />
        <Route path="services" element={
          <ClientRoute>
            <ServiceOrderList />
          </ClientRoute>
        } />
        <Route path="invoices" element={
          <ClientRoute>
            <InvoiceList />
          </ClientRoute>
        } />
        <Route path="invoices/new" element={
          <ClientRoute>
            <InvoiceForm />
          </ClientRoute>
        } />
        <Route path="invoices/edit/:id" element={
          <ClientRoute>
            <InvoiceForm />
          </ClientRoute>
        } />
        <Route path="invoices/view/:id" element={
          <ClientRoute>
            <InvoicePreview />
          </ClientRoute>
        } />
        <Route path="history" element={
          <ClientRoute>
            <HistoryRecords />
          </ClientRoute>
        } />
        <Route path="customers" element={
          <ClientRoute>
            <HistoryRecords />
          </ClientRoute>
        } />
        <Route path="settings" element={
          <ClientRoute>
            <Settings />
          </ClientRoute>
        } />
        <Route path="profile" element={
          <ClientRoute>
            <Profile />
          </ClientRoute>
        } />

        {/* Legacy redirects */}
        <Route path="quotations" element={<Navigate to="/invoices" replace />} />
        <Route path="products" element={<Navigate to="/history" replace />} />
        <Route path="purchases" element={<Navigate to="/history" replace />} />
        <Route path="payments" element={<Navigate to="/history" replace />} />
        <Route path="expenses" element={<Navigate to="/history" replace />} />
        <Route path="reports" element={<Navigate to="/history" replace />} />
        <Route path="companies" element={<Navigate to="/users" replace />} />
      </Route>

      <Route path="*" element={<Navigate to={defaultLanding} replace />} />
    </Routes>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-4">
              {this.state.error?.message || "An unexpected error occurred while loading the application."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/login';
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors"
              >
                Reset & Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                borderRadius: '12px',
                padding: '12px 16px',
              },
            }}
          />
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
