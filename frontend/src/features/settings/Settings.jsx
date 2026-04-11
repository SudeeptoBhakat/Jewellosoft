import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, THEMES } from '../../contexts/ThemeContext';

/* ─── Theme Card Mini-Preview ─────────────────────────────────── */
const themeCardStyle = (preview, isActive) => ({
  position: 'relative',
  flex: '1 1 220px',
  maxWidth: 300,
  borderRadius: 'var(--radius-lg)',
  border: isActive
    ? '2px solid var(--color-primary)'
    : '2px solid var(--border-primary)',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'all 0.25s ease',
  boxShadow: isActive ? '0 0 0 3px var(--color-primary-muted)' : 'var(--shadow-sm)',
  transform: isActive ? 'scale(1.02)' : 'scale(1)',
});

const previewWindowStyle = (preview) => ({
  display: 'flex',
  height: 100,
  background: preview.bg,
  borderBottom: `1px solid ${preview.accent}22`,
});

const previewSidebarStyle = (preview) => ({
  width: 50,
  background: preview.sidebar,
  borderRight: `1px solid ${preview.accent}22`,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

const previewBarStyle = (preview, w) => ({
  height: 5,
  width: w,
  borderRadius: 3,
  background: preview.accent,
  opacity: 0.5,
});

const previewContentStyle = (preview) => ({
  flex: 1,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});

const previewCardStyle = (preview) => ({
  background: preview.card,
  borderRadius: 4,
  height: 26,
  border: `1px solid ${preview.accent}18`,
});

const previewTextStyle = (preview, w) => ({
  height: 4,
  width: w,
  borderRadius: 2,
  background: preview.text,
  opacity: 0.25,
});

function ThemeCard({ themeDef, isActive, onClick }) {
  const { preview } = themeDef;
  return (
    <div
      id={`theme-card-${themeDef.key}`}
      style={themeCardStyle(preview, isActive)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {/* Mini Window Preview */}
      <div style={previewWindowStyle(preview)}>
        <div style={previewSidebarStyle(preview)}>
          <div style={previewBarStyle(preview, '100%')} />
          <div style={previewBarStyle(preview, '70%')} />
          <div style={previewBarStyle(preview, '85%')} />
          <div style={previewBarStyle(preview, '60%')} />
        </div>
        <div style={previewContentStyle(preview)}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ ...previewCardStyle(preview), flex: 1 }} />
            <div style={{ ...previewCardStyle(preview), flex: 1 }} />
          </div>
          <div style={{ ...previewCardStyle(preview), flex: 1 }} />
          <div style={{ display: 'flex', gap: 4, marginTop: 'auto' }}>
            <div style={previewTextStyle(preview, 30)} />
            <div style={previewTextStyle(preview, 50)} />
          </div>
        </div>
      </div>

      {/* Label Area */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-md)',
          background: isActive ? 'var(--color-primary-muted)' : 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)',
          fontSize: 'var(--text-md)',
          flexShrink: 0,
        }}>
          <i className={themeDef.icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
          }}>
            {themeDef.label}
          </div>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {themeDef.description}
          </div>
        </div>

        {isActive && (
          <div style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i className="fa-solid fa-check" style={{ fontSize: 10, color: 'white' }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Settings Component ──────────────────────────────────────── */
export default function Settings() {
  const { syncShop } = useAuth();
  const { theme: activeTheme, setTheme } = useTheme();
  const [tab, setTab] = useState('General');
  const tabs = ['General', 'Business', 'Security'];

  const [formData, setFormData] = useState({
    theme: 'default',
    language: 'English',
    date_format: 'DD/MM/YYYY',
    default_gst_rate: 3,
    decimal_precision: 2,
    hallmark_value: 53,
    name: '',
    owner_name: '',
    phone: '',
    email: '',
    gst_number: '',
    address: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/accounts/shop/current/');
      const data = { ...res.data };

      // ── Migrate legacy theme values to new keys ──
      const legacyMap = {
        'System Default': 'default',
        'Dark Mode': 'dark',
        'Light Mode': 'light',
        'halloween': 'default',
      };
      if (data.theme && legacyMap[data.theme]) {
        data.theme = legacyMap[data.theme];
      }
      // Ensure we only use known keys
      if (!THEMES.some((t) => t.key === data.theme)) {
        data.theme = 'default';
      }

      setFormData(prev => ({ ...prev, ...data }));

      // Sync theme from backend → context so it takes effect immediately
      setTheme(data.theme);

      // Update local storage for hallmark if changed via API
      if (res.data.hallmark_value) {
        localStorage.setItem('jewellosoft_hallmark_value', res.data.hallmark_value);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    // Map IDs to JSON keys
    const fieldMap = {
      'settings-language': 'language',
      'settings-dateformat': 'date_format',
      'settings-gst': 'default_gst_rate',
      'settings-decimal': 'decimal_precision',
      'settings-hallmark-value': 'hallmark_value',
      'settings-shop-name': 'name',
      'settings-owner': 'owner_name',
      'settings-phone': 'phone',
      'settings-email': 'email',
      'settings-gst-number': 'gst_number',
      'settings-address': 'address'
    };
    
    const key = fieldMap[id] || id;
    setFormData(prev => ({ ...prev, [key]: value }));

    if (key === 'hallmark_value') {
      try { localStorage.setItem('jewellosoft_hallmark_value', value); } catch {}
    }
  };

  /** Called when clicking a theme card — live-previews immediately */
  const handleThemeSelect = (themeKey) => {
    setFormData(prev => ({ ...prev, theme: themeKey }));
    setTheme(themeKey); // live apply
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      // ── Senior Engineer Hardening Strategy ──
      // 1. Ensure numeric fields are actually numbers and not NaN
      // 2. Trim string fields and provide fallbacks for mandatory ones
      // 3. Remove fields that shouldn't be patched directly if they are read-only
      
      const sanitizedData = {
        ...formData,
        default_gst_rate: parseFloat(formData.default_gst_rate) || 0,
        decimal_precision: parseInt(formData.decimal_precision) || 2,
        hallmark_value: parseFloat(formData.hallmark_value) || 0,
        name: (formData.name || '').trim() || 'My Jewellery Shop',
        owner_name: (formData.owner_name || '').trim(),
        phone: (formData.phone || '').trim(),
        address: (formData.address || '').trim(),
        gst_number: (formData.gst_number || '').trim(),
        email: (formData.email || '').trim(),
      };

      // Remove read-only or sensitive keys that might be in formData from a previous GET
      delete sanitizedData.id;
      delete sanitizedData.supabase_email;
      delete sanitizedData.supabase_user_id;

      await api.patch('/accounts/shop/current/', sanitizedData);
      
      // Refresh global shop state so Navbar etc. pick up changes
      if (syncShop) await syncShop();
      
      setMessage({ text: 'Settings saved successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error('Save failed', err);
      const detail = err.response?.data?.detail || 'Failed to save settings. Please check all fields.';
      setMessage({ text: detail, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Settings...</div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Settings</h1>
          <div className="page-header__actions">
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              <i className="fa-solid fa-save"></i> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Configure your application preferences and business settings.</p>
        
        {message.text && (
          <div style={{ 
            marginTop: 12, 
            padding: '10px 14px', 
            borderRadius: 6, 
            backgroundColor: message.type === 'success' ? 'var(--color-accent-muted, #f0fdf4)' : 'var(--color-danger-muted, #fef2f2)',
            color: message.type === 'success' ? 'var(--color-accent, #166534)' : 'var(--color-danger, #991b1b)',
            border: `1px solid ${message.type === 'success' ? 'var(--color-accent, #bbf7d0)' : 'var(--color-danger, #fecaca)'}`,
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
          }}>
            <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} style={{ marginRight: 8 }} />
            {message.text}
          </div>
        )}
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tabs__tab${tab === t ? ' tabs__tab--active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {tab === 'General' && (
        <div className="animate-fade-in-up">
          {/* ── Theme Picker ──────────────────────────────── */}
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title">
                <i className="fa-solid fa-palette" style={{ marginRight: 8, opacity: 0.6 }}></i>Theme
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
                Changes apply instantly — click Save to persist
              </span>
            </div>
            <div className="billing-form__body">
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
              }}>
                {THEMES.map((t) => (
                  <ThemeCard
                    key={t.key}
                    themeDef={t}
                    isActive={formData.theme === t.key}
                    onClick={() => handleThemeSelect(t.key)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Appearance ────────────────────────────────── */}
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-globe" style={{ marginRight: 8, opacity: 0.6 }}></i>Regional</span>
            </div>
            <div className="billing-form__body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <select className="form-input form-select" id="settings-language" value={formData.language} onChange={handleChange}>
                    <option value="English">English</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Gujarati">Gujarati</option>
                    <option value="Marathi">Marathi</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date Format</label>
                  <select className="form-input form-select" id="settings-dateformat" value={formData.date_format} onChange={handleChange}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Preferences ───────────────────────────────── */}
          <div className="billing-form">
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-sliders" style={{ marginRight: 8, opacity: 0.6 }}></i>Preferences</span>
            </div>
            <div className="billing-form__body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Default GST Rate (%)</label>
                  <input className="form-input" type="number" step="0.01" id="settings-gst" value={formData.default_gst_rate} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Decimal Precision</label>
                  <select className="form-input form-select" id="settings-decimal" value={formData.decimal_precision} onChange={handleChange}>
                    <option value={2}>2 decimal places</option>
                    <option value={3}>3 decimal places</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hallmark Value (₹ per item)</label>
                  <input className="form-input" type="number" step="0.01" id="settings-hallmark-value" value={formData.hallmark_value} onChange={handleChange} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Used in billing: Hallmark Count × ₹{formData.hallmark_value || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Settings */}
      {tab === 'Business' && (
        <div className="animate-fade-in-up">
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-building" style={{ marginRight: 8, opacity: 0.6 }}></i>Business Information</span>
            </div>
            <div className="billing-form__body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Shop Name *</label>
                  <input className="form-input" type="text" id="settings-shop-name" value={formData.name} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input className="form-input" type="text" id="settings-owner" value={formData.owner_name} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-input" type="text" id="settings-gst-number" value={formData.gst_number} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" id="settings-phone" value={formData.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" id="settings-email" value={formData.email} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" type="text" id="settings-address" value={formData.address} onChange={handleChange} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'Security' && (
        <div className="animate-fade-in-up">
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-lock" style={{ marginRight: 8, opacity: 0.6 }}></i>Change Password</span>
            </div>
            <div className="billing-form__body">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Please use the Supabase hosted authentication portal to change your password securely.
              </p>
              <button className="btn btn--outline" disabled>Change Password via Portal</button>
            </div>
          </div>

          <div className="billing-form">
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-database" style={{ marginRight: 8, opacity: 0.6 }}></i>Data & Backup</span>
            </div>
            <div className="billing-form__body">
              <div className="flex gap-3">
                <button className="btn btn--ghost" onClick={async () => {
                  if (window.electronAPI) {
                    const res = await window.electronAPI.backupDB();
                    if (res.success) alert(`Backup saved successfully to: ${res.path}`);
                    else if (res.reason !== 'canceled') alert(`Backup failed: ${res.error}`);
                  } else {
                    alert('Offline backups are only supported in the Desktop app.');
                  }
                }}>
                  <i className="fa-solid fa-download"></i> Export All Data
                </button>
                <button className="btn btn--danger" style={{ marginLeft: 'auto' }}><i className="fa-solid fa-trash-can"></i> Reset Data</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
