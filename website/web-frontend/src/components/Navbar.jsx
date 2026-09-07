import { useState, useEffect } from 'react';

export default function Navbar({ onOpenDownload }) {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    setNavOpen(false);
    const element = document.querySelector(targetId);
    if (!element) return;
    const navbarHeight = document.getElementById('mainNavbar')?.offsetHeight || 80;
    const top = element.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <nav className={`navbar navbar-expand-lg fixed-top js-navbar ${scrolled ? 'scrolled' : ''}`} id="mainNavbar">
      <div className="container">
        <a className="navbar-brand brand-logo" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <img src="/logo.png" alt="JewelloSoft" style={{ width: '32px', height: 'auto' }} />
          <span className="brand-name">JewelloSoft</span>
        </a>

        <button
          className="navbar-toggler"
          type="button"
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
          onClick={() => setNavOpen(!navOpen)}
        >
          <i className="bi bi-list text-gold fs-4"></i>
        </button>

        <div className={`collapse navbar-collapse ${navOpen ? 'show' : ''}`} id="navMenu">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
            <li className="nav-item">
              <a className="nav-link" href="#features" onClick={(e) => handleNavClick(e, '#features')}>
                Features
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#how-it-works" onClick={(e) => handleNavClick(e, '#how-it-works')}>
                How It Works
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#security" onClick={(e) => handleNavClick(e, '#security')}>
                Security
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#faq" onClick={(e) => handleNavClick(e, '#faq')}>
                FAQ
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#feedback" onClick={(e) => handleNavClick(e, '#feedback')}>
                Feedback
              </a>
            </li>
            <li className="nav-item ms-lg-3">
              <button
                type="button"
                className="btn btn-gold-outline btn-sm"
                onClick={() => {
                  setNavOpen(false);
                  onOpenDownload();
                }}
              >
                Download Free
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
