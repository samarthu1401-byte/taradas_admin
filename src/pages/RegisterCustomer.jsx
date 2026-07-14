import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Copy, KeyRound, UserPlus } from 'lucide-react';
import { authService } from '../services/authService';


export default function RegisterCustomer() {
  const { showToast, refreshCustomers } = useAdmin();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    pincode: '',
    aadharcardNo: '',
    pancardNo: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.phone.length !== 10) {
      showToast('Phone number must be 10 digits', 'error');
      return;
    }
    if (!formData.aadharcardNo && !formData.pancardNo) {
      showToast('Either Aadhar Card or PAN Card number is required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const profileData = {
        name: formData.name,
        email: formData.email.trim().toLowerCase(),
        phoneNumber: `+91${formData.phone}`,
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode,
        aadharcardNo: formData.aadharcardNo || "NA",
        pancardNo: formData.pancardNo || "NA"
      };

      const customerId = `CUS${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
      const created = await authService.saveProfileToVault({ ...profileData, userId: customerId });

      await refreshCustomers();

      setCreatedCustomer({ customerId: created.customerId, initialPassword: created.initialPassword });
      showToast('Customer registered successfully', 'success');
      setFormData({ name: '', phone: '', email: '', address: '', city: '', pincode: '', aadharcardNo: '', pancardNo: '' });
    } catch (err) {
      console.error("Error registering customer:", err);
      // Extract GraphQL error message if it exists
      const errorMessage = err?.errors?.[0]?.message || err.message || 'Failed to register customer';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 800 }}>
      <div className="panel-header">
        <h3 className="d-flex align-center gap-2">
          <UserPlus className="text-maroon" />
          Register New Customer
        </h3>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Mobile Number (10 digits)</label>
            <div className="d-flex">
              <div style={{ padding: '12px 16px', background: 'var(--gray)', border: '1px solid #ddd', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14 }}>+91</div>
              <input type="tel" className="form-control" style={{ borderRadius: '0 8px 8px 0' }} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} required />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          </div>
          <div className="form-group"><label>Customer ID</label><input className="form-control" value="Generated automatically" disabled /></div>
        </div>

        <div className="form-group">
          <label>Full Address</label>
          <textarea className="form-control" rows="3" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <input type="text" className="form-control" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Pincode</label>
            <input type="text" className="form-control" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '')})} maxLength={6} required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Aadhar Card Number</label>
            <input type="text" className="form-control" placeholder="Optional if PAN provided" value={formData.aadharcardNo} onChange={e => setFormData({...formData, aadharcardNo: e.target.value.replace(/\D/g, '')})} maxLength={12} />
          </div>
          <div className="form-group">
            <label>PAN Card Number</label>
            <input type="text" className="form-control" placeholder="Optional if Aadhar provided" value={formData.pancardNo} onChange={e => setFormData({...formData, pancardNo: e.target.value.toUpperCase()})} maxLength={10} />
          </div>
        </div>

        <hr style={{ borderTop: '1px solid #eee', margin: '24px 0' }} />

        <button type="submit" className="btn btn-primary" style={{ padding: '14px 32px', fontSize: 16 }} disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Complete Registration'}
        </button>
      </form>
      {createdCustomer && (
        <div style={{ marginTop: 24, padding: 18, borderRadius: 10, background: '#fff8e7', border: '1px solid #e7c56f' }}>
          <div className="d-flex align-center gap-2" style={{ fontWeight: 700, color: 'var(--maroon)' }}><KeyRound size={17} /> Customer login created</div>
          <p className="text-muted" style={{ fontSize: 13, margin: '8px 0 12px' }}>Share these credentials securely. The password is shown only once.</p>
          <div className="d-flex gap-3" style={{ flexWrap: 'wrap' }}>
            <strong>Customer ID: {createdCustomer.customerId}</strong><strong>Temporary password: {createdCustomer.initialPassword}</strong>
            <button type="button" className="btn btn-outline" style={{ padding: '4px 9px' }} onClick={() => navigator.clipboard.writeText(`Customer ID: ${createdCustomer.customerId}\nPassword: ${createdCustomer.initialPassword}`)}><Copy size={14} /> Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}
