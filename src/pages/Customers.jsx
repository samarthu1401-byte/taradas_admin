import { Fragment, useState, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useLivePrice } from '../context/LivePriceContext';
import { Search, ChevronDown, ChevronUp, Edit, IndianRupee, Trash2, X, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { walletService } from '../services/walletService';
import { customerService } from '../services/customerService';

export default function Customers() {
  const { getAllUsers, getUserWallet, showToast, customers, refreshCustomers } = useAdmin();
  const { prices } = useLivePrice();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Accept Cash modal state
  const [cashUser, setCashUser] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashCreditType, setCashCreditType] = useState('inr');
  const [cashProcessing, setCashProcessing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingCustomer, setSavingCustomer] = useState(false);

  const deleteCustomer = async (user) => {
    if (!window.confirm(`Delete ${user.name}? This permanently removes the customer login and profile.`)) return;
    try {
      await customerService.removeCustomer(user.userId);
      await refreshCustomers();
      showToast('Customer deleted', 'success');
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message, 'error'); }
  };

  const usersData = useMemo(() => {
    const users = getAllUsers();
    return users.map(u => ({ ...u, wallet: getUserWallet(u.phone) }));
  }, [customers, getAllUsers, getUserWallet]);

  const filteredUsers = usersData.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.includes(searchTerm) ||
    u.customerId?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openCashModal = (e, user) => {
    e.stopPropagation();
    setCashUser({ ...user, wallet: getUserWallet(user.phone) });
    setCashAmount('');
    setCashCreditType('inr');
  };

  const closeCashModal = () => {
    setCashUser(null);
    setCashAmount('');
    setCashCreditType('inr');
  };

  const openEditCustomer = (user) => {
    setEditingUser(user);
    setEditForm({ name: user.name || '', email: user.email || '', phoneNumber: user.phoneNumber || '', address: user.address || '', city: user.city || '', pincode: user.pincode || '', active: user.active !== false });
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    setSavingCustomer(true);
    try {
      await customerService.updateCustomer({ userId: editingUser.userId, ...editForm });
      await refreshCustomers();
      showToast('Customer updated', 'success');
      setEditingUser(null);
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message, 'error'); }
    finally { setSavingCustomer(false); }
  };


  const handleCashCredit = async (e) => {
    e.preventDefault();
    const val = parseFloat(cashAmount);
    if (!val || val <= 0) return;

    setCashProcessing(true);
    try {
      let assetAdded = 'inr';
      let assetAmount = val;

      if (cashCreditType === 'gold24k') {
        assetAmount = val / prices.gold24k.price;
        assetAdded = 'gold';
      } else if (cashCreditType === 'silver') {
        assetAmount = val / prices.silver.price;
        assetAdded = 'silver';
      }

      await walletService.creditWallet({ customerId: cashUser.userId, asset: cashCreditType, amount: parseFloat(assetAmount.toFixed(4)), type: 'credit', description: 'Cash deposit by Admin' });
      showToast(`Credited ${assetAmount.toFixed(4)} ${assetAdded.toUpperCase()} to ${cashUser.name}`, 'success');
      closeCashModal();
      await refreshCustomers();
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message, 'error'); }
    finally { setCashProcessing(false); }
  };

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <h3>Customer CRM</h3>
          <div className="d-flex align-center gap-3">
            <div style={{ position: 'relative' }}>
              <Search size={18} className="text-muted" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="text"
                placeholder="Search customer ID, name, or phone..."
                className="form-control"
                style={{ paddingLeft: 36, width: 300 }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Link to="/register" className="btn btn-primary d-flex align-center gap-2">
              <UserPlus size={18} /> Register Customer
            </Link>
          </div>
        </div>

        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Customer Name</th>
                <th>Contact Info</th>
                <th>City</th>
                <th>PIN Code</th>
                <th>Wallet Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-muted">No customers found</td></tr>
              ) : (
                paginatedUsers.map(user => (
                  <Fragment key={user.phone}>
                    <tr
                      style={{ cursor: 'pointer', background: expandedUser === user.phone ? '#fafafa' : '#fff' }}
                      onClick={() => setExpandedUser(expandedUser === user.phone ? null : user.phone)}
                    >
                      <td><span className="badge info">{user.customerId || user.userId}</span></td>
                      <td>
                        <div style={{ fontWeight: 'bold', color: 'var(--maroon)' }}>{user.name || 'Unknown'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>+91 {user.phone}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{user.email || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{user.city || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{user.pincode || '—'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>₹{(user.wallet?.inrBalance || 0).toLocaleString()}</div>
                        <div className="text-gold" style={{ fontSize: 12 }}>{(user.wallet?.gold24kBalance || 0).toFixed(3)}g Gold</div>
                      </td>
                      <td>
                        <div className="d-flex gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            title="Accept Cash"
                            onClick={e => openCashModal(e, user)}
                          >
                            <IndianRupee size={14} /> Cash
                          </button>
                          <button className="btn btn-outline" style={{ padding: '6px 9px', color: '#dc2626' }} title="Delete customer" onClick={() => deleteCustomer(user)}>
                            <Trash2 size={14} />
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                            onClick={() => setExpandedUser(expandedUser === user.phone ? null : user.phone)}
                          >
                            {expandedUser === user.phone ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedUser === user.phone && (
                      <tr style={{ background: '#fafafa' }}>
                        <td colSpan="7" style={{ padding: 24, borderTop: 'none' }}>
                          <div className="customer-details-grid d-flex gap-4">
                            <div style={{ flex: 1, background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
                              <h4 className="mb-3 d-flex justify-between align-center">
                                Customer Details
                                <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => openEditCustomer(user)}><Edit size={14} /> Edit</button>
                              </h4>
                              <div className="d-flex flex-column gap-2" style={{ fontSize: 13 }}>
                                <div><strong>Address:</strong> {user.address || 'Not provided'}</div>
                                <div><strong>Referred By:</strong> {user.referredBy || 'None'}</div>
                                <div><strong>Referral Code:</strong> {user.referralCode || `TJ${user.phone.substring(6)}`}</div>
                              </div>
                            </div>

                            <div style={{ flex: 1, background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
                              <h4 className="mb-3">Active Schemes ({user.wallet?.activeSchemes?.length || 0})</h4>
                              {user.wallet?.activeSchemes?.length > 0 ? (
                                <div className="d-flex flex-column gap-2">
                                  {user.wallet.activeSchemes.map(s => (
                                    <div key={s.id} style={{ padding: 12, background: '#fcfcfc', border: '1px solid #eee', borderRadius: 6, fontSize: 13 }}>
                                      <div className="d-flex justify-between align-center mb-1">
                                        <strong className="text-maroon">{s.name}</strong>
                                        <span className={`badge ${s.status === 'Missed Payment' ? 'danger' : 'success'}`}>{s.status || 'Active'}</span>
                                      </div>
                                      <div className="d-flex justify-between text-muted" style={{ fontSize: 12 }}>
                                        <span>Progress: {s.installmentsPaid}/{s.totalInstallments}</span>
                                        <span>Paid: ₹{s.totalPaid.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-muted" style={{ fontSize: 13 }}>No active schemes.</div>
                              )}
                            </div>

                            <div style={{ flex: 1, background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
                              <h4 className="mb-3">Recent Transactions</h4>
                              {user.wallet?.transactions?.length > 0 ? (
                                <div className="d-flex flex-column gap-2">
                                  {user.wallet.transactions.slice(0, 3).map(tx => (
                                    <div key={tx.id} style={{ padding: 10, borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                                      <div className="d-flex justify-between mb-1">
                                        <strong>{tx.desc}</strong>
                                        <span className={tx.type === 'credit' ? 'text-success' : 'text-danger'}>
                                          {tx.type === 'credit' ? '+' : '-'}{tx.amount} {tx.assetAdded === 'gold' ? 'g' : 'INR'}
                                        </span>
                                      </div>
                                      <div className="text-muted">{new Date(tx.date).toLocaleDateString()}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-muted" style={{ fontSize: 13 }}>No transactions yet.</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="d-flex justify-between align-center" style={{ padding: '16px 24px', borderTop: '1px solid #eee', background: '#fff' }}>
              <button 
                className="btn btn-outline" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Page {currentPage} of {totalPages}
              </div>
              <button 
                className="btn btn-outline" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Accept Cash Modal */}
      {cashUser && (
        <div className="modal-overlay" onClick={closeCashModal}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Accept Cash — {cashUser.name}</h3>
              <button className="modal-close" onClick={closeCashModal}><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="d-flex justify-between align-center mb-4" style={{ padding: '12px 16px', background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee' }}>
                <div className="text-muted" style={{ fontSize: 12 }}>+91 {cashUser.phone}</div>
                <div className="text-right">
                  <div className="text-muted" style={{ fontSize: 11 }}>Current INR Vault</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold' }}>₹{(cashUser.wallet.inrBalance || 0).toLocaleString()}</div>
                </div>
              </div>

              <form onSubmit={handleCashCredit}>
                <div className="form-group">
                  <label>Cash Amount Received (₹)</label>
                  <div className="d-flex align-center" style={{ position: 'relative' }}>
                    <IndianRupee size={18} style={{ position: 'absolute', left: 14 }} className="text-muted" />
                    <input
                      type="number"
                      className="form-control"
                      style={{ paddingLeft: 44, fontSize: 18, fontWeight: 'bold' }}
                      value={cashAmount}
                      onChange={e => setCashAmount(e.target.value)}
                      required
                      min="1"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Credit As</label>
                  <div className="d-flex gap-3">
                    {[
                      { value: 'inr', label: 'INR Balance', sub: null },
                      { value: 'gold24k', label: '24K Gold', sub: cashAmount && cashCreditType === 'gold24k' ? `${(parseFloat(cashAmount) / prices.gold24k.price).toFixed(4)}g` : null },
                      { value: 'silver', label: 'Silver', sub: cashAmount && cashCreditType === 'silver' ? `${(parseFloat(cashAmount) / prices.silver.price).toFixed(2)}g` : null },
                    ].map(opt => (
                      <label
                        key={opt.value}
                        style={{
                          flex: 1, padding: 14,
                          border: `2px solid ${cashCreditType === opt.value ? 'var(--gold)' : '#ddd'}`,
                          borderRadius: 8, cursor: 'pointer',
                          background: cashCreditType === opt.value ? '#FFF8E7' : '#fff',
                          textAlign: 'center',
                        }}
                      >
                        <input type="radio" name="cashCreditType" value={opt.value} checked={cashCreditType === opt.value} onChange={() => setCashCreditType(opt.value)} style={{ display: 'none' }} />
                        <div style={{ fontWeight: 'bold', fontSize: 13 }}>{opt.label}</div>
                        {opt.sub && <div style={{ fontSize: 11, color: 'var(--maroon)', marginTop: 3 }}>{opt.sub}</div>}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '16px 0 0', margin: 0, border: 'none', background: 'none' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeCashModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={cashProcessing || !cashAmount}>
                    {cashProcessing ? 'Processing...' : `Confirm & Credit ₹${cashAmount || 0}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-header"><h3>Edit {editingUser.name}</h3><button className="modal-close" onClick={() => setEditingUser(null)}><X size={16} /></button></div><form onSubmit={saveCustomer}><div className="modal-body"><div className="form-row"><div className="form-group"><label>Name</label><input className="form-control" value={editForm.name} onChange={event => setEditForm(value => ({ ...value, name: event.target.value }))} required /></div><div className="form-group"><label>Phone</label><input className="form-control" value={editForm.phoneNumber} onChange={event => setEditForm(value => ({ ...value, phoneNumber: event.target.value }))} required /></div></div><div className="form-row"><div className="form-group"><label>Email</label><input type="email" className="form-control" value={editForm.email} onChange={event => setEditForm(value => ({ ...value, email: event.target.value }))} required /></div><div className="form-group"><label>Status</label><select className="form-control" value={String(editForm.active)} onChange={event => setEditForm(value => ({ ...value, active: event.target.value === 'true' }))}><option value="true">Active</option><option value="false">Inactive</option></select></div></div><div className="form-group"><label>Address</label><input className="form-control" value={editForm.address} onChange={event => setEditForm(value => ({ ...value, address: event.target.value }))} /></div><div className="form-row"><div className="form-group"><label>City</label><input className="form-control" value={editForm.city} onChange={event => setEditForm(value => ({ ...value, city: event.target.value }))} /></div><div className="form-group"><label>Pincode</label><input className="form-control" value={editForm.pincode} onChange={event => setEditForm(value => ({ ...value, pincode: event.target.value }))} /></div></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={savingCustomer}>{savingCustomer ? 'Saving…' : 'Save Changes'}</button></div></form></div></div>
      )}

    </>
  );
}
