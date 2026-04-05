import { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';

export default function Settings() {
  const { syncShop } = useAuth();
  const [tab, setTab] = useState('General');
  const tabs = ['General', 'Business', 'Security'];

  const [formData, setFormData] = useState({
    theme: 'System Default',
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
      setFormData(prev => ({ ...prev, ...res.data }));
      
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
      'settings-theme': 'theme',
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

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      await api.patch('/accounts/shop/current/', formData);
      // Refresh global shop state so Navbar etc. pick up changes
      if (syncShop) await syncShop();
      setMessage({ text: 'Settings saved successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error('Save failed', err);
      setMessage({ text: 'Failed to save settings. Please try again.', type: 'error' });
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
            backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
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
          <div className="billing-form" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-palette" style={{ marginRight: 8, opacity: 0.6 }}></i>Appearance</span>
            </div>
            <div className="billing-form__body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Theme</label>
                  <select className="form-input form-select" id="settings-theme" value={formData.theme} onChange={handleChange}>
                    <option value="Dark Mode">Dark Mode</option>
                    <option value="Light Mode">Light Mode</option>
                    <option value="System Default">System Default</option>
                  </select>
                </div>
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

          <div className="billing-form">
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-bell" style={{ marginRight: 8, opacity: 0.6 }}></i>Preferences</span>
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
