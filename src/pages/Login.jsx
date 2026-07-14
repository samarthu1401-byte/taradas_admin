import { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { login, showToast, admin, confirmNewPassword } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (admin) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsNewPassword) {
      if (!newPassword) {
        showToast('Please enter your new password', 'warning');
        return;
      }
      setIsSubmitting(true);
      await confirmNewPassword(newPassword);
      setIsSubmitting(false);
      return;
    }

    if (!username) {
      showToast('Please enter your username', 'warning');
      return;
    }
    if (!password) {
      showToast('Please enter your password', 'warning');
      return;
    }
    
    setIsSubmitting(true);
    const result = await login(username, password);
    if (result?.challenge === 'NEW_PASSWORD_REQUIRED') {
      setNeedsNewPassword(true);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon" style={{ margin: '0 auto 16px', width: 64, height: 64, fontSize: 32 }}>T</div>
          <h2 style={{ color: 'var(--maroon)' }}>TARADAS</h2>
          <p className="text-muted" style={{ letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 }}>Store Management</p>
        </div>
        <div className="login-body">
          <form onSubmit={handleSubmit}>
            {needsNewPassword ? (
              <div className="form-group">
                <label>New Password Required</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="Enter a new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Admin Username</label>
                  <div className="d-flex">
                    <input 
                      type="text" 
                      className="form-control"
                      style={{ borderRadius: '8px' }}
                      placeholder="admin_user" 
                      value={username} 
                      onChange={e => setUsername(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-control"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <button 
              type="submit" 
              className="btn btn-primary w-100" 
              style={{ padding: 14, fontSize: 16, marginTop: 12, opacity: isSubmitting ? 0.7 : 1 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating...' : (needsNewPassword ? 'Update Password' : 'Access Dashboard')}
            </button>
            <p className="text-center text-muted mt-4" style={{ fontSize: 12 }}>
              Authorized personnel only.<br/>Authentication powered by AWS Cognito
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
