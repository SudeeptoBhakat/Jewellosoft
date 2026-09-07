import { useState } from 'react';

export default function DownloadModal({ isOpen, onClose, releaseInfo }) {
  const [downloading, setDownloading] = useState(false);
  const [macEmail, setMacEmail] = useState('');
  const [macNotified, setMacNotified] = useState(false);
  const [macError, setMacError] = useState(false);

  if (!isOpen) return null;

  const handleWindowsDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
    }, 2500);
  };

  const handleMacWaitlist = () => {
    const email = macEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMacError(true);
      setTimeout(() => setMacError(false), 2000);
      return;
    }

    setMacNotified(true);
    setMacEmail('');
    setTimeout(() => {
      setMacNotified(false);
    }, 4000);
  };

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div
        className="modal fade show d-block"
        id="downloadModal"
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content modal-premium">
            <div className="modal-header modal-premium-header">
              <div>
                <div className="modal-eyebrow">Ready to transform your business?</div>
                <h5 className="modal-title">Download JewelloSoft</h5>
              </div>
              <button
                type="button"
                className="btn-close btn-close-modal"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body modal-premium-body">
              <div className="dl-version-info">
                <span className="dl-version-badge" id="dlVersionBadge">
                  {releaseInfo.version || 'v1.1.1'} — Latest Stable
                </span>
                <span className="dl-size" id="dlVersionSize">
                  {releaseInfo.size || '~118 MB'} · Windows 10/11
                </span>
              </div>

              <a
                href={releaseInfo.downloadUrl || 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest'}
                target="_blank"
                rel="noopener noreferrer"
                className="dl-btn dl-btn-primary"
                id="winDownloadBtn"
                onClick={handleWindowsDownload}
              >
                <div className="dl-btn-icon"><i className="bi bi-windows"></i></div>
                <div className="dl-btn-text">
                  <span className="dl-btn-title">
                    {downloading ? 'Starting download…' : 'Download for Windows'}
                  </span>
                  <span className="dl-btn-sub" id="dlBtnSub">
                    .exe installer · {releaseInfo.size || '~118 MB'}
                  </span>
                </div>
                <i className="bi bi-download dl-btn-arrow"></i>
              </a>

              <a
                href={releaseInfo.releasePage || 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest'}
                target="_blank"
                rel="noopener noreferrer"
                className="dl-btn dl-btn-secondary"
                id="releasePageBtn"
              >
                <div className="dl-btn-icon"><i className="bi bi-github"></i></div>
                <div className="dl-btn-text">
                  <span className="dl-btn-title">View on GitHub</span>
                  <span className="dl-btn-sub">Release notes, changelog &amp; all assets</span>
                </div>
                <i className="bi bi-box-arrow-up-right dl-btn-arrow"></i>
              </a>

              <div className="dl-btn dl-btn-disabled">
                <div className="dl-btn-icon"><i className="bi bi-apple"></i></div>
                <div className="dl-btn-text">
                  <span className="dl-btn-title">Mac Version</span>
                  <span className="dl-btn-sub">Coming Soon — Join waitlist below</span>
                </div>
                <span className="dl-coming-soon">Soon</span>
              </div>

              <div className="dl-mac-waitlist">
                <input
                  type="email"
                  className="dl-email-input"
                  placeholder={macNotified ? "You're on the list!" : 'Enter email for Mac release notification'}
                  value={macEmail}
                  onChange={(e) => setMacEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMacWaitlist()}
                  style={{ borderColor: macError ? '#e05252' : '' }}
                />
                <button
                  type="button"
                  className="dl-email-btn"
                  onClick={handleMacWaitlist}
                  style={macNotified ? { background: 'linear-gradient(135deg, #4caf7a, #2e7d52)' } : {}}
                >
                  {macNotified ? '✓ Noted!' : 'Notify Me'}
                </button>
              </div>

              <p className="dl-disclaimer">Free forever plan included. No credit card required. Works fully offline.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
