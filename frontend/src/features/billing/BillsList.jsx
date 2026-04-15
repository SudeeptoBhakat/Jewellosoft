import { useState, useMemo, useEffect, useCallback } from 'react';
import api, { extractList } from '../../lib/axios';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';
import { useAuth } from '../../contexts/AuthContext';
import { fmtCurrency as fmt, fmtInt } from '../../utils/billingCalcEngine';

const statusMap = { Paid: 'success', Pending: 'warning', Partial: 'info', Cancelled: 'danger' };
const statusBadge = (s) => <span className={`badge badge--${statusMap[s] || 'primary'}`}>{s}</span>;

/* ═══════════════════════════════════════════
   BILL DETAIL MODAL
   ═══════════════════════════════════════════ */
function BillDetailModal({ bill, onClose, onPrint }) {
  if (!bill) return null;

  const totalWeight = (bill.items || []).reduce((s, i) => s + (i.weight || 0), 0);
  const totalMetalVal = (bill.items || []).reduce((s, i) => s + (i.metalValue || 0), 0);
  const totalMaking = (bill.items || []).reduce((s, i) => s + (i.making || 0), 0);
  const isInvoice = bill.billType === 'Invoice';

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 780, maxHeight: '92vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="modal__header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <div>
            <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-file-invoice-dollar" style={{ color: 'var(--color-primary)' }}></i>
              {bill.id}
            </h2>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              {bill.billType} • {bill.metal} • {new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn--ghost btn--sm" onClick={onPrint} title="Print"><i className="fa-solid fa-print"></i></button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-5)' }}>
          {/* Customer & Bill Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Customer</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', marginBottom: 4 }}>{bill.customer}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}><i className="fa-solid fa-phone" style={{ marginRight: 6, opacity: 0.5 }}></i>{bill.phone || '—'}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}><i className="fa-solid fa-location-dot" style={{ marginRight: 6, opacity: 0.5 }}></i>{bill.address || '—'}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Bill Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status</span><span style={{ textAlign: 'right' }}>{statusBadge(bill.status)}</span>
                <span style={{ color: 'var(--text-muted)' }}>Payment</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{bill.payment}</span>
                <span style={{ color: 'var(--text-muted)' }}>Items</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{(bill.items || []).length}</span>
                <span style={{ color: 'var(--text-muted)' }}>Total Wt</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{totalWeight.toFixed(3)}g</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Items</div>
            <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table className="data-table" style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    {isInvoice && <th>HUID</th>}
                    <th>Weight</th>
                    <th>Metal Val</th>
                    <th>Making</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.items || []).map((item, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      {isInvoice && <td style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{item.huid || '—'}</td>}
                      <td>{item.weight}g</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(item.metalValue)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(item.making)}</td>
                      <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-surface)' }}>
                    <td colSpan={isInvoice ? 3 : 2} style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>TOTALS</td>
                    <td style={{ fontWeight: 600 }}>{totalWeight.toFixed(3)}g</td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalMetalVal)}</td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(totalMaking)}</td>
                    <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary-hover)' }}>{fmt(bill.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>Payment Details</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-sm)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Cash</span><span style={{ fontWeight: 600 }}>{fmtInt(bill.paidCash)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Online</span><span style={{ fontWeight: 600 }}>{fmtInt(bill.paidOnline)}</span></div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>Total Paid</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtInt((bill.paidCash || 0) + (bill.paidOnline || 0))}</span>
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>Bill Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--text-sm)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Subtotal</span><span>{fmt(bill.subtotal)}</span></div>
                {bill.otherCharges > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>(+) Other</span><span>{fmt(bill.otherCharges)}</span></div>}
                {bill.hallmark > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>(+) Hallmark</span><span>{fmt(bill.hallmark)}</span></div>}
                {bill.cgst > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>(+) CGST 1.5%</span><span>{fmt(bill.cgst)}</span></div>}
                {bill.sgst > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>(+) SGST 1.5%</span><span>{fmt(bill.sgst)}</span></div>}
                {/* Old Metal — show by settlement mode */}
                {(bill.oldSettlementMode === 'weight' && bill.oldWt > 0) && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>(−) Old Metal ({bill.oldWt.toFixed(3)}g)</span>
                    <span style={{ color: 'var(--color-danger)' }}>−{fmt(bill.oldValue)}</span>
                  </div>
                )}
                {(bill.oldSettlementMode === 'value' && bill.oldValueDirect > 0) && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>(−) Old Metal (Direct)</span>
                    <span style={{ color: 'var(--color-danger)' }}>−{fmt(bill.oldValueDirect)}</span>
                  </div>
                )}
                {/* Fallback for legacy bills without mode */}
                {(!bill.oldSettlementMode || bill.oldSettlementMode === 'none') && bill.oldValue > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>(−) Old Value</span>
                    <span style={{ color: 'var(--color-danger)' }}>−{fmt(bill.oldValue)}</span>
                  </div>
                )}
                {bill.advance > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>(−) Advance</span><span style={{ color: 'var(--color-danger)' }}>−{fmt(bill.advance)}</span></div>}
                {bill.discount > 0 && <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>(−) Discount</span><span style={{ color: 'var(--color-danger)' }}>−{fmt(bill.discount)}</span></div>}
              </div>
            </div>
          </div>

          {/* Final Amount */}
          <div className="bill-final-block" style={{ marginTop: 'var(--space-4)' }}>
            <div className="bill-final-label">FINAL AMOUNT</div>
            <div className="bill-final-value">{fmtInt(bill.finalAmount)}</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', position: 'sticky', bottom: 0, background: 'var(--bg-card)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className="btn btn--primary" onClick={onPrint}><i className="fa-solid fa-print"></i> Print Bill</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   DELETE CONFIRM MODAL (Password Protected)
   ═══════════════════════════════════════════ */
function DeleteModal({ bill, onClose, onConfirm }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleDelete = () => {
    if (password === 'admin123') {
      onConfirm(bill.id);
      onClose();
    } else {
      setError('Incorrect password. Deletion denied.');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal__header">
          <h2 className="modal__title" style={{ color: 'var(--color-danger)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }}></i>
            Delete Bill
          </h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="modal__body">
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            You are about to permanently delete <strong style={{ color: 'var(--text-primary)' }}>{bill?.id}</strong> for <strong style={{ color: 'var(--text-primary)' }}>{bill?.customer}</strong>.
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)' }}>
            This action cannot be undone. Enter admin password to confirm.
          </p>
          <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
            <label className="form-label">Admin Password *</label>
            <input
              className={`form-input${error ? ' form-input--error' : ''}`}
              type="password"
              placeholder="Enter password to delete"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              autoFocus
              id="delete-bill-password"
            />
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--danger" onClick={handleDelete} disabled={!password}>
            <i className="fa-solid fa-trash-can"></i> Delete Permanently
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   BILLS LIST PAGE
   ═══════════════════════════════════════════ */
export default function BillsList() {
  const { shop } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const mapBill = useCallback((b, type) => ({
    dbId: b.id,
    id: b.invoice_no || b.estimate_no || `BILL-${b.id}`,
    customer: b.customer_detail?.name || 'Walk-in',
    phone: b.customer_detail?.phone || '',
    address: b.customer_detail?.address || '',
    metal: b.metal_type || '—',
    billType: type,
    items: (b.items || []).map(i => ({
      name: i.product_name,
      huid: i.huid || '',
      weight: parseFloat(i.net_weight) || 0,
      rate: parseFloat(b.metal_rate) || 0,
      metalValue: parseFloat(i.metal_value) || (parseFloat(i.net_weight) * (parseFloat(b.metal_rate) / 10)),
      making: parseFloat(i.making_charge) || 0,
      total: parseFloat(i.total) || (parseFloat(i.net_weight) * (parseFloat(b.metal_rate) / 10) + parseFloat(i.making_charge))
    })),
    subtotal: parseFloat(b.subtotal) || 0,
    otherCharges: parseFloat(b.others || 0),
    hallmark: parseFloat(b.hallmark || 0),
    cgst: parseFloat(b.cgst || 0),
    sgst: parseFloat(b.sgst || 0),
    oldValue: parseFloat(b.old_amount || 0),
    oldWt: parseFloat(b.old_weight || 0),
    oldValueDirect: parseFloat(b.old_value_direct || 0),
    oldSettlementMode: b.old_settlement_mode || 'none',
    advance: parseFloat(b.advance || 0),
    discount: parseFloat(b.discount || 0),
    roundOff: parseFloat(b.round_off || 0),
    finalAmount: parseFloat(b.grand_total) || 0,
    rate10gm: parseFloat(b.metal_rate || 0),
    payment: b.payment_method?.toUpperCase() || 'CASH',
    paidCash: b.payment_method === 'cash' ? parseFloat(b.grand_total) || 0 : 0,
    paidOnline: b.payment_method !== 'cash' ? parseFloat(b.grand_total) || 0 : 0,
    status: 'Paid',
    date: b.created_at || new Date().toISOString()
  }), []);

  const fetchBills = useCallback(async (currentPage, searchQuery, typeF) => {
    try {
      setLoading(true);
      const queryParams = `?page=${currentPage}${searchQuery ? '&search=' + encodeURIComponent(searchQuery) : ''}`;
      
      let allResults = [];
      let total = 0;

      if (typeF === 'All' || typeF === 'Invoice') {
        try {
          const invRes = await api.get(`/billing/invoices/${queryParams}`);
          const invData = extractList(invRes.data);
          allResults = [...allResults, ...invData.map(b => mapBill(b, 'Invoice'))];
          total += invRes.data?.count || invData.length;
        } catch (e) {
          console.error('Failed to fetch invoices:', e);
        }
      }

      if (typeF === 'All' || typeF === 'Estimate') {
        try {
          const estRes = await api.get(`/billing/estimates/${queryParams}`);
          const estData = extractList(estRes.data);
          allResults = [...allResults, ...estData.map(b => mapBill(b, 'Estimate'))];
          total += estRes.data?.count || estData.length;
        } catch (e) {
          console.error('Failed to fetch estimates:', e);
        }
      }

      setBills(allResults.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setTotalCount(total);
      setTotalPages(Math.max(1, Math.ceil(total / 50)));

    } catch (err) {
      console.error('Failed to load bills', err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [mapBill]);

  // Debounce API calls when search or filters change
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchBills(page, search, typeFilter);
    }, 400);
    return () => clearTimeout(delay);
  }, [page, search, typeFilter, fetchBills]);

  /* Modals */
  const [viewBill, setViewBill] = useState(null);
  const [deleteBill, setDeleteBill] = useState(null);
  const [printData, setPrintData] = useState(null);

  const statuses = ['All', 'Paid', 'Pending', 'Partial', 'Cancelled'];
  const types = ['All', 'Invoice', 'Estimate'];

  /* Filtered Bills — local date/status filtering */
  const filtered = useMemo(() => {
    return bills.filter(b => {
      const matchStatus = statusFilter === 'All' || b.status === statusFilter;
      const matchDateFrom = !dateFrom || b.date >= dateFrom;
      const matchDateTo = !dateTo || b.date <= dateTo;
      return matchStatus && matchDateFrom && matchDateTo;
    });
  }, [bills, statusFilter, dateFrom, dateTo]);

  /* Stats */
  const stats = useMemo(() => ({
    total: bills.length,
    totalAmount: bills.filter(b => b.status !== 'Cancelled').reduce((s, b) => s + b.finalAmount, 0),
    paid: bills.filter(b => b.status === 'Paid').length,
    pending: bills.filter(b => b.status === 'Pending').length,
  }), [bills]);

  /* Actions */
  const handleDelete = async (id) => {
    try {
      const bill = bills.find(b => b.id === id);
      if (!bill) return;
      if (bill.billType === 'Invoice') {
        await api.delete(`/billing/invoices/${bill.dbId}/`);
      } else {
        await api.delete(`/billing/estimates/${bill.dbId}/`);
      }
      setBills(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
      alert("Failed to delete bill from server");
    }
  };

  const handlePrint = (bill) => {
    const docData = {
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
        docType: bill.billType === 'Invoice' ? 'TAX INVOICE' : 'ESTIMATE',
        theme: bill.metal.toLowerCase() === 'silver' ? 'silver' : 'gold',
        customer: { name: bill.customer, phone: bill.phone, address: bill.address },
        meta: { number: bill.id, date: new Date(bill.date).toLocaleDateString('en-IN') },
        rates: { rate10gm: bill.rate10gm },
        items: bill.items,
        oldMetal: (bill.oldSettlementMode === 'weight' && bill.oldWt > 0)
          ? { weight: bill.oldWt, value: bill.oldValue, mode: 'weight' }
          : (bill.oldSettlementMode === 'value' && bill.oldValueDirect > 0)
            ? { weight: 0, value: bill.oldValueDirect, mode: 'value' }
            : bill.oldValue > 0 ? { weight: bill.oldWt, value: bill.oldValue, mode: 'weight' } : null,
        totals: {
            subtotal: bill.subtotal,
            cgst: bill.cgst,
            sgst: bill.sgst,
            otherCharges: bill.otherCharges,
            hallmark: bill.hallmark,
            advance: bill.advance,
            discount: bill.discount,
            roundOff: bill.roundOff,
            finalAmount: bill.finalAmount
        },
        payment: { amounts: [
            { mode: 'CASH', amount: bill.paidCash },
            { mode: 'ONLINE', amount: bill.paidOnline }
        ].filter(x => x.amount > 0) }
    };
    setPrintData(docData);
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter('All'); setTypeFilter('All'); setDateFrom(''); setDateTo('');
  };

  const hasActiveFilters = search || statusFilter !== 'All' || typeFilter !== 'All' || dateFrom || dateTo;

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Bills List</h1>
          <div className="page-header__actions">
            <button className="btn btn--ghost btn--sm"><i className="fa-solid fa-download"></i> Export</button>
            <button className="btn btn--primary" onClick={() => window.location.href = '/billing'}><i className="fa-solid fa-plus"></i> New Bill</button>
          </div>
        </div>
        <p className="page-header__subtitle">View, search, and manage all invoices & estimates.</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Bills', value: stats.total, icon: 'fa-file-invoice', color: 'primary' },
          { label: 'Total Revenue', value: fmtInt(stats.totalAmount), icon: 'fa-indian-rupee-sign', color: 'success' },
          { label: 'Paid', value: stats.paid, icon: 'fa-check', color: 'success' },
          { label: 'Pending', value: stats.pending, icon: 'fa-clock', color: 'warning' },
        ].map((s, i) => (
          <div className="card animate-fade-in-up" style={{ padding: 'var(--space-4)' }} key={i}>
            <div className="card__header" style={{ marginBottom: 0 }}>
              <div>
                <div className="card__value" style={{ fontSize: 'var(--text-xl)' }}>{s.value}</div>
                <div className="card__label">{s.label}</div>
              </div>
              <div className={`card__icon card__icon--${s.color}`} style={{ width: 36, height: 36 }}><i className={`fa-solid ${s.icon}`}></i></div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="data-table-wrapper animate-fade-in-up">
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', minWidth: 200 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Search</label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }}></i>
                <input className="form-input" type="text" placeholder="Invoice #, customer, phone..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }} id="bills-search" />
              </div>
            </div>
            <div style={{ minWidth: 130 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Status</label>
              <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 130 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Type</label>
              <select className="form-input form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                {types.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>From Date</label>
              <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>To Date</label>
              <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }} />
            </div>
            {hasActiveFilters && (
              <button className="btn btn--ghost btn--sm" onClick={clearFilters} style={{ height: 36 }}>
                <i className="fa-solid fa-xmark"></i> Clear
              </button>
            )}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Showing {filtered.length} of {totalCount} bills
            {hasActiveFilters && <span style={{ color: 'var(--color-primary)', marginLeft: 8 }}>(filtered)</span>}
          </div>
        </div>

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Metal</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
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
                    <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>Loading bills...</div>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                    <i className="empty-state__icon fa-solid fa-file-circle-xmark"></i>
                    <div className="empty-state__title">No bills found</div>
                    <div className="empty-state__text">Try adjusting your search or filters</div>
                    {hasActiveFilters && (
                      <button className="btn btn--ghost btn--sm" onClick={clearFilters} style={{ marginTop: 'var(--space-3)' }}>Clear all filters</button>
                    )}
                  </div>
                </td>
              </tr>
            ) : filtered.map(bill => (
              <tr key={bill.id} style={{ cursor: 'pointer' }} onClick={() => setViewBill(bill)}>
                <td style={{ fontWeight: 600, color: 'var(--color-primary-hover)' }}>{bill.id}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{bill.customer}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{bill.phone}</div>
                </td>
                <td><span className={`badge badge--${bill.billType === 'Invoice' ? 'primary' : 'info'}`} style={{ fontSize: '0.6rem' }}>{bill.billType}</span></td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{bill.metal}</td>
                <td style={{ fontWeight: 500 }}>{(bill.items || []).length}</td>
                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(bill.finalAmount)}</td>
                <td style={{ fontSize: 'var(--text-sm)' }}>{bill.payment}</td>
                <td>{statusBadge(bill.status)}</td>
                <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                  <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                    <button className="btn btn--ghost btn--sm btn--icon" title="View" onClick={() => setViewBill(bill)}><i className="fa-solid fa-eye"></i></button>
                    <button className="btn btn--ghost btn--sm btn--icon" title="Print" onClick={() => handlePrint(bill)}><i className="fa-solid fa-print"></i></button>
                    <button className="btn btn--ghost btn--sm btn--icon" title="Delete" style={{ color: 'var(--color-danger)' }} onClick={() => setDeleteBill(bill)}><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center" style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-soft)' }}>
            <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
              <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <i className="fa-solid fa-chevron-left"></i> Previous
              </button>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} <span style={{ opacity: 0.5 }}>({totalCount} records)</span>
              </span>
              <button className="btn btn--ghost btn--sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Next <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewBill && <BillDetailModal bill={viewBill} onClose={() => setViewBill(null)} onPrint={() => { setViewBill(null); handlePrint(viewBill); }} />}
      {deleteBill && <DeleteModal bill={deleteBill} onClose={() => setDeleteBill(null)} onConfirm={handleDelete} />}
      <PrintPreviewModal isOpen={!!printData} data={printData} onClose={() => setPrintData(null)} />
    </div>
  );
}
