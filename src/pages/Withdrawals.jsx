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
  return <><PageLead eyebrow="Approval desk" title="Withdrawals" description="Review and action customer withdrawal requests with full status visibility." /><div className="panel"><div className="panel-header"><h3 className="d-flex align-center gap-2"><PackageOpen /> Withdrawal Approvals</h3><div className="d-flex gap-2"><input className="form-control" type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} /><select className="form-control" style={{ width: 150 }} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option></select></div></div><div className="table-container"><table className="admin-table"><thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredRequests.map(request => { const customer = customerDetails(request.customerId); return <tr key={request.id}><td>{new Date(request.createdAt).toLocaleDateString('en-IN')}</td><td><strong>{customer?.name || request.customerId}</strong><div className="text-muted" style={{ fontSize: 12 }}>{customer?.customerId || request.customerId}</div></td><td>{request.type}</td><td>{request.amount} {request.asset}</td><td><span className={`badge ${request.status === 'Pending' ? 'warning' : request.status === 'Approved' ? 'success' : 'danger'}`}>{request.status}</span></td><td>{request.status === 'Pending' && <div className="d-flex gap-2"><button className="btn btn-outline" onClick={() => handleAction(request, 'Approve')}><CheckCircle size={16} /></button><button className="btn btn-outline" onClick={() => handleAction(request, 'Reject')}><XCircle size={16} /></button></div>}</td></tr>})}{!filteredRequests.length && <tr><td colSpan="6" className="text-center text-muted">No withdrawal requests found.</td></tr>}</tbody></table></div></div></>;
}
