import { useState, useEffect } from 'react';
import api, { extractList } from '../../lib/axios';

export default function RateChart() {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rateHistory, setRateHistory] = useState([]);
  const [rates, setRates] = useState({
    gold24k: '', gold22k: '', gold18k: '',
    silver999: '', silver925: '',
  });
  const [makingRates, setMakingRates] = useState({
    gold24k: '', gold22k: '', gold18k: '',
    silver999: '', silver925: '',
  });

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rates/');
      const data = extractList(res.data);
      
      // Store history for table
      setRateHistory(data);

      // Only want the latest rates to populate the form
      const latestRates = { gold24k: '', gold22k: '', gold18k: '', silver999: '', silver925: '' };
      const latestMaking = { gold24k: '', gold22k: '', gold18k: '', silver999: '', silver925: '' };
      
      const processedTypes = new Set();
      data.forEach(entry => {
        if (!processedTypes.has(entry.metal_type)) {
          latestRates[entry.metal_type] = (Number(entry.rate_per_10gm) / 10).toFixed(2);
          latestMaking[entry.metal_type] = (Number(entry.making_per_10gm || 0) / 10).toFixed(2);
          processedTypes.add(entry.metal_type);
        }
      });
      setRates(latestRates);
      setMakingRates(latestMaking);
    } catch (err) {
      console.error("Failed to load rates:", err);
      setRateHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const saveRates = async () => {
    try {
      const payload = Object.entries(rates).map(([metal_type, rate]) => ({
        metal_type,
        rate_per_10gm: (Number(rate) * 10).toFixed(2),
        making_per_10gm: (Number(makingRates[metal_type] || 0) * 10).toFixed(2)
      }));
      
      for (const entry of payload) {
        if (entry.rate_per_10gm && Number(entry.rate_per_10gm) > 0) {
           await api.post('/rates/', entry);
        }
      }
      setEditMode(false);
      fetchRates();
    } catch (err) {
      console.error("Failed to save rates:", err);
      const msg = err.response?.data?.message || err.response?.data?.errors || 'Failed to save rates.';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const updateRate = (key, val) => setRates({ ...rates, [key]: val });
  const updateMakingRate = (key, val) => setMakingRates({ ...makingRates, [key]: val });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Rate Chart</h1>
          <div className="page-header__actions">
            <button className="btn btn--ghost btn--sm"><i className="fa-solid fa-clock-rotate-left"></i> History</button>
            {editMode ? (
              <>
                <button className="btn btn--ghost btn--sm" onClick={() => setEditMode(false)}>Cancel</button>
                <button className="btn btn--success" onClick={saveRates}>
                  <i className="fa-solid fa-check"></i> Save Rates
                </button>
              </>
            ) : (
              <button className="btn btn--primary" onClick={() => setEditMode(true)}>
                <i className="fa-solid fa-pen"></i> Update Rates
              </button>
            )}
          </div>
        </div>
        <p className="page-header__subtitle">Manage today's gold and silver rates. Last updated: 31 Mar 2026, 10:30 AM</p>
      </div>

      {/* Current Rates - Gold */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#78350f' }}>
            <i className="fa-solid fa-coins"></i>
          </span>
          Gold Rates (per gram)
        </h2>
        <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[
            { label: 'Gold 24K (999)', key: 'gold24k', change: '+₹120', up: true },
            { label: 'Gold 22K (916)', key: 'gold22k', change: '+₹120', up: true },
            { label: 'Gold 18K (750)', key: 'gold18k', change: '+₹90', up: true },
          ].map((item) => (
            <div className="card animate-fade-in-up" key={item.key}>
              <div className="card__label" style={{ marginBottom: 'var(--space-2)' }}>{item.label}</div>
              {editMode ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Rate / 1g</div>
                    <input
                      className="form-input"
                      type="number"
                      step="1"
                      value={rates[item.key]}
                      onChange={(e) => updateRate(item.key, e.target.value)}
                      style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-display)', height: 48, padding: '8px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Making / 1g</div>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={makingRates[item.key]}
                      onChange={(e) => updateMakingRate(item.key, e.target.value)}
                      style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-display)', height: 48, padding: '8px' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="card__value">₹{Number(rates[item.key]).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Making: ₹{makingRates[item.key] || '0.00'}/g</div>
                </>
              )}
              <div className={`card__trend card__trend--${item.up ? 'up' : 'down'}`}>
                <i className={`fa-solid fa-arrow-${item.up ? 'up' : 'down'}`}></i> {item.change}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Rates - Silver */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#1e293b' }}>
            <i className="fa-solid fa-coins"></i>
          </span>
          Silver Rates (per gram)
        </h2>
        <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[
            { label: 'Silver 999 (Pure)', key: 'silver999', change: '-₹1.20', up: false },
            { label: 'Silver 925 (Sterling)', key: 'silver925', change: '-₹1.10', up: false },
          ].map((item) => (
            <div className="card animate-fade-in-up" key={item.key}>
              <div className="card__label" style={{ marginBottom: 'var(--space-2)' }}>{item.label}</div>
              {editMode ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Rate / 1g</div>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={rates[item.key]}
                      onChange={(e) => updateRate(item.key, e.target.value)}
                      style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-display)', height: 48, padding: '8px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Making / 1g</div>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      value={makingRates[item.key]}
                      onChange={(e) => updateMakingRate(item.key, e.target.value)}
                      style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'var(--font-display)', height: 48, padding: '8px' }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="card__value">₹{Number(rates[item.key]).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Making: ₹{makingRates[item.key] || '0.00'}/g</div>
                </>
              )}
              <div className={`card__trend card__trend--${item.up ? 'up' : 'down'}`}>
                <i className={`fa-solid fa-arrow-${item.up ? 'up' : 'down'}`}></i> {item.change}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate History Table */}
      <div className="data-table-wrapper animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <div className="data-table-toolbar">
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>Rate History</h3>
          <button className="btn btn--ghost btn--sm"><i className="fa-solid fa-download"></i> Export</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Gold 24K</th>
              <th>Gold 22K</th>
              <th>Gold 18K</th>
              <th>Silver 999</th>
              <th>Silver 925</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>Loading history...</td>
              </tr>
            ) : rateHistory.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>No history available.</td>
              </tr>
            ) : rateHistory.map((row, i) => (
              <tr key={row.id || i}>
                <td style={{ fontWeight: 500 }}>{new Date(row.created_at).toLocaleDateString()}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{row.metal_type === 'gold24k' ? <><div style={{fontWeight: 700}}>₹{(row.rate_per_10gm/10).toFixed(2)}</div><div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400}}>Mk: ₹{(row.making_per_10gm/10 || 0).toFixed(2)}</div></> : '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.metal_type === 'gold22k' ? <><div style={{fontWeight: 700}}>₹{(row.rate_per_10gm/10).toFixed(2)}</div><div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400}}>Mk: ₹{(row.making_per_10gm/10 || 0).toFixed(2)}</div></> : '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.metal_type === 'gold18k' ? <><div style={{fontWeight: 700}}>₹{(row.rate_per_10gm/10).toFixed(2)}</div><div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400}}>Mk: ₹{(row.making_per_10gm/10 || 0).toFixed(2)}</div></> : '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.metal_type === 'silver999' ? <><div style={{fontWeight: 700}}>₹{(row.rate_per_10gm/10).toFixed(2)}</div><div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400}}>Mk: ₹{(row.making_per_10gm/10 || 0).toFixed(2)}</div></> : '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{row.metal_type === 'silver925' ? <><div style={{fontWeight: 700}}>₹{(row.rate_per_10gm/10).toFixed(2)}</div><div style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400}}>Mk: ₹{(row.making_per_10gm/10 || 0).toFixed(2)}</div></> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
