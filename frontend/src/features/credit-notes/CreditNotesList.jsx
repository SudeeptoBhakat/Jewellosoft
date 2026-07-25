/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { extractList } from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs } from '../../contexts/TabContext';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';
import CreditNoteTemplate from '../pdfs/templates/CreditNoteTemplate';
import { toast } from '../../utils/toast';
import useTabRefresh from '../../hooks/useTabRefresh';

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadge = (status) => {
  const map = {
    open: 'badge badge--success',
    partial: 'badge badge--info',
    closed: 'badge badge--neutral',
    expired: 'badge badge--danger',
    cancelled: 'badge badge--danger',
  };
  const label = {
    open: 'Open',
    partial: 'Partially Used',
    closed: 'Closed',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };
  return <span className={map[status] || 'badge'}>{label[status] || status}</span>;
};

export default function CreditNotesList({ isActive = true }) {
  const { shop } = useAuth();
  const { openTab } = useTabs();
  const [searchParams, setSearchParams] = useSearchParams();

  const initCustId = searchParams.get('customer_id');
  const initInvId = searchParams.get('invoice_id');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(!!initCustId);
  const [viewCN, setViewCN] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Expiry config
  const validityDays = shop?.credit_note_validity_days || 0;

  const loadCreditNotes = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (search.trim()) params.search = search;

      const res = await api.get('/billing/credit-notes/', { params });
      setCreditNotes(extractList(res.data));
    } catch (e) {
      console.error('Failed to load credit notes:', e);
      toast.error('Failed to load credit notes.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const delay = setTimeout(() => {
      loadCreditNotes();
    }, 400);
    return () => clearTimeout(delay);
  }, [loadCreditNotes]);

  useTabRefresh(() => loadCreditNotes(), isActive);

  // Stats calculation
  const stats = useMemo(() => {
    return {
      totalCount: creditNotes.length,
      totalAmount: creditNotes.reduce((s, c) => s + parseFloat(c.credit_amount || 0), 0),
      totalRemaining: creditNotes.reduce((s, c) => s + parseFloat(c.remaining_amount || 0), 0),
      openCount: creditNotes.filter(c => c.status === 'open' || c.status === 'partial').length,
    };
  }, [creditNotes]);

  const handlePrint = (cn) => {
    const docData = {
      isCreditNote: true,
      template: shop?.pdf_template || 'classic',
      shop: {
        name: shop?.name || 'My Jewellery Shop',
        address: shop?.address || '',
        phone: shop?.phone || '',
        email: shop?.email || '',
        gst_number: shop?.gst_number || '',
        pan_number: shop?.pan_number || '',
        watermark_logo_url: shop?.watermark_logo || null,
      },
      customer: cn.customer_detail || {},
      creditNote: cn,
    };
    setPrintData(docData);
  };

  const handleCancel = async (id, cnNo) => {
    if (window.confirm(`Are you sure you want to cancel Credit Note ${cnNo}? This will mark it cancelled and release ledger.`)) {
      try {
        await api.patch(`/billing/credit-notes/${id}/`, { status: 'cancelled' });
        toast.success(`Credit Note ${cnNo} cancelled successfully.`);
        loadCreditNotes();
      } catch (err) {
        console.error(err);
        toast.error('Failed to cancel credit note.');
      }
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Credit Notes</h1>
          <div className="page-header__actions">
            <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
              <i className="fa-solid fa-plus"></i> Issue Credit Note
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Manage customer store credits, exchanges, and return adjustments.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Issued', value: stats.totalCount, icon: 'fa-ticket', color: 'primary' },
          { label: 'Total Value', value: fmt(stats.totalAmount), icon: 'fa-indian-rupee-sign', color: 'success' },
          { label: 'Unused Credit Balance', value: fmt(stats.totalRemaining), icon: 'fa-wallet', color: 'info' },
          { label: 'Active Credit Notes', value: stats.openCount, icon: 'fa-clock', color: 'warning' },
        ].map((s, i) => (
          <div className="card animate-fade-in-up" style={{ padding: 'var(--space-4)' }} key={i}>
            <div className="card__header" style={{ marginBottom: 0 }}>
              <div className="flex justify-between items-center w-full">
                <div>
                  <div className="card__subtitle" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{s.label}</div>
                  <div className="card__title" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginTop: 4 }}>{s.value}</div>
                </div>
                <div className={`icon-wrapper bg--${s.color}`} style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa-solid ${s.icon}`} style={{ fontSize: '1.1rem' }}></i>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="data-table-wrapper animate-fade-in-up">
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Search</label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }}></i>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search CN #, customer, phone, source invoice..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }}
                />
              </div>
            </div>
            <div style={{ minWidth: 150 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Status</label>
              <select
                className="form-input form-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ height: 36, fontSize: 'var(--text-sm)' }}
              >
                <option value="All">All Statuses</option>
                <option value="open">Open</option>
                <option value="partial">Partially Used</option>
                <option value="closed">Closed</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {(search || statusFilter !== 'All') && (
              <button className="btn btn--ghost btn--sm" onClick={() => { setSearch(''); setStatusFilter('All'); }} style={{ height: 36 }}>
                <i className="fa-solid fa-xmark"></i> Clear
              </button>
            )}
          </div>
        </div>

        {/* Credit Notes Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>CN Number</th>
              <th>Customer</th>
              <th>Source Invoice</th>
              <th>Reason</th>
              <th className="txt-right">Total Credit</th>
              <th className="txt-right">Remaining</th>
              <th>Status</th>
              <th>Expiry</th>
              <th>Date</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10}>
                  <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="spinner"></div>
                    <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>Loading credit notes...</div>
                  </div>
                </td>
              </tr>
            ) : creditNotes.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                    <i className="empty-state__icon fa-solid fa-wallet"></i>
                    <div className="empty-state__title">No credit notes found</div>
                    <div className="empty-state__text">Try adjusting your filters or issue a new credit note.</div>
                  </div>
                </td>
              </tr>
            ) : creditNotes.map(cn => (
              <tr key={cn.id} style={{ cursor: 'pointer' }} onClick={() => setViewCN(cn)}>
                <td style={{ fontWeight: 600, color: 'var(--color-primary-hover)' }}>{cn.credit_note_no}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{cn.customer_detail?.name || 'Walk-in'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{cn.customer_detail?.phone || ''}</div>
                </td>
                <td>{cn.source_invoice_no ? <span style={{ fontFamily: 'monospace' }}>{cn.source_invoice_no}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cn.reason}>{cn.reason}</td>
                <td className="txt-right" style={{ fontWeight: 600 }}>{fmt(cn.credit_amount)}</td>
                <td className="txt-right" style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmt(cn.remaining_amount)}</td>
                <td>{statusBadge(cn.status)}</td>
                <td style={{ fontSize: 'var(--text-sm)', color: cn.is_expired ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                  {cn.expires_at ? new Date(cn.expires_at).toLocaleDateString('en-IN') : <span style={{ color: 'var(--text-muted)' }}>No Expiry</span>}
                </td>
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {new Date(cn.created_at).toLocaleDateString('en-IN')}
                </td>
                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                  <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                    <button className="btn btn--ghost btn--sm btn--icon" title="View" onClick={() => setViewCN(cn)}><i className="fa-solid fa-eye"></i></button>
                    <button className="btn btn--ghost btn--sm btn--icon" title="Print" onClick={() => handlePrint(cn)}><i className="fa-solid fa-print"></i></button>
                    {cn.status !== 'cancelled' && cn.status !== 'closed' && (
                      <button className="btn btn--ghost btn--sm btn--icon btn--danger-hover" title="Cancel" onClick={() => handleCancel(cn.id, cn.credit_note_no)}><i className="fa-solid fa-ban"></i></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Detail Modal */}
      {viewCN && (
        <CreditNoteDetailModal
          cn={viewCN}
          onClose={() => setViewCN(null)}
          onPrint={() => { setViewCN(null); handlePrint(viewCN); }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCreditNoteModal
          onClose={() => {
            setShowCreateModal(false);
            setSearchParams({});
          }}
          onSave={() => {
            setShowCreateModal(false);
            setSearchParams({});
            loadCreditNotes();
          }}
          validityDays={validityDays}
          initialCustomerId={initCustId}
          initialInvoiceId={initInvId}
        />
      )}

      {/* Print Modal */}
      <PrintPreviewModal isOpen={!!printData} data={printData} onClose={() => setPrintData(null)} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   CREDIT NOTE DETAIL MODAL
   ═══════════════════════════════════════════ */
function CreditNoteDetailModal({ cn, onClose, onPrint }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal__header">
          <div>
            <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-wallet" style={{ color: 'var(--color-primary)' }}></i>
              {cn.credit_note_no}
            </h2>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              Issued on {new Date(cn.created_at).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn--ghost btn--sm" onClick={onPrint} title="Print"><i className="fa-solid fa-print"></i></button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Customer</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', marginBottom: 4 }}>{cn.customer_detail?.name || 'Walk-in'}</div>
              {cn.customer_detail?.phone && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}><i className="fa-solid fa-phone" style={{ marginRight: 6, opacity: 0.5 }}></i>{cn.customer_detail.phone}</div>}
              {cn.customer_detail?.address && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}><i className="fa-solid fa-location-dot" style={{ marginRight: 6, opacity: 0.5 }}></i>{cn.customer_detail.address}</div>}
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Credit Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status</span><span style={{ textAlign: 'right' }}>{statusBadge(cn.status)}</span>
                <span style={{ color: 'var(--text-muted)' }}>Source Invoice</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{cn.source_invoice_no || '—'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Expiry</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{cn.expires_at ? new Date(cn.expires_at).toLocaleDateString('en-IN') : 'No Expiry'}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Reason & Notes</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{cn.reason}</div>
            {cn.notes && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', borderTop: '1px dashed var(--border-soft)', paddingTop: 'var(--space-2)' }}>{cn.notes}</div>}
          </div>

          {/* Usage History */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Usage History</div>
            {(!cn.usages || cn.usages.length === 0) ? (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No usages recorded. This credit note is fully unused.</div>
            ) : (
              <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="data-table" style={{ marginBottom: 0 }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Applied To</th>
                      <th>Notes</th>
                      <th className="txt-right">Amount Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cn.usages.map((u) => (
                      <tr key={u.id}>
                        <td>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{u.invoice_no || u.estimate_no || '—'}</td>
                        <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{u.note || '—'}</td>
                        <td className="txt-right" style={{ fontWeight: 600 }}>{fmt(u.amount_used)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Value balances footer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', borderTop: '1px solid var(--border-primary)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Issued Amount</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginTop: 4 }}>{fmt(cn.credit_amount)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Used Amount</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-danger)', marginTop: 4 }}>{fmt(cn.used_amount)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Remaining Balance</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-success)', marginTop: 4 }}>{fmt(cn.remaining_amount)}</div>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className="btn btn--primary" onClick={onPrint}><i className="fa-solid fa-print"></i> Print Receipt</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   CREATE CREDIT NOTE MODAL
   ═══════════════════════════════════════════ */
function CreateCreditNoteModal({ onClose, onSave, validityDays, initialCustomerId, initialInvoiceId }) {
  const { shop } = useAuth();
  
  // Customer autocomplete
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const [custSuggestions, setCustSuggestions] = useState([]);
  const custWrapRef = useRef(null);

  // Form Fields
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState(() => {
    if (validityDays && validityDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + validityDays);
      return d.toISOString().split('T')[0];
    }
    return '';
  });

  // Source Invoice Lookup
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Customer suggestions click-out
  useEffect(() => {
    const mouseHandler = (e) => {
      if (custWrapRef.current && !custWrapRef.current.contains(e.target)) {
        setShowCustSuggestions(false);
      }
    };
    document.addEventListener('mousedown', mouseHandler);
    return () => document.removeEventListener('mousedown', mouseHandler);
  }, []);

  // Fetch suggestions
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (custName.length > 2 && !customerId) {
        try {
          const res = await api.get(`/customers/?search=${encodeURIComponent(custName)}`);
          setCustSuggestions(extractList(res.data));
          if (extractList(res.data).length > 0) setShowCustSuggestions(true);
        } catch (e) {
          console.error(e);
          setCustSuggestions([]);
        }
      } else {
        setCustSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [custName, customerId]);

  // Load Invoices for selected Customer
  useEffect(() => {
    if (customerId) {
      setLoadingInvoices(true);
      api.get(`/billing/invoices/?customer=${customerId}`)
        .then(res => {
          setInvoices(extractList(res.data));
        })
        .catch(err => {
          console.error(err);
          setInvoices([]);
        })
        .finally(() => setLoadingInvoices(false));
    } else {
      setInvoices([]);
      setSelectedInvoiceId('');
    }
  }, [customerId]);

  // Load initial customer details if provided
  useEffect(() => {
    if (initialCustomerId) {
      api.get(`/customers/${initialCustomerId}/`)
        .then(res => {
          const c = res.data;
          setCustomerId(c.id);
          setCustName(c.name);
          setCustMobile(c.phone || '');
          setCustAddress(c.address || '');
        })
        .catch(err => {
          console.error('Error fetching customer details:', err);
        });
    }
  }, [initialCustomerId]);

  // Select initial invoice if provided and invoices loaded
  useEffect(() => {
    if (initialInvoiceId && invoices.length > 0) {
      const match = invoices.find(i => String(i.id) === String(initialInvoiceId));
      if (match) {
        setSelectedInvoiceId(String(initialInvoiceId));
        setAmount(String(match.grand_total));
        setReason(`Exchange against Invoice ${match.invoice_no}`);
      }
    }
  }, [initialInvoiceId, invoices]);

  const selectCustomer = (c) => {
    setCustomerId(c.id);
    setCustName(c.name);
    setCustMobile(c.phone || '');
    setCustAddress(c.address || '');
    setShowCustSuggestions(false);
  };

  const handleInvoiceChange = (e) => {
    const invId = e.target.value;
    setSelectedInvoiceId(invId);
    if (invId) {
      const match = invoices.find(i => String(i.id) === String(invId));
      if (match) {
        // Prefill amount and default reason
        setAmount(String(match.grand_total));
        setReason(`Exchange against Invoice ${match.invoice_no}`);
      }
    } else {
      setAmount('');
      setReason('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!custName.trim()) return toast.error("Customer name is required.");
    if (!amount || parseFloat(amount) <= 0) return toast.error("Please enter a valid credit amount.");
    if (!reason.trim()) return toast.error("Reason is required.");

    try {
      let finalCustId = customerId;
      // Create new customer if needed
      if (!finalCustId) {
        const custRes = await api.post('/customers/', {
          shop: shop?.id || 1,
          name: custName.trim(),
          phone: custMobile || `NA-${Date.now().toString().slice(-8)}`,
          address: custAddress,
        });
        finalCustId = custRes.data.id;
      }

      const payload = {
        customer_id: finalCustId,
        credit_amount: parseFloat(amount),
        reason: reason.trim(),
        notes: notes.trim(),
        expires_at: expiryDate || null,
        source_invoice_id: selectedInvoiceId ? parseInt(selectedInvoiceId) : null,
      };

      await api.post('/billing/credit-notes/', payload);
      toast.success("Credit Note issued successfully!");
      onSave();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to create Credit Note.");
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 580, overflow: 'visible' }}>
        <div className="modal__header">
          <h2 className="modal__title">
            <i className="fa-solid fa-plus" style={{ marginRight: 8 }}></i>
            Issue Credit Note
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ padding: 'var(--space-5)' }}>
            {/* Customer Lookup section */}
            <div className="billing-form" style={{ marginBottom: 'var(--space-4)', overflow: 'visible' }}>
              <div className="billing-form__header">
                <span className="billing-form__header-title">Customer Details</span>
              </div>
              <div className="billing-form__body" style={{ overflow: 'visible' }}>
                <div style={{ position: 'relative' }} ref={custWrapRef}>
                  <label className="form-label">Search/Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search name/phone or enter new customer..."
                    value={custName}
                    onChange={e => {
                      setCustName(e.target.value);
                      if (customerId) {
                        setCustomerId(null);
                        setCustMobile('');
                        setCustAddress('');
                      }
                    }}
                    autoComplete="off"
                    required
                  />

                  {showCustSuggestions && custSuggestions.length > 0 && (
                    <div className="autocomplete-suggestions">
                      {custSuggestions.map(c => (
                        <div key={c.id} className="autocomplete-suggestion-item" onClick={() => selectCustomer(c)}>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone} | {c.address || 'No address'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-row" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={custMobile}
                      onChange={e => setCustMobile(e.target.value)}
                      placeholder="Customer phone"
                      disabled={!!customerId}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-input"
                      value={custAddress}
                      onChange={e => setCustAddress(e.target.value)}
                      placeholder="Customer address"
                      disabled={!!customerId}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Credit Note Specifics */}
            <div className="billing-form">
              <div className="billing-form__header">
                <span className="billing-form__header-title">Credit Info</span>
              </div>
              <div className="billing-form__body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Link Source Invoice (Optional)</label>
                    <select
                      className="form-input form-select"
                      value={selectedInvoiceId}
                      onChange={handleInvoiceChange}
                      disabled={!customerId || loadingInvoices}
                    >
                      <option value="">-- None --</option>
                      {invoices.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.invoice_no} ({fmt(i.grand_total)}) - {new Date(i.created_at).toLocaleDateString('en-IN')}
                        </option>
                      ))}
                    </select>
                    {!customerId && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                        Select a saved customer first to link invoice.
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Credit Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                  <label className="form-label">Reason *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Exchange of Gold Ring, Returned bangle"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label className="form-label">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={expiryDate}
                      onChange={e => setExpiryDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Internal Notes (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Internal use only"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary">Issue Credit Note</button>
          </div>
        </form>
      </div>
    </>
  );
}
