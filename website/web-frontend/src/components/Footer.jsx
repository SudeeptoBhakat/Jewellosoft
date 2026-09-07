export default function Footer() {
  const handleAnchorClick = (e, targetId) => {
    e.preventDefault();
    const element = document.querySelector(targetId);
    if (!element) return;
    const navbarHeight = document.getElementById('mainNavbar')?.offsetHeight || 80;
    const top = element.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="row gy-4 align-items-start">
          <div className="col-lg-4">
            <div className="footer-brand">
              <img src="/logo.png" alt="JewelloSoft" style={{ width: '32px', height: 'auto' }} />
              <span className="brand-name">JewelloSoft</span>
            </div>
            <p className="footer-tagline">Craft Your Bills. Upgrade Your Business.</p>
            <p className="footer-sub">
              Designed to operate with precision where the real work happens, we provide the flexibility and absolute control necessary to manage your shop with confidence—anywhere, anytime.
            </p>
          </div>

          <div className="col-sm-6 col-lg-2 offset-lg-2">
            <h6 className="footer-heading">Product</h6>
            <ul className="footer-links">
              <li><a href="#features" onClick={(e) => handleAnchorClick(e, '#features')}>Features</a></li>
              <li><a href="#how-it-works" onClick={(e) => handleAnchorClick(e, '#how-it-works')}>How It Works</a></li>
              <li><a href="#security" onClick={(e) => handleAnchorClick(e, '#security')}>Security</a></li>
              <li><a href="#faq" onClick={(e) => handleAnchorClick(e, '#faq')}>FAQ</a></li>
              <li><a href="#feedback" onClick={(e) => handleAnchorClick(e, '#feedback')}>Feedback</a></li>
            </ul>
          </div>

          <div className="col-sm-6 col-lg-2">
            <h6 className="footer-heading">Legal</h6>
            <ul className="footer-links">
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms &amp; Conditions</a></li>
              <li><a href="#">Refund Policy</a></li>
            </ul>
          </div>

          <div className="col-lg-2">
            <h6 className="footer-heading">Contact</h6>
            <ul className="footer-links">
              <li><a href="mailto:sudeeptabhakat03@gmail.com">sudeeptabhakat03@gmail.com</a></li>
              <li><a href="tel:+919733248165">+91 97332 48165</a></li>
            </ul>
            <div className="footer-socials mt-3">
              <a href="#" aria-label="X"><i className="bi bi-twitter-x"></i></a>
              <a href="#" aria-label="Instagram"><i className="bi bi-instagram"></i></a>
              <a href="#" aria-label="LinkedIn"><i className="bi bi-linkedin"></i></a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="gold-divider mb-4"></div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <p className="mb-0 footer-copy">© 2025 GetJewelloSoft.com — All rights reserved.</p>
            <p className="mb-0 footer-copy">
              Made with <i className="bi bi-heart-fill text-gold"></i> for India's jewellers.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
