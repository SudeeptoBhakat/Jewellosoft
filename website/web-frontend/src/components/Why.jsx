export default function Why() {
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
    <section className="section-why alt-bg" id="why">
      <div className="container">
        <div className="text-center mb-section">
          <div className="section-eyebrow">Why JewelloSoft</div>
          <h2 className="section-title">The Difference Is in the Details</h2>
          <div className="gold-line-center"></div>
        </div>

        <div className="row g-4 justify-content-center">
          <div className="col-sm-6 col-lg-4">
            <div className="why-card animate-fadein" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="why-icon"><i className="bi bi-gem"></i></div>
              <h4>Built for Jewellery</h4>
              <p>Every feature — weight pricing, making charges, purity categories — speaks the language of your trade.</p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="why-card animate-fadein" style={{ animationDelay: '.1s' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="why-icon"><i className="bi bi-wifi-off"></i></div>
              <h4>Works Offline</h4>
              <p>No dependency on internet connectivity. Your shop keeps running even when the network doesn't.</p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="why-card animate-fadein" style={{ animationDelay: '.2s' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="why-icon"><i className="bi bi-shield-check"></i></div>
              <h4>Completely Secure</h4>
              <p>Your data never leaves your computer. No cloud leaks, no third-party access, no privacy risk.</p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="why-card animate-fadein" style={{ animationDelay: '.3s' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="why-icon"><i className="bi bi-stars"></i></div>
              <h4>Genuinely Simple</h4>
              <p>Designed for shopkeepers — not accountants or IT professionals. Anyone can learn it in one day.</p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="why-card animate-fadein" style={{ animationDelay: '.4s' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="why-icon"><i className="bi bi-sliders2"></i></div>
              <h4>Zero Complexity</h4>
              <p>No confusing menus, no hidden settings. Everything is where you expect it to be.</p>
            </div>
          </div>
          <div className="col-sm-6 col-lg-4">
            <div className="why-card animate-fadein" style={{ animationDelay: '.5s' }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              <div className="why-icon"><i className="bi bi-telephone-fill"></i></div>
              <h4>Real Support</h4>
              <p>Dedicated support from people who understand jewellery businesses — not generic chat bots.</p>
            </div>
          </div>
        </div>

        <div className="why-highlight text-center mt-5 animate-fadein">
          <span>"JewelloSoft adapts to your business — not the other way around."</span>
        </div>
      </div>
    </section>
  );
}
