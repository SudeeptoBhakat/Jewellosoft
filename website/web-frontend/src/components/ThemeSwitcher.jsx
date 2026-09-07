import { useState, useEffect } from 'react';

const themes = [
  { id: 'theme-dark', title: 'Black + Gold', label: 'Black + Gold', className: 'swatch-dark' },
  { id: 'theme-green', title: 'Deep Green + Gold', label: 'Deep Green + Gold', className: 'swatch-green' },
  { id: 'theme-light', title: 'Cream + Gold', label: 'Cream + Gold', className: 'swatch-light' }
];

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('jwsoft_theme') || 'theme-dark';
  });

  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-green', 'theme-light');
    document.body.classList.add(currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('jwsoft_theme', currentTheme);
  }, [currentTheme]);

  return (
    <div className="theme-switcher" id="themeSwitcher">
      <span className="theme-label">Theme</span>
      <div className="theme-swatches">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`swatch ${t.className} ${currentTheme === t.id ? 'active' : ''}`}
            data-theme={t.id}
            title={t.title}
            onClick={() => setCurrentTheme(t.id)}
          >
            <span className="swatch-inner"></span>
            <span className="swatch-tip">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
