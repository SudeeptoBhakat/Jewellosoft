import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import { toast } from '../../utils/toast';
import { getSuggestions, addSuggestion, updateSuggestion, deleteSuggestion, resetToDefaults } from '../../utils/productSuggestions';
import ResetDataModal from './ResetDataModal';

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

export default function Settings() {
  const { syncShop } = useAuth();
  const { theme: activeTheme, setTheme } = useTheme();
  const [tab, setTab] = useState('General');
  const tabs = ['General', 'Business', 'Suggestions', 'Security'];

  const [formData, setFormData] = useState({
    theme: 'default',
    language: 'English',
    date_format: 'DD/MM/YYYY',
    default_gst_rate: 3,
    default_igst_rate: 3,
    decimal_precision: 2,
    hallmark_value: 53,
    name: '',
    owner_name: '',
    phone: '',
    email: '',
    gst_number: '',
    address: '',
    pan_number: '',
    pdf_template: 'classic',
    watermark_logo: null,
    require_full_payment_for_delivery: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [showResetModal, setShowResetModal] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [newSuggestionName, setNewSuggestionName] = useState('');
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    fetchSettings();
    setSuggestions(getSuggestions());
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/accounts/shop/current/');
      const data = { ...res.data };

      const legacyMap = {
        'System Default': 'default',
        'Dark Mode': 'dark',
        'Light Mode': 'light',
        'halloween': 'default',
      };
      if (data.theme && legacyMap[data.theme]) {
        data.theme = legacyMap[data.theme];
      }
      if (!THEMES.some((t) => t.key === data.theme)) {
        data.theme = 'default';
      }

      setFormData(prev => ({ ...prev, ...data }));

      setTheme(data.theme);

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

    const fieldMap = {
      'settings-language': 'language',
      'settings-dateformat': 'date_format',
      'settings-gst': 'default_gst_rate',
      'settings-igst': 'default_igst_rate',
      'settings-decimal': 'decimal_precision',
      'settings-hallmark-value': 'hallmark_value',
      'settings-shop-name': 'name',
      'settings-owner': 'owner_name',
      'settings-phone': 'phone',
      'settings-email': 'email',
      'settings-gst-number': 'gst_number',
      'settings-address': 'address',
      'settings-pan-number': 'pan_number',
      'settings-pdf-template': 'pdf_template'
    };
    
    const key = fieldMap[id] || id;
    setFormData(prev => ({ ...prev, [key]: value }));

    if (key === 'hallmark_value') {
      try { localStorage.setItem('jewellosoft_hallmark_value', value); } catch {}
    }
  };

  const handleThemeSelect = (themeKey) => {
    setFormData(prev => ({ ...prev, theme: themeKey }));
    setTheme(themeKey); // live apply
  };

  const handleWatermarkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('watermark_logo', file);
      const res = await api.post('/accounts/shop/watermark/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, watermark_logo: res.data.watermark_logo }));
      setMessage({ text: 'Watermark uploaded successfully!', type: 'success' });
      if (syncShop) await syncShop();
    } catch (err) {
      setMessage({ text: 'Failed to upload watermark.', type: 'error' });
    }
  };

  const handleWatermarkDelete = async () => {
    try {
        await api.delete('/accounts/shop/watermark/');
        setFormData(prev => ({ ...prev, watermark_logo: null }));
        setMessage({ text: 'Watermark deleted successfully!', type: 'success' });
        if (syncShop) await syncShop();
    } catch (err) {
        setMessage({ text: 'Failed to delete watermark.', type: 'error' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      
      const sanitizedData = {
        ...formData,
        default_gst_rate: parseFloat(formData.default_gst_rate) || 0,
        default_igst_rate: parseFloat(formData.default_igst_rate) || 0,
        decimal_precision: parseInt(formData.decimal_precision) || 2,
        hallmark_value: parseFloat(formData.hallmark_value) || 0,
        name: (formData.name || '').trim() || 'My Jewellery Shop',
        owner_name: (formData.owner_name || '').trim(),
        phone: (formData.phone || '').trim(),
        address: (formData.address || '').trim(),
        gst_number: (formData.gst_number || '').trim(),
        email: (formData.email || '').trim(),
        pan_number: (formData.pan_number || '').trim(),
        pdf_template: formData.pdf_template || 'classic',
      };

      delete sanitizedData.id;
      delete sanitizedData.supabase_email;
      delete sanitizedData.supabase_user_id;

      await api.patch('/accounts/shop/current/', sanitizedData);
      
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
                  <label className="form-label">Default IGST Rate (%)</label>
                  <input className="form-input" type="number" step="0.01" id="settings-igst" value={formData.default_igst_rate} onChange={handleChange} />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Applicable only for Interstate Billing / Orders
                </span>
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
                <div className="form-group">
                  <label className="form-label">PAN Number</label>
                  <input className="form-input" type="text" id="settings-pan-number" value={formData.pan_number} onChange={handleChange} style={{ textTransform: 'uppercase' }} />
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

          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-file-pdf" style={{ marginRight: 8, opacity: 0.6 }}></i>PDF & Branding</span>
            </div>
            <div className="billing-form__body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Billing PDF Template</label>
                  <select className="form-input form-select" id="settings-pdf-template" value={formData.pdf_template} onChange={handleChange}>
                    <option value="classic">Classic (Original)</option>
                    <option value="standard">Standard (Minimal Professional)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Watermark Logo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {formData.watermark_logo ? (
                      <>
                        <img src={formData.watermark_logo} alt="Watermark" style={{ height: 40, width: 40, objectFit: 'contain', background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)' }} />
                        <button className="btn btn--danger btn--sm" onClick={handleWatermarkDelete}>Delete Watermark</button>
                      </>
                    ) : (
                      <>
                        <input type="file" id="watermark-upload" accept="image/*" style={{ display: 'none' }} onChange={handleWatermarkUpload} />
                        <label htmlFor="watermark-upload" className="btn btn--outline btn--sm" style={{ cursor: 'pointer' }}>
                            <i className="fa-solid fa-upload" style={{ marginRight: 6 }}></i> Upload Logo
                        </label>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    Transparent PNG recommended. This will appear as a background watermark on printed bills.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Order Management */}
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-cart-flatbed" style={{ marginRight: 8, opacity: 0.6 }}></i>Order Management</span>
            </div>
            <div className="billing-form__body">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)', padding: 'var(--space-3) 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 4 }}>
                    Block Delivery Without Full Payment
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    When enabled, orders cannot be marked as <strong>Delivered</strong> or <strong>Completed</strong> unless the customer's balance due is ₹0.00.
                  </div>
                </div>
                <button
                  id="settings-delivery-block-toggle"
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, require_full_payment_for_delivery: !prev.require_full_payment_for_delivery }))}
                  style={{
                    flexShrink: 0,
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    border: 'none',
                    cursor: 'pointer',
                    background: formData.require_full_payment_for_delivery ? 'var(--color-primary)' : 'var(--border-primary)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    padding: 0,
                  }}
                  aria-label="Toggle delivery block"
                  aria-checked={formData.require_full_payment_for_delivery}
                  role="switch"
                >
                  <span style={{
                    position: 'absolute',
                    top: 3,
                    left: formData.require_full_payment_for_delivery ? 25 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s ease',
                    display: 'block',
                  }} />
                </button>
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
              <div className="flex gap-3" style={{ flexWrap: 'wrap', gap: 10 }}>
                <button className="btn btn--ghost" onClick={async () => {
                  if (window.electronAPI) {
                    const res = await window.electronAPI.backupDB();
                    if (res.success) toast.success(`Backup saved successfully to: ${res.path}`);
                    else if (res.reason !== 'canceled') toast.error(`Backup failed: ${res.error}`);
                  } else {
                    toast.warning('Offline backups are only supported in the Desktop app.');
                  }
                }}>
                  <i className="fa-solid fa-download"></i> Export All Data
                </button>
                <button className="btn btn--outline" onClick={async () => {
                  if (confirm("Are you sure you want to reset all bill and order numbering sequences to start from 001? This is typically done at the end of a commercial year. Subsequent bills/orders will restart from 1.")) {
                    try {
                      const res = await api.post('/accounts/shop/reset-numbering/');
                      toast.success(res.data.detail || 'Numbering sequences reset successfully!');
                    } catch (err) {
                      toast.error(err.response?.data?.detail || 'Failed to reset numbering sequences.');
                    }
                  }
                }}>
                  <i className="fa-solid fa-rotate-left"></i> Reset Bill Numbering
                </button>
                <button className="btn btn--danger" style={{ marginLeft: 'auto' }} onClick={() => setShowResetModal(true)}><i className="fa-solid fa-trash-can"></i> Reset Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Suggestions Tab ═══ */}
      {tab === 'Suggestions' && (
        <div className="animate-fade-in-up">
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title">
                <i className="fa-solid fa-lightbulb" style={{ marginRight: 8, opacity: 0.6 }}></i>
                Product Name Suggestions
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 400 }}>
                {suggestions.length} names in database
              </span>
            </div>
            <div className="billing-form__body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
                Manage the autocomplete suggestions shown when typing product names in Billing, Orders, and Inventory.
                Names you type will also be auto-recorded into this list.
              </p>

              {/* Add new suggestion */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Enter a new product name..."
                  value={newSuggestionName}
                  onChange={(e) => setNewSuggestionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSuggestionName.trim()) {
                      setSuggestions(addSuggestion(newSuggestionName));
                      setNewSuggestionName('');
                      toast.success(`Added "${newSuggestionName.trim()}"`);
                    }
                  }}
                  style={{ flex: 1 }}
                  id="settings-add-suggestion"
                />
                <button
                  className="btn btn--primary"
                  disabled={!newSuggestionName.trim()}
                  onClick={() => {
                    setSuggestions(addSuggestion(newSuggestionName));
                    toast.success(`Added "${newSuggestionName.trim()}"`);
                    setNewSuggestionName('');
                  }}
                >
                  <i className="fa-solid fa-plus" /> Add
                </button>
              </div>

              {/* Search + Reset */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }} />
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Search suggestions..."
                    value={suggestionSearch}
                    onChange={(e) => setSuggestionSearch(e.target.value)}
                    style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }}
                    id="settings-search-suggestions"
                  />
                </div>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    if (confirm('Reset all suggestions to the default list? This will remove any custom names you added.')) {
                      setSuggestions(resetToDefaults());
                      toast.info('Suggestions reset to defaults.');
                    }
                  }}
                  style={{ height: 36, whiteSpace: 'nowrap' }}
                >
                  <i className="fa-solid fa-rotate-right" /> Reset to Defaults
                </button>
              </div>

              {/* Suggestion List */}
              <div style={{
                maxHeight: 400,
                overflowY: 'auto',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
              }}>
                {(() => {
                  const q = suggestionSearch.toLowerCase();
                  const filtered = q ? suggestions.filter(s => s.toLowerCase().includes(q)) : suggestions;

                  if (filtered.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-search" style={{ fontSize: '1.2rem', opacity: 0.3, display: 'block', marginBottom: 8 }} />
                        {q ? 'No matching suggestions found.' : 'No suggestions yet. Add some above!'}
                      </div>
                    );
                  }

                  return filtered.map((name, idx) => {
                    const globalIdx = suggestions.indexOf(name);
                    const isEditing = editingIdx === globalIdx;

                    return (
                      <div
                        key={name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border-secondary)',
                          fontSize: 'var(--text-sm)',
                          transition: 'background 0.15s ease',
                          background: isEditing ? 'var(--color-primary-muted)' : 'transparent',
                        }}
                      >
                        {isEditing ? (
                          <>
                            <input
                              className="form-input"
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && editingValue.trim()) {
                                  setSuggestions(updateSuggestion(name, editingValue));
                                  setEditingIdx(-1);
                                  setEditingValue('');
                                  toast.success('Updated successfully.');
                                } else if (e.key === 'Escape') {
                                  setEditingIdx(-1);
                                  setEditingValue('');
                                }
                              }}
                              style={{ flex: 1, height: 30, fontSize: 'var(--text-sm)' }}
                              autoFocus
                            />
                            <button
                              className="btn btn--primary btn--sm btn--icon"
                              onClick={() => {
                                if (editingValue.trim()) {
                                  setSuggestions(updateSuggestion(name, editingValue));
                                  setEditingIdx(-1);
                                  setEditingValue('');
                                  toast.success('Updated successfully.');
                                }
                              }}
                              title="Save"
                            >
                              <i className="fa-solid fa-check" />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm btn--icon"
                              onClick={() => { setEditingIdx(-1); setEditingValue(''); }}
                              title="Cancel"
                            >
                              <i className="fa-solid fa-xmark" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{name}</span>
                            <button
                              className="btn btn--ghost btn--sm btn--icon"
                              onClick={() => { setEditingIdx(globalIdx); setEditingValue(name); }}
                              title="Edit"
                              style={{ opacity: 0.5 }}
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>
                            <button
                              className="btn btn--ghost btn--sm btn--icon"
                              onClick={() => {
                                setSuggestions(deleteSuggestion(name));
                                toast.info(`Removed "${name}"`);
                              }}
                              title="Delete"
                              style={{ opacity: 0.5, color: 'var(--color-danger)' }}
                            >
                              <i className="fa-solid fa-trash-can" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                <i className="fa-solid fa-circle-info" style={{ marginRight: 4, opacity: 0.5 }} />
                Tip: Product names you type during billing or order creation are automatically added to this list.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Reset Data Modal ═══ */}
      {showResetModal && (
        <ResetDataModal
          onClose={() => setShowResetModal(false)}
          onReset={() => {
            // Re-fetch settings + clear local suggestion state
            fetchSettings();
            setSuggestions(getSuggestions());
          }}
        />
      )}
    </div>
  );
}
