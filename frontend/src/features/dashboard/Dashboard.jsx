import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';

const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

const statusBadge = (status) => {
  const map = { Paid: 'success', Pending: 'warning', Partial: 'info' };
  return <span className={`badge badge--${map[status] || 'primary'}`}>{status}</span>;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today_sales: 0,
    pending_orders: 0,
    stock_count: 0,
    active_customers: 0,
    total_dues: 0,
    total_credits: 0,
  });
  const [recentBills, setRecentBills] = useState([]);
  const [rates, setRates] = useState({});

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/stats/');
      const d = res.data;
      setStats({
        today_sales: d.today_sales || 0,
        pending_orders: d.pending_orders || 0,
        stock_count: d.stock_count || 0,
        active_customers: d.active_customers || 0,
        total_dues: d.total_dues || 0,
        total_credits: d.total_credits || 0,
      });
      setRecentBills(d.recent_bills || []);
      setRates(d.rates || {});
    } catch (e) {
      console.error('Dashboard load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Today's Sales",
      value: fmt(stats.today_sales),
      icon: 'fa-solid fa-indian-rupee-sign',
      variant: 'primary',
      onClick: null,
    },
    {
      label: 'Pending Orders',
      value: stats.pending_orders,
      icon: 'fa-solid fa-clock',
      variant: 'warning',
      onClick: () => navigate('/orders/list'),
    },
    {
      label: 'Items in Stock',
      value: Number(stats.stock_count).toLocaleString('en-IN'),
      icon: 'fa-solid fa-boxes-stacked',
      variant: 'info',
      onClick: () => navigate('/inventory'),
    },
    {
      label: 'Active Customers',
      value: stats.active_customers,
      icon: 'fa-solid fa-user-group',
      variant: 'success',
      onClick: () => navigate('/customers'),
    },
    {
      label: 'Outstanding Dues',
      value: fmt(stats.total_dues),
      icon: 'fa-solid fa-arrow-trend-up',
      variant: 'danger',
      onClick: () => navigate('/dues-credits?tab=due'),
      badge: stats.total_dues > 0 ? '!' : null,
      badgeCls: 'danger',
    },
    {
      label: 'Customer Credits',
      value: fmt(stats.total_credits),
      icon: 'fa-solid fa-arrow-trend-down',
      variant: 'success',
      onClick: () => navigate('/dues-credits?tab=credit'),
    },
  ];


  const timeSince = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Dashboard</h1>
          <div className="page-header__actions">
            <button className="btn btn--ghost btn--sm" onClick={fetchDashboard}>
              <i className="fa-solid fa-rotate"></i> Refresh
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Welcome back! Here's what's happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid stagger">
        {statCards.map((stat, i) => (
          <div
            className="card card--clickable animate-fade-in-up"
            key={i}
            onClick={stat.onClick || undefined}
            style={{ cursor: stat.onClick ? 'pointer' : 'default', position: 'relative' }}
          >
            {stat.badge && (
              <span
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'var(--color-danger)', color: '#fff',
                  fontSize: '0.6rem', fontWeight: 800,
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'pulse 1.5s infinite',
                }}
              >
                {stat.badge}
              </span>
            )}
            <div className="card__header">
              <div>
                <div
                  className="card__value"
                  style={stat.variant === 'danger' ? { color: 'var(--color-danger)' } : {}}
                >
                  {loading ? '...' : stat.value}
                </div>
                <div className="card__label">{stat.label}</div>
                {stat.onClick && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                    Click to view details
                  </div>
                )}
              </div>
              <div className={`card__icon card__icon--${stat.variant}`}>
                <i className={stat.icon}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dues & Credits Alert Strip */}
      {!loading && (stats.total_dues > 0 || stats.total_credits > 0) && (
        <div
          className="animate-fade-in-up"
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          {stats.total_dues > 0 && (
            <div
              onClick={() => navigate('/dues-credits?tab=due')}
              style={{
                flex: 1, minWidth: 200, cursor: 'pointer',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'background 0.2s',
              }}
            >
              <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--color-danger)', fontSize: '1.1rem' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                  {fmt(stats.total_dues)} Outstanding Dues
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Customers owe you money → click to collect</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }} />
            </div>
          )}
          {stats.total_credits > 0 && (
            <div
              onClick={() => navigate('/dues-credits?tab=credit')}
              style={{
                flex: 1, minWidth: 200, cursor: 'pointer',
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'background 0.2s',
              }}
            >
              <i className="fa-solid fa-circle-info" style={{ color: 'var(--color-success)', fontSize: '1.1rem' }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>
                  {fmt(stats.total_credits)} Customer Credits
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>You owe customers refunds → click to review</div>
              </div>
              <i className="fa-solid fa-chevron-right" style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }} />
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Recent Bills */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <div className="card__header">
            <h2 className="card__title">Recent Bills</h2>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate('/billing/list')}>View All</button>
          </div>
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-4)' }}>Loading...</td></tr>
                ) : recentBills.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>No bills yet. Create your first bill!</td></tr>
                ) : recentBills.map((bill) => (
                  <tr key={bill.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/billing/list')}>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary-hover)' }}>{bill.id}</td>
                    <td>{bill.customer}</td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(bill.amount)}</td>
                    <td>{statusBadge(bill.type === 'Invoice' ? 'Paid' : 'Pending')}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{timeSince(bill.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions Feed */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
          <div className="card__header">
            <h2 className="card__title">Quick Actions</h2>
          </div>
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'flex-start', gap: 12 }} onClick={() => navigate('/billing')}>
              <i className="fa-solid fa-file-invoice-dollar"></i> Create New Bill
            </button>
            <button className="btn btn--warning" style={{ width: '100%', justifyContent: 'flex-start', gap: 12 }} onClick={() => navigate('/orders')}>
              <i className="fa-solid fa-box"></i> Create New Order
            </button>
            <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: 12 }} onClick={() => navigate('/inventory')}>
              <i className="fa-solid fa-boxes-stacked"></i> Manage Inventory
            </button>
            <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: 12 }} onClick={() => navigate('/customers')}>
              <i className="fa-solid fa-user-group"></i> View Customers
            </button>
            <button className="btn btn--ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: 12 }} onClick={() => navigate('/rates')}>
              <i className="fa-solid fa-coins"></i> Update Rates
            </button>
          </div>
        </div>
      </div>

      {/* Rate Quick View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-5)' }}>
        <div className="rate-card animate-fade-in-up" style={{ animationDelay: '400ms', animationFillMode: 'both', cursor: 'pointer' }} onClick={() => navigate('/rates')}>
          <div className="rate-card__metal-icon rate-card__metal-icon--gold">
            <i className="fa-solid fa-coins"></i>
          </div>
          <div className="rate-card__info">
            <div className="rate-card__metal-name">Gold (22K)</div>
            <div className="rate-card__price">
              {loading ? '...' : rates.gold22k ? `₹${rates.gold22k.rate_per_gram.toLocaleString('en-IN')}` : rates.gold24k ? `₹${rates.gold24k.rate_per_gram.toLocaleString('en-IN')}` : '₹—'}
            </div>
            <div className="rate-card__unit">Per Gram • {rates.gold22k?.updated_at ? `Updated ${new Date(rates.gold22k.updated_at).toLocaleDateString()}` : 'Not set yet'}</div>
          </div>
        </div>
        <div className="rate-card animate-fade-in-up" style={{ animationDelay: '450ms', animationFillMode: 'both', cursor: 'pointer' }} onClick={() => navigate('/rates')}>
          <div className="rate-card__metal-icon rate-card__metal-icon--silver">
            <i className="fa-solid fa-coins"></i>
          </div>
          <div className="rate-card__info">
            <div className="rate-card__metal-name">Silver (925)</div>
            <div className="rate-card__price">
              {loading ? '...' : rates.silver925 ? `₹${rates.silver925.rate_per_gram}` : rates.silver999 ? `₹${rates.silver999.rate_per_gram}` : '₹—'}
            </div>
            <div className="rate-card__unit">Per Gram • {rates.silver925?.updated_at ? `Updated ${new Date(rates.silver925.updated_at).toLocaleDateString()}` : 'Not set yet'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
