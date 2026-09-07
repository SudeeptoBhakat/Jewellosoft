import { useState, useEffect } from 'react';
import ThemeSwitcher from './components/ThemeSwitcher';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import MarqueeStrip from './components/MarqueeStrip';
import About from './components/About';
import Features from './components/Features';
import Why from './components/Why';
import HowItWorks from './components/HowItWorks';
import Security from './components/Security';
import FAQ from './components/FAQ';
import CTA from './components/CTA';
import Feedback from './components/Feedback';
import Footer from './components/Footer';
import DownloadModal from './components/DownloadModal';

export default function App() {
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState({
    version: 'v1.1.1',
    size: '~118 MB',
    downloadUrl: 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest',
    releasePage: 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest'
  });

  useEffect(() => {
    async function fetchRelease() {
      try {
        const res = await fetch('https://api.github.com/repos/SudeeptoBhakat/Jewellosoft/releases/latest', {
          headers: { Accept: 'application/vnd.github.v3+json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const version = data.tag_name || 'v1.1.1';
        const releasePage = data.html_url || 'https://github.com/SudeeptoBhakat/Jewellosoft/releases/latest';
        const exeAsset = data.assets?.find(
          (a) => a.name.endsWith('.exe') && !a.name.endsWith('.blockmap')
        );
        const downloadUrl = exeAsset ? exeAsset.browser_download_url : releasePage;
        const sizeBytes = exeAsset ? exeAsset.size : 0;
        const size = sizeBytes ? `~${(sizeBytes / (1024 * 1024)).toFixed(0)} MB` : '~118 MB';

        setReleaseInfo({ version, size, downloadUrl, releasePage });
      } catch {
        // Fallback already initialised
      }
    }

    fetchRelease();
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll(
      '.animate-fadein, .animate-fadein-delay, .animate-slide-left, .animate-slide-right'
    );

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    targets.forEach((el) => {
      el.style.opacity = '0';
      el.style.animationPlayState = 'paused';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '';
            entry.target.style.animationPlayState = 'running';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <ThemeSwitcher />
      <Navbar onOpenDownload={() => setDownloadModalOpen(true)} />
      <Hero onOpenDownload={() => setDownloadModalOpen(true)} releaseInfo={releaseInfo} />
      <MarqueeStrip />
      <About />
      <Features />
      <Why />
      <HowItWorks />
      <Security />
      <FAQ />
      <CTA onOpenDownload={() => setDownloadModalOpen(true)} releaseInfo={releaseInfo} />
      <Feedback />
      <Footer />
      <DownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        releaseInfo={releaseInfo}
      />
    </>
  );
}
