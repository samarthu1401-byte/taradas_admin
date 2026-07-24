import { useEffect, useState } from 'react';
import { PackageOpen, CheckCircle, XCircle } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { withdrawalService } from '../services/withdrawalService';
import PageLead from '../components/PageLead';

export default function Withdrawals() {
  const { showToast, customers } = useAdmin();
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    withdrawalService.list().then(setRequests).catch(error => showToast(error.message, 'error'));
    // This is an initial data fetch; showToast is intentionally excluded because its context reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async (request, action) => {
    try {
      const updated = await withdrawalService.updateStatus({ id: request.id, status: action === 'Approve' ? 'Approved' : 'Rejected' });
      setRequests(current => current.map(item => item.id === request.id ? updated : item));
      showToast(`Withdrawal ${action === 'Approve' ? 'approved' : 'rejected'}`, action === 'Approve' ? 'success' : 'info');
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message, 'error'); }
  };

  const filteredRequests = requests.filter(request => (statusFilter === 'all' || request.status === statusFilter) && (!dateFilter || request.createdAt.startsWith(dateFilter)));
  const customerDetails = customerId => customers.find(customer => customer.userId === customerId);
  return (
    <>
      <PageLead eyebrow="Approval desk" title="Withdrawals & Redemptions" description="Review and action customer scheme redemptions and gold wallet requests with full status visibility." />
      <div className="panel">
        <div className="panel-header">
          <h3 className="d-flex align-center gap-2"><PackageOpen size={20} /> Withdrawal Approvals</h3>
          <div className="d-flex gap-2">
            <input className="form-control" type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />
            <select className="form-control" style={{ width: 160 }} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer Details</th>
                <th>Request Type</th>
                <th>24K Gold Quantity</th>
                <th>Bonus Status</th>
                <th>Status</th>
                <th>Decision Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => {
                const customer = customerDetails(request.customerId);
                return (
                  <tr key={request.id}>
                    <td>{(() => { if (!request.createdAt) return '—'; try { const d = new Date(request.createdAt); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN'); } catch { return '—'; } })()}</td>
                    <td>
                      <strong>{customer?.name || request.customerId}</strong>
                      <div className="text-muted" style={{ fontSize: 12 }}>ID: {customer?.customerId || request.customerId} | Ph: {customer?.phoneNumber || '—'}</div>
                    </td>
                    <td><span className="badge info">{request.type}</span></td>
                    <td><strong style={{ color: 'var(--gold-dark)', fontSize: 15 }}>{request.amount} {request.asset ? request.asset.toUpperCase() : '24K Gold'}</strong></td>
                    <td>
                      {request.installmentsPaid >= 12 || request.status === 'Approved' ? (
                        <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>✨ ₹1,000 Bonus Gold Credited</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--gold-dark)', fontWeight: 700 }}>🎁 ₹1,000 Bonus Eligible on 12th Inst.</span>
                      )}
                    </td>
                    <td><span className={`badge ${request.status === 'Pending' ? 'warning' : request.status === 'Approved' ? 'success' : 'danger'}`}>{request.status}</span></td>
                    <td>
                      {request.status === 'Pending' ? (
                        <div className="d-flex gap-2">
                          <button className="btn btn-outline" style={{ color: '#10B981', borderColor: '#10B981' }} onClick={() => handleAction(request, 'Approve')} title="Approve Redemption">
                            <CheckCircle size={16} /> Approve
                          </button>
                          <button className="btn btn-outline" style={{ color: '#EF4444', borderColor: '#EF4444' }} onClick={() => handleAction(request, 'Reject')} title="Reject Request">
                            <XCircle size={16} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }}>Actioned ({request.status})</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredRequests.length && (
                <tr>
                  <td colSpan="7" className="text-center text-muted" style={{ padding: 30 }}>
                    No withdrawal requests matching selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
