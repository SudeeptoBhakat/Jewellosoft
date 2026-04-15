import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import * as authService from '../../services/authService';

export default function Register() {
  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // ── Email-confirmation flow state ──────────────────────────────
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const handleChange = (e) =>
    setFormData((p) => ({ ...p, [e.target.id]: e.target.value }));

  // ── Cooldown timer ─────────────────────────────────────────────
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

  // ── Submit handler ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMsg('');

    // Client-side validation
    if (
      !formData.shopName.trim() ||
      !formData.ownerName.trim() ||
      !formData.mobileNumber.trim() ||
      !formData.email.trim() ||
      !formData.password
    ) {
      setError('Please fill in all mandatory fields.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!isOnline) {
      setError('You are offline. Please check your internet connection.');
      return;
    }
    if (cooldown > 0) {
      setError(`Please wait ${cooldown} seconds before trying again.`);
      return;
    }

    try {
      setLoading(true);
      const result = await register(formData.email, formData.password, {
        shop_name: formData.shopName,
        owner_name: formData.ownerName,
        mobile_number: formData.mobileNumber,
        // Fallback keys ensuring compatibility based on any trigger parsing:
        shopName: formData.shopName,
        ownerName: formData.ownerName,
        mobileNumber: formData.mobileNumber,
      });

      // If Supabase requires email confirmation, show UI instead of navigating
      if (result?.needsEmailConfirmation) {
        setConfirmationPending(true);
        return;
      }

      navigate('/select-template', { replace: true });
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.';
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

  // ── Resend confirmation email ──────────────────────────────────
  const handleResend = async () => {
    if (!isOnline) {
      setError('You are offline.');
      return;
    }
    setResendMsg('');
    setError('');
    try {
      setResending(true);
      await authService.resendConfirmation(formData.email);
      setResendMsg('Confirmation email sent! Please check your inbox.');
      startCooldown(60);
    } catch (err) {
      setError(err.message || 'Could not resend email.');
    } finally {
      setResending(false);
    }
  };

  const isDisabled = loading || cooldown > 0;

  // ── Email Confirmation Pending Screen ──────────────────────────
  if (confirmationPending) {
    return (
      <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: 450, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: 'var(--bg-surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <i className="fa-solid fa-envelope-circle-check" style={{ fontSize: '1.75rem', color: 'var(--color-primary)' }}></i>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Check Your Email</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
          We've sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{formData.email}</strong>.<br />
          Please click the link to activate your account.
        </p>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.875rem', textAlign: 'left' }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }}></i>{error}
          </div>
        )}
        {resendMsg && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.875rem', textAlign: 'left' }}>
            <i className="fa-solid fa-circle-check" style={{ marginRight: 8 }}></i>{resendMsg}
          </div>
        )}

        <button
          className="btn btn--ghost"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          style={{ marginBottom: 16 }}
        >
          {resending && <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 8 }}></i>}
          {cooldown > 0 ? `Resend available in ${cooldown}s` : resending ? 'Sending...' : 'Resend Confirmation Email'}
        </button>

        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Already confirmed? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Log in here</Link>
        </div>
      </div>
    );
  }

  // ── Registration Form ──────────────────────────────────────────
  return (
    <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: 450, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Register Shop</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Set up your JewelloSoft account.</p>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fa-solid fa-wifi" style={{ opacity: 0.7 }}></i>
          You are currently offline. Registration requires an internet connection.
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
          <label className="form-label" htmlFor="shopName">Shop Name *</label>
          <input id="shopName" type="text" className="form-input" placeholder="e.g., Sharma Jewellers" value={formData.shopName} onChange={handleChange} disabled={isDisabled} />
        </div>

        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="ownerName">Owner Name *</label>
            <input id="ownerName" type="text" className="form-input" placeholder="e.g., Arun Sharma" value={formData.ownerName} onChange={handleChange} disabled={isDisabled} />
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="form-label" htmlFor="mobileNumber">Mobile Number *</label>
            <input id="mobileNumber" type="tel" className="form-input" placeholder="+91 XXXXX XXXXX" value={formData.mobileNumber} onChange={handleChange} disabled={isDisabled} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="form-label" htmlFor="email">Email Address *</label>
          <input id="email" type="email" className="form-input" placeholder="admin@shop.com" value={formData.email} onChange={handleChange} disabled={isDisabled} autoComplete="email" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>This will be used for login.</span>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label" htmlFor="password">Password *</label>
            <input id="password" type="password" className="form-input" placeholder="••••••••" value={formData.password} onChange={handleChange} disabled={isDisabled} autoComplete="new-password" />
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label" htmlFor="confirmPassword">Confirm Password *</label>
            <input id="confirmPassword" type="password" className="form-input" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} disabled={isDisabled} autoComplete="new-password" />
          </div>
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
              ? 'Creating Account...'
              : 'Finish Setup'}
        </button>
      </form>

      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Log in here</Link>
      </div>
    </div>
  );
}
