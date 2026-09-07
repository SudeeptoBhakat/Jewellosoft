export default function Features() {
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
    const y = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
    e.currentTarget.style.background = `radial-gradient(ellipse at ${x}% ${y}%, var(--gold-dim) 0%, var(--bg-card) 65%)`;
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.background = '';
  };

  return (
    <section className="section-features" id="features">
      <div className="container">
        <div className="text-center mb-section">
          <div className="section-eyebrow">Core Features</div>
          <h2 className="section-title">Everything a Jeweller Needs</h2>
          <div className="gold-line-center"></div>
        </div>

        <div className="feature-row row align-items-center gy-5 mb-feature">
          <div className="col-lg-5 animate-slide-left">
            <div className="feature-visual fv-billing">
              <i className="bi bi-receipt-cutoff fv-icon"></i>
              <div className="fv-lines">
                <div className="fvl long"></div>
                <div className="fvl mid"></div>
                <div className="fvl short"></div>
                <div className="fvl long"></div>
                <div className="fvl mid gold"></div>
              </div>
            </div>
          </div>
          <div className="col-lg-6 offset-lg-1 animate-slide-right">
            <div className="feature-number">01</div>
            <h3 className="feature-title">Smart Billing System</h3>
            <p className="feature-desc">
              Create professional invoices tailored to jewellery — with GST, making charges, wastage, stone charges, and hallmarking fees. Show or hide any line item per customer, per invoice. Auto-calculation means zero manual errors.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Custom invoice templates</li>
              <li><i className="bi bi-check2"></i> GST, making charges &amp; wastage auto-calc</li>
              <li><i className="bi bi-check2"></i> Hide/show charge fields per bill</li>
              <li><i className="bi bi-check2"></i> Instant PDF &amp; print export</li>
            </ul>
          </div>
        </div>

        <div className="feature-row row align-items-center gy-5 mb-feature flex-lg-row-reverse">
          <div className="col-lg-5 animate-slide-right">
            <div className="feature-visual fv-inventory">
              <i className="bi bi-boxes fv-icon"></i>
              <div className="fv-chips">
                <span className="chip">22K Gold</span>
                <span className="chip">18K Gold</span>
                <span className="chip gold-chip">Diamonds</span>
                <span className="chip">Silver</span>
                <span className="chip">Platinum</span>
              </div>
            </div>
          </div>
          <div className="col-lg-6 offset-lg-1 animate-slide-left">
            <div className="feature-number">02</div>
            <h3 className="feature-title">Inventory Management</h3>
            <p className="feature-desc">
              Track every piece by weight, purity, category, and location. Know exactly what's in your vault, what's sold, and what needs replenishment — all in real time.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Real-time stock tracking</li>
              <li><i className="bi bi-check2"></i> Weight-based item management</li>
              <li><i className="bi bi-check2"></i> Category &amp; purity filters</li>
              <li><i className="bi bi-check2"></i> Low-stock alerts</li>
            </ul>
          </div>
        </div>

        <div className="feature-row row align-items-center gy-5 mb-feature">
          <div className="col-lg-5 animate-slide-left">
            <div className="feature-visual fv-offline">
              <i className="bi bi-wifi-off fv-icon"></i>
              <div className="fv-offline-badge">OFFLINE<br />READY</div>
            </div>
          </div>
          <div className="col-lg-6 offset-lg-1 animate-slide-right">
            <div className="feature-number">03</div>
            <h3 className="feature-title">Offline-First System</h3>
            <p className="feature-desc">
              No internet? No problem. JewelloSoft stores all your data locally on your machine. Power cuts, slow networks, rural areas — nothing stops your billing.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> 100% offline operation</li>
              <li><i className="bi bi-check2"></i> Secure local database</li>
              <li><i className="bi bi-check2"></i> No monthly cloud fees</li>
              <li><i className="bi bi-check2"></i> Optional backup export</li>
            </ul>
          </div>
        </div>

        <div className="feature-row row align-items-center gy-5 mb-feature flex-lg-row-reverse">
          <div className="col-lg-5 animate-slide-right">
            <div className="feature-visual fv-invoice">
              <i className="bi bi-file-earmark-richtext fv-icon"></i>
              <div className="fv-pdf-preview">
                <div className="pdf-line bold"></div>
                <div className="pdf-line short"></div>
                <div className="pdf-line long"></div>
                <div className="pdf-line mid"></div>
                <div className="pdf-badge">PDF</div>
              </div>
            </div>
          </div>
          <div className="col-lg-6 offset-lg-1 animate-slide-left">
            <div className="feature-number">04</div>
            <h3 className="feature-title">Invoice Customization</h3>
            <p className="feature-desc">
              Your invoice should look like <em>your</em> shop, not a generic template. Add your logo, choose layouts, set your own terms, and produce stunning PDFs customers will trust.
            </p>
            <ul className="feature-list">
              <li><i className="bi bi-check2"></i> Upload shop logo &amp; branding</li>
              <li><i className="bi bi-check2"></i> Multiple invoice layouts</li>
              <li><i className="bi bi-check2"></i> One-click PDF export</li>
              <li><i className="bi bi-check2"></i> Print directly from software</li>
            </ul>
          </div>
        </div>

        <div className="row g-4 mt-4">
          <div className="col-md-4 animate-fadein">
            <div className="mini-feature-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <i className="bi bi-people-fill mfc-icon"></i>
              <h4>Customer Management</h4>
              <p>Maintain customer profiles, purchase history, and outstanding balances in one place.</p>
            </div>
          </div>
          <div className="col-md-4 animate-fadein" style={{ animationDelay: '.15s' }}>
            <div className="mini-feature-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <i className="bi bi-cash-coin mfc-icon"></i>
              <h4>Payment Tracking</h4>
              <p>Record advance payments, partial settlements, and dues. Never lose track of money owed.</p>
            </div>
          </div>
          <div className="col-md-4 animate-fadein" style={{ animationDelay: '.3s' }}>
            <div className="mini-feature-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <i className="bi bi-bar-chart-line-fill mfc-icon"></i>
              <h4>Reports &amp; Insights</h4>
              <p>Daily sales, monthly summaries, GST reports, and inventory valuations at a glance.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
