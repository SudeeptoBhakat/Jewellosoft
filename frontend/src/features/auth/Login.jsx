import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

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

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

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

  const submitLabel = cooldown > 0
    ? `Please wait (${cooldown}s)`
    : loading
      ? (isOnline ? 'Signing in...' : 'Verifying offline...')
      : (isOnline ? 'Sign In' : 'Sign In (Offline Mode)');

  return (
    <div className="animate-fade-in-up">
      <div className="auth-card-head">
        <h1>Welcome back</h1>
        <p>Sign in to continue to your store.</p>
      </div>

      {!isOnline && (
        <div className="auth-alert auth-alert--warning">
          <i className="fa-solid fa-cloud-slash"></i>
          <span>
            You are <strong>offline</strong>. If you have signed in on this device before,
            you can still continue with your saved credentials.
          </span>
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert--error">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            className="form-input"
            placeholder="you@yourshop.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isDisabled}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <div className="auth-input-wrap">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isDisabled}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="auth-reveal"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn--primary auth-submit" disabled={isDisabled}>
          {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
          {submitLabel}
        </button>
      </form>

      <div className="auth-switch">
        Don&apos;t have an account? <Link to="/register">Register your shop</Link>
      </div>
    </div>
  );
}
