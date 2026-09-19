import { useState, useEffect, useMemo } from 'react';
import api, { extractList } from '../../lib/axios';
import ExportButton from '../../components/elements/ExportButton';
import DataImportModal from '../../components/elements/DataImportModal';
import useTabRefresh from '../../hooks/useTabRefresh';
import { verifyAdminPassword } from '../../services/authService';
import SingleWhatsAppModal from './SingleWhatsAppModal';
import WhatsAppBroadcastModal from './WhatsAppBroadcastModal';
import '../auth/auth.css';

const typeBadge = (t) => {
  const map = { VIP: 'warning', Regular: 'primary', 'Walk-in': 'info' };
  return <span className={`badge badge--${map[t] || 'info'}`}>{t || 'Walk-in'}</span>;
};

/* ═══════════════════════════════════════════
   ADD / EDIT CUSTOMER MODAL
   ═══════════════════════════════════════════ */
function CustomerModal({ customer, onClose, onSaved }) {
  const isEdit = !!customer;
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [gstNumber, setGstNumber] = useState(customer?.gst_number || '');
  const [customerCode, setCustomerCode] = useState(customer?.customer_code || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Name and Phone are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        gst_number: gstNumber.trim() || null,
        notes: notes.trim() || null,
        shop: 1,
      };

      if (!isEdit) {
        // Auto-generate customer_code for new customers
        payload.customer_code = customerCode.trim() || `CUST-${Date.now().toString().slice(-6)}`;
      }

      if (isEdit) {
        await api.put(`/customers/${customer.id}/`, payload);
      } else {
        await api.post('/customers/', payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save customer:', err);
      const apiErrors = err.response?.data?.errors || err.response?.data;
      if (apiErrors && typeof apiErrors === 'object') {
        const messages = Object.entries(apiErrors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        setError(messages.join('\n'));
      } else {
        setError(err.response?.data?.message || 'Failed to save customer.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal__header">
          <h2 className="modal__title">
            <i className={`fa-solid ${isEdit ? 'fa-user-pen' : 'fa-user-plus'}`} style={{ marginRight: 8, color: 'var(--color-primary)' }}></i>
            {isEdit ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div style={{ padding: 'var(--space-5)' }}>
          {error && (
            <div style={{ background: 'var(--color-danger-muted)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)', whiteSpace: 'pre-line' }}>
              {error}
            </div>
          )}
          <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Customer Name *</label>
              <input className="form-input" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} autoFocus id="cust-name" />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Phone Number *</label>
              <input className="form-input" type="tel" placeholder="10-digit mobile" value={phone} onChange={e => setPhone(e.target.value)} maxLength={15} id="cust-phone" />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} id="cust-email" />
            </div>
            {!isEdit && (
              <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                <label className="form-label">Customer Code</label>
                <input className="form-input" type="text" placeholder="Auto-generated" value={customerCode} onChange={e => setCustomerCode(e.target.value)} id="cust-code" style={{ fontFamily: 'monospace' }} />
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <label className="form-label">Address</label>
            <input className="form-input" type="text" placeholder="Full address" value={address} onChange={e => setAddress(e.target.value)} id="cust-address" />
          </div>
          <div className="form-row" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">GST Number</label>
              <input className="form-input" type="text" placeholder="GSTIN" value={gstNumber} onChange={e => setGstNumber(e.target.value)} maxLength={50} id="cust-gst" style={{ fontFamily: 'monospace', textTransform: 'uppercase' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Notes</label>
              <input className="form-input" type="text" placeholder="Internal notes" value={notes} onChange={e => setNotes(e.target.value)} id="cust-notes" />
            </div>
          </div>
        </div>
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !name.trim() || !phone.trim()}>
            {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <><i className={`fa-solid ${isEdit ? 'fa-check' : 'fa-plus'}`}></i> {isEdit ? 'Save Changes' : 'Add Customer'}</>}
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   DELETE CUSTOMER MODAL
   ═══════════════════════════════════════════ */
function DeleteCustomerModal({ customer, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      setError('Please enter your admin password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const auth = await verifyAdminPassword(password);
      if (!auth.success) {
        setError(auth.error || 'Incorrect admin password.');
        return;
      }
      onConfirm(customer.id);
      onClose();
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal__header">
          <h2 className="modal__title" style={{ color: 'var(--color-danger)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>Delete Customer
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal__body">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            Delete <strong style={{ color: 'var(--text-primary)' }}>{customer?.name}</strong> ({customer?.phone})?
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>This action cannot be undone.</p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Admin Password *</label>
            <div className="auth-input-wrap">
              <input
                className={`form-input${error ? ' form-input--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                autoFocus
              />
              <button
                type="button"
                className="auth-reveal"
                onClick={() => setShowPassword(prev => !prev)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--danger" onClick={handleDelete} disabled={loading || !password}>
            <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-trash-can'}`}></i> Delete
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   CUSTOMERS PAGE
   ═══════════════════════════════════════════ */
export default function Customers({ isActive = true }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All');
  const [customersData, setCustomersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [deleteCustomer, setDeleteCustomer] = useState(null);

  // WhatsApp
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [waCustomer, setWaCustomer] = useState(null);
  const [broadcastModal, setBroadcastModal] = useState(false);

  const customerColumns = useMemo(() => [
    { label: 'Customer Code', key: 'customer_code', aliases: ['code', 'id', 'cust code'] },
    { label: 'Name', key: 'name', required: true, aliases: ['customer name', 'full name'] },
    {
      label: 'Phone',
      key: 'phone',
      required: true,
      aliases: ['mobile', 'phone number', 'contact'],
      validate: (val) => {
        const clean = String(val || '').replace(/[^0-9+]/g, '');
        if (clean.length < 7) return 'Phone must have at least 7 digits';
        return null;
      }
    },
    { label: 'Email', key: 'email', aliases: ['email address', 'e-mail'] },
    { label: 'Address', key: 'address', aliases: ['city', 'location', 'full address'] },
    { label: 'GST Number', key: 'gst_number', aliases: ['gstin', 'gst'] },
    { label: 'Notes', key: 'notes', aliases: ['remark', 'remarks'] }
  ], []);

  const sampleCustomerRows = useMemo(() => [
    {
      customer_code: 'CUST-1001',
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul.sharma@example.com',
      address: '123 MG Road, Kolkata',
      gst_number: '19AAAAA0000A1Z5',
      notes: 'Regular gold jewelry customer'
    },
    {
      customer_code: 'CUST-1002',
      name: 'Pooja Verma',
      phone: '9123456780',
      email: '',
      address: 'Salt Lake Sector 5',
      gst_number: '',
      notes: 'Prefers silver ornaments'
    }
  ], []);

  const handleImportCustomers = async (items) => {
    let createdCount = 0;
    for (const item of items) {
      const payload = {
        name: item.name,
        phone: item.phone,
        email: item.email || null,
        address: item.address || null,
        gst_number: item.gst_number || null,
        customer_code: item.customer_code || `CUST-${Date.now().toString().slice(-6)}${createdCount}`,
        notes: item.notes || null,
        shop: 1
      };
      await api.post('/customers/', payload);
      createdCount++;
    }
    return { success: true, count: createdCount };
  };

  const tabs = ['All', 'VIP', 'Regular', 'Walk-in'];

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/customers/');
      const records = extractList(res.data);
      setCustomersData(records);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setError("Failed to load customers. Please try again.");
      setCustomersData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useTabRefresh(() => fetchCustomers(), isActive);

  const filtered = useMemo(() => {
    return customersData.filter(
      (c) =>
        (tab === 'All' || c.customer_type === tab) &&
        ((c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))
    );
  }, [customersData, tab, search]);

  const totalBills = useMemo(() => customersData.reduce((s, c) => s + (c.total_bills || 0), 0), [customersData]);

  const handleDeleteCustomer = async (id) => {
    try {
      await api.delete(`/customers/${id}/`);
      setCustomersData(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete customer.');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Customers</h1>
          <div className="page-header__actions">
            <ExportButton
              data={filtered}
              columns={customerColumns}
              filename="Customers"
              sheetName="Customers"
            />
            <button className="btn btn--outline btn--sm" onClick={() => setImportModal(true)}>
              <i className="fa-solid fa-file-import"></i> Import Data
            </button>
            <button
              className="btn btn--outline btn--sm"
              style={{ color: '#25D366', borderColor: '#25D366' }}
              onClick={() => setBroadcastModal(true)}
            >
              <i className="fa-brands fa-whatsapp"></i>
              {selectedIds.size > 0 ? ` Send to ${selectedIds.size} Selected` : ' Broadcast'}
            </button>
            <button className="btn btn--primary" onClick={() => setAddModal(true)}>
              <i className="fa-solid fa-user-plus"></i> Add Customer
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Manage your customer directory and purchase history.</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card animate-fade-in-up">
          <div className="card__header">
            <div>
              <div className="card__value">{customersData.length}</div>
              <div className="card__label">Total Customers</div>
            </div>
            <div className="card__icon card__icon--primary"><i className="fa-solid fa-users"></i></div>
          </div>
        </div>
        <div className="card animate-fade-in-up">
          <div className="card__header">
            <div>
              <div className="card__value">{customersData.filter((c) => c.customer_type === 'VIP').length}</div>
              <div className="card__label">VIP Customers</div>
            </div>
            <div className="card__icon card__icon--warning"><i className="fa-solid fa-crown"></i></div>
          </div>
        </div>
        <div className="card animate-fade-in-up">
          <div className="card__header">
            <div>
              <div className="card__value">{totalBills}</div>
              <div className="card__label">Total Bills</div>
            </div>
            <div className="card__icon card__icon--success"><i className="fa-solid fa-file-invoice"></i></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tabs__tab${tab === t ? ' tabs__tab--active' : ''}`} onClick={() => setTab(t)}>
            {t} {t !== 'All' && <span style={{ opacity: 0.5, marginLeft: 4 }}>({customersData.filter((c) => c.customer_type === t).length})</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="data-table-wrapper animate-fade-in-up">
        <div className="data-table-toolbar">
          <div className="data-table-toolbar__search">
            <i className="fa-solid fa-magnifying-glass data-table-toolbar__search-icon"></i>
            <input className="data-table-toolbar__search-input" type="text" placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} id="customers-search" />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{filtered.length} customers</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(new Set(filtered.map(c => c.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Bills</th>
              <th>Total Spent</th>
              <th>Type</th>
              <th>Last Visit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="spinner"></div>
                    <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>Loading customers...</div>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-danger)' }}>
                  {error}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-secondary)' }}>
                  No customers found.
                </td>
              </tr>
            ) : filtered.map((c) => (
              <tr key={c.id} style={{ background: selectedIds.has(c.id) ? 'var(--color-primary-muted)' : undefined }}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={e => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        return next;
                      });
                    }}
                  />
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{c.customer_code}</td>
                <td style={{ fontWeight: 600 }}>
                  <div className="flex items-center gap-3">
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                      {(c.name || '').split(' ').map((n) => n[0]).join('')}
                    </div>
                    {c.name}
                  </div>
                </td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{c.phone}</td>
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                <td>{c.address || '—'}</td>
                <td style={{ fontWeight: 600 }}>{c.total_bills || 0}</td>
                <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>₹{Number(c.total_spent || 0).toLocaleString('en-IN')}</td>
                <td>{typeBadge(c.customer_type)}</td>
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{c.last_visit || '—'}</td>
                <td>
                  <div className="flex gap-2">
                    <button
                      className="btn btn--ghost btn--sm btn--icon"
                      title="Send WhatsApp"
                      style={{ color: '#25D366' }}
                      onClick={() => setWaCustomer(c)}
                    >
                      <i className="fa-brands fa-whatsapp" />
                    </button>
                    <button className="btn btn--ghost btn--sm btn--icon" title="Edit" onClick={() => setEditCustomer(c)}><i className="fa-solid fa-pen" /></button>
                    <button className="btn btn--ghost btn--sm btn--icon" title="Delete" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleteCustomer(c)}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && customersData.length > 0 && (
          <div className="data-table__pagination">
            <span>Showing {filtered.length} of {customersData.length} customers</span>
            <div className="flex gap-2">
              <button className="btn btn--ghost btn--sm" disabled>Previous</button>
              <button className="btn btn--primary btn--sm">1</button>
              <button className="btn btn--ghost btn--sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {addModal && <CustomerModal customer={null} onClose={() => setAddModal(false)} onSaved={fetchCustomers} />}
      {editCustomer && <CustomerModal customer={editCustomer} onClose={() => setEditCustomer(null)} onSaved={fetchCustomers} />}
      {deleteCustomer && <DeleteCustomerModal customer={deleteCustomer} onClose={() => setDeleteCustomer(null)} onConfirm={handleDeleteCustomer} />}
      {waCustomer && (
        <SingleWhatsAppModal customer={waCustomer} onClose={() => setWaCustomer(null)} />
      )}
      {broadcastModal && (
        <WhatsAppBroadcastModal
          selectedCustomers={customersData.filter(c => selectedIds.has(c.id))}
          allCustomers={customersData}
          onClose={() => setBroadcastModal(false)}
        />
      )}
      {importModal && (
        <DataImportModal

          isOpen={importModal}
          onClose={() => setImportModal(false)}
          title="Import Customers Data"
          moduleName="Customers"
          columns={customerColumns}
          sampleRows={sampleCustomerRows}
          onImport={handleImportCustomers}
          onSuccess={fetchCustomers}
        />
      )}
    </div>
  );
}
