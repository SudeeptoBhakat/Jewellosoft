import { useState } from 'react';
import api from '../../lib/axios';
import { toast } from '../../utils/toast';

export default function ResetDataModal({ onClose, onReset }) {
  const [step, setStep] = useState(1);
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFinalReset = async () => {
    if (!password.trim()) {
      setError('Please enter your admin password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/accounts/shop/reset-data/', { password });

      try {
        localStorage.removeItem('jewellosoft_product_suggestions');
        localStorage.removeItem('jewellosoft_hallmark_value');
      } catch { /* non-critical */ }

      toast.success('All data has been reset successfully.');
      if (onReset) onReset();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Reset failed. Please check your password and try again.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal__header">
          <h2 className="modal__title" style={{ color: 'var(--color-danger)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />
            Reset All Data
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {step === 1 && (
          <>
            <div className="modal__body">
              {/* Critical Warning Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <i className="fa-solid fa-radiation" style={{
                    fontSize: '1.5rem',
                    color: 'var(--color-danger)',
                    marginTop: 2,
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 'var(--text-base)',
                      color: 'var(--color-danger)',
                      marginBottom: 6,
                    }}>
                      DANGER ZONE — Irreversible Action
                    </div>
                    <p style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0,
                    }}>
                      This will <strong style={{ color: 'var(--text-primary)' }}>permanently delete</strong> all of the following data:
                    </p>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 'var(--space-4)',
              }}>
                {[
                  { icon: 'fa-file-invoice-dollar', label: 'All Bills & Invoices' },
                  { icon: 'fa-clipboard-list', label: 'All Orders' },
                  { icon: 'fa-gem', label: 'All Inventory' },
                  { icon: 'fa-users', label: 'All Customers' },
                  { icon: 'fa-chart-line', label: 'All Rate History' },
                  { icon: 'fa-credit-card', label: 'All Payments' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-primary)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    <i className={`fa-solid ${item.icon}`} style={{ color: 'var(--color-danger)', opacity: 0.7, width: 16, textAlign: 'center' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Backup warning */}
              <div style={{
                background: 'var(--color-warning-muted, rgba(245,158,11,0.1))',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 'var(--space-4)',
              }}>
                <i className="fa-solid fa-download" style={{ color: 'var(--color-warning, #f59e0b)', fontSize: '1.1rem' }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  You <strong style={{ color: 'var(--text-primary)' }}>must backup</strong> by exporting all data first. This action is <strong style={{ color: 'var(--color-danger)' }}>NOT recoverable</strong>.
                </span>
              </div>

              {/* Acknowledgement checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                fontWeight: 500,
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-danger)', cursor: 'pointer' }}
                />
                I understand this will permanently delete all my data
              </label>
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn--danger"
                disabled={!understood}
                onClick={() => setStep(2)}
              >
                <i className="fa-solid fa-arrow-right" /> Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="modal__body">
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)',
                lineHeight: 1.6,
              }}>
                Enter your admin password to confirm the reset. This is the final step.
              </p>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Admin Password *</label>
                <input
                  className={`form-input${error ? ' form-input--error' : ''}`}
                  type="password"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleFinalReset()}
                  autoFocus
                  id="reset-data-password"
                />
                {error && <div className="form-error">{error}</div>}
              </div>
            </div>

            <div className="modal__footer">
              <button className="btn btn--ghost" onClick={() => { setStep(1); setPassword(''); setError(''); }}>
                <i className="fa-solid fa-arrow-left" /> Back
              </button>
              <button
                className="btn btn--danger"
                onClick={handleFinalReset}
                disabled={loading || !password.trim()}
              >
                <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-trash-can'}`} />
                {loading ? 'Resetting...' : 'Reset All Data'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
