import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import './auth.css';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();

  if (loading) {
    return (
      <div className="auth-loading">
        <i className="fa-solid fa-circle-notch fa-spin"></i>
        <span>Loading JewelloSoft...</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="auth-root">
      {!isOnline && (
        <div className="auth-offline-strip">
          <i className="fa-solid fa-cloud-slash"></i>
          No internet connection — online sign-in and registration are unavailable.
        </div>
      )}

      <div className="auth-body">
        <aside className="auth-brand">
          <div className="auth-brand-mark">
            <span className="auth-brand-logo">
              <i className="fa-solid fa-gem"></i>
            </span>
            <span className="auth-brand-wordmark">JewelloSoft</span>
          </div>

          <div className="auth-brand-hero">
            <h2>Run your entire jewellery business from one place.</h2>
            <p>Billing, inventory, custom orders and customer ledgers — precise, GST-ready and fully offline.</p>
          </div>

          <ul className="auth-feature-list">
            <li><i className="fa-solid fa-file-invoice"></i> GST-compliant billing &amp; estimates</li>
            <li><i className="fa-solid fa-boxes-stacked"></i> HUID &amp; SKU inventory tracking</li>
            <li><i className="fa-solid fa-wifi"></i> Works fully offline, syncs when online</li>
          </ul>

          <div className="auth-brand-foot">
            Secure local data &middot; Encrypted licensing
          </div>
        </aside>

        <main className="auth-panel">
          <div className="auth-card">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
