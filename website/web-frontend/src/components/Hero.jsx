export default function Hero({ onOpenDownload, releaseInfo }) {
  const scrollToFeatures = (e) => {
    e.preventDefault();
    const element = document.querySelector('#features');
    if (!element) return;
    const navbarHeight = document.getElementById('mainNavbar')?.offsetHeight || 80;
    const top = element.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <section className="hero-section" id="hero">
      <div className="hero-bg-pattern"></div>
      <div className="container">
        <div className="row align-items-center min-vh-100">
          <div className="col-lg-6 hero-left animate-fadein">
            <h1 className="hero-title">
              Your Shop.<br />
              <em>Your Rules.</em><br />
              Your Billing.
            </h1>
            <p className="hero-sub">
              JewelloSoft is a modern, <strong>offline-first</strong> jewellery billing &amp; inventory management software — From meticulous inventory tracking to seamless billing, get the professional-grade tools you need to run your shop by your own rules..
            </p>
            <ul className="hero-checks">
              <li><i className="bi bi-check-circle-fill"></i> Works 100% Offline</li>
              <li><i className="bi bi-check-circle-fill"></i> Fully Customizable Billing</li>
              <li><i className="bi bi-check-circle-fill"></i> Built for Jewellery Shops — Not Generic Businesses</li>
            </ul>
            <div className="hero-actions">
              <button className="btn btn-gold btn-lg" onClick={onOpenDownload}>
                <i className="bi bi-download me-2"></i>Download Now — Free
              </button>
              <a href="#features" onClick={scrollToFeatures} className="btn btn-ghost btn-lg ms-3">
                View Features <i className="bi bi-arrow-down ms-1"></i>
              </a>
            </div>
            <p className="hero-note" id="heroVersionNote">
              Windows 10 / 11 &nbsp;·&nbsp; No internet required &nbsp;·&nbsp; {releaseInfo.version || 'Free forever plan'}
            </p>
          </div>

          <div className="col-lg-6 hero-right animate-fadein-delay">
            <div className="desktop-mockup">
              <div className="mockup-stand"></div>
              <div className="mockup-base"></div>
              <div className="mockup-screen">
                <div className="mockup-titlebar">
                  <span className="dot dot-red"></span>
                  <span className="dot dot-yellow"></span>
                  <span className="dot dot-green"></span>
                  <span className="titlebar-text">JewelloSoft — New Invoice</span>
                </div>
                <div className="mockup-body">
                  <div className="mockup-sidebar">
                    <div className="sidebar-logo">
                      <img src="/logo.png" alt="JewelloSoft" style={{ width: '50%' }} />
                    </div>
                    <ul className="sidebar-nav">
                      <li className="active"><i className="bi bi-receipt"></i></li>
                      <li><i className="bi bi-box-seam"></i></li>
                      <li><i className="bi bi-people"></i></li>
                      <li><i className="bi bi-bar-chart"></i></li>
                      <li><i className="bi bi-gear"></i></li>
                    </ul>
                  </div>

                  <div className="mockup-content">
                    <div className="invoice-header">
                      <div>
                        <div className="inv-shop">Sharma Gold House</div>
                        <div className="inv-sub">GST No: 27AABCS1429B1Z</div>
                      </div>
                      <div className="inv-badge">INVOICE #2847</div>
                    </div>
                    <div className="inv-customer">
                      <span className="inv-label">Customer</span>
                      <span className="inv-val">Priya Mehta</span>
                    </div>
                    <table className="inv-table">
                      <thead>
                        <tr><th>Item</th><th>Wt</th><th>Rate</th><th>Amt</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Gold Ring 22K</td><td>4.2g</td><td>₹6,200</td><td>₹26,040</td></tr>
                        <tr><td>Necklace 18K</td><td>12.5g</td><td>₹5,800</td><td>₹72,500</td></tr>
                        <tr><td>Making Charges</td><td>—</td><td>—</td><td>₹3,200</td></tr>
                      </tbody>
                    </table>
                    <div className="inv-footer">
                      <div className="inv-row"><span>Subtotal</span><span>₹1,01,740</span></div>
                      <div className="inv-row"><span>GST (3%)</span><span>₹3,052</span></div>
                      <div className="inv-row inv-total"><span>Total</span><span>₹1,04,792</span></div>
                      <button type="button" className="inv-btn" onClick={onOpenDownload}>
                        <i className="bi bi-printer me-1"></i>Print &amp; Save PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="gold-divider"></div>
    </section>
  );
}
