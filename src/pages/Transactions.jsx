import { useState, useMemo, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Filter, Download } from 'lucide-react';
import { walletService } from '../services/walletService';

export default function Transactions() {
  const { customers } = useAdmin();
  const [transactions, setTransactions] = useState([]);
  const [filterAsset, setFilterAsset] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [customerQuery, setCustomerQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    Promise.all(customers.map(async customer => {
      const items = await walletService.listTransactions(customer.userId);
      return items.map(item => ({ ...item, customerId: customer.customerId, customerName: customer.name, customerPhone: customer.phoneNumber, date: item.createdAt, assetAdded: item.asset, desc: item.description }));
    })).then(groups => setTransactions(groups.flat().sort((a, b) => new Date(b.date) - new Date(a.date)))).catch(() => setTransactions([]));
  }, [customers]);

  const filteredTxs = useMemo(() => transactions.filter(tx => {
    if (filterAsset !== 'all' && tx.assetAdded !== filterAsset) return false;
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (customerQuery && !`${tx.customerName || ''} ${tx.customerPhone || ''} ${tx.customerId || ''}`.toLowerCase().includes(customerQuery.toLowerCase())) return false;
    if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(tx.date) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  }), [transactions, filterAsset, filterType, customerQuery, dateFrom, dateTo]);

  const totals = useMemo(() => filteredTxs.reduce(
    (acc, tx) => { tx.type === 'credit' ? acc.credits++ : acc.debits++; return acc; },
    { credits: 0, debits: 0 }
  ), [filteredTxs]);

  const handleExportCSV = () => {
    const headers = ['Date & Time', 'Customer Name', 'Phone', 'Description', 'Type', 'Amount', 'Asset'];
    const rows = filteredTxs.map(tx => [
      new Date(tx.date).toLocaleString('en-IN'),
      tx.customerName || 'Unknown',
      tx.customerPhone,
      tx.desc || tx.scheme || '',
      tx.type,
      tx.amount,
      tx.assetAdded === 'gold' ? 'Gold (g)' : tx.assetAdded === 'silver' ? 'Silver (g)' : 'INR',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-header" style={{ marginBottom: 16 }}>
        <h3>Transaction Ledger</h3>
        <button className="btn btn-outline" onClick={handleExportCSV} disabled={filteredTxs.length === 0}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div style={{ background: '#fafafa', padding: 16, borderRadius: 10, border: '1px solid #eee', marginBottom: 20 }}>
        <div className="d-flex justify-between align-center" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="d-flex align-center gap-3" style={{ flexWrap: 'wrap' }}>
            <div className="d-flex align-center gap-2">
              <Filter size={15} className="text-muted" />
              <select className="form-control" style={{ width: 130, padding: '8px 12px' }} value={filterAsset} onChange={e => setFilterAsset(e.target.value)}>
                <option value="all">All Assets</option>
                <option value="inr">INR</option>
                <option value="gold24k">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>
            <select className="form-control" style={{ width: 130, padding: '8px 12px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="credit">Credits</option>
              <option value="debit">Debits</option>
            </select>
            <input className="form-control" style={{ width: 220, padding: '8px 12px' }} placeholder="Search customer or phone" value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} />
            <div className="d-flex align-center gap-2">
              <input type="date" className="form-control" style={{ width: 150, padding: '8px 12px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-muted" style={{ fontSize: 13 }}>to</span>
              <input type="date" className="form-control" style={{ width: 150, padding: '8px 12px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="d-flex gap-4">
            <div className="text-center">
              <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Credits</div>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: 16 }}>{totals.credits}</div>
            </div>
            <div className="text-center">
              <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Debits</div>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 16 }}>{totals.debits}</div>
            </div>
            <div className="text-center">
              <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Showing</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{filteredTxs.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Customer</th>
              <th>Description</th>
              <th>Type</th>
              <th>Amount / Asset</th>
            </tr>
          </thead>
          <tbody>
            {filteredTxs.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state" style={{ padding: 40 }}>
                    <div className="empty-state-icon">🔍</div>
                    <div className="empty-state-title">No transactions match</div>
                    <div className="empty-state-desc">Try adjusting your filters</div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTxs.map(tx => (
                <tr key={`${tx.id}-${tx.customerPhone}`}>
                  <td style={{ fontSize: 13 }}>{new Date(tx.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
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
  );
}
