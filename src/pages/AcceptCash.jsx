import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Search } from 'lucide-react';
import { walletService } from '../services/walletService';
import { schemeService } from '../services/schemeService';
import PageLead from '../components/PageLead';

export default function AcceptCash() {
  const { getAllUsers, showToast } = useAdmin();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [customerSchemes, setCustomerSchemes] = useState([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [processing, setProcessing] = useState(false);
  const users = getAllUsers();
  const selectedScheme = customerSchemes.find(s => s._id === selectedSchemeId);

  const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    const user = users.find(u => u.userId?.toLowerCase() === query || u.customerId?.toLowerCase() === query || u.name?.toLowerCase().includes(query) || u.phone === query || u.phoneNumber?.includes(query));
    if (!user) {
      setSelectedUser(null); setCustomerSchemes([]); setSelectedSchemeId('');
      showToast('Customer not found', 'error'); return;
    }
    try {
      const [wallet, schemes] = await Promise.all([walletService.getWallet(user.userId), schemeService.getCustomerSchemes(user.userId)]);
      const activeSchemes = schemes.filter(s => s.status === 'ACTIVE' && s.installments_paid < s.total_installments);
      setSelectedUser({ ...user, wallet }); setCustomerSchemes(activeSchemes); setSelectedSchemeId(activeSchemes[0]?._id || '');
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message || 'Unable to load customer schemes', 'error'); }
  };

  const handleCollect = async (event) => {
    event.preventDefault();
    if (!selectedScheme) return;
    setProcessing(true);
    try {
      const installment = await schemeService.collectCashInstallment(selectedSchemeId);
      setCustomerSchemes(current => current.map(s => s._id === selectedSchemeId ? { ...s, installments_paid: s.installments_paid + 1, total_paid_amount: s.total_paid_amount + s.installment_amount, total_gold_grams: s.total_gold_grams + installment.grams_allocated } : s));
      showToast(`Cash collection approved: installment #${installment.installment_number} for ${selectedUser.name}`, 'success');
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message || 'Unable to approve collection', 'error'); }
    finally { setProcessing(false); }
  };

  return <>
    <PageLead eyebrow="Collection desk" title="Accept cash" description="Find a customer, select an enrolled scheme, and approve the next cash installment." />
    <div className="form-row">
      <div className="panel">
        <div className="panel-header"><h3>Accept cash installment</h3></div>
        <form onSubmit={handleSearch} className="mb-6">
          <div className="form-group"><label>Search by Customer ID, name, or mobile number</label><div className="d-flex gap-2">
            <input type="text" className="form-control" placeholder="CUS1234ABCD, customer name, or mobile" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button type="submit" className="btn btn-secondary" disabled={!searchQuery.trim()}><Search size={18} /> Find</button>
          </div></div>
        </form>
        {selectedUser && <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 12, border: '1px solid #eee' }}>
          <div className="d-flex justify-between align-center mb-4"><div><h4 style={{ fontSize: 18, color: 'var(--maroon)' }}>{selectedUser.name || 'Anonymous User'}</h4><div className="text-muted">{selectedUser.phoneNumber || selectedUser.phone}</div></div><div className="text-right"><div className="text-muted" style={{ fontSize: 12 }}>Customer ID</div><div style={{ fontWeight: 'bold' }}>{selectedUser.customerId || selectedUser.userId}</div></div></div>
          <hr style={{ borderTop: '1px solid #ddd', margin: '20px 0' }} />
          <form onSubmit={handleCollect}>
            <div className="form-group"><label>Customer scheme</label>{customerSchemes.length ? <select className="form-control" value={selectedSchemeId} onChange={e => setSelectedSchemeId(e.target.value)}>{customerSchemes.map(s => <option key={s._id} value={s._id}>{s.scheme_type} · {s.gold_carat} · ₹{s.installment_amount.toLocaleString()} · installment {s.installments_paid + 1}/{s.total_installments}</option>)}</select> : <div className="text-muted">This customer has no active scheme with a pending installment.</div>}</div>
            <button type="submit" className="btn btn-primary w-100" style={{ padding: 16, fontSize: 16 }} disabled={processing || !selectedScheme}>{processing ? 'Approving...' : `Approve cash installment${selectedScheme ? ` · ₹${selectedScheme.installment_amount.toLocaleString()}` : ''}`}</button>
          </form>
        </div>}
      </div>
      <div className="panel"><div className="panel-header"><h3>Collection policy</h3></div><p className="text-muted">Approval marks only the next pending installment of the selected customer scheme as paid. Gold is calculated at the current rate for the karat locked at enrollment.</p></div>
    </div>
  </>;
}
