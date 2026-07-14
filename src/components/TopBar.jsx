import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Bell, Menu, ChevronDown, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ProfilePanel from './ProfilePanel';

const PAGE_TITLES = {
  '/': 'Dashboard Overview',
  '/accept-cash': 'Accept Cash & Credit Wallet',
  '/customers': 'Customer CRM',
  '/transactions': 'Transaction Ledger',
  '/schemes': 'Scheme Management',
  '/gold-rates': 'Live Gold Rates',
  '/register': 'Register Customer',
  '/missed-payments': 'SIP Defaulters',
  '/withdrawals': 'Withdrawal Approvals',
  '/daily-report': 'Daily Collection Report',
  '/scheme-overview': 'Scheme Overview',
};

export default function TopBar({ onMenuClick, isDark, onToggleDark }) {
  const { admin } = useAdmin();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);


  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="topbar">
      <div className="d-flex align-center gap-3">
        <button className="btn btn-outline topbar-menu-btn" style={{ padding: 8, border: 'none' }} onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <h1 className="page-title">{PAGE_TITLES[location.pathname] || 'Store Management'}</h1>
      </div>

      <div className="topbar-actions">
        <div className="topbar-clock">
          <span className="clock-time">{timeStr}</span>
          <span className="clock-date">{dateStr}</span>
        </div>

        <button
          onClick={onToggleDark}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1.5px solid var(--border-color, #e5e5e5)',
            background: isDark ? '#2a2a2e' : '#f5f5f5',
            color: isDark ? '#f0c040' : '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={20} className="text-muted" />
        </div>

        {/* Clickable profile area */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: profileOpen ? '#f5f5f5' : 'transparent', border: '1px solid transparent', borderColor: profileOpen ? '#eee' : 'transparent', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <div className="admin-avatar">
              {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="topbar-profile-name" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, color: 'var(--dark)' }}>{admin?.name || 'Admin'}</span>
              <span style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Store Manager</span>
            </div>
            <ChevronDown size={14} className="text-muted" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
        </div>
      </div>
    </div>
  );
}
