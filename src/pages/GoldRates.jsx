import { RefreshCw, TrendingUp } from 'lucide-react';
import { useLivePrice } from '../context/LivePriceContext';
import PageLead from '../components/PageLead';

export default function GoldRates() {
  const { prices, lastUpdated, loading, error, refreshPrices } = useLivePrice();
  const format = value => value ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

  return (
    <>
      <PageLead eyebrow="Market intelligence" title="Live gold rates" description="Daily market reference rates for informed customer conversations." />
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3 className="d-flex align-center gap-2"><TrendingUp className="text-gold" /> Live Gold Rates</h3>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>
            Rates are supplied by the backend market-rate service and refreshed once per day.
          </p>
        </div>
        <button className="btn btn-outline" onClick={refreshPrices} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      <div className="grid-cards">
        <div className="stat-card"><div className="stat-card-info"><h4>24K Gold / gram</h4><div className="value">{format(prices.gold24k.price)}</div></div></div>
        <div className="stat-card"><div className="stat-card-info"><h4>22K Gold / gram</h4><div className="value">{format(prices.gold22k.price)}</div></div></div>
        <div className="stat-card"><div className="stat-card-info"><h4>18K Gold / gram</h4><div className="value">{format(prices.gold18k.price)}</div></div></div>
      </div>
      <p className="text-muted" style={{ fontSize: 12 }}>
        Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString('en-IN') : 'Loading…'}
      </p>
    </div></>
  );
}
