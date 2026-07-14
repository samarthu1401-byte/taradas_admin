import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useLivePrice } from '../context/LivePriceContext';
import { Search, IndianRupee } from 'lucide-react';
import { walletService } from '../services/walletService';

export default function AcceptCash() {
  const { getAllUsers, getUserWallet, refreshCustomers, showToast } = useAdmin();
  const { prices } = useLivePrice();
  
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [amount, setAmount] = useState('');
  const [creditType, setCreditType] = useState('inr'); // inr, gold24k, silver
  const [processing, setProcessing] = useState(false);

  const users = getAllUsers();

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchPhone.trim().toLowerCase();
    const user = users.find(u => u.userId?.toLowerCase() === query || u.name?.toLowerCase().includes(query) || u.phone === query || u.phoneNumber?.includes(query));
    if (user) {
      const wallet = getUserWallet(user.phone);
      setSelectedUser({ ...user, wallet });
      setAmount('');
    } else {
      showToast('Customer not found', 'error');
      setSelectedUser(null);
    }
  };

  const handleCredit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) return;

    setProcessing(true);
    try {
      let assetAdded = 'inr';
      let assetAmount = val;
      
      if (creditType === 'gold24k') {
        assetAmount = val / prices.gold24k.price;
        assetAdded = 'gold';
      } else if (creditType === 'silver') {
        assetAmount = val / prices.silver.price;
        assetAdded = 'silver';
      }

      await walletService.creditWallet({ customerId: selectedUser.userId, asset: creditType, amount: parseFloat(assetAmount.toFixed(4)), type: 'credit', description: 'Cash deposit by Admin' });
      showToast(`Successfully credited ${assetAmount.toFixed(4)} ${assetAdded.toUpperCase()} to ${selectedUser.name}`, 'success');
      await refreshCustomers();
      setSelectedUser(null);
      setSearchPhone('');
      setAmount('');
    } catch (error) { showToast(error?.errors?.[0]?.message || error.message, 'error'); }
    finally { setProcessing(false); }
  };

  return (
    <div className="form-row">
      <div className="panel">
        <div className="panel-header">
          <h3>Accept Cash & Credit Wallet</h3>
        </div>
        
        <form onSubmit={handleSearch} className="mb-6">
          <div className="form-group">
            <label>Search by Customer ID, name, or mobile number</label>
            <div className="d-flex gap-2">
              <input 
                type="text" 
                className="form-control" 
                placeholder="CUS1234ABCD, customer name, or mobile"
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary" disabled={!searchPhone.trim()}>
                <Search size={18} /> Find
              </button>
            </div>
          </div>
        </form>

        {selectedUser && (
          <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 12, border: '1px solid #eee' }}>
            <div className="d-flex justify-between align-center mb-4">
              <div>
                <h4 style={{ fontSize: 18, color: 'var(--maroon)' }}>{selectedUser.name || 'Anonymous User'}</h4>
                <div className="text-muted">+91 {selectedUser.phone}</div>
              </div>
              <div className="text-right">
                <div className="text-muted" style={{ fontSize: 12 }}>Current INR Vault</div>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>₹{(selectedUser.wallet.inrBalance || 0).toLocaleString()}</div>
              </div>
            </div>

            <hr style={{ borderTop: '1px solid #ddd', margin: '20px 0' }} />

            <form onSubmit={handleCredit}>
              <div className="form-group">
                <label>Cash Amount Received (₹)</label>
                <div className="d-flex align-center" style={{ position: 'relative' }}>
                  <IndianRupee size={20} style={{ position: 'absolute', left: 16 }} className="text-muted" />
                  <input 
                    type="number" 
                    className="form-control" 
                    style={{ paddingLeft: 48, fontSize: 18, fontWeight: 'bold' }}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Credit As</label>
                <div className="d-flex gap-3">
                  <label style={{ flex: 1, padding: 16, border: `2px solid ${creditType === 'inr' ? 'var(--gold)' : '#ddd'}`, borderRadius: 8, cursor: 'pointer', background: creditType === 'inr' ? '#FFF8E7' : '#fff' }}>
                    <input type="radio" name="creditType" value="inr" checked={creditType === 'inr'} onChange={() => setCreditType('inr')} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 'bold', textAlign: 'center' }}>INR Balance</div>
                  </label>
                  <label style={{ flex: 1, padding: 16, border: `2px solid ${creditType === 'gold24k' ? 'var(--gold)' : '#ddd'}`, borderRadius: 8, cursor: 'pointer', background: creditType === 'gold24k' ? '#FFF8E7' : '#fff' }}>
                    <input type="radio" name="creditType" value="gold24k" checked={creditType === 'gold24k'} onChange={() => setCreditType('gold24k')} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 'bold', textAlign: 'center' }}>24K Gold</div>
                    {amount && creditType === 'gold24k' && <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--maroon)', marginTop: 4 }}>{(parseFloat(amount)/prices.gold24k.price).toFixed(4)}g</div>}
                  </label>
                  <label style={{ flex: 1, padding: 16, border: `2px solid ${creditType === 'silver' ? '#999' : '#ddd'}`, borderRadius: 8, cursor: 'pointer', background: creditType === 'silver' ? '#f0f0f0' : '#fff' }}>
                    <input type="radio" name="creditType" value="silver" checked={creditType === 'silver'} onChange={() => setCreditType('silver')} style={{ display: 'none' }} />
                    <div style={{ fontWeight: 'bold', textAlign: 'center' }}>Silver</div>
                    {amount && creditType === 'silver' && <div style={{ fontSize: 11, textAlign: 'center', color: '#666', marginTop: 4 }}>{(parseFloat(amount)/prices.silver.price).toFixed(2)}g</div>}
                  </label>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-100" style={{ padding: 16, fontSize: 16 }} disabled={processing || !amount}>
                {processing ? 'Processing...' : `Confirm & Credit ₹${amount || 0}`}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Live Rates Reference</h3>
        </div>
        <div className="d-flex flex-column gap-3">
          <div className="d-flex justify-between align-center p-3" style={{ padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>24K Gold</div>
            <div className="text-gold" style={{ fontSize: 18, fontWeight: 'bold' }}>₹{prices.gold24k.price.toFixed(2)}/g</div>
          </div>
          <div className="d-flex justify-between align-center p-3" style={{ padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>22K Gold</div>
            <div className="text-gold" style={{ fontSize: 18, fontWeight: 'bold' }}>₹{prices.gold22k.price.toFixed(2)}/g</div>
          </div>
          <div className="d-flex justify-between align-center p-3" style={{ padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #eee' }}>
            <div style={{ fontWeight: 'bold' }}>Silver</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#666' }}>₹{prices.silver.price.toFixed(2)}/g</div>
          </div>
        </div>
      </div>
    </div>
  );
}
