import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { LivePriceProvider } from './context/LivePriceContext';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ToastContainer from './components/Toast';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Schemes = lazy(() => import('./pages/Schemes'));
const GoldRates = lazy(() => import('./pages/GoldRates'));
const RegisterCustomer = lazy(() => import('./pages/RegisterCustomer'));
const Withdrawals = lazy(() => import('./pages/Withdrawals'));
const DailyReport = lazy(() => import('./pages/DailyReport'));
const SchemeOverview = lazy(() => import('./pages/SchemeOverview'));
const MissedPayments = lazy(() => import('./pages/MissedPayments'));
const AcceptCash = lazy(() => import('./pages/AcceptCash'));
const DataBackup = lazy(() => import('./pages/DataBackup'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

const ProtectedRoute = ({ children }) => {
  const { admin, loading } = useAdmin();
  if (loading) return null;
  if (!admin) return <Navigate to="/login" replace />;
  if (admin.role !== 'admin') return <Navigate to="/unauthorized" replace />;
  return children;
};

const AdminLayout = ({ children, collapsed, onToggleCollapse, isDark, onToggleDark }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar isOpen={sidebarOpen} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} isDark={isDark} onToggleDark={onToggleDark} />
        <div className="page-container">
          {children}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleToggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      return next;
    });
  };

  return (
    <AdminProvider>
      <LivePriceProvider>
        <Suspense fallback={<div className="page-container text-muted">Loading…</div>}><Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AdminLayout collapsed={collapsed} onToggleCollapse={handleToggleCollapse} isDark={isDark} onToggleDark={() => setIsDark(d => !d)}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/schemes" element={<Schemes />} />
                  <Route path="/gold-rates" element={<GoldRates />} />
                  <Route path="/register" element={<RegisterCustomer />} />
                  <Route path="/withdrawals" element={<Withdrawals />} />
                  <Route path="/daily-report" element={<DailyReport />} />
                  <Route path="/scheme-overview" element={<SchemeOverview />} />
                  <Route path="/missed-payments" element={<MissedPayments />} />
                  <Route path="/accept-cash" element={<AcceptCash />} />
                  <Route path="/data-backup" element={<DataBackup />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          } />
        </Routes></Suspense>
        <ToastContainer />
      </LivePriceProvider>
    </AdminProvider>
  );
}

export default App;
