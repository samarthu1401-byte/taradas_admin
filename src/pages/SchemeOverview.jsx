import { useMemo, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { Landmark, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function SchemeOverview() {
  const { getAllUsers, getUserWallet, customers } = useAdmin();
  const [filter, setFilter] = useState('all');

  const { schemes, stats } = useMemo(() => {
    const users = getAllUsers();
    const all = [];
    let active = 0, missed = 0, completing = 0;

    users.forEach(user => {
      const wallet = getUserWallet(user.phone);
      (wallet.activeSchemes || []).forEach(scheme => {
        const remaining = scheme.totalInstallments - scheme.installmentsPaid;
        const isCompleting = remaining <= 2 && remaining > 0;
        const isMissed = scheme.status === 'Missed Payment';

        if (isMissed) missed++;
        else active++;
        if (isCompleting) completing++;

        all.push({ ...scheme, customerName: user.name, customerPhone: user.phone, isCompleting, remaining });
      });
    });

    return { schemes: all, stats: { active, missed, completing, total: all.length } };
  }, [customers]);

  const filtered = schemes.filter(s => {
    if (filter === 'completing') return s.isCompleting;
    if (filter === 'missed') return s.status === 'Missed Payment';
    return true;
  });

  const filterBtns = [
    { key: 'all', label: `All (${stats.total})` },
    { key: 'completing', label: `Completing Soon (${stats.completing})` },
    { key: 'missed', label: `Missed (${stats.missed})` },
  ];

  return (
    <div>
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: filter === 'all' ? '3px solid var(--gold)' : '' }} onClick={() => setFilter('all')}>
          <div className="stat-card-info">
            <h4>Total Schemes</h4>
            <div className="value">{stats.total}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(198,153,62,0.1)', color: 'var(--gold)' }}>
            <Landmark size={24} />
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: `3px solid ${filter === 'completing' ? '#10b981' : 'transparent'}` }} onClick={() => setFilter('completing')}>
          <div className="stat-card-info">
            <h4>Completing Soon</h4>
            <div className="value" style={{ color: '#10b981' }}>{stats.completing}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: `3px solid ${filter === 'missed' ? '#ef4444' : 'transparent'}` }} onClick={() => setFilter('missed')}>
          <div className="stat-card-info">
            <h4>Missed Payments</h4>
            <div className="value text-danger">{stats.missed}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <h4>On Track</h4>
            <div className="value text-success">{stats.active}</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <Clock size={24} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>
            {filter === 'completing' ? 'Schemes Completing Soon' :
              filter === 'missed' ? 'Missed Payment Schemes' :
              'All Active Schemes'}
          </h3>
          <div className="d-flex gap-2">
            {filterBtns.map(f => (
              <button
                key={f.key}
                className={`btn ${filter === f.key ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 14px', fontSize: 12 }}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏆</div>
            <div className="empty-state-title">No schemes in this category</div>
            <div className="empty-state-desc">Schemes matching this filter will appear here</div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {filtered.map(s => {
              const progress = (s.installmentsPaid / s.totalInstallments) * 100;
              const isMissed = s.status === 'Missed Payment';
              return (
                <div
                  key={`${s.customerPhone}-${s.id}`}
                  style={{
                    background: isMissed ? '#fff5f5' : s.isCompleting ? '#f0fdf4' : '#fafafa',
                    border: `1px solid ${isMissed ? '#fca5a5' : s.isCompleting ? '#86efac' : '#eee'}`,
                    borderRadius: 10, padding: 20,
                  }}
                >
                  <div className="d-flex justify-between align-center mb-3">
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: 15 }}>{s.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>
                        {s.customerName} &middot; +91 {s.customerPhone}
                      </div>
                    </div>
                    <div className="d-flex align-center gap-2">
                      {s.isCompleting && <span className="badge success">Completing Soon</span>}
                      <span className={`badge ${isMissed ? 'danger' : 'success'}`}>{s.status || 'Active'}</span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="d-flex justify-between mb-1" style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      <span>{s.installmentsPaid} of {s.totalInstallments} installments paid</span>
                      <span style={{ fontWeight: 700 }}>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="progress-track" style={{ height: 8 }}>
                      <div
                        className={`progress-fill${isMissed ? ' danger' : ''}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="d-flex justify-between" style={{ fontSize: 13, color: 'var(--text-light)' }}>
                    <span>Total Paid: <strong style={{ color: 'var(--dark)' }}>₹{(s.totalPaid || 0).toLocaleString('en-IN')}</strong></span>
                    <span><strong style={{ color: isMissed ? '#ef4444' : s.isCompleting ? '#10b981' : 'var(--dark)' }}>{s.remaining}</strong> installment{s.remaining !== 1 ? 's' : ''} remaining</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
