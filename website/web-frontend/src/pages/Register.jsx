import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerUser } from '../services/api';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    shop_name: '',
    owner_name: '',
    mobile_number: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { email, password, shop_name, owner_name } = formData;
    if (!email || !password || !shop_name || !owner_name) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      const res = await registerUser(formData);
      if (res.success && res.user) {
        login(res.user);
        navigate('/profile', { replace: true });
      } else {
        setError(res.message || 'Registration failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account. Please try again.');
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
          maxWidth: '520px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div className="text-center mb-4">
          <h2 className="font-heading fs-3 mb-1" style={{ color: 'var(--text-primary)' }}>Create Account</h2>
          <p className="small mb-0" style={{ color: 'var(--text-secondary)' }}>
            Register your jewellery store with JewelloSoft
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 border-0" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                Shop Name *
              </label>
              <input
                type="text"
                name="shop_name"
                className="form-control"
                placeholder="Royal Jewellers"
                value={formData.shop_name}
                onChange={handleChange}
                required
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                Owner Name *
              </label>
              <input
                type="text"
                name="owner_name"
                className="form-control"
                placeholder="Rajesh Verma"
                value={formData.owner_name}
                onChange={handleChange}
                required
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div className="col-12">
              <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                className="form-control"
                placeholder="owner@royaljewellers.com"
                value={formData.email}
                onChange={handleChange}
                required
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                Mobile Number
              </label>
              <input
                type="tel"
                name="mobile_number"
                className="form-control"
                placeholder="9876543210"
                value={formData.mobile_number}
                onChange={handleChange}
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label small fw-medium" style={{ color: 'var(--text-secondary)' }}>
                Password *
              </label>
              <input
                type="password"
                name="password"
                className="form-control"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-gold w-100 py-2 fw-semibold rounded-3 mt-4 mb-3"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ) : null}
            {loading ? 'Creating Account...' : 'Register Business'}
          </button>
        </form>

        <div className="text-center pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
          <span className="small me-1" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?
          </span>
          <Link to="/login" className="small fw-semibold text-gold text-decoration-none">
            Sign In Here
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
