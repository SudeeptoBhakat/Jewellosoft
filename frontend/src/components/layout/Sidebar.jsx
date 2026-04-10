import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../lib/axios';

const navSections = [
  {
    title: 'Main',
    items: [
      { path: '/dashboard', icon: 'fa-solid fa-grid-2', label: 'Dashboard' },
      { path: '/billing', icon: 'fa-solid fa-file-invoice-dollar', label: 'New Bill' },
      { path: '/orders', icon: 'fa-solid fa-box', label: 'New Order' },
    ],
  },
  {
    title: 'Records',
    items: [
      { path: '/billing/list', icon: 'fa-solid fa-receipt', label: 'Bills List' },
      { path: '/orders/list', icon: 'fa-solid fa-clipboard-list', label: 'Orders List' },
    ],
  },
  {
    title: 'Management',
    items: [
      { path: '/inventory', icon: 'fa-solid fa-warehouse', label: 'Inventory' },
      { path: '/rates', icon: 'fa-solid fa-coins', label: 'Rate Chart' },
      { path: '/customers', icon: 'fa-solid fa-users', label: 'Customers' },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/settings', icon: 'fa-solid fa-gear', label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const [shopName, setShopName] = useState('JewelloSoft');
  const [appVersion, setAppVersion] = useState('1.0');

  useEffect(() => {
    // Fetch shop name from backend
    api.get('/accounts/shop/current/')
      .then((res) => setShopName(res.data.name || 'JewelloSoft'))
      .catch(() => {}); // Silent fail — default name is fine

    // Fetch app version from Electron (if available)
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion()
        .then((v) => setAppVersion(v || '1.0'))
        .catch(() => {});
    }
  }, []);

  return (
    <nav className="sidebar">
      {/* Shop Name Brand */}
      <a href="#/dashboard" className="sidebar__brand">
        <div className="sidebar__shop-name">{shopName}</div>
      </a>

      {/* Navigation */}
      <div className="sidebar__nav">
        {navSections.map((section) => (
          <div className="sidebar__section" key={section.title}>
            <div className="sidebar__section-title">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                }
              >
                <i className={`sidebar__link-icon ${item.icon}`}></i>
                <span className="sidebar__link-label">{item.label}</span>
                {item.badge && (
                  <span className="sidebar__link-badge">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar__footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--color-primary), #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', color: 'white', fontWeight: 700,
          }}>
            <i className="fa-solid fa-gem"></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              JewelloSoft v{appVersion}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}