import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../../utils/toast';

function ToastCard({ id, message, type, onClose }) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);
  const remainingTimeRef = useRef(4000);
  const startTimeRef = useRef(Date.now());

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      onClose(id);
    }, 300); // Wait for fade-out animation to complete
  }, [id, onClose]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, remainingTimeRef.current);
  }, [handleDismiss]);

  const pauseTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    remainingTimeRef.current -= (Date.now() - startTimeRef.current);
    if (remainingTimeRef.current < 500) {
      remainingTimeRef.current = 500; // Keep at least half a second when resuming
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearTimeout(timerRef.current);
  }, [startTimer]);

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
  };

  const colors = {
    success: 'var(--color-accent, #C9A84C)',
    error: 'var(--color-danger, #ef4444)',
    warning: 'var(--color-warning, #f59e0b)',
    info: 'var(--color-info, #3b82f6)',
  };

  return (
    <div
      className={`toast-card toast-card--${type} ${visible ? 'toast-card--show' : 'toast-card--hide'}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg, 12px)',
        background: 'var(--bg-card, #121212)',
        border: `1px solid var(--border-primary, rgba(201, 168, 76, 0.15))`,
        borderLeft: `4px solid ${colors[type] || 'var(--color-primary)'}`,
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        width: 320,
        marginBottom: 10,
        transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ color: colors[type] || 'inherit', fontSize: 16, marginTop: 1, flexShrink: 0 }}>
        <i className={`fa-solid ${icons[type] || 'fa-circle-info'}`}></i>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-sm, 13px)',
          fontWeight: 500,
          color: 'var(--text-primary, #f8f6f0)',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}>
          {message}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          color: 'var(--text-muted, #64748b)',
          fontSize: 12,
          lineHeight: 1,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          transition: 'color 120ms',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToast) => {
      setToasts((prev) => [...prev, newToast]);
    });
    return unsubscribe;
  }, []);

  const handleClose = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div
      className="toast-container"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999999, // Ensure it sits above even auto-updater
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none', // Allow clicking through empty space
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} {...t} onClose={handleClose} />
      ))}
    </div>
  );
}
