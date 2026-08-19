/* ═══════════════════════════════════════════════
   JEWELLOSOFT — script.js
═══════════════════════════════════════════════ */

/* ── DOM Ready ── */
document.addEventListener('DOMContentLoaded', () => {
  initThemeSwitcher();
  initNavbarScroll();
  initScrollAnimations();
  initSmoothScroll();
  initMacWaitlist();
  fetchGitHubRelease();
  initFeedbackForm();
});

/* ─────────────────────────────────────────────
   THEME SWITCHER
───────────────────────────────────────────── */
function initThemeSwitcher() {
  const body      = document.body;
  const swatches  = document.querySelectorAll('.swatch');
  const STORAGE_KEY = 'jwsoft_theme';

  // Restore saved theme
  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'theme-dark';
  applyTheme(savedTheme);

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const theme = swatch.getAttribute('data-theme');
      applyTheme(theme);
      localStorage.setItem(STORAGE_KEY, theme);

      // Click scale animation
      swatch.style.transform = 'scale(0.85)';
      setTimeout(() => { swatch.style.transform = ''; }, 200);
    });
  });

  function applyTheme(theme) {
    // Remove all theme classes
    body.classList.remove('theme-dark', 'theme-green', 'theme-light');
    body.classList.add(theme);

    // Update active swatch
    swatches.forEach(s => s.classList.remove('active'));
    const activeSwatch = document.querySelector(`.swatch[data-theme="${theme}"]`);
    if (activeSwatch) activeSwatch.classList.add('active');
  }
}

/* ─────────────────────────────────────────────
   NAVBAR SCROLL BEHAVIOUR
───────────────────────────────────────────── */
function initNavbarScroll() {
  const navbar = document.getElementById('mainNavbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
}

/* ─────────────────────────────────────────────
   SCROLL ANIMATIONS (Intersection Observer)
───────────────────────────────────────────── */
function initScrollAnimations() {
  const targets = document.querySelectorAll(
    '.animate-fadein, .animate-fadein-delay, .animate-slide-left, .animate-slide-right'
  );

  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    targets.forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
    return;
  }

  // Initially hide animated elements
  targets.forEach(el => {
    el.style.opacity = '0';
    el.style.animationPlayState = 'paused';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.opacity = '';
        el.style.animationPlayState = 'running';
        observer.unobserve(el);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  targets.forEach(el => observer.observe(el));
}

/* ─────────────────────────────────────────────
   SMOOTH SCROLL for anchor links
───────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      // Close mobile navbar if open
      const navbarCollapse = document.getElementById('navMenu');
      if (navbarCollapse && navbarCollapse.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
        if (bsCollapse) bsCollapse.hide();
      }

      const navbarHeight = document.getElementById('mainNavbar')?.offsetHeight || 80;
      const top = target.getBoundingClientRect().top + window.scrollY - navbarHeight - 16;

      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ─────────────────────────────────────────────
   DOWNLOAD MODAL
───────────────────────────────────────────── */
function openDownloadModal() {
  const modalEl = document.getElementById('downloadModal');
  if (!modalEl) return;

  // Ensure Bootstrap modal is properly instantiated
  let modal = bootstrap.Modal.getInstance(modalEl);
  if (!modal) {
    modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
  }
  modal.show();
}

/* ─────────────────────────────────────────────
   GITHUB RELEASE — Dynamic version/size/link
───────────────────────────────────────────── */
async function fetchGitHubRelease() {
  const API_URL = 'https://api.github.com/repos/SudeeptoBhakat/Jewellosoft/releases/latest';
  const FALLBACK = {
    version:     'v1.1.1',
    size:        '~118 MB',
    downloadUrl: 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest',
    releasePage: 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest'
  };

  try {
    const res = await fetch(API_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);

    const data = await res.json();
    const version      = data.tag_name || FALLBACK.version;
    const releasePage  = data.html_url || FALLBACK.releasePage;

    // Find the .exe asset (not blockmap, not yml)
    const exeAsset = data.assets.find(a =>
      a.name.endsWith('.exe') && !a.name.endsWith('.blockmap')
    );

    const downloadUrl = exeAsset ? exeAsset.browser_download_url : FALLBACK.downloadUrl;
    const sizeBytes   = exeAsset ? exeAsset.size : 0;
    const sizeMB      = sizeBytes
      ? `~${(sizeBytes / (1024 * 1024)).toFixed(0)} MB`
      : FALLBACK.size;

    updateDownloadUI(version, sizeMB, downloadUrl, releasePage);
  } catch (err) {
    console.warn('GitHub release fetch failed, using fallback values:', err);
    updateDownloadUI(
      FALLBACK.version, FALLBACK.size,
      FALLBACK.downloadUrl, FALLBACK.releasePage
    );
  }
}

function updateDownloadUI(version, size, downloadUrl, releasePage) {
  // Modal — version badge
  const vBadge = document.getElementById('dlVersionBadge');
  if (vBadge) vBadge.textContent = `${version} — Latest Stable`;

  // Modal — size label
  const vSize = document.getElementById('dlVersionSize');
  if (vSize) vSize.textContent = `${size}  ·  Windows 10/11`;

  // Modal — primary download button
  const winBtn = document.getElementById('winDownloadBtn');
  if (winBtn) {
    winBtn.href = downloadUrl;
    const sub = winBtn.querySelector('#dlBtnSub');
    if (sub) sub.textContent = `.exe installer  ·  ${size}`;
  }

  // Modal — release page button
  const releaseBtn = document.getElementById('releasePageBtn');
  if (releaseBtn) releaseBtn.href = releasePage;

  // CTA section note
  const ctaNote = document.getElementById('ctaVersionNote');
  if (ctaNote) ctaNote.textContent = `Windows 10 / 11  ·  ${version}  ·  ${size}`;

  // Hero section note
  const heroNote = document.getElementById('heroVersionNote');
  if (heroNote) heroNote.textContent = `Windows 10 / 11  ·  No internet required  ·  ${version}`;
}

/* ─────────────────────────────────────────────
   DOWNLOAD TRIGGER (Windows button)
   — visual feedback on click
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const winBtn = document.getElementById('winDownloadBtn');
  if (winBtn) {
    winBtn.addEventListener('click', () => {
      const titleEl = winBtn.querySelector('.dl-btn-title');
      if (!titleEl) return;
      const originalText = titleEl.textContent;
      titleEl.textContent = 'Starting download…';
      setTimeout(() => { titleEl.textContent = originalText; }, 2500);
    });
  }
});

/* ─────────────────────────────────────────────
   MAC WAITLIST FORM
───────────────────────────────────────────── */
function initMacWaitlist() {
  const btn   = document.querySelector('.dl-email-btn');
  const input = document.querySelector('.dl-email-input');
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const email = input.value.trim();
    if (!email || !isValidEmail(email)) {
      input.style.borderColor = '#e05252';
      input.focus();
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      return;
    }

    // Simulate submit
    btn.textContent = '✓ Noted!';
    btn.style.background = 'linear-gradient(135deg, #4caf7a, #2e7d52)';
    input.value = '';
    input.placeholder = 'You\'re on the list!';

    setTimeout(() => {
      btn.textContent = 'Notify Me';
      btn.style.background = '';
      input.placeholder = 'Enter email for Mac release notification';
    }, 4000);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ─────────────────────────────────────────────
   FEEDBACK FORM
───────────────────────────────────────────── */
function initFeedbackForm() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('feedbackSubmitBtn');
    const originalHTML = btn.innerHTML;

    // Validate all fields
    const name    = form.querySelector('#feedbackName').value.trim();
    const email   = form.querySelector('#feedbackEmail').value.trim();
    const type    = form.querySelector('#feedbackType').value;
    const message = form.querySelector('#feedbackMessage').value.trim();

    if (!name || !email || !type || !message) {
      // Let browser validation handle it
      return;
    }

    if (!isValidEmail(email)) {
      form.querySelector('#feedbackEmail').style.borderColor = '#e05252';
      form.querySelector('#feedbackEmail').focus();
      setTimeout(() => { form.querySelector('#feedbackEmail').style.borderColor = ''; }, 2000);
      return;
    }

    // Show loading state
    btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Sending…';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
      // Try FormSubmit.co AJAX endpoint
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('feedback_type', type);
      formData.append('message', message);
      formData.append('_subject', `JewelloSoft Feedback — ${type}`);
      formData.append('_template', 'table');
      formData.append('_captcha', 'false');

      const response = await fetch('https://formsubmit.co/ajax/sudeeptabhakat03@gmail.com', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success === 'true' || data.success === true) {
        showFeedbackSuccess();
      } else {
        throw new Error('FormSubmit returned non-success');
      }
    } catch (err) {
      console.warn('FormSubmit failed, falling back to mailto:', err);
      // Fallback: open mailto
      const subject = encodeURIComponent(`JewelloSoft Feedback — ${type}`);
      const body    = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nFeedback Type: ${type}\n\n${message}`
      );
      window.location.href = `mailto:sudeeptabhakat03@gmail.com?subject=${subject}&body=${body}`;
      showFeedbackSuccess();
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      btn.style.opacity = '';
    }
  });
}

function showFeedbackSuccess() {
  const form    = document.getElementById('feedbackForm');
  const success = document.getElementById('feedbackSuccess');
  if (form) form.style.display = 'none';
  if (success) success.style.display = 'block';
}

function resetFeedbackForm() {
  const form    = document.getElementById('feedbackForm');
  const success = document.getElementById('feedbackSuccess');
  if (form) {
    form.reset();
    form.style.display = '';
  }
  if (success) success.style.display = 'none';
}

/* ─────────────────────────────────────────────
   ACTIVE NAV LINK on scroll
───────────────────────────────────────────── */
(function () {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const highlight = () => {
    const scrollY = window.scrollY + 120;
    sections.forEach(section => {
      const top    = section.offsetTop;
      const height = section.offsetHeight;
      const id     = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
        if (activeLink) activeLink.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', highlight, { passive: true });
})();

/* ─────────────────────────────────────────────
   PRICING CARD HOVER — subtle glow ripple
───────────────────────────────────────────── */
document.querySelectorAll('.pricing-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
    card.style.background = `radial-gradient(ellipse at ${x}% ${y}%, var(--gold-dim) 0%, var(--bg-card) 70%)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.background = '';
  });
});

/* ─────────────────────────────────────────────
   FEATURE / FEEDBACK CARD HOVER — radial glow
───────────────────────────────────────────── */
document.querySelectorAll('.mini-feature-card, .why-card, .aig-card, .feedback-contact-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
    card.style.background = `radial-gradient(ellipse at ${x}% ${y}%, var(--gold-dim) 0%, var(--bg-card) 65%)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.background = '';
  });
});