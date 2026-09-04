import { useState, useEffect, useMemo, useCallback } from 'react';
import api, { extractList } from '../../lib/axios';
import ExportButton from '../../components/elements/ExportButton';
import useTabRefresh from '../../hooks/useTabRefresh';
import { toast } from '../../utils/toast';

const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = (s) => {
  const map = {
    pending: { cls: 'badge--warning', label: 'Pending' },
    partially_paid: { cls: 'badge--info', label: 'Partial' },
    cleared: { cls: 'badge--success', label: 'Cleared' },
  };
  const item = map[s] || map.pending;
  return <span className={`badge ${item.cls}`}>{item.label}</span>;
};

function DueModal({ isOpen, onClose, due, onSuccess }) {
  const isEdit = !!due;
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState(due?.customer_detail?.name || '');
  const [selectedCustomer, setSelectedCustomer] = useState(due?.customer || null);
  const [dueAmount, setDueAmount] = useState(due?.due_amount || '');
  const [paidAmount, setPaidAmount] = useState(due?.paid_amount || '0');
  const [dueDate, setDueDate] = useState(due?.due_date || '');
  const [notes, setNotes] = useState(due?.notes || '');
  const [status, setStatus] = useState(due?.status || 'pending');

  const [billSearch, setBillSearch] = useState(due?.bill_number || '');
  const [billSearchResults, setBillSearchResults] = useState([]);
  const [selectedBill, setSelectedBill] = useState(
    due?.bill_number ? { bill_number: due.bill_number, type: due.bill_type, id: due.invoice || due.estimate } : null
  );
  const [searchingBills, setSearchingBills] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers/').then((res) => setCustomers(extractList(res.data))).catch(() => {});
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.customer_code?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [customers, customerSearch]);

  const searchBills = useCallback(async (query = '') => {
    setSearchingBills(true);
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (selectedCustomer) params.customer_id = selectedCustomer;
      const res = await api.get('/dues/search-bills/', { params });
      setBillSearchResults(res.data || []);
    } catch {
      setBillSearchResults([]);
    } finally {
      setSearchingBills(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (billSearch.trim()) {
        searchBills(billSearch);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [billSearch, searchBills]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer.');
      return;
    }
    if (!dueAmount || parseFloat(dueAmount) <= 0) {
      toast.error('Please enter a valid due amount.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer: selectedCustomer,
        due_amount: parseFloat(dueAmount),
        paid_amount: parseFloat(paidAmount || 0),
        due_date: dueDate || null,
        notes: notes.trim(),
        status,
        invoice: selectedBill?.type === 'invoice' ? selectedBill.id : null,
        estimate: selectedBill?.type === 'estimate' ? selectedBill.id : null,
        bill_type: selectedBill?.type || 'none',
        bill_number: selectedBill?.bill_number || '',
      };

      if (isEdit) {
        await api.patch(`/dues/${due.id}/`, payload);
        toast.success('Due record updated successfully.');
      } else {
        await api.post('/dues/', payload);
        toast.success('Due record added successfully.');
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to save due record.';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal__header">
          <h2 className="modal__title">
            <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus-circle'}`} style={{ color: 'var(--color-primary)', marginRight: 8 }}></i>
            {isEdit ? 'Edit Due Record' : 'Add Manual Due Record'}
          </h2>
          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Customer Selection */}
          <div className="form-group">
            <label className="form-label">Select Customer *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="text"
                placeholder="Search customer by name or phone..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setSelectedCustomer(null);
                }}
              />
              {customerSearch && !selectedCustomer && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    maxHeight: 180,
                    overflowY: 'auto',
                    marginTop: 4,
                  }}
                >
                  {filteredCustomers.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No customer found.</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c.id);
                          setCustomerSearch(`${c.name} (${c.phone || c.customer_code})`);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <strong>{c.name}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{c.phone || c.customer_code}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Amounts */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Due Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Paid / Cleared (₹)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Optional Bill Link */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Link with Bill (Optional)</span>
              {selectedBill && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBill(null);
                    setBillSearch('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  ✕ Delink Bill
                </button>
              )}
            </label>

            {selectedBill ? (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface-secondary, rgba(0,0,0,0.03))',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge badge--${selectedBill.type === 'invoice' ? 'primary' : 'info'}`}>
                      {selectedBill.type?.toUpperCase()}
                    </span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{selectedBill.bill_number}</strong>
                  </div>
                  <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {selectedBill.grand_total !== undefined && (
                      <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                        Bill Total: ₹{Number(selectedBill.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {selectedBill.date && <span style={{ marginLeft: 10 }}>Date: {selectedBill.date}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedBill.grand_total !== undefined && (!dueAmount || dueAmount === '0') && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setDueAmount(String(selectedBill.grand_total))}
                    >
                      Use Bill Total
                    </button>
                  )}
                  <span style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>Linked</span>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search bill by number (e.g. INV-2026, EST-2026) or customer..."
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  onFocus={() => searchBills(billSearch)}
                />
                {searchingBills && (
                  <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    <div className="spinner" style={{ width: 14, height: 14 }}></div>
                  </div>
                )}

                {billSearch && !selectedBill && billSearchResults.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)',
                      maxHeight: 200,
                      overflowY: 'auto',
                      marginTop: 4,
                    }}
                  >
                    {billSearchResults.map((b) => (
                      <div
                        key={`${b.type}-${b.id}`}
                        onClick={() => {
                          setSelectedBill(b);
                          setBillSearch(b.bill_number);
                          if (!selectedCustomer && b.customer_id) {
                            setSelectedCustomer(b.customer_id);
                            setCustomerSearch(`${b.customer_name} (${b.customer_phone || ''})`);
                          }
                        }}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`badge badge--${b.type === 'invoice' ? 'primary' : 'info'}`}>
                              {b.type?.toUpperCase()}
                            </span>
                            <strong style={{ fontFamily: 'monospace' }}>{b.bill_number}</strong>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {b.customer_name} {b.customer_phone ? `(${b.customer_phone})` : ''} • {b.date}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            ₹{Number(b.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bill Total</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Due Date & Status */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Due / Expected Date</label>
              <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="cleared">Cleared</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes / Remarks</label>
            <textarea
              className="form-input"
              rows="2"
              placeholder="e.g. Promised to pay remaining by next week"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 'var(--space-4) var(--space-6)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Record' : 'Save Due Record'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function DueRecords({ isActive = true }) {
  const [dues, setDues] = useState([]);
  const [summary, setSummary] = useState({ total_due: 0, total_paid: 0, total_remaining: 0, pending_count: 0, total_count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDue, setEditingDue] = useState(null);

  const fetchDues = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (filterType !== 'all') params.filter_type = filterType;

      const [resList, resSummary] = await Promise.all([
        api.get('/dues/', { params }),
        api.get('/dues/summary/', { params }),
      ]);

      setDues(extractList(resList.data));
      setSummary(resSummary.data || {});
    } catch (err) {
      console.error('Failed to load dues:', err);
      toast.error('Failed to load due records.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, filterType]);

  useEffect(() => {
    const delay = setTimeout(fetchDues, 350);
    return () => clearTimeout(delay);
  }, [fetchDues]);

  useTabRefresh(fetchDues, isActive);

  const handleDelink = async (id) => {
    try {
      await api.post(`/dues/${id}/delink-bill/`);
      toast.success('Bill delinked successfully.');
      fetchDues();
    } catch {
      toast.error('Failed to delink bill.');
    }
  };

  const handleMarkCleared = async (id) => {
    try {
      const item = dues.find((d) => d.id === id);
      if (!item) return;
      await api.patch(`/dues/${id}/`, {
        paid_amount: item.due_amount,
        status: 'cleared',
      });
      toast.success('Marked as cleared.');
      fetchDues();
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this due record?')) {
      try {
        await api.delete(`/dues/${id}/`);
        toast.success('Due record deleted.');
        fetchDues();
      } catch {
        toast.error('Failed to delete due record.');
      }
    }
  };

  const dueColumns = useMemo(
    () => [
      { label: 'Customer Name', key: 'customer_name' },
      { label: 'Customer Phone', key: 'customer_phone' },
      { label: 'Due Amount (₹)', key: 'due_amount' },
      { label: 'Paid Amount (₹)', key: 'paid_amount' },
      { label: 'Remaining (₹)', key: 'remaining_amount' },
      { label: 'Linked Bill Type', key: 'bill_type' },
      { label: 'Linked Bill Number', key: 'bill_number' },
      { label: 'Status', key: 'status', transform: (val) => String(val || '').toUpperCase() },
      { label: 'Due Date', key: 'due_date', transform: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '—') },
      { label: 'Created Date', key: 'created_at', transform: (val) => (val ? new Date(val).toLocaleDateString('en-IN') : '') },
      { label: 'Notes', key: 'notes' },
    ],
    []
  );

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">
            <i className="fa-solid fa-hand-holding-hand" style={{ color: 'var(--color-primary)', marginRight: 10 }}></i>
            Due Records
          </h1>
          <div className="page-header__actions">
            <ExportButton data={dues} columns={dueColumns} filename="Due_Records" sheetName="Dues" />
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEditingDue(null);
                setModalOpen(true);
              }}
            >
              <i className="fa-solid fa-plus"></i> Add Due Record
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Manual credit and due tracking per customer. Link or delink specific invoices and estimates.</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Dues', value: fmt(summary.total_due), icon: 'fa-file-invoice-dollar', color: 'primary' },
          { label: 'Total Cleared', value: fmt(summary.total_paid), icon: 'fa-circle-check', color: 'success' },
          { label: 'Outstanding Balance', value: fmt(summary.total_remaining), icon: 'fa-scale-balanced', color: 'warning' },
          { label: 'Pending Records', value: summary.pending_count, icon: 'fa-clock', color: 'info' },
        ].map((s, i) => (
          <div key={i} className="card animate-fade-in-up" style={{ padding: 'var(--space-4)' }}>
            <div className="card__header" style={{ marginBottom: 0 }}>
              <div>
                <div className="card__value" style={{ fontSize: 'var(--text-xl)' }}>{s.value}</div>
                <div className="card__label">{s.label}</div>
              </div>
              <div className={`card__icon card__icon--${s.color}`} style={{ width: 36, height: 36 }}>
                <i className={`fa-solid ${s.icon}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="data-table-wrapper animate-fade-in-up">
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Search</label>
              <div style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}
                ></i>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search customer name, phone, or bill #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }}
                />
              </div>
            </div>

            <div style={{ minWidth: 140 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Status</label>
              <select className="form-input form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="cleared">Cleared</option>
              </select>
            </div>

            <div style={{ minWidth: 160 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Filter Type</label>
              <select className="form-input form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                <option value="all">All Records</option>
                <option value="customer_only">Customer Wise (No Bill)</option>
                <option value="bill_only">Bill Wise (Linked)</option>
                <option value="customer_and_bill">Customer + Bill</option>
              </select>
            </div>

            {(search || statusFilter !== 'all' || filterType !== 'all') && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setFilterType('all');
                }}
                style={{ height: 36 }}
              >
                <i className="fa-solid fa-xmark"></i> Clear
              </button>
            )}
          </div>
        </div>

        {/* Dues Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Due Amount</th>
              <th>Paid Amount</th>
              <th>Remaining</th>
              <th>Linked Bill</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Created</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>
                  <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="spinner"></div>
                    <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>Loading due records...</div>
                  </div>
                </td>
              </tr>
            ) : dues.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                    <i className="empty-state__icon fa-solid fa-hand-holding-hand"></i>
                    <div className="empty-state__title">No due records found</div>
                    <div className="empty-state__text">Add a new manual due entry or adjust your search filters.</div>
                  </div>
                </td>
              </tr>
            ) : (
              dues.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{d.customer_name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{d.customer_phone || '—'}</div>
                  </td>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(d.due_amount)}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', color: '#16a34a' }}>{fmt(d.paid_amount)}</td>
                  <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: d.remaining_amount > 0 ? '#dc2626' : '#16a34a' }}>
                    {fmt(d.remaining_amount)}
                  </td>
                  <td>
                    {d.bill_number ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge badge--${d.bill_type === 'invoice' ? 'primary' : 'info'}`}>
                          {d.bill_type?.toUpperCase()}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d.bill_number}</span>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          title="Delink Bill"
                          style={{ color: 'var(--color-danger)', padding: 2, height: 20, width: 20 }}
                          onClick={() => handleDelink(d.id)}
                        >
                          <i className="fa-solid fa-link-slash" style={{ fontSize: '0.7rem' }}></i>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        onClick={() => {
                          setEditingDue(d);
                          setModalOpen(true);
                        }}
                      >
                        <i className="fa-solid fa-link" style={{ marginRight: 4 }}></i> Link Bill
                      </button>
                    )}
                  </td>
                  <td>{statusBadge(d.status)}</td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {new Date(d.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                      {d.status !== 'cleared' && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm btn--icon"
                          title="Mark Cleared"
                          style={{ color: '#16a34a' }}
                          onClick={() => handleMarkCleared(d.id)}
                        >
                          <i className="fa-solid fa-circle-check"></i>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm btn--icon"
                        title="Edit"
                        onClick={() => {
                          setEditingDue(d);
                          setModalOpen(true);
                        }}
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm btn--icon"
                        title="Delete"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => handleDelete(d.id)}
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <DueModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingDue(null);
          }}
          due={editingDue}
          onSuccess={fetchDues}
        />
      )}
    </div>
  );
}
