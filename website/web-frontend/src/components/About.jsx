export default function About() {
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
    <section className="section-about alt-bg" id="about">
      <div className="container">
        <div className="row align-items-center gy-5">
          <div className="col-lg-5 animate-slide-left">
            <div className="about-icon-grid">
              <div className="aig-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <i className="bi bi-receipt-cutoff"></i>
                <span>Invoice Control</span>
              </div>
              <div className="aig-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <i className="bi bi-boxes"></i>
                <span>Inventory Control</span>
              </div>
              <div className="aig-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <i className="bi bi-graph-up-arrow"></i>
                <span>Business Control</span>
              </div>
              <div className="aig-card" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                <i className="bi bi-shield-lock"></i>
                <span>Secure &amp; Local</span>
              </div>
            </div>
          </div>
          <div className="col-lg-6 offset-lg-1 animate-slide-right">
            <div className="section-eyebrow">About JewelloSoft</div>
            <h2 className="section-title">
              Built for Jewellers,<br /><em>Not Generic Businesses</em>
            </h2>
            <p className="section-body">
              Running a jewellery business requires precision, flexibility, and trust that a generic billing tool simply cannot provide. You deal with weight-based pricing, making charges, wastage, hallmarking, GST on gold — complexities that off-the-shelf software ignores.
            </p>
            <p className="section-body">
              JewelloSoft was crafted from the ground up by studying how real jewellery shops operate. It gives you complete invoice control — customise every line, hide or show charges, add your logo, and export polished PDFs in seconds. Inventory control means real-time tracking by weight, purity, and category. And business control means reports, payment tracking, and customer ledgers that tell you exactly where your money is.
            </p>
            <div className="highlight-line">
              "JewelloSoft adapts to your business — not the other way around."
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
