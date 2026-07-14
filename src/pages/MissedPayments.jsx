import { useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { AlertTriangle, MessageCircle, Send } from 'lucide-react';

const buildMessage = (name, scheme) =>
  `Dear ${name},\n\nThis is a gentle reminder from Taradas Jewellers regarding your "${scheme}" scheme.\n\nIt looks like you missed your recent installment. Please clear your pending dues to continue enjoying the benefits of your scheme.\n\nThank you,\nTaradas Jewellers`;

export default function MissedPayments() {
  const { getAllUsers, getUserWallet, customers } = useAdmin();

  const defaulters = useMemo(() => {
    const users = getAllUsers();
    const list = [];
    users.forEach(u => {
      const wallet = getUserWallet(u.phone);
      (wallet.activeSchemes || []).forEach(scheme => {
        if (scheme.status === 'Missed Payment') {
          list.push({
            customerName: u.name,
            customerPhone: u.phone,
            schemeName: scheme.name,
            installmentsPaid: scheme.installmentsPaid,
            totalInstallments: scheme.totalInstallments,
          });
        }
      });
    });
    return list;
  }, [customers]);

  const sendWhatsApp = (d) =>
    window.open(`https://wa.me/91${d.customerPhone}?text=${encodeURIComponent(buildMessage(d.customerName, d.schemeName))}`, '_blank');

  const sendRemindAll = () => {
    defaulters.forEach((d, i) =>
      setTimeout(() => sendWhatsApp(d), i * 400)
    );
  };

  return (
    <div className="panel" style={{ borderTop: '4px solid #ef4444' }}>
      <div className="panel-header">
        <h3 className="d-flex align-center gap-2 text-danger">
          <AlertTriangle size={20} /> SIP / Scheme Defaulters
        </h3>
        {defaulters.length > 0 && (
          <button className="btn btn-whatsapp" onClick={sendRemindAll}>
            <Send size={15} /> Remind All ({defaulters.length})
          </button>
        )}
      </div>

      <div className="d-flex justify-between align-center mb-4" style={{ padding: '13px 16px', borderRadius: 10, background: '#fff7f7', border: '1px solid #fee2e2' }}>
        <span className="text-muted" style={{ fontSize: 14 }}>Customers needing a payment follow-up. Reminders open in WhatsApp for review before sending.</span>
        <span className="badge danger">{defaulters.length} pending</span>
      </div>

      {defaulters.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">All payments are on track</div>
          <div className="empty-state-desc">No missed payments found — great job!</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Scheme</th>
                <th>Progress</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {defaulters.map((d, i) => (
                <tr key={`${d.customerPhone}-${i}`}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--maroon)' }}>{d.customerName}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>+91 {d.customerPhone}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--maroon)' }}>{d.schemeName}</td>
                  <td>
                    <div className="d-flex align-center gap-2" style={{ minWidth: 160 }}>
                      <div className="progress-track" style={{ flex: 1, height: 7 }}>
                        <div
                          className="progress-fill danger"
                          style={{ width: `${(d.installmentsPaid / d.totalInstallments) * 100}%` }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
                        {d.installmentsPaid}/{d.totalInstallments}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-whatsapp" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => sendWhatsApp(d)}>
                      <MessageCircle size={14} /> Remind
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
