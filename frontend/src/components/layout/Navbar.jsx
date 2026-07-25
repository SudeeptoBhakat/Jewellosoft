/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useRefresh } from '../../contexts/RefreshContext';

export default function Navbar() {
  const navigate = useNavigate();
  const { logout, shop } = useAuth();
  const { tick, refresh } = useRefresh();

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
  const [showRates, setShowRates] = useState(false);
  const ratesRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

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
  }, [tick]);

  /* ─── Global Refresh ─── */
  const handleGlobalRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 700);
  };

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
      if (ratesRef.current && !ratesRef.current.contains(e.target)) setShowRates(false);
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

      {/* Global Refresh */}
      <button
        className="navbar__quick-btn navbar__quick-btn--secondary"
        id="btn-global-refresh"
        title="Refresh data (current tab)"
        onClick={handleGlobalRefresh}
        disabled={refreshing}
        style={{ padding: '0 10px' }}
      >
        <i className={`fa-solid fa-arrows-rotate${refreshing ? ' fa-spin' : ''}`}></i>
      </button>

      <div className="navbar__divider"></div>

      {/* Live Rates Dropdown */}
      <div className="navbar__profile-wrap" ref={ratesRef} style={{ position: 'relative' }}>
        {(() => {
          const rateEntries = [
            { key: 'gold24k', label: 'Gold 24K (999)', value: rates.gold24k, kind: 'gold' },
            { key: 'gold22k', label: 'Gold 22K (916)', value: rates.gold22k, kind: 'gold' },
            { key: 'gold18k', label: 'Gold 18K (750)', value: rates.gold18k, kind: 'gold' },
            { key: 'silver999', label: 'Silver 999 (Pure)', value: rates.silver999, kind: 'silver' },
            { key: 'silver925', label: 'Silver 925 (Sterling)', value: rates.silver925, kind: 'silver' },
          ].filter(r => r.value > 0);
          const headline = rateEntries.find(r => r.key === 'gold22k') || rateEntries[0];

          return (
            <>
              <div
                className="navbar__rates"
                id="rates-dropdown"
                onClick={() => setShowRates(p => !p)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title="Live metal rates"
              >
                {headline ? (
                  <div className="navbar__rate-item">
                    <span className={`navbar__rate-metal navbar__rate-metal--${headline.kind}`}>
                      <i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>
                      {headline.key === 'gold22k' ? '22K' : headline.label.split(' ')[1]}
                    </span>
                    <span className="navbar__rate-value">₹{headline.value.toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <div className="navbar__rate-item">
                    <span className="navbar__rate-metal"><i className="fa-solid fa-coins" style={{ marginRight: 4, fontSize: '0.55rem' }}></i>Rates</span>
                    <span className="navbar__rate-value" style={{ color: 'var(--text-muted)' }}>—</span>
                  </div>
                )}
                <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginLeft: 4, transition: 'transform 150ms', transform: showRates ? 'rotate(180deg)' : 'rotate(0deg)' }}></i>
              </div>

              {showRates && (
                <div className="navbar__dropdown animate-fade-in" style={{ minWidth: 240 }}>
                  <div className="navbar__dropdown-header" style={{ paddingBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                        <i className="fa-solid fa-coins" style={{ marginRight: 8, color: 'var(--color-warning)' }}></i>
                        Live Rates (₹/g)
                      </div>
                    </div>
                  </div>
                  <div className="navbar__dropdown-divider"></div>
                  {rateEntries.length === 0 && (
                    <div style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No rates configured yet
                    </div>
                  )}
                  {rateEntries.map(r => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', fontSize: 'var(--text-sm)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                        <i className="fa-solid fa-coins" style={{ fontSize: '0.6rem', color: r.kind === 'gold' ? 'var(--color-warning)' : 'var(--color-info)' }}></i>
                        {r.label}
                      </span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>₹{r.value.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div className="navbar__dropdown-divider"></div>
                  <button className="navbar__dropdown-item" onClick={() => { navigate('/rates'); setShowRates(false); }}>
                    <i className="fa-solid fa-chart-line"></i>
                    <span>View Rates Chart</span>
                  </button>
                </div>
              )}
            </>
          );
        })()}
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
            <button className="navbar__dropdown-item" onClick={() => {
              if (window.electronAPI?.showAboutDialog) {
                window.electronAPI.showAboutDialog();
              } else {
                alert('JewelloSoft Community Edition\nVersion: 1.0.0\nCopyright © 2026 Sudeepta Bhakat\nCommercial rights reserved.');
              }
              setShowProfile(false);
            }}>
              <i className="fa-solid fa-circle-info"></i>
              <span>About JewelloSoft</span>
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
