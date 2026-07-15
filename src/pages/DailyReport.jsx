import { useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { IndianRupee, Printer, Users, ReceiptText, TrendingUp } from 'lucide-react';
import PageLead from '../components/PageLead';

export default function DailyReport() {
  const { getAllUsers, getUserWallet, customers } = useAdmin();

  const today = new Date();
  const todayLocalDate = today.toLocaleDateString('en-IN');

  const report = useMemo(() => {
    const users = getAllUsers();
    const collections = [];
    let totalInr = 0, totalGold = 0, totalSilver = 0, txCount = 0;

    users.forEach(user => {
      const wallet = getUserWallet(user.phone);
      const todayTxs = (wallet.transactions || []).filter(tx =>
        tx.type === 'credit' && new Date(tx.date).toLocaleDateString('en-IN') === todayLocalDate
      );

      if (todayTxs.length === 0) return;

      let cInr = 0, cGold = 0, cSilver = 0;
      todayTxs.forEach(tx => {
        if (tx.assetAdded === 'gold') { cGold += tx.amount; totalGold += tx.amount; }
        else if (tx.assetAdded === 'silver') { cSilver += tx.amount; totalSilver += tx.amount; }
        else { cInr += tx.amount; totalInr += tx.amount; }
        txCount++;
      });

      collections.push({ name: user.name, phone: user.phone, inr: cInr, gold: cGold, silver: cSilver, txs: todayTxs });
    });

    return { collections, totalInr, totalGold, totalSilver, txCount };
  }, [customers]);

  return (
    <div>
      <PageLead eyebrow="Daily close" title="Collection report" description="A clean summary of today’s customer wallet collections." ><button className="btn" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button></PageLead>
      <div className="d-flex justify-between align-center mb-6 no-print">
        <div>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
            {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid-cards">
        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Transactions Today</h4>
            <div className="value">{report.txCount}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
            <ReceiptText size={24} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Cash Collected (INR)</h4>
            <div className="value">₹{report.totalInr.toLocaleString('en-IN')}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(198,153,62,0.1)', color: 'var(--gold)' }}>
            <IndianRupee size={24} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Gold Collected</h4>
            <div className="value text-gold">{report.totalGold.toFixed(4)}g</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(198,153,62,0.1)', color: 'var(--gold)' }}>
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h4>Customers Paid</h4>
            <div className="value">{report.collections.length}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <Users size={24} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Customer-wise Breakdown</h3>
          <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
            {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        {report.collections.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No collections today</div>
            <div className="empty-state-desc">Cash credited to customers today will appear here</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>INR Credited</th>
                  <th>Gold Credited</th>
                  <th>Silver Credited</th>
                  <th>Time &amp; Description</th>
                </tr>
              </thead>
              <tbody>
                {report.collections.map(c => (
                  <tr key={c.phone}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--maroon)' }}>{c.name}</div>
                      <div className="text-muted" style={{ fontSize: 12 }}>+91 {c.phone}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--maroon)' }}>
                      {c.inr > 0 ? `₹${c.inr.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--gold-dark)' }}>
                      {c.gold > 0 ? `${c.gold.toFixed(4)}g` : '—'}
                    </td>
                    <td style={{ fontWeight: 600, color: '#666' }}>
                      {c.silver > 0 ? `${c.silver.toFixed(2)}g` : '—'}
                    </td>
                    <td>
                      {c.txs.map(tx => (
                        <div key={tx.id} style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 2 }}>
                          {new Date(tx.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {' — '}{tx.desc || tx.scheme || 'Credit'}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '14px 16px', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--maroon)' }}>
                    ₹{report.totalInr.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--gold-dark)' }}>
                    {report.totalGold.toFixed(4)}g
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#666' }}>
                    {report.totalSilver.toFixed(2)}g
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-light)' }}>
                    {report.txCount} transaction{report.txCount !== 1 ? 's' : ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
