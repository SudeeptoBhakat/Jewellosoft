import { useState, useEffect, useCallback } from 'react';

/**
 * ─── AutoUpdater ─────────────────────────────────────────────────
 * Production-grade, permission-based auto-update UI.
 *
 * State Machine:
 *   idle → available → downloading → downloaded → installing
 *                  ↘ error (retryable)
 *
 * Flow:
 *   1. App checks for updates on boot (main process, 5s delay)
 *   2. If update found → shows card with version + "Download Now"
 *   3. User clicks "Download Now" → progress bar with speed + bytes
 *   4. Download complete → "Restart & Install" button
 *   5. User clicks restart → app quits + installs + relaunches
 *
 * The user can dismiss at any stage. If dismissed during "available",
 * a small badge remains for re-opening.
 * ─────────────────────────────────────────────────────────────────
 */

const STATES = {
  IDLE: 'idle',
  AVAILABLE: 'available',
  DOWNLOADING: 'downloading',
  DOWNLOADED: 'downloaded',
  INSTALLING: 'installing',
  ERROR: 'error',
};

export default function AutoUpdater() {
  const [status, setStatus] = useState(STATES.IDLE);
  const [updateInfo, setUpdateInfo] = useState(null); // { version, currentVersion, releaseDate }
  const [progress, setProgress] = useState({ percent: 0, speed: 0, transferred: 0, total: 0 });
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setStatus(STATES.AVAILABLE);
      setDismissed(false); // Always show when new update detected
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      // Stay idle — nothing to show
      setStatus(STATES.IDLE);
    });

    window.electronAPI.onDownloadProgress((info) => {
      setStatus(STATES.DOWNLOADING);
      setProgress({
        percent: Math.round(info.percent),
        speed: info.bytesPerSecond || 0,
        transferred: info.transferred || 0,
        total: info.total || 0,
      });
    });

    window.electronAPI.onUpdateDownloaded((info) => {
      setStatus(STATES.DOWNLOADED);
      if (info?.version) setUpdateInfo(prev => ({ ...prev, ...info }));
    });

    window.electronAPI.onUpdateError((info) => {
      setError(info?.message || 'An unexpected error occurred.');
      setStatus(STATES.ERROR);
    });
  }, []);

  const handleDownload = useCallback(() => {
    setStatus(STATES.DOWNLOADING);
    setProgress({ percent: 0, speed: 0, transferred: 0, total: 0 });
    window.electronAPI.startDownload();
  }, []);

  const handleInstall = useCallback(() => {
    setStatus(STATES.INSTALLING);
    // Brief visual feedback before the app quits
    setTimeout(() => {
      window.electronAPI.installUpdate();
    }, 300);
  }, []);

  const handleDismiss = useCallback(() => {
    if (status === STATES.AVAILABLE || status === STATES.DOWNLOADED || status === STATES.ERROR) {
      setDismissed(true);
    }
  }, [status]);

  const handleRetry = useCallback(() => {
    setError('');
    setStatus(STATES.IDLE);
    window.electronAPI.checkForUpdates();
  }, []);

  // Format bytes to human-readable
  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatSpeed = (bps) => {
    if (bps < 1024) return `${bps} B/s`;
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  };

  // ─── Nothing to show ──────────────────────────────────────────
  if (status === STATES.IDLE) return null;

  // ─── Dismissed: show small re-open badge ──────────────────────
  if (dismissed && (status === STATES.AVAILABLE || status === STATES.DOWNLOADED)) {
    return (
      <button
        id="update-badge"
        onClick={() => setDismissed(false)}
        title="Update available"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
          width: 48, height: 48, borderRadius: '50%',
          background: status === STATES.DOWNLOADED
            ? 'var(--color-accent, #22c55e)'
            : 'var(--color-primary, #6366f1)',
          border: 'none', cursor: 'pointer', color: 'white',
          fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      >
        <i className={`fa-solid ${status === STATES.DOWNLOADED ? 'fa-circle-check' : 'fa-arrow-up'}`} />
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
            50% { transform: scale(1.08); box-shadow: 0 4px 30px rgba(99,102,241,0.5); }
          }
        `}</style>
      </button>
    );
  }

  if (dismissed && status === STATES.ERROR) return null;

  // ─── Main Update Card ─────────────────────────────────────────
  return (
    <div
      id="update-card"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
        background: 'var(--bg-card, #1e293b)',
        color: 'var(--text-primary, #f1f5f9)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border-primary, rgba(255,255,255,0.08))',
        padding: 0, width: 360, overflow: 'hidden',
        fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        animation: 'slideUp 350ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: status === STATES.DOWNLOADED
          ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
          : status === STATES.ERROR
            ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
            : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))',
        borderBottom: '1px solid var(--border-primary, rgba(255,255,255,0.06))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: status === STATES.DOWNLOADED
              ? 'var(--color-accent, #22c55e)'
              : status === STATES.ERROR
                ? 'var(--color-danger, #ef4444)'
                : 'var(--color-primary, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 14,
          }}>
            <i className={`fa-solid ${
              status === STATES.AVAILABLE ? 'fa-arrow-up' :
              status === STATES.DOWNLOADING ? 'fa-cloud-arrow-down' :
              status === STATES.DOWNLOADED ? 'fa-circle-check' :
              status === STATES.INSTALLING ? 'fa-rotate' :
              'fa-triangle-exclamation'
            }`} style={status === STATES.INSTALLING ? { animation: 'spin 1s linear infinite' } : {}} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3 }}>
              {status === STATES.AVAILABLE && 'Update Available'}
              {status === STATES.DOWNLOADING && 'Downloading Update'}
              {status === STATES.DOWNLOADED && 'Ready to Install'}
              {status === STATES.INSTALLING && 'Restarting...'}
              {status === STATES.ERROR && 'Update Error'}
            </div>
            {updateInfo?.version && status !== STATES.ERROR && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.3, marginTop: 1 }}>
                v{updateInfo.currentVersion || '?'} → v{updateInfo.version}
              </div>
            )}
          </div>
        </div>

        {/* Dismiss X — only on available, downloaded, error */}
        {(status === STATES.AVAILABLE || status === STATES.DOWNLOADED || status === STATES.ERROR) && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'var(--text-muted, #94a3b8)', fontSize: 14, lineHeight: 1,
              borderRadius: 4, transition: 'color 120ms',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary, #f1f5f9)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '16px 18px' }}>

        {/* AVAILABLE — ask for permission */}
        {status === STATES.AVAILABLE && (
          <>
            <p style={{
              fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)',
              lineHeight: 1.6, margin: '0 0 16px 0',
            }}>
              A new version of JewelloSoft is available. Would you like to download it now?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                id="btn-download-update"
                onClick={handleDownload}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
                  background: 'var(--color-primary, #6366f1)', color: 'white',
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 150ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <i className="fa-solid fa-download" />
                Download Now
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '10px 16px', border: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
                  borderRadius: 8, background: 'transparent',
                  color: 'var(--text-muted, #94a3b8)', fontWeight: 500,
                  fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover, rgba(255,255,255,0.2))'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-primary, rgba(255,255,255,0.1))'}
              >
                Later
              </button>
            </div>
          </>
        )}

        {/* DOWNLOADING — progress bar with speed + bytes */}
        {status === STATES.DOWNLOADING && (
          <>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 10,
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {progress.total > 0
                  ? `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`
                  : 'Preparing download...'}
              </span>
              <span style={{
                fontSize: '0.85rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: 'var(--color-primary, #6366f1)',
              }}>
                {progress.percent}%
              </span>
            </div>
            {/* Progress track */}
            <div style={{
              width: '100%', height: 8, backgroundColor: 'var(--bg-surface, #334155)',
              borderRadius: 4, overflow: 'hidden', position: 'relative',
            }}>
              <div style={{
                width: `${progress.percent}%`, height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, var(--color-primary, #6366f1), #818cf8)',
                transition: 'width 300ms ease-out',
                position: 'relative',
              }}>
                {/* Shimmer effect */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  animation: 'shimmer 1.5s infinite',
                }} />
              </div>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 8,
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>
                {progress.speed > 0 ? `↓ ${formatSpeed(progress.speed)}` : ''}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>
                Please don't close the app
              </span>
            </div>
            <style>{`
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {/* DOWNLOADED — restart button */}
        {status === STATES.DOWNLOADED && (
          <>
            <p style={{
              fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)',
              lineHeight: 1.6, margin: '0 0 16px 0',
            }}>
              v{updateInfo?.version} is ready. Restart the application to finish installing.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                id="btn-install-update"
                onClick={handleInstall}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
                  background: 'var(--color-accent, #22c55e)', color: 'white',
                  fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 150ms',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <i className="fa-solid fa-arrow-rotate-right" />
                Restart & Install
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '10px 16px', border: '1px solid var(--border-primary, rgba(255,255,255,0.1))',
                  borderRadius: 8, background: 'transparent',
                  color: 'var(--text-muted, #94a3b8)', fontWeight: 500,
                  fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Later
              </button>
            </div>
          </>
        )}

        {/* INSTALLING — brief state before quit */}
        {status === STATES.INSTALLING && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              width: 36, height: 36, margin: '0 auto 12px',
              border: '3px solid var(--border-primary, #334155)',
              borderTopColor: 'var(--color-primary, #6366f1)',
              borderRadius: '50%', animation: 'spin 0.7s linear infinite',
            }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', margin: 0 }}>
              Closing and installing update...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ERROR — with retry */}
        {status === STATES.ERROR && (
          <>
            <p style={{
              fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)',
              lineHeight: 1.6, margin: '0 0 12px 0',
            }}>
              {error}
            </p>
            <button
              onClick={handleRetry}
              style={{
                width: '100%', padding: '10px 0', border: 'none', borderRadius: 8,
                background: 'var(--bg-elevated, #283548)', color: 'var(--text-primary, #f1f5f9)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 150ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <i className="fa-solid fa-rotate" />
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
