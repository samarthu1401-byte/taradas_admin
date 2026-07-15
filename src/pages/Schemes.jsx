import { useState, useEffect, useRef } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Plus, Edit, Trash2, ShieldAlert, X, RefreshCw } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import PageLead from '../components/PageLead';

const getClient = () => generateClient();

const GET_SCHEMES = `
  query {
    getSchemes {
      _id
      scheme_name
      scheme_type
      installment_amount
      total_installments
      duration_months
      description
      is_active
    }
  }
`;

const CREATE_SCHEME = `mutation CreateScheme($input: CreateSchemeInput!) { createScheme(input: $input) { _id } }`;
const UPDATE_SCHEME = `mutation UpdateScheme($input: UpdateSchemeInput!) { updateScheme(input: $input) { _id } }`;
const DEACTIVATE_SCHEME = `mutation DeactivateScheme($id: ID!) { deactivateScheme(id: $id) { _id is_active } }`;

function maskPhone(phone) {
  if (!phone || phone.length < 4) return phone;
  return phone.slice(0, 2) + 'xxxxxx' + phone.slice(-2);
}

export default function Schemes() {
  const { admin, showToast } = useAdmin();
  const [schemes, setSchemes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '', description: '', installmentAmount: '', totalInstallments: '', durationMonths: '', schemeType: 'MONTHLY', benefits: ''
  });

  // OTP delete flow
  const [otpModal, setOtpModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);
  const otpInputRef = useRef(null);

  const fetchSchemes = async () => {
    try {
      setIsLoading(true);
      const response = await getClient().graphql({ query: GET_SCHEMES, authMode: "userPool" });
      const apiSchemes = response.data.getSchemes || [];
      
      const mappedSchemes = apiSchemes.map(s => ({
        id: s._id,
        name: s.scheme_name,
        schemeType: s.scheme_type,
        installmentAmount: s.installment_amount,
        totalInstallments: s.total_installments,
        durationMonths: s.duration_months,
        description: s.description || 'No description available.',
        benefits: ['Standard scheme benefits'],
        isActive: s.is_active,
      }));
      setSchemes(mappedSchemes);
    } catch (error) {
      console.error("Error fetching schemes:", error);
      showToast("Failed to load schemes from server", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSchemes();
  }, []);

  useEffect(() => {
    return () => clearInterval(countdownRef.current);
  }, []);

  const handleOpenModal = (scheme = null) => {
    if (scheme) {
      setEditingId(scheme.id);
      setFormData({ 
        name: scheme.name, 
        description: scheme.description, 
        installmentAmount: scheme.installmentAmount?.toString(), 
        totalInstallments: scheme.totalInstallments?.toString(), 
        durationMonths: scheme.durationMonths?.toString() || '',
        schemeType: scheme.schemeType, 
        benefits: scheme.benefits.join('\n') 
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', installmentAmount: '', totalInstallments: '', durationMonths: '', schemeType: 'MONTHLY', benefits: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.installmentAmount || !formData.totalInstallments) return;
    
    try {
      const input = { scheme_name: formData.name, scheme_type: formData.schemeType, installment_amount: parseFloat(formData.installmentAmount), total_installments: parseInt(formData.totalInstallments, 10), duration_months: parseInt(formData.durationMonths, 10), description: formData.description || 'No description provided' };
      await getClient().graphql({
        query: editingId ? UPDATE_SCHEME : CREATE_SCHEME,
        variables: editingId ? { input: { id: editingId, ...input } } : { input },
        authMode: "userPool"
      });
      
      showToast(editingId ? 'Scheme updated successfully' : 'New scheme created successfully', 'success');
      setIsModalOpen(false);
      fetchSchemes(); // Re-fetch to get the new scheme with its _id
    } catch (error) {
      console.error("Error creating scheme:", error);
      showToast("Failed to create scheme", "error");
    }
  };

  const sendOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setEnteredOtp('');
    setOtpError('');
    setOtpSending(true);

    setTimeout(() => {
      setOtpSending(false);
      // In production: call SMS API here with admin.phone and otp
      // For demo, the OTP is shown via toast since no SMS backend is connected
      showToast(`OTP for deletion: ${otp}  (sent to +91 ${maskPhone(admin?.phone)})`, 'info');
      setCountdown(30);
      clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }, 900);
  };

  const handleDeleteClick = (id) => {
    setPendingDeleteId(id);
    setOtpModal(true);
    sendOtp();
  };

  const handleOtpVerify = (e) => {
    e.preventDefault();
    if (enteredOtp.length !== 6) { setOtpError('Enter the 6-digit OTP.'); return; }
    if (enteredOtp === generatedOtp) {
      client.graphql({ query: DEACTIVATE_SCHEME, variables: { id: pendingDeleteId }, authMode: 'userPool' }).then(() => { showToast('Scheme deactivated', 'success'); closeOtpModal(); fetchSchemes(); }).catch(error => showToast(error?.errors?.[0]?.message || error.message, 'error'));
    } else {
      setOtpError('Incorrect OTP. Please try again.');
      setEnteredOtp('');
      otpInputRef.current?.focus();
    }
  };

  const closeOtpModal = () => {
    setOtpModal(false);
    setPendingDeleteId(null);
    setGeneratedOtp('');
    setEnteredOtp('');
    setOtpError('');
    setOtpSending(false);
    clearInterval(countdownRef.current);
    setCountdown(0);
  };

  const pendingScheme = schemes.find(s => s.id === pendingDeleteId);

  return (
    <><PageLead eyebrow="Product studio" title="Gold schemes" description="Create and manage savings plans available to your customers." ><button className="btn btn-primary" onClick={() => handleOpenModal()}><Plus size={16} /> Create Scheme</button></PageLead>
    <div className="panel">
      <div className="panel-header">
        <h3>Gold & Silver Schemes</h3>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>
          Loading schemes from server...
        </div>
      ) : schemes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>
          No schemes found. Create one to get started!
        </div>
      ) : (
        <div className="scheme-grid">
          {schemes.map(s => (
            <div key={s.id} className="scheme-card">
              <div className="d-flex justify-between align-center mb-3">
                <h4 style={{ fontSize: 18, color: 'var(--maroon)' }}>{s.name}</h4>
                <span className="badge info">{s.schemeType}</span>
              </div>
              <p className="scheme-card-description">{s.description}</p>
              <div className="mb-4">
                <div style={{ fontSize: 12, color: 'var(--text-light)', textTransform: 'uppercase' }}>Installment Amount</div>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>₹{s.installmentAmount?.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Total Installments: {s.totalInstallments}</div>
              </div>
              <div className="scheme-card-actions">
                <button className="btn btn-outline w-100" onClick={() => handleOpenModal(s)}>
                  <Edit size={14} /> Edit
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteClick(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Scheme Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Scheme' : 'Create New Scheme'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Scheme Name</label>
                  <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-control" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows="2" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Scheme Type</label>
                    <select className="form-control" value={formData.schemeType} onChange={e => setFormData({ ...formData, schemeType: e.target.value })}>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Installment Amount (₹)</label>
                    <input type="number" className="form-control" value={formData.installmentAmount} onChange={e => setFormData({ ...formData, installmentAmount: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Total Installments</label>
                    <input type="number" className="form-control" value={formData.totalInstallments} onChange={e => setFormData({ ...formData, totalInstallments: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Duration (Months)</label>
                    <input type="number" className="form-control" value={formData.durationMonths} onChange={e => setFormData({ ...formData, durationMonths: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Benefits (One per line)</label>
                  <textarea className="form-control" value={formData.benefits} onChange={e => setFormData({ ...formData, benefits: e.target.value })} rows="4" placeholder={`e.g. 2% extra gold on maturity\nNo lock-in period`} required />
                </div>
                <div className="modal-footer" style={{ padding: '20px 0 0', marginTop: 12, background: 'none' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Create Scheme'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {otpModal && (
        <div className="modal-overlay" onClick={closeOtpModal}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="d-flex align-center gap-3">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldAlert size={18} color="#dc2626" />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, marginBottom: 2 }}>Confirm Scheme Deletion</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 400 }}>OTP verification required</div>
                </div>
              </div>
              <button className="modal-close" onClick={closeOtpModal}><X size={14} /></button>
            </div>

            <div className="modal-body">
              {/* Scheme being deleted */}
              {pendingScheme && (
                <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
                  <div style={{ color: '#991b1b', fontWeight: 700 }}>Deleting: {pendingScheme.name}</div>
                  <div style={{ color: '#b91c1c', marginTop: 3 }}>₹{pendingScheme.installmentAmount?.toLocaleString()} / installment · {pendingScheme.schemeType}</div>
                </div>
              )}

              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 20 }}>
                An OTP has been sent to <strong style={{ color: 'var(--dark)' }}>+91 {maskPhone(admin?.phone)}</strong>. Enter it below to confirm deletion.
              </p>

              <form onSubmit={handleOtpVerify}>
                <div className="form-group">
                  <label>Enter OTP</label>
                  <input
                    ref={otpInputRef}
                    type="tel"
                    className="form-control"
                    placeholder="— — — — — —"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={e => { setEnteredOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                    disabled={otpSending}
                    style={{ fontSize: 24, letterSpacing: 10, textAlign: 'center', fontWeight: 700 }}
                    autoComplete="one-time-code"
                  />
                  {otpError && (
                    <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{otpError}</div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 20, textAlign: 'center' }}>
                  {otpSending ? (
                    <span>Sending OTP…</span>
                  ) : countdown > 0 ? (
                    <span>Resend OTP in <strong>{countdown}s</strong></span>
                  ) : (
                    <button
                      type="button"
                      onClick={sendOtp}
                      style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', fontWeight: 600, cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <RefreshCw size={12} /> Resend OTP
                    </button>
                  )}
                </div>

                <div className="d-flex gap-3">
                  <button type="button" className="btn btn-outline w-100" onClick={closeOtpModal}>Cancel</button>
                  <button
                    type="submit"
                    className="btn btn-danger w-100"
                    disabled={otpSending || enteredOtp.length !== 6}
                  >
                    <Trash2 size={14} /> Delete Scheme
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div></>
  );
}
