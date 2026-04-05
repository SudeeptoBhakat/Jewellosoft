import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const { logout, shop } = useAuth();

  // Derive shop name / owner from global auth state
  const shopName = shop?.name || 'JewelloSoft';
  const ownerName = shop?.owner_name || 'Admin';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  const getInitials = (n) => n.split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase() || 'A';

  const [time, setTime] = useState(new Date());
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  /* ─── Live Rates from API ─── */
  const [rates, setRates] = useState({ gold24k: 0, gold22k: 0, gold18k: 0, silver999: 0, silver925: 0 });

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await api.get('/rates/latest/');
        const d = res.data;
        setRates({
          gold24k: d.gold24k?.rate_per_gram || 0,
          gold22k: d.gold22k?.rate_per_gram || 0,
          gold18k: d.gold18k?.rate_per_gram || 0,
          silver999: d.silver999?.rate_per_gram || 0,
          silver925: d.silver925?.rate_per_gram || 0,
        });
      } catch (e) {
        console.warn('Failed to fetch live rates for navbar:', e);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /* ─── Global Search ─── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); setShowSearch(false); return; }
    try {
      const res = await api.get(`/search/?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.results || []);
      setShowSearch(true);
    } catch (e) {
      console.warn('Search failed:', e);
      setSearchResults([]);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleResultClick = (result) => {
    setShowSearch(false);
    setSearchQuery('');
    navigate(result.url);
  };

  /* ─── Keyboard shortcut (Ctrl+K) ─── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* ─── Clock ─── */
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* Close dropdowns on click-outside */
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formattedTime = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const formattedDate = time.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const typeIcons = { customer: 'fa-user', invoice: 'fa-file-invoice-dollar', estimate: 'fa-file-lines', order: 'fa-box', inventory: 'fa-gem' };
  const typeColors = { customer: 'var(--color-success)', invoice: 'var(--color-primary)', estimate: 'var(--color-info)', order: 'var(--color-warning)', inventory: 'var(--color-secondary)' };

  return (
    <header className="navbar">
      {/* Global Search */}
      <div className="navbar__search" ref={searchRef} style={{ position: 'relative' }}>
        <i className="fa-solid fa-magnifying-glass navbar__search-icon"></i>
        <input
          type="text"
          className="navbar__search-input"
          placeholder="Search bills, orders, customers..."
          id="global-search"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => searchResults.length > 0 && setShowSearch(true)}
          autoComplete="off"
        />
        <span className="navbar__search-shortcut">Ctrl+K</span>

        {/* Search Dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
            zIndex: 9999, maxHeight: 380, overflowY: 'auto',
          }}>
            {searchResults.map((r, i) => (
              <div
                key={i}
                onClick={() => handleResultClick(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < searchResults.length - 1 ? '1px solid var(--border-soft)' : 'none',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-surface)', color: typeColors[r.type] || 'var(--text-muted)',
                  fontSize: '0.75rem', flexShrink: 0,
                }}>
                  <i className={`fa-solid ${typeIcons[r.type] || r.icon || 'fa-search'}`}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
                </div>
                <span className={`badge badge--${r.type === 'invoice' ? 'primary' : r.type === 'order' ? 'warning' : r.type === 'customer' ? 'success' : 'info'}`} style={{ fontSize: '0.55rem', flexShrink: 0 }}>
                  {r.type}
                </span>
              </div>
            ))}
          </div>
        )}
        {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
            background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
            zIndex: 9999, padding: '20px 14px', textAlign: 'center',
            fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
          }}>
            <i className="fa-solid fa-search" style={{ marginRight: 6, opacity: 0.5 }}></i>
            No results for "{searchQuery}"
          </div>
        )}
      </div>

      <div className="navbar__spacer"></div>

      {/* Quick Actions */}
      <div className="navbar__actions">
        <button className="navbar__quick-btn" id="btn-new-bill" onClick={() => navigate('/billing')}>
          <i className="fa-solid fa-plus"></i>
          <span>New Bill</span>
        </button>
        <button className="navbar__quick-btn navbar__quick-btn--secondary" id="btn-new-order" onClick={() => navigate('/orders')}>
          <i className="fa-solid fa-plus"></i>
          <span>New Order</span>
        </button>
      </div>

      <div className="navbar__divider"></div>

      {/* Live Rates */}
      <div className="navbar__rates">
        {rates.gold24k > 0 && <div className="navbar__rate-item"><span className="navbar__rate-metal navbar__rate-metal--gold"><i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>24K</span><span className="navbar__rate-value">₹{rates.gold24k.toLocaleString('en-IN')}</span></div>}
        {rates.gold22k > 0 && <div className="navbar__rate-item"><span className="navbar__rate-metal navbar__rate-metal--gold"><i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>22K</span><span className="navbar__rate-value">₹{rates.gold22k.toLocaleString('en-IN')}</span></div>}
        {rates.gold18k > 0 && <div className="navbar__rate-item"><span className="navbar__rate-metal navbar__rate-metal--gold"><i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>18K</span><span className="navbar__rate-value">₹{rates.gold18k.toLocaleString('en-IN')}</span></div>}
        {rates.silver999 > 0 && <div className="navbar__rate-item"><span className="navbar__rate-metal navbar__rate-metal--silver"><i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>999</span><span className="navbar__rate-value">₹{rates.silver999.toLocaleString('en-IN')}</span></div>}
        {rates.silver925 > 0 && <div className="navbar__rate-item"><span className="navbar__rate-metal navbar__rate-metal--silver"><i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>925</span><span className="navbar__rate-value">₹{rates.silver925.toLocaleString('en-IN')}</span></div>}
      </div>

      <div className="navbar__divider"></div>

      {/* Date/Time */}
      <div className="navbar__datetime">
        <span className="navbar__time">{formattedTime}</span>
        <span className="navbar__date">{formattedDate}</span>
      </div>

      <div className="navbar__divider"></div>

      {/* Admin Profile with Dropdown */}
      <div className="navbar__profile-wrap" ref={profileRef}>
        <div className="navbar__profile" id="profile-dropdown" onClick={() => setShowProfile(p => !p)}>
          <div className="navbar__avatar">{getInitials(ownerName)}</div>
          <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginLeft: 2, transition: 'transform 150ms', transform: showProfile ? 'rotate(180deg)' : 'rotate(0deg)' }}></i>
        </div>

        {showProfile && (
          <div className="navbar__dropdown animate-fade-in">
            <div className="navbar__dropdown-header">
              <div className="navbar__dropdown-avatar">{getInitials(ownerName)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{ownerName}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Owner</div>
              </div>
            </div>
            <div className="navbar__dropdown-divider"></div>
            <div className="navbar__dropdown-info">
              <i className="fa-solid fa-store" style={{ color: 'var(--text-muted)', width: 16, textAlign: 'center' }}></i>
              <span style={{ fontWeight: 500 }}>{shopName}</span>
            </div>
            <div className="navbar__dropdown-divider"></div>
            <button className="navbar__dropdown-item" onClick={() => { navigate('/settings'); setShowProfile(false); }}>
              <i className="fa-solid fa-gear"></i>
              <span>Preferences</span>
            </button>
            <div className="navbar__dropdown-divider"></div>
            <button className="navbar__dropdown-item navbar__dropdown-item--danger" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
