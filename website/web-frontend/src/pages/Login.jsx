import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);
      const res = await loginUser({ email, password });
      if (res.success && res.user) {
        login(res.user);
        navigate('/profile', { replace: true });
      } else {
        setError(res.message || 'Login failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center px-3 py-5" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-center mb-4">
        <Link to="/" className="text-decoration-none d-inline-flex align-items-center gap-2">
          <img src="/logo.png" alt="JewelloSoft" style={{ width: '38px', height: 'auto' }} />
          <span className="brand-name fs-4">JewelloSoft</span>
        </Link>
      </div>

      <div
        className="card w-100 p-4 p-md-5 rounded-4"
        style={{
          maxWidth: '440px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div className="text-center mb-4">
          <h2 className="font-heading fs-3 mb-1" style={{ color: 'var(--text-primary)' }}>Sign In</h2>
          <p className="small mb-0" style={{ color: 'var(--text-secondary)' }}>
            Access your jewellery business portal
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 border-0" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <input
              type="email"
              className="form-control"
              placeholder="owner@jewellers.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div className="mb-4">
            <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-gold w-100 py-2 fw-semibold rounded-3 mb-3"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ) : null}
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
          <span className="small me-1" style={{ color: 'var(--text-secondary)' }}>
            Don't have an account?
          </span>
          <Link to="/register" className="small fw-semibold text-gold text-decoration-none">
            Register Here
          </Link>
        </div>
      </div>

      <div className="text-center mt-4">
        <Link to="/" className="small text-decoration-none" style={{ color: 'var(--text-muted)' }}>
          <i className="bi bi-arrow-left me-1"></i> Back to Home
        </Link>
      </div>
    </div>
  );
}
