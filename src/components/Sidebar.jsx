import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import {
  LayoutDashboard, Users, ReceiptText, Landmark, TrendingUp,
  PackageOpen, LogOut, FileText, BarChart3, AlertCircle,
  WalletCards, DatabaseBackup
} from 'lucide-react';

export default function Sidebar({ isOpen, collapsed }) {
  const { logout, customers } = useAdmin();

  const badges = useMemo(() => {
    try {
      const users = customers;
      let missedCount = 0;
      users.forEach(u => {
        const wallet = u.wallet;
        if (wallet.activeSchemes) {
          missedCount += wallet.activeSchemes.filter(s => s.status === 'Missed Payment').length;
        }
      });
      const pendingWithdrawals = 0;
      return { missedCount, pendingWithdrawals };
    } catch {
      return { missedCount: 0, pendingWithdrawals: 0 };
    }
  }, [customers]);

  const navItem = (to, Icon, label, badge, exact) => (
    <NavLink
      to={to}
      end={exact}
      title={collapsed ? label : undefined}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon size={18} className="nav-icon" />
      {!collapsed && <span className="nav-label">{label}</span>}
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </NavLink>
  );

  const sectionLabel = (text) => (
    <div className="nav-section-label">{text}</div>
  );

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-header">
        <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
          <img
            src="/logo.png"
            alt="Taradas Jewellers Logo"
            style={{
              width: 40, height: 40, borderRadius: 10, objectFit: 'cover',
              background: '#fff', border: '1.5px solid var(--gold)',
              boxShadow: '0 4px 12px rgba(198,153,62,0.35)'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="logo-icon" style={{ display: 'none', position: 'absolute', top: 0, left: 0, width: 40, height: 40 }}>
            T
          </div>
        </div>
        {!collapsed && (
          <div className="sidebar-header-text">
            <h2>TARADAS</h2>
            <span>Jewellers Admin</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {sectionLabel('Main')}
        {navItem('/', LayoutDashboard, 'Dashboard', 0, true)}

        {sectionLabel('Management')}
        {navItem('/customers', Users, 'Customer CRM', 0, false)}
        {navItem('/transactions', ReceiptText, 'Transactions', 0, false)}
        {navItem('/schemes', Landmark, 'Gold Schemes', 0, false)}
        {navItem('/gold-rates', TrendingUp, 'Live Gold Rates', 0, false)}

        {sectionLabel('Operations')}
        {navItem('/withdrawals', PackageOpen, 'Withdrawals', badges.pendingWithdrawals, false)}
        {navItem('/accept-cash', WalletCards, 'Accept Cash', 0, false)}
        {navItem('/missed-payments', AlertCircle, 'Missed Payments', badges.missedCount, false)}

        {sectionLabel('Reports')}
        {navItem('/daily-report', FileText, 'Daily Report', 0, false)}
        {navItem('/scheme-overview', BarChart3, 'Scheme Overview', 0, false)}
        {navItem('/data-backup', DatabaseBackup, 'Data Backup', 0, false)}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={logout} title={collapsed ? 'Logout' : undefined}>
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
