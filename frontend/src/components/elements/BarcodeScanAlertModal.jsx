import React, { useEffect, useRef } from 'react';

export default function BarcodeScanAlertModal({ alert, onClose }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!alert) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (_) {}

    const timer = setTimeout(() => {
      buttonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [alert, onClose]);

  if (!alert) return null;

  const { title = 'Product Out of Inventory', barcode, message, type = 'danger' } = alert;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-surface, #1e1e2d)',
          color: 'var(--text-primary, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: type === 'danger' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: type === 'danger' ? '#ef4444' : '#f59e0b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0
            }}
          >
            <i className={type === 'danger' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-exclamation'}></i>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: type === 'danger' ? '#f87171' : '#fbbf24' }}>
              {title}
            </h3>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>Inventory Validation Notice</span>
          </div>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {barcode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Scanned Barcode:</span>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-subtle, rgba(255, 255, 255, 0.08))',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                  letterSpacing: '0.5px'
                }}
              >
                {barcode}
              </span>
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-secondary, #cbd5e1)' }}>
            {message}
          </p>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: 'var(--bg-subtle, rgba(0, 0, 0, 0.2))',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            ref={buttonRef}
            onClick={onClose}
            style={{
              padding: '0.55rem 1.5rem',
              backgroundColor: type === 'danger' ? '#ef4444' : '#f59e0b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
              outline: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
            }}
          >
            OK (Dismiss)
          </button>
        </div>
      </div>
    </div>
  );
}
