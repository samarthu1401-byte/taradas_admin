import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Edit3, CheckCircle, ShieldAlert } from 'lucide-react';
import { useLivePrice } from '../context/LivePriceContext';
import PageLead from '../components/PageLead';

export default function GoldRates() {
  const { prices, lastUpdated, authority, loading, error, refreshPrices, updateRate } = useLivePrice();
  const [formData, setFormData] = useState({ gold24k: '', gold22k: '', gold18k: '' });
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (prices.gold24k.price) {
      setFormData({
        gold24k: prices.gold24k.price.toString(),
        gold22k: prices.gold22k.price.toString(),
        gold18k: prices.gold18k.price.toString(),
      });
    }
  }, [prices]);

  const format = value => value ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

  const handle24KChange = (val) => {
    const num = parseFloat(val) || 0;
    setFormData({
      gold24k: val,
      gold22k: num ? (num * 22 / 24).toFixed(2) : '',
      gold18k: num ? (num * 18 / 24).toFixed(2) : '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.gold24k) return;
    try {
      setSaving(true);
      setSuccessMsg('');
      await updateRate(formData.gold24k, formData.gold22k, formData.gold18k);
      setSuccessMsg("Today's showroom gold rate updated successfully across the mobile app!");
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageLead eyebrow="Market intelligence" title="Live gold rates" description="Daily auto-refreshed market reference rates with admin manual override." />
      
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h3 className="d-flex align-center gap-2">
              <TrendingUp className="text-gold" /> Live Active Gold Rates
            </h3>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>
              Source: <strong style={{ color: 'var(--gold-dark)' }}>{authority || 'Auto Market Rate'}</strong> · Auto-refreshed daily
            </p>
          </div>
          <button className="btn btn-outline" onClick={refreshPrices} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {successMsg && <div className="alert alert-success d-flex align-center gap-2"><CheckCircle size={18} /> {successMsg}</div>}

        <div className="grid-cards">
          <div className="stat-card">
            <div className="stat-card-info">
              <h4>24K Pure Gold / gram</h4>
              <div className="value">{format(prices.gold24k.price)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <h4>22K Standard Gold / gram</h4>
              <div className="value">{format(prices.gold22k.price)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <h4>18K Gold / gram</h4>
              <div className="value">{format(prices.gold18k.price)}</div>
            </div>
          </div>
        </div>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 14 }}>
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString('en-IN') : 'Loading…'}
        </p>
      </div>

      {/* Manual Admin Override Section */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="d-flex align-center gap-2">
              <Edit3 size={18} className="text-gold" /> Override Today's Showroom Rate
            </h3>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Manually set today's 24K, 22K, and 18K per-gram showroom gold rates to override auto-fetched market rates.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: 13 }}>24K Gold Rate (₹ / gram)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 15235"
                value={formData.gold24k}
                onChange={e => handle24KChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: 13 }}>22K Gold Rate (₹ / gram)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 13965"
                value={formData.gold22k}
                onChange={e => setFormData({ ...formData, gold22k: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 600, fontSize: 13 }}>18K Gold Rate (₹ / gram)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 11426"
                value={formData.gold18k}
                onChange={e => setFormData({ ...formData, gold18k: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Updating Rates…' : "Save & Broadcast Today's Showroom Rate"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setFormData({ gold24k: '', gold22k: '', gold18k: '' });
                refreshPrices();
              }}
              disabled={saving}
            >
              Reset to Auto Rate
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
