import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  // ── Cooldown timer (used after rate-limit errors) ──────────────
  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    // Cooldown guard
    if (cooldown > 0) {
      setError(`Please wait ${cooldown} seconds before trying again.`);
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.message || 'Login failed. Please try again.';
      setError(msg);

      // Start cooldown if rate-limited
      if (
        msg.toLowerCase().includes('too many') ||
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('wait')
      ) {
        startCooldown(60);
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || cooldown > 0;

  return (
    <div className="animate-fade-in-up" style={{ width: '100%' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome Back</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Enter your credentials to access your store.</p>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-wifi" style={{ opacity: 0.7 }}></i>
          <span>
            You are <strong>offline</strong>. Online login is unavailable.
            If you have logged in before on this device, you can still sign in using your saved credentials.
          </span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 14px', borderRadius: 6, marginBottom: 20, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="form-label" htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            className="form-input"
            placeholder="admin@sharmajewellers.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isDisabled}
            autoComplete="email"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>Password</label>
          </div>
          <input
            id="login-password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDisabled}
            autoComplete="current-password"
            style={{ marginTop: 6 }}
          />
        </div>

        <button
          type="submit"
          className="btn btn--primary"
          style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 500, opacity: isDisabled ? 0.6 : 1 }}
          disabled={isDisabled}
        >
          {loading && <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 8 }}></i>}
          {cooldown > 0
            ? `Please wait (${cooldown}s)`
            : loading
              ? (isOnline ? 'Signing in...' : 'Verifying offline...')
              : (isOnline ? 'Sign In' : 'Sign In (Offline Mode)')}
        </button>
      </form>

      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Don't have an account? <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Register your shop</Link>
      </div>
    </div>
  );
}
