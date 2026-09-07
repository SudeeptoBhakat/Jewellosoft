export default function CTA({ onOpenDownload, releaseInfo }) {
  return (
    <section className="section-cta" id="cta">
      <div className="cta-bg-pattern"></div>
      <div className="container text-center">
        <div className="section-eyebrow animate-fadein">Start Today — Free</div>
        <h2 className="cta-title animate-fadein">
          Download JewelloSoft &amp; Start Managing<br />
          <em>Your Jewellery Business Today</em>
        </h2>
        <p className="cta-sub animate-fadein">
          No credit card. No internet. No complexity. Just powerful billing built for jewellers.
        </p>
        <button className="btn btn-gold btn-lg btn-cta-main animate-fadein" onClick={onOpenDownload}>
          <i className="bi bi-download me-2"></i>Download JewelloSoft Free
        </button>
        <p className="cta-note animate-fadein" id="ctaVersionNote">
          Windows 10 / 11 &nbsp;·&nbsp; {releaseInfo.version || 'v1.1.1'} &nbsp;·&nbsp; {releaseInfo.size || '~118 MB'}
        </p>
      </div>
    </section>
  );
}
