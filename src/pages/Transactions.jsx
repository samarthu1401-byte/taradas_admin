import { useState, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Filter, Download } from 'lucide-react';
import PageLead from '../components/PageLead';

export default function Transactions() {
  const { customers } = useAdmin();
  const [filterAsset, setFilterAsset] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [customerQuery, setCustomerQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const transactions = useMemo(() => customers.flatMap(customer =>
    (customer.wallet?.transactions || []).map(item => ({
      ...item,
      customerId: customer.customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
    })))
    .sort((left, right) => new Date(right.date) - new Date(left.date)), [customers]);

  const filteredTxs = useMemo(() => transactions.filter(tx => {
    if (filterAsset !== 'all' && tx.assetAdded !== filterAsset) return false;
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
    if (customerQuery && !`${tx.customerName || ''} ${tx.customerPhone || ''} ${tx.customerId || ''}`.toLowerCase().includes(customerQuery.toLowerCase())) return false;
    if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(tx.date) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  }), [transactions, filterAsset, filterStatus, customerQuery, dateFrom, dateTo]);

  const totals = useMemo(() => filteredTxs.reduce(
    (acc, tx) => {
      if (tx.status === 'SUCCESS') acc.success++;
      else if (tx.status === 'FAILED') acc.failed++;
      else if (tx.status === 'ABANDONED') acc.abandoned++;
      else acc.pending++;
      return acc;
    },
    { success: 0, failed: 0, abandoned: 0, pending: 0 }
  ), [filteredTxs]);

  const handleExportCSV = () => {
    const headers = ['Date & Time', 'Customer Name', 'Phone', 'Description', 'Status', 'Amount', 'Asset'];
    const rows = filteredTxs.map(tx => [
      new Date(tx.date).toLocaleString('en-IN'),
      tx.customerName || 'Unknown',
      tx.customerPhone,
      tx.desc || tx.scheme || '',
      tx.status || 'UNKNOWN',
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
    <><PageLead eyebrow="Finance desk" title="Transaction ledger" description="Review every wallet credit and debit with customer-level filtering." />
    <div className="panel">
      <div className="panel-header ledger-panel-header">
        <div><span className="ledger-kicker">Wallet movement</span><h3>Transaction Ledger</h3></div>
        <button className="btn btn-outline" onClick={handleExportCSV} disabled={filteredTxs.length === 0}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="ledger-toolbar">
        <div className="ledger-toolbar-row">
          <div className="ledger-filter-group">
            <div className="d-flex align-center gap-2">
              <Filter size={15} className="text-muted" />
              <select className="form-control" value={filterAsset} onChange={e => setFilterAsset(e.target.value)}>
                <option value="all">All Assets</option>
                <option value="inr">INR</option>
                <option value="gold24k">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>
            <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="SUCCESS">Successful</option>
              <option value="FAILED">Failed</option>
              <option value="ABANDONED">Abandoned</option>
              <option value="CREATED">Pending</option>
            </select>
            <input className="form-control ledger-search" placeholder="Search customer, ID or phone" value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} />
            <div className="ledger-date-range">
              <input type="date" className="form-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-muted" style={{ fontSize: 13 }}>to</span>
              <input type="date" className="form-control" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="ledger-summary">
            <div><span>Successful</span><strong className="credit">{totals.success}</strong>
            </div>
            <div><span>Failed</span><strong className="debit">{totals.failed}</strong>
            </div>
            <div><span>Abandoned</span><strong>{totals.abandoned}</strong>
            </div>
            <div><span>Pending</span><strong>{totals.pending}</strong>
            </div>
            <div><span>Showing</span><strong>{filteredTxs.length}</strong>
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
              <th>Status</th>
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
                    <div className="text-muted" style={{ fontSize: 12 }}>{tx.customerPhone || '-'}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{tx.desc || tx.scheme}</td>
                  <td>
                    <span className={`badge ${tx.status === 'SUCCESS' ? 'success' : tx.status === 'FAILED' ? 'danger' : 'warning'}`}>{tx.status || 'UNKNOWN'}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: tx.assetAdded === 'gold' ? 'var(--gold-dark)' : tx.assetAdded === 'silver' ? '#666' : 'var(--maroon)' }}>
                    {tx.status === 'SUCCESS' ? '+' : ''}{tx.amount} {tx.assetAdded === 'gold' ? 'g Gold' : tx.assetAdded === 'silver' ? 'g Silver' : 'INR'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div></>
  );
}
