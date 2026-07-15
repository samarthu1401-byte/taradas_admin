import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, Banknote, CheckCircle2, CircleDollarSign,
  Gem, Landmark, ReceiptText, TrendingUp, UserPlus, Users, WalletCards,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

const formatCurrency = (value) => `₹${value.toLocaleString('en-IN')}`;

export default function Dashboard() {
  const { getAllUsers, getUserWallet, customers } = useAdmin();

  const stats = useMemo(() => {
    const users = getAllUsers();
    const today = new Date().toLocaleDateString('en-IN');
    const result = { totalInr: 0, totalGold: 0, activeSchemes: 0, missed: 0, todayCollection: 0, completing: 0, recentTxs: [] };

    users.forEach((user) => {
      const wallet = getUserWallet(user.phone);
      result.totalInr += wallet.totalInvested || 0;
      result.totalGold += wallet.gold24kBalance || 0;
      result.activeSchemes += wallet.activeSchemes?.length || 0;
      result.missed += wallet.activeSchemes?.filter((scheme) => scheme.status === 'Missed Payment').length || 0;
      result.completing += wallet.activeSchemes?.filter((scheme) => {
        const remaining = scheme.totalInstallments - scheme.installmentsPaid;
        return remaining > 0 && remaining <= 2;
      }).length || 0;

      (wallet.transactions || []).forEach((tx) => {
        if (tx.type === 'credit' && new Date(tx.date).toLocaleDateString('en-IN') === today && (!tx.assetAdded || tx.assetAdded === 'inr')) result.todayCollection += tx.amount;
        result.recentTxs.push({ ...tx, customerName: user.name, customerPhone: user.phone });
      });
    });

    result.recentTxs.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { ...result, totalCustomers: users.length, recentTxs: result.recentTxs.slice(0, 5) };
  }, [customers, getAllUsers, getUserWallet]);

  const health = stats.missed ? 'Attention required' : 'All collections on track';
  const healthTone = stats.missed ? 'attention' : 'healthy';

  return (
    <div className="dashboard-premium">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">Taradas Jewellers · Admin intelligence</span>
          <h2>Today’s store performance, <em>at a glance.</em></h2>
          <p>Monitor savings, collections and customer activity from one clear workspace.</p>
          <div className={`dashboard-health ${healthTone}`}>
            {stats.missed ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
            <span>{health}</span>
            {stats.missed > 0 && <Link to="/missed-payments">Review now <ArrowUpRight size={14} /></Link>}
          </div>
        </div>
        <div className="dashboard-hero-collection">
          <span>Today’s collection</span>
          <strong>{formatCurrency(stats.todayCollection)}</strong>
          <div><TrendingUp size={15} /> Live wallet credits</div>
        </div>
      </section>

      <section className="dashboard-metrics">
        <div className="dashboard-metric metric-navy"><span className="metric-label">Customers</span><strong>{stats.totalCustomers}</strong><small>Registered profiles</small><Users /></div>
        <div className="dashboard-metric metric-gold"><span className="metric-label">Active schemes</span><strong>{stats.activeSchemes}</strong><small>Ongoing savings plans</small><Landmark /></div>
        <div className="dashboard-metric metric-emerald"><span className="metric-label">Total invested</span><strong>{formatCurrency(stats.totalInr)}</strong><small>Confirmed scheme payments</small><WalletCards /></div>
        <div className="dashboard-metric metric-violet"><span className="metric-label">Gold managed</span><strong>{stats.totalGold.toFixed(3)}g</strong><small>24K equivalent balance</small><Gem /></div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-panel dashboard-activity">
          <div className="dashboard-panel-heading"><div><span>Live activity</span><h3>Recent transactions</h3></div><Link to="/transactions">View ledger <ArrowUpRight size={15} /></Link></div>
          {stats.recentTxs.length ? <div className="activity-list">{stats.recentTxs.map((tx) => (
            <div className="activity-item" key={`${tx.id}-${tx.customerPhone}`}>
              <div className={`activity-icon ${tx.type === 'credit' ? 'credit' : 'debit'}`}><ReceiptText size={16} /></div>
              <div className="activity-copy"><strong>{tx.customerName || 'Customer'}</strong><span>{tx.desc || tx.scheme || 'Wallet transaction'} · {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>
              <div className={`activity-amount ${tx.type === 'credit' ? 'credit' : 'debit'}`}>{tx.type === 'credit' ? '+' : '-'}{tx.assetAdded === 'gold' ? `${tx.amount}g` : formatCurrency(tx.amount || 0)}</div>
            </div>
          ))}</div> : <div className="dashboard-empty"><CircleDollarSign size={28} /><strong>No transactions yet</strong><span>New wallet activity will appear here.</span></div>}
        </div>

        <div className="dashboard-panel dashboard-priority">
          <div className="dashboard-panel-heading"><div><span>Priority desk</span><h3>What needs attention</h3></div></div>
          <Link className="priority-row" to="/missed-payments"><span className="priority-icon danger"><AlertTriangle size={17} /></span><div><strong>Missed payments</strong><small>{stats.missed ? `${stats.missed} customer plan${stats.missed === 1 ? '' : 's'} need follow-up` : 'No pending reminders'}</small></div><b>{stats.missed}</b><Chevron /></Link>
          <Link className="priority-row" to="/scheme-overview"><span className="priority-icon success"><CheckCircle2 size={17} /></span><div><strong>Completing soon</strong><small>Plans within their final installments</small></div><b>{stats.completing}</b><Chevron /></Link>
          <Link className="priority-row" to="/withdrawals"><span className="priority-icon gold"><Banknote size={17} /></span><div><strong>Withdrawal desk</strong><small>Review pending customer requests</small></div><Chevron /></Link>
        </div>
      </section>

      <section className="dashboard-quick-actions">
        <Link to="/register"><UserPlus size={19} /><span><strong>Register customer</strong><small>Create a customer ID and login</small></span><ArrowUpRight size={17} /></Link>
        <Link to="/accept-cash"><Banknote size={19} /><span><strong>Accept cash</strong><small>Credit a customer wallet</small></span><ArrowUpRight size={17} /></Link>
        <Link to="/schemes"><Landmark size={19} /><span><strong>Manage schemes</strong><small>Create or update gold plans</small></span><ArrowUpRight size={17} /></Link>
      </section>
    </div>
  );
}

function Chevron() { return <ArrowUpRight className="priority-arrow" size={16} />; }
