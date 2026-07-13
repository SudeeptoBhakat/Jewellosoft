import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import * as authService from '../../services/authService';

const scorePassword = (value) => {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 6) score += 1;
  if (value.length >= 10) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 3);
};

const STRENGTH_META = [
  { label: '', className: '' },
  { label: 'Weak password', className: 'is-weak' },
  { label: 'Fair password', className: 'is-fair' },
  { label: 'Strong password', className: 'is-strong' },
];

const STEPS = [
  { icon: 'fa-store', title: 'Name your shop', subtitle: "Let's start with what your customers will see on every bill." },
  { icon: 'fa-user', title: 'About you', subtitle: 'Tell us who runs the shop and how to reach you.' },
  { icon: 'fa-lock', title: 'Create your login', subtitle: 'Set the credentials you will use to sign in — online and offline.' },
];

export default function Register() {
  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('fwd');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const handleChange = (e) =>
    setFormData((p) => ({ ...p, [e.target.id]: e.target.value }));

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

  const stepError = (index) => {
    if (index === 0 && !formData.shopName.trim()) return 'Please enter your shop name.';
    if (index === 1) {
      if (!formData.ownerName.trim()) return 'Please enter the owner name.';
      if (!formData.mobileNumber.trim()) return 'Please enter a mobile number.';
    }
    return null;
  };

  const goNext = () => {
    const msg = stepError(step);
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setDirection('fwd');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError('');
    setDirection('back');
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleStepKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goNext();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMsg('');

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
        shopName: formData.shopName,
        ownerName: formData.ownerName,
        mobileNumber: formData.mobileNumber,
      });

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
  const strength = scorePassword(formData.password);
  const strengthMeta = STRENGTH_META[strength];
  const confirmMismatch =
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;
  const isLastStep = step === STEPS.length - 1;
  const activeStep = STEPS[step];

  if (confirmationPending) {
    return (
      <div className="animate-fade-in-up auth-confirm">
        <div className="auth-confirm-icon">
          <i className="fa-solid fa-envelope-circle-check"></i>
        </div>
        <div className="auth-card-head" style={{ textAlign: 'center' }}>
          <h1>You&apos;re almost there</h1>
          <p>
            We&apos;ve sent a confirmation link to <strong>{formData.email}</strong>.
            Click it to activate your account and start selling.
          </p>
        </div>

        {error && (
          <div className="auth-alert auth-alert--error">
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}
        {resendMsg && (
          <div className="auth-alert auth-alert--success">
            <i className="fa-solid fa-circle-check"></i>
            <span>{resendMsg}</span>
          </div>
        )}

        <button
          className="btn btn--ghost auth-submit"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
        >
          {resending && <i className="fa-solid fa-circle-notch fa-spin"></i>}
          {cooldown > 0
            ? `Resend available in ${cooldown}s`
            : resending
              ? 'Sending...'
              : 'Resend confirmation email'}
        </button>

        <div className="auth-switch">
          Already confirmed? <Link to="/login">Log in here</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="auth-onboard-head">
        <span className="auth-step-count">Step {step + 1} of {STEPS.length}</span>
        <span className="auth-step-skiphint">Set up your shop</span>
      </div>

      <div className="auth-progress">
        {STEPS.map((_, index) => (
          <span
            key={index}
            className={`auth-progress-seg ${index < step ? 'is-done' : ''} ${index === step ? 'is-active' : ''}`}
          ></span>
        ))}
      </div>

      {!isOnline && (
        <div className="auth-alert auth-alert--warning">
          <i className="fa-solid fa-cloud-slash"></i>
          <span>You are currently offline. Registration requires an internet connection.</span>
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert--error">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className={`auth-stage ${direction === 'fwd' ? 'auth-dir-fwd' : 'auth-dir-back'}`} key={step}>
          <div className="auth-step-icon">
            <i className={`fa-solid ${activeStep.icon}`}></i>
          </div>
          <div className="auth-card-head">
            <h1>{activeStep.title}</h1>
            <p>{activeStep.subtitle}</p>
          </div>

          {step === 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="shopName">Shop name</label>
              <input id="shopName" type="text" className="form-input" placeholder="e.g., Sharma Jewellers" value={formData.shopName} onChange={handleChange} onKeyDown={handleStepKeyDown} disabled={isDisabled} autoFocus />
            </div>
          )}

          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="ownerName">Owner name</label>
                <input id="ownerName" type="text" className="form-input" placeholder="e.g., Arun Sharma" value={formData.ownerName} onChange={handleChange} onKeyDown={handleStepKeyDown} disabled={isDisabled} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="mobileNumber">Mobile number</label>
                <input id="mobileNumber" type="tel" className="form-input" placeholder="+91 XXXXX XXXXX" value={formData.mobileNumber} onChange={handleChange} onKeyDown={handleStepKeyDown} disabled={isDisabled} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address</label>
                <input id="email" type="email" className="form-input" placeholder="admin@shop.com" value={formData.email} onChange={handleChange} disabled={isDisabled} autoComplete="email" autoFocus />
                <span className="auth-hint">This will be used for login.</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div className="auth-input-wrap">
                  <input id="password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="At least 6 characters" value={formData.password} onChange={handleChange} disabled={isDisabled} autoComplete="new-password" />
                  <button type="button" className="auth-reveal" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
                {formData.password && (
                  <>
                    <div className="auth-strength">
                      {[1, 2, 3].map((tier) => (
                        <span key={tier} className={`auth-strength-bar ${strength >= tier ? strengthMeta.className : ''}`}></span>
                      ))}
                    </div>
                    <span className="auth-hint">{strengthMeta.label}</span>
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
                <div className="auth-input-wrap">
                  <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className={`form-input ${confirmMismatch ? 'form-input--error' : ''}`} placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange} disabled={isDisabled} autoComplete="new-password" />
                  <button type="button" className="auth-reveal" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                    <i className={showConfirm ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                  </button>
                </div>
                {confirmMismatch && <span className="form-error">Passwords do not match.</span>}
              </div>
            </>
          )}
        </div>

        <div className="auth-nav">
          {step > 0 && (
            <button type="button" className="btn btn--ghost auth-nav-back" onClick={goBack} disabled={isDisabled}>
              <i className="fa-solid fa-arrow-left"></i>
              Back
            </button>
          )}

          {isLastStep ? (
            <button type="submit" className="btn btn--primary auth-nav-next" disabled={isDisabled}>
              {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
              {cooldown > 0 ? `Please wait (${cooldown}s)` : loading ? 'Creating account...' : 'Finish setup'}
            </button>
          ) : (
            <button type="button" className="btn btn--primary auth-nav-next" onClick={goNext} disabled={isDisabled}>
              Continue
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          )}
        </div>
      </form>

      <div className="auth-switch">
        Already have an account? <Link to="/login">Log in here</Link>
      </div>
    </div>
  );
}
