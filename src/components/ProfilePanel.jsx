import { useEffect, useRef } from 'react';
import { Shield, LogOut, X } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

export default function ProfilePanel({ onClose }) {
  const { admin, logout } = useAdmin();
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = event => {
      if (!panelRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef} className="profile-panel" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320, background: 'var(--white)', borderRadius: 14, boxShadow: '0 12px 48px rgba(0,0,0,0.18)', border: '1px solid #eee', zIndex: 1000, overflow: 'hidden' }}>
      <div style={{ padding: 20, background: 'linear-gradient(135deg, var(--sidebar-bg), #2d2d30)', color: '#fff' }}>
        <button onClick={onClose} style={{ float: 'right', background: 'transparent', color: '#fff' }}><X size={16} /></button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{admin?.username || 'Administrator'}</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>Administrator · {admin?.groups?.join(', ') || 'admins'}</div>
      </div>
      <div style={{ padding: 16 }}>
        <div className="d-flex align-center gap-2 text-muted" style={{ fontSize: 13, marginBottom: 16 }}><Shield size={16} /> Authenticated by Amazon Cognito</div>
        <button className="btn btn-danger w-100" onClick={logout}><LogOut size={16} /> Sign out</button>
      </div>
    </div>
  );
}
