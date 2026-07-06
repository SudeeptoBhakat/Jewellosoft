import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/axios';

const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PAYMENT_STATUS_LABELS = {
  pending: { label: 'Pending', cls: 'warning' },
  partially_paid: { label: 'Partial', cls: 'info' },
  paid: { label: 'Paid', cls: 'success' },
  overpaid: { label: 'Overpaid', cls: 'primary' },
};

export default function DuesCreditsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'all';

  const setTab = (newTab) => {
    setSearchParams(prev => {
      if (newTab === 'all') {
        prev.delete('tab');
      } else {
        prev.set('tab', newTab);
      }
      return prev;
    });
  };

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ results: [], total_due: 0, total_credit: 0, count: 0 });
  const [searchQ, setSearchQ] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('type', tab);
      if (searchQ.trim()) params.set('search', searchQ.trim());
      const res = await api.get(`/payments/advances/dues-summary/?${params}`);
      setData(res.data);
    } catch (e) {
      console.error('DuesCreditsList fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [tab, searchQ]);

  useEffect(() => {
    const handler = setTimeout(fetchData, 350);
    return () => clearTimeout(handler);
  }, [fetchData]);

  const toggleRow = (id) => setExpandedRow(prev => (prev === id ? null : id));

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header__top">
          <div className="flex items-center gap-3">
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => navigate('/dashboard')}
              title="Back to Dashboard"
            >
              <i className="fa-solid fa-arrow-left" />
            </button>
            <h1 className="page-header__title">
              <i className="fa-solid fa-scale-balanced" style={{ marginRight: 10, color: 'var(--color-primary)' }} />
              Dues &amp; Credits
            </h1>
          </div>
          <div className="page-header__actions">
            <button className="btn btn--ghost btn--sm" onClick={fetchData}>
              <i className="fa-solid fa-rotate" /> Refresh
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">
          Outstanding customer balances — who owes you and who you owe.
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}
      >
        {/* Total Dues */}
        <div
          className="card card--clickable"
          onClick={() => setTab('due')}
          style={{
            borderLeft: tab === 'due' ? '4px solid var(--color-danger)' : '4px solid transparent',
            transition: 'border-color 0.2s',
          }}
        >
          <div className="card__header">
            <div>
              <div
                className="card__value"
                style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xl)' }}
              >
                {loading ? '...' : fmt(data.total_due)}
              </div>
              <div className="card__label">Total Outstanding Dues</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                Customers owe this to you
              </div>
            </div>
            <div className="card__icon card__icon--warning">
              <i className="fa-solid fa-arrow-trend-up" />
            </div>
          </div>
        </div>

        {/* Total Credits */}
        <div
          className="card card--clickable"
          onClick={() => setTab('credit')}
          style={{
            borderLeft: tab === 'credit' ? '4px solid var(--color-success)' : '4px solid transparent',
            transition: 'border-color 0.2s',
          }}
        >
          <div className="card__header">
            <div>
              <div
                className="card__value"
                style={{ color: 'var(--color-success)', fontSize: 'var(--text-xl)' }}
              >
                {loading ? '...' : fmt(data.total_credit)}
              </div>
              <div className="card__label">Total Customer Credits</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                You owe this to customers
              </div>
            </div>
            <div className="card__icon card__icon--success">
              <i className="fa-solid fa-arrow-trend-down" />
            </div>
          </div>
        </div>

        {/* Total Customers */}
        <div className="card">
          <div className="card__header">
            <div>
              <div className="card__value">{loading ? '...' : data.count}</div>
              <div className="card__label">Customers with Balance</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                Showing {tab === 'all' ? 'all types' : tab === 'due' ? 'dues only' : 'credits only'}
              </div>
            </div>
            <div className="card__icon card__icon--primary">
              <i className="fa-solid fa-user-group" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          {/* Tab toggle */}
          <div className="flex gap-2">
            {[
              { key: 'all',    label: 'All',     icon: 'fa-list' },
              { key: 'due',    label: 'Dues',    icon: 'fa-arrow-trend-up' },
              { key: 'credit', label: 'Credits', icon: 'fa-arrow-trend-down' },
            ].map(t => (
              <button
                key={t.key}
                className={`btn btn--sm ${tab === t.key ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => setTab(t.key)}
              >
                <i className={`fa-solid ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{
                position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none',
              }}
            />
            <input
              className="form-input"
              type="text"
              placeholder="Search by customer name or phone…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }}
              id="dues-search"
            />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card animate-fade-in-up">
        <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '3%' }}>#</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Balance</th>
                <th>Type</th>
                <th>Orders / Bills</th>
                <th style={{ width: '6%' }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />
                    Loading balances…
                  </td>
                </tr>
              ) : data.results.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: '2rem', marginBottom: 10, display: 'block', opacity: 0.3, color: 'var(--color-success)' }} />
                    {searchQ ? 'No results match your search.' : 'All accounts are settled — no outstanding balances!'}
                  </td>
                </tr>
              ) : data.results.map((row, idx) => (
                <>
                  <tr
                    key={row.customer_id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleRow(row.customer_id)}
                  >
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.customer_name}</div>
                      {row.customer_address && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                          {row.customer_address}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                      {row.customer_phone || '—'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 'var(--text-md)',
                          color: row.balance_type === 'due'
                            ? 'var(--color-danger)'
                            : 'var(--color-success)',
                        }}
                      >
                        {fmt(row.balance)}
                      </span>
                    </td>
                    <td>
                      {row.balance_type === 'due' ? (
                        <span className="badge badge--warning" style={{ gap: 6 }}>
                          <i className="fa-solid fa-arrow-trend-up" style={{ fontSize: '0.65rem' }} />
                          Due
                        </span>
                      ) : (
                        <span className="badge badge--success" style={{ gap: 6 }}>
                          <i className="fa-solid fa-arrow-trend-down" style={{ fontSize: '0.65rem' }} />
                          Credit
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                      {row.orders.length > 0 && (
                        <span style={{ marginRight: 8 }}>
                          <i className="fa-solid fa-box" style={{ marginRight: 4, opacity: 0.5 }} />
                          {row.orders.length} order{row.orders.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {row.invoices.length > 0 && (
                        <span style={{ marginRight: 8 }}>
                          <i className="fa-solid fa-file-invoice" style={{ marginRight: 4, opacity: 0.5 }} />
                          {row.invoices.length} inv
                        </span>
                      )}
                      {row.estimates.length > 0 && (
                        <span>
                          <i className="fa-solid fa-file-lines" style={{ marginRight: 4, opacity: 0.5 }} />
                          {row.estimates.length} est
                        </span>
                      )}
                    </td>
                    <td>
                      <i
                        className={`fa-solid fa-chevron-${expandedRow === row.customer_id ? 'up' : 'down'}`}
                        style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', transition: 'transform 0.2s' }}
                      />
                    </td>
                  </tr>

                  {/* ── Expanded Detail Row ── */}
                  {expandedRow === row.customer_id && (
                    <tr key={`${row.customer_id}-detail`}>
                      <td colSpan={7} style={{ padding: 0, background: 'var(--bg-surface)', borderBottom: '2px solid var(--border-primary)' }}>
                        <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>

                          {/* Orders */}
                          {row.orders.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <i className="fa-solid fa-box" style={{ marginRight: 6 }} /> Orders
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {row.orders.map(o => (
                                  <div
                                    key={o.id}
                                    style={{
                                      padding: '8px 12px',
                                      background: 'var(--bg-primary)',
                                      borderRadius: 'var(--radius-md)',
                                      border: '1px solid var(--border-primary)',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => navigate('/orders/list')}
                                  >
                                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-primary-hover)' }}>
                                        {o.order_no}
                                      </span>
                                      <span style={{ fontWeight: 700 }}>{fmt(o.grand_total)}</span>
                                    </div>
                                    <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                      <span>{fmtDate(o.created_at)}</span>
                                      <div className="flex gap-2">
                                        <span className={`badge badge--${PAYMENT_STATUS_LABELS[o.payment_status]?.cls || 'primary'}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                          {PAYMENT_STATUS_LABELS[o.payment_status]?.label || o.payment_status}
                                        </span>
                                        <span className="badge badge--info" style={{ fontSize: '0.6rem', padding: '2px 6px', textTransform: 'capitalize' }}>
                                          {o.order_status}
                                        </span>
                                      </div>
                                    </div>
                                    {o.advance > 0 && (
                                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 3 }}>
                                        Advance collected: {fmt(o.advance)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Invoices */}
                          {row.invoices.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <i className="fa-solid fa-file-invoice-dollar" style={{ marginRight: 6 }} /> Invoices
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {row.invoices.map(i => (
                                  <div
                                    key={i.id}
                                    style={{
                                      padding: '8px 12px',
                                      background: 'var(--bg-primary)',
                                      borderRadius: 'var(--radius-md)',
                                      border: '1px solid var(--border-primary)',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => navigate('/billing/list')}
                                  >
                                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-primary-hover)' }}>
                                        {i.invoice_no}
                                      </span>
                                      <span style={{ fontWeight: 700 }}>{fmt(i.grand_total)}</span>
                                    </div>
                                    <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                      <span>{fmtDate(i.created_at)}</span>
                                      <span className={`badge badge--${i.is_paid ? 'success' : 'danger'}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                        {i.is_paid ? 'Paid' : 'Unpaid'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Estimates */}
                          {row.estimates.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <i className="fa-solid fa-file-lines" style={{ marginRight: 6 }} /> Estimates
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                {row.estimates.map(e => (
                                  <div
                                    key={e.id}
                                    style={{
                                      padding: '8px 12px',
                                      background: 'var(--bg-primary)',
                                      borderRadius: 'var(--radius-md)',
                                      border: '1px solid var(--border-primary)',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => navigate('/billing/list')}
                                  >
                                    <div className="flex justify-between" style={{ marginBottom: 4 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-info)' }}>
                                        {e.estimate_no}
                                      </span>
                                      <span style={{ fontWeight: 700 }}>{fmt(e.grand_total)}</span>
                                    </div>
                                    <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                      <span>{fmtDate(e.created_at)}</span>
                                      <span className={`badge badge--${e.is_paid ? 'success' : 'info'}`} style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                                        {e.is_paid ? 'Paid' : 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn--primary btn--sm"
                              onClick={() => navigate('/billing')}
                              style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                            >
                              <i className="fa-solid fa-file-invoice-dollar" /> Create Bill
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => navigate('/customers')}
                              style={{ width: '100%', justifyContent: 'flex-start', gap: 8 }}
                            >
                              <i className="fa-solid fa-user" /> View Customer
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {data.results.length > 0 && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-5)',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
            }}
          >
            <span>Showing {data.results.length} customer{data.results.length !== 1 ? 's' : ''} with outstanding balance</span>
            <div className="flex gap-4">
              {data.total_due > 0 && (
                <span>
                  Total Due: <strong style={{ color: 'var(--color-danger)' }}>{fmt(data.total_due)}</strong>
                </span>
              )}
              {data.total_credit > 0 && (
                <span>
                  Total Credit: <strong style={{ color: 'var(--color-success)' }}>{fmt(data.total_credit)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
