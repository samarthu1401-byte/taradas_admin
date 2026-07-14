import { useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Users, Landmark, IndianRupee, TrendingUp, AlertTriangle, CheckCircle, ReceiptText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { getAllUsers, getUserWallet, customers } = useAdmin();

  const stats = useMemo(() => {
    const users = getAllUsers();
    const todayLocalDate = new Date().toLocaleDateString('en-IN');

    let totalInr = 0, totalGold = 0, activeSchemesCount = 0;
    let missedPaymentsCount = 0;
    let todayCollection = 0, completingSoon = 0;
    let recentTxs = [];

    users.forEach(u => {

      const wallet = getUserWallet(u.phone);
      totalInr += wallet.inrBalance || 0;
      totalGold += wallet.gold24kBalance || 0;

      if (wallet.activeSchemes) {
        activeSchemesCount += wallet.activeSchemes.length;
        missedPaymentsCount += wallet.activeSchemes.filter(s => s.status === 'Missed Payment').length;
        wallet.activeSchemes.forEach(s => {
          const remaining = s.totalInstallments - s.installmentsPaid;
          if (remaining <= 2 && remaining > 0) completingSoon++;
        });
      }

      if (wallet.transactions) {
        wallet.transactions.forEach(tx => {
          if (tx.type === 'credit' && new Date(tx.date).toLocaleDateString('en-IN') === todayLocalDate) {
            if (!tx.assetAdded || tx.assetAdded === 'inr') todayCollection += tx.amount;
          }
        });
        recentTxs = [...recentTxs, ...wallet.transactions.map(t => ({ ...t, customerName: u.name, customerPhone: u.phone }))];
      }
    });

    recentTxs.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { totalCustomers: users.length, totalInr, totalGold, activeSchemesCount, missedPaymentsCount, todayCollection, completingSoon, recentTxs: recentTxs.slice(0, 5) };
  }, [customers]);

  return (
    <div>
      {/* Alert banners */}
      {stats.completingSoon > 0 && (
        <Link to="/scheme-overview" style={{ textDecoration: 'none' }}>
          <div className="alert alert-success" style={{ cursor: 'pointer' }}>
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>{stats.completingSoon} scheme{stats.completingSoon !== 1 ? 's' : ''} completing soon</strong>
              — prepare for gold/cash redemption. <span style={{ textDecoration: 'underline' }}>View details</span>
            </div>
          </div>
        </Link>
      )}
      {stats.missedPaymentsCount > 0 && (
        <Link to="/missed-payments" style={{ textDecoration: 'none' }}>
          <div className="alert alert-danger" style={{ cursor: 'pointer' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>{stats.missedPaymentsCount} customer{stats.missedPaymentsCount !== 1 ? 's' : ''} with missed payments</strong>
              — send WhatsApp reminders now. <span style={{ textDecoration: 'underline' }}>View defaulters</span>
            </div>
          </div>
        </Link>
      )}

      <div className="grid-cards">
        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Total Customers</h4>
            <div className="value">{stats.totalCustomers}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Active Schemes</h4>
            <div className="value">{stats.activeSchemesCount}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <Landmark size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Total INR Vaulted</h4>
            <div className="value">₹{stats.totalInr.toLocaleString('en-IN')}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
            <IndianRupee size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Gold Managed</h4>
            <div className="value text-gold">{stats.totalGold.toFixed(3)}g</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(198,153,62,0.1)', color: 'var(--gold)' }}>
            <TrendingUp size={24} />
          </div>
        </div>

        <Link to="/daily-report" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-card-info">
            <h4>Today's Collection</h4>
            <div className="value" style={{ color: '#10b981' }}>₹{stats.todayCollection.toLocaleString('en-IN')}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <ReceiptText size={24} />
          </div>
        </Link>

        <Link to="/missed-payments" className="stat-card" style={{ textDecoration: 'none', borderLeft: stats.missedPaymentsCount > 0 ? '4px solid #ef4444' : '' }}>
          <div className="stat-card-info">
            <h4 className={stats.missedPaymentsCount > 0 ? 'text-danger' : ''}>Missed Payments</h4>
            <div className={`value ${stats.missedPaymentsCount > 0 ? 'text-danger' : ''}`}>{stats.missedPaymentsCount}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
        </Link>


        <Link to="/scheme-overview" className="stat-card" style={{ textDecoration: 'none', borderLeft: stats.completingSoon > 0 ? '4px solid #10b981' : '' }}>
          <div className="stat-card-info">
            <h4 className={stats.completingSoon > 0 ? 'text-success' : ''}>Completing Soon</h4>
            <div className={`value ${stats.completingSoon > 0 ? 'text-success' : ''}`}>{stats.completingSoon}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
        </Link>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Recent Transactions</h3>
          <Link to="/transactions" className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 13 }}>View All</Link>
        </div>
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount / Asset</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTxs.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state" style={{ padding: 32 }}>
                      <div className="empty-state-icon">💳</div>
                      <div className="empty-state-title">No transactions yet</div>
                    </div>
                  </td>
                </tr>
              ) : (
                stats.recentTxs.map(tx => (
                  <tr key={`${tx.id}-${tx.customerPhone}`}>
                    <td style={{ fontSize: 13 }}>{new Date(tx.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tx.customerName || 'Unknown'}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>+91 {tx.customerPhone}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{tx.desc || tx.scheme}</td>
                    <td>
                      <span className={`badge ${tx.type === 'credit' ? 'success' : 'danger'}`}>{tx.type}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: tx.assetAdded === 'gold' ? 'var(--gold-dark)' : tx.assetAdded === 'silver' ? '#666' : 'var(--maroon)' }}>
                      {tx.type === 'credit' ? '+' : '-'}{tx.amount} {tx.assetAdded === 'gold' ? 'g Gold' : tx.assetAdded === 'silver' ? 'g Silver' : 'INR'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
