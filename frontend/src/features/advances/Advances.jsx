import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/axios';
import { toast } from '../../utils/toast';
import FallbackWatermarkSVG from "../../assets/media/svg.svg";

// ─── Helpers ────────────────────────────────────────────────────────────────
function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const fmt = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const IST = { timeZone: 'Asia/Kolkata' };
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric' })
  : '—';
const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  : '—';

const MODE_BADGE = {
  cash:          { bg: 'rgba(234,179,8,0.15)',   color: '#b45309', icon: 'fa-money-bill-wave' },
  upi:           { bg: 'rgba(59,130,246,0.15)',  color: '#1d4ed8', icon: 'fa-mobile-screen' },
  card:          { bg: 'rgba(168,85,247,0.15)',  color: '#6b21a8', icon: 'fa-credit-card' },
  bank_transfer: { bg: 'rgba(16,185,129,0.15)', color: '#065f46', icon: 'fa-building-columns' },
  cheque:        { bg: 'rgba(249,115,22,0.15)',  color: '#9a3412', icon: 'fa-file-invoice' },
  mixed:         { bg: 'rgba(100,116,139,0.15)', color: '#334155', icon: 'fa-layer-group' },
};
const badgeFor = (mode) => MODE_BADGE[mode?.toLowerCase()] || MODE_BADGE.cash;

const STATUS_BADGE = {
  active:    { bg: 'rgba(16,185,129,0.12)', color: '#065f46', label: 'Active' },
  cancelled: { bg: 'rgba(239,68,68,0.12)',  color: '#991b1b', label: 'Cancelled' },
};
const statusBadge = (s) => STATUS_BADGE[s] || STATUS_BADGE.active;

const PaymentModeBadge = ({ mode, small }) => {
  const b = badgeFor(mode);
  return (
    <span style={{ textTransform: 'uppercase', fontSize: small ? '0.68rem' : '0.72rem', fontWeight: 700,
      padding: small ? '2px 6px' : '3px 8px', borderRadius: 4, background: b.bg, color: b.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <i className={`fa-solid ${b.icon}`} style={{ fontSize: '0.65rem' }} />
      {mode}
    </span>
  );
};

// ─── Indian number-to-words ────────────────────────────────────────────────
function numToWords(n) {
  if (n === 0) return 'Zero';
  const o = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const t = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function c(num) {
    if (num === 0) return '';
    if (num < 20) return o[num] + ' ';
    if (num < 100) return t[Math.floor(num/10)] + (num%10 ? ' '+o[num%10] : '') + ' ';
    if (num < 1000) return o[Math.floor(num/100)] + ' Hundred ' + c(num%100);
    if (num < 100000) return c(Math.floor(num/1000)).trim() + ' Thousand ' + c(num%1000);
    if (num < 10000000) return c(Math.floor(num/100000)).trim() + ' Lakh ' + c(num%100000);
    return c(Math.floor(num/10000000)).trim() + ' Crore ' + c(num%10000000);
  }
  return c(Math.abs(Math.floor(n))).replace(/\s+/g,' ').trim();
}
function amountWords(amt) {
  const r = Math.floor(Math.abs(amt));
  const p = Math.round((Math.abs(amt) - r)*100);
  return numToWords(r) + ' Rupees' + (p > 0 ? ' and ' + numToWords(p) + ' Paise' : '') + ' Only';
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Advances() {
  const [tab, setTab] = useState('receipts');
  const [shopInfo, setShopInfo] = useState(null);
  const [customers, setCustomers] = useState([]);

  useEffect(() => { fetchShopInfo(); fetchCustomers(); }, []);

  const fetchShopInfo = async () => {
    try { const r = await api.get('/accounts/shop/current/'); setShopInfo(r.data); } catch {}
  };
  const fetchCustomers = async () => {
    try { const r = await api.get('/customers/'); setCustomers(extractList(r.data)); } catch {}
  };

  const TABS = [
    { key: 'receipts',  label: 'Receipts & Refunds', icon: 'fa-receipt' },
    { key: 'cashbook',  label: 'Daily Cash Book',    icon: 'fa-book' },
    { key: 'ledger',    label: 'Customer Ledger',     icon: 'fa-scale-balanced' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Advance Payments</h1>
        </div>
        <p className="page-header__subtitle">Record and audit customer advance deposits, daily cash reconciliation, and customer ledger statements.</p>
      </div>

      {/* Tab Bar */}
      <div className="tabs" style={{ marginBottom: 'var(--space-5)' }}>
        {TABS.map(t => (
          <button key={t.key} id={`adv-tab-${t.key}`}
            className={`tabs__tab${tab === t.key ? ' tabs__tab--active' : ''}`}
            onClick={() => setTab(t.key)}>
            <i className={`fa-solid ${t.icon}`} style={{ marginRight: 7 }} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'receipts' && <ReceiptsTab shopInfo={shopInfo} />}
      {tab === 'cashbook' && <CashBookTab shopInfo={shopInfo} />}
      {tab === 'ledger'   && <LedgerTab shopInfo={shopInfo} customers={customers} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: RECEIPTS & REFUNDS
// ═══════════════════════════════════════════════════════════
function ReceiptsTab({ shopInfo }) {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [isRefund, setIsRefund] = useState(false);

  // Record modal state
  const [orderQuery, setOrderQuery] = useState('');
  const [orderSearching, setOrderSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderAdvances, setOrderAdvances] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentSplits, setPaymentSplits] = useState([{ mode: 'cash', amount: '' }, { mode: 'upi', amount: '' }]);
  const [refNumber, setRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Receipt preview
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => { fetchAdvances(); }, []);

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/advances/');
      setAdvances(extractList(res.data));
    } catch { toast.error('Failed to load payments.'); }
    finally { setLoading(false); }
  };

  const fetchOrderAdvances = async (orderId) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/payments/advances/?order=${orderId}`);
      const list = extractList(res.data);
      setOrderAdvances(list);
      return list;
    } catch { return []; }
    finally { setLoadingHistory(false); }
  };

  const handleSearchOrder = async () => {
    const q = orderQuery.trim();
    if (!q) return;
    setOrderSearching(true);
    setSelectedOrder(null); setOrderAdvances([]); setAdvanceAmount('');
    try {
      const res = await api.get(`/orders/?search=${encodeURIComponent(q)}`);
      const orders = extractList(res.data);
      if (!orders.length) { toast.error('No orders found.'); return; }
      const matched = orders.find(o => o.order_no.toLowerCase().includes(q.toLowerCase())) || orders[0];
      const history = await fetchOrderAdvances(matched.id);

      const grandTotal    = parseFloat(matched.grand_total || 0);
      const orderAdvance  = parseFloat(matched.advance || 0);  // advance paid at booking — NOT an AdvancePayment record
      const receiptsPaid  = history.filter(p => p.status === 'active' && !p.is_refund).reduce((s,p) => s + parseFloat(p.amount||0), 0);
      const refundsIssued = history.filter(p => p.status === 'active' && p.is_refund).reduce((s,p) => s + parseFloat(p.amount||0), 0);
      const totalPaid     = orderAdvance + receiptsPaid - refundsIssued;
      const balance       = Math.max(grandTotal - totalPaid, 0);

      setSelectedOrder({ ...matched, orderAdvance, receiptsPaid, refundsIssued, totalPaid, balance });
      setAdvanceAmount(balance > 0 ? balance.toFixed(2) : '');
    } catch { toast.error('Error searching for order.'); }
    finally { setOrderSearching(false); }
  };

  const closeModal = () => {
    setShowAddModal(false); setIsRefund(false);
    setOrderQuery(''); setSelectedOrder(null); setOrderAdvances([]);
    setAdvanceAmount(''); setPaymentMode('cash'); setNotes(''); setRefNumber('');
    setPaymentSplits([{ mode: 'cash', amount: '' }, { mode: 'upi', amount: '' }]);
  };

  const newAmt = parseFloat(advanceAmount) || 0;
  const balance = selectedOrder?.balance ?? 0;
  const afterBalance = Math.max(balance - newAmt, 0);
  const mixedTotal = paymentSplits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedOrder) { toast.error('Please select a valid order.'); return; }
    const finalAmt = paymentMode === 'mixed' ? mixedTotal : newAmt;
    if (!finalAmt || finalAmt <= 0) { toast.error('Enter a valid amount > ₹0.'); return; }
    if (!isRefund && finalAmt > balance + 0.01) {
      if (!window.confirm(`₹${fmt(finalAmt)} exceeds remaining balance ₹${fmt(balance)}. Proceed?`)) return;
    }
    setSaving(true);
    try {
      const body = {
        shop: shopInfo?.id,
        order: selectedOrder.id,
        amount: finalAmt,
        payment_mode: paymentMode,
        notes: notes.trim(),
        reference_number: refNumber.trim() || null,
        is_refund: isRefund,
        ...(paymentMode === 'mixed' ? { payment_splits: paymentSplits.filter(s => parseFloat(s.amount) > 0).map(s => ({ mode: s.mode, amount: parseFloat(s.amount) })) } : {}),
      };
      const res = await api.post('/payments/advances/', body);
      toast.success(isRefund ? 'Refund recorded!' : 'Advance payment recorded!');
      closeModal();
      fetchAdvances();
      setActiveReceipt(res.data);
      setShowReceiptModal(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { toast.error('Please provide a cancellation reason.'); return; }
    setCancelling(true);
    try {
      await api.post(`/payments/advances/${cancelTarget.id}/cancel/`, { reason: cancelReason });
      toast.success(`Receipt ${cancelTarget.receipt_no} cancelled.`);
      setCancelTarget(null); setCancelReason('');
      fetchAdvances();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel.');
    } finally { setCancelling(false); }
  };

  const handlePrint = async () => {
    if (!activeReceipt) return;
    if (window.electronAPI) {
      const res = await window.electronAPI.printToPDF(`Receipt_${activeReceipt.receipt_no}.pdf`);
      if (res.success) toast.success('Receipt printed.');
      else if (res.reason !== 'canceled') toast.error(`Print failed: ${res.error}`);
    } else { window.print(); }
  };

  const filtered = advances.filter(adv => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      adv.receipt_no?.toLowerCase().includes(q) ||
      adv.order_detail?.order_no?.toLowerCase().includes(q) ||
      adv.order_detail?.customer_detail?.name?.toLowerCase().includes(q) ||
      adv.order_detail?.customer_detail?.phone?.includes(q)
    );
    const matchesStatus = filterStatus === 'all' || adv.status === filterStatus ||
      (filterStatus === 'refund' && adv.is_refund);
    return matchesSearch && matchesStatus;
  });

  const totalActive = advances.filter(a => a.status === 'active' && !a.is_refund).reduce((s, a) => s + parseFloat(a.amount||0), 0);
  const totalCancelled = advances.filter(a => a.status === 'cancelled').length;
  const totalRefunds = advances.filter(a => a.is_refund && a.status === 'active').reduce((s,a) => s + parseFloat(a.amount||0), 0);

  return (
    <>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {[
          { icon: 'fa-hand-holding-dollar', label: 'Total Advances Collected', value: `₹${fmt(totalActive)}`, accent: 'var(--color-primary-muted)', iconColor: 'var(--color-primary)' },
          { icon: 'fa-receipt', label: 'Total Transactions', value: advances.length, accent: 'rgba(34,197,94,0.15)', iconColor: '#10b981' },
          { icon: 'fa-arrow-rotate-left', label: 'Refunds Issued', value: `₹${fmt(totalRefunds)}`, accent: 'rgba(249,115,22,0.15)', iconColor: '#ea580c' },
          { icon: 'fa-ban', label: 'Cancelled', value: totalCancelled, accent: 'rgba(239,68,68,0.12)', iconColor: '#dc2626' },
        ].map(c => (
          <div key={c.label} style={{ background: 'linear-gradient(135deg, var(--bg-card), var(--bg-surface))', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: c.accent, color: c.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
              <i className={`fa-solid ${c.icon}`} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input className="form-input" type="text" placeholder="Search receipt no, order, customer…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft:36, height:38 }} />
        </div>
        <select className="form-input form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ height:38, width:'auto', minWidth:150 }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="refund">Refunds</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button id="adv-record-refund-btn" className="btn btn--outline" onClick={() => { setIsRefund(true); setShowAddModal(true); }}>
            <i className="fa-solid fa-arrow-rotate-left" style={{ marginRight: 6 }} />Refund
          </button>
          <button id="adv-record-advance-btn" className="btn btn--primary" onClick={() => { setIsRefund(false); setShowAddModal(true); }}>
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Record Advance
          </button>
        </div>
      </div>

      {/* Receipts Table */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign:'center', color:'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize:'2rem', display:'block', marginBottom:12 }} />Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-secondary)', borderRadius:'var(--radius-md)', padding:'4rem 2rem', textAlign:'center', color:'var(--text-muted)' }}>
          <i className="fa-solid fa-folder-open" style={{ fontSize:'3rem', marginBottom:16, opacity:0.3, display:'block' }} />
          <h3>{searchQuery ? 'No match found.' : 'No Advance Payments Yet'}</h3>
        </div>
      ) : (
        <div className="table-responsive" style={{ border:'1px solid var(--border-primary)', borderRadius:'var(--radius-md)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Order No</th>
                <th>Customer</th>
                <th style={{ textAlign:'right' }}>Amount (₹)</th>
                <th>Mode</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign:'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(adv => {
                const cust = adv.order_detail?.customer_detail || {};
                const sb = statusBadge(adv.status);
                const isCancelled = adv.status === 'cancelled';
                return (
                  <tr key={adv.id} style={{ opacity: isCancelled ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600, color: isCancelled ? 'var(--text-muted)' : 'var(--color-primary)', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                      {adv.receipt_no}
                    </td>
                    <td style={{ fontWeight: 500 }}>{adv.order_detail?.order_no || '—'}</td>
                    <td>{cust.name || 'Walk-in'}</td>
                    <td style={{ fontWeight: 600, textAlign:'right', color: adv.is_refund ? '#dc2626' : 'inherit' }}>
                      {adv.is_refund ? '-' : ''}₹{fmt(adv.amount)}
                    </td>
                    <td><PaymentModeBadge mode={adv.payment_mode} /></td>
                    <td>
                      <span style={{ fontSize:'0.72rem', fontWeight:600, padding:'2px 7px', borderRadius:4,
                        background: adv.is_refund ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                        color: adv.is_refund ? '#dc2626' : '#059669' }}>
                        {adv.is_refund ? 'REFUND' : 'PAYMENT'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize:'0.72rem', fontWeight:600, padding:'2px 7px', borderRadius:4, background:sb.bg, color:sb.color }}>
                        {sb.label}
                      </span>
                    </td>
                    <td style={{ fontSize:'var(--text-xs)' }}>{fmtDateTime(adv.payment_date)}</td>
                    <td style={{ textAlign:'center' }}>
                      <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                        <button className="btn btn--ghost btn--sm btn--icon" title="Print Receipt"
                          onClick={() => { setActiveReceipt(adv); setShowReceiptModal(true); }}>
                          <i className="fa-solid fa-print" />
                        </button>
                        {!isCancelled && (
                          <button className="btn btn--ghost btn--sm btn--icon" title="Cancel"
                            style={{ color:'var(--color-danger)' }}
                            onClick={() => setCancelTarget(adv)}>
                            <i className="fa-solid fa-ban" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Record Modal */}
      {showAddModal && (
        <>
          <div className="overlay" onClick={closeModal} style={{ zIndex:1000 }} />
          <div className="modal" style={{ maxWidth:700, width:'95%', zIndex:1001, borderRadius:'var(--radius-lg)', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
            <div className="modal__header" style={{ flexShrink:0 }}>
              <h2 className="modal__title">
                <i className={`fa-solid ${isRefund ? 'fa-arrow-rotate-left' : 'fa-hand-holding-dollar'}`} style={{ marginRight:8, color: isRefund ? '#dc2626' : 'var(--color-primary)' }} />
                {isRefund ? 'Record Refund' : 'Record Advance Payment'}
              </h2>
              <button className="btn btn--ghost btn--sm btn--icon" onClick={closeModal}><i className="fa-solid fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
              <div className="modal__body" style={{ padding:'var(--space-4)', overflowY:'auto', flex:1 }}>

                {/* Step 1: Find Order */}
                <div className="billing-form" style={{ marginBottom:'var(--space-4)' }}>
                  <div className="billing-form__header">
                    <span className="billing-form__header-title"><i className="fa-solid fa-magnifying-glass" style={{ marginRight:6 }} />Find Order</span>
                  </div>
                  <div className="billing-form__body">
                    <div style={{ display:'flex', gap:'var(--space-2)' }}>
                      <input className="form-input" type="text" placeholder="Order number, customer name or phone…"
                        value={orderQuery} onChange={e => setOrderQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchOrder()} autoFocus />
                      <button type="button" className="btn btn--primary" onClick={handleSearchOrder} disabled={orderSearching || !orderQuery.trim()} style={{ whiteSpace:'nowrap' }}>
                        {orderSearching ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-search" style={{ marginRight:6 }} />Search</>}
                      </button>
                    </div>
                    {selectedOrder && (
                      <div style={{ marginTop:14, borderRadius:'var(--radius-md)', border:'1px solid var(--color-primary)', overflow:'hidden' }}>
                        <div style={{ background:'var(--color-primary)', color:'#fff', padding:'8px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontWeight:700, fontSize:'var(--text-sm)' }}><i className="fa-solid fa-file-invoice" style={{ marginRight:6 }} />{selectedOrder.order_no}</span>
                          <span style={{ fontSize:'var(--text-xs)', opacity:0.85 }}>{selectedOrder.order_type}</span>
                        </div>
                        <div style={{ padding:'12px 14px', background:'var(--bg-surface)', fontSize:'var(--text-sm)' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', marginBottom:10 }}>
                            <div><span style={{ color:'var(--text-muted)' }}>Customer:</span> <strong>{selectedOrder.customer_detail?.name || 'Walk-in'}</strong></div>
                            <div><span style={{ color:'var(--text-muted)' }}>Phone:</span> <strong>{selectedOrder.customer_detail?.phone || '—'}</strong></div>
                          </div>
                          <div style={{ background:'var(--bg-card)', borderRadius:4, padding:'10px 12px', border:'1px solid var(--border-primary)' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                              <span style={{ color:'var(--text-muted)' }}>Order Total</span>
                              <strong>₹{fmt(selectedOrder.grand_total)}</strong>
                            </div>
                            {selectedOrder.orderAdvance > 0 && (
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, color:'#059669' }}>
                                <span><i className="fa-solid fa-file-invoice" style={{ marginRight:5, opacity:0.7 }} />Order Advance (at booking)</span>
                                <span style={{ fontWeight:600 }}>₹{fmt(selectedOrder.orderAdvance)}</span>
                              </div>
                            )}
                            {selectedOrder.receiptsPaid > 0 && (
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, color:'#059669' }}>
                                <span><i className="fa-solid fa-receipt" style={{ marginRight:5, opacity:0.7 }} />Advance Receipts</span>
                                <span style={{ fontWeight:600 }}>₹{fmt(selectedOrder.receiptsPaid)}</span>
                              </div>
                            )}
                            {selectedOrder.refundsIssued > 0 && (
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, color:'#dc2626' }}>
                                <span><i className="fa-solid fa-arrow-rotate-left" style={{ marginRight:5, opacity:0.7 }} />Refunds Issued</span>
                                <span style={{ fontWeight:600 }}>-₹{fmt(selectedOrder.refundsIssued)}</span>
                              </div>
                            )}
                            <div style={{ borderTop:'1px dashed var(--border-secondary)', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between' }}>
                              <span style={{ fontWeight:700, color:'var(--color-primary)' }}>Balance Due</span>
                              <strong style={{ color: selectedOrder.balance > 0 ? 'var(--color-primary)' : '#16a34a', fontSize:'1.05rem' }}>₹{fmt(selectedOrder.balance)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Payment History */}
                {selectedOrder && orderAdvances.length > 0 && (
                  <div className="billing-form" style={{ marginBottom:'var(--space-4)' }}>
                    <div className="billing-form__header">
                      <span className="billing-form__header-title"><i className="fa-solid fa-clock-rotate-left" style={{ marginRight:6 }} />Payment History</span>
                    </div>
                    <div className="billing-form__body">
                      <div style={{ border:'1px solid var(--border-primary)', borderRadius:4, overflow:'hidden' }}>
                        <table style={{ width:'100%', fontSize:'0.8rem', borderCollapse:'collapse' }}>
                          <thead>
                            <tr style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border-secondary)' }}>
                              <th style={{ padding:'6px 10px', textAlign:'left' }}>Receipt</th>
                              <th style={{ padding:'6px 10px', textAlign:'left' }}>Date</th>
                              <th style={{ padding:'6px 10px', textAlign:'left' }}>Mode</th>
                              <th style={{ padding:'6px 10px', textAlign:'left' }}>Type</th>
                              <th style={{ padding:'6px 10px', textAlign:'left' }}>Status</th>
                              <th style={{ padding:'6px 10px', textAlign:'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderAdvances.map(p => {
                              const sb = statusBadge(p.status);
                              return (
                                <tr key={p.id} style={{ borderBottom:'1px solid var(--border-secondary)', opacity: p.status === 'cancelled' ? 0.55 : 1 }}>
                                  <td style={{ padding:'6px 10px', fontWeight:600, color:'var(--color-primary)', textDecoration: p.status === 'cancelled' ? 'line-through' : 'none' }}>{p.receipt_no}</td>
                                  <td style={{ padding:'6px 10px' }}>{fmtDateTime(p.payment_date)}</td>
                                  <td style={{ padding:'6px 10px' }}><PaymentModeBadge mode={p.payment_mode} small /></td>
                                  <td style={{ padding:'6px 10px' }}>
                                    <span style={{ fontSize:'0.68rem', fontWeight:600, padding:'1px 5px', borderRadius:3, background: p.is_refund ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: p.is_refund ? '#dc2626' : '#059669' }}>
                                      {p.is_refund ? 'REFUND' : 'PAYMENT'}
                                    </span>
                                  </td>
                                  <td style={{ padding:'6px 10px' }}>
                                    <span style={{ fontSize:'0.68rem', fontWeight:600, padding:'1px 5px', borderRadius:3, background:sb.bg, color:sb.color }}>{sb.label}</span>
                                  </td>
                                  <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600, color: p.is_refund ? '#dc2626' : 'inherit' }}>
                                    {p.is_refund ? '-' : ''}₹{fmt(p.amount)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: New Entry Form */}
                {selectedOrder && (
                  <div className="billing-form">
                    <div className="billing-form__header">
                      <span className="billing-form__header-title">
                        <i className={`fa-solid ${isRefund ? 'fa-minus-circle' : 'fa-plus-circle'}`} style={{ marginRight:6 }} />
                        {isRefund ? 'Refund Amount' : 'New Advance Payment'}
                      </span>
                    </div>
                    <div className="billing-form__body">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Payment Mode *</label>
                          <select className="form-input form-select" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                            <option value="cash">Cash</option>
                            <option value="upi">UPI / Online</option>
                            <option value="card">Card</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="cheque">Cheque</option>
                            <option value="mixed">Mixed (Split)</option>
                          </select>
                        </div>
                        {paymentMode !== 'mixed' && (
                          <div className="form-group">
                            <label className="form-label">Amount (₹) *</label>
                            <input className="form-input" type="number" step="0.01" min="0.01" placeholder="0.00"
                              value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} required />
                            {!isRefund && advanceAmount && newAmt > 0 && (
                              <div style={{ marginTop:5, fontSize:'var(--text-xs)', color: afterBalance > 0 ? 'var(--color-primary)' : '#16a34a' }}>
                                After payment, balance due: <strong>₹{fmt(afterBalance)}</strong>
                                {afterBalance === 0 && ' ✅ Fully paid!'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mixed Split Inputs */}
                      {paymentMode === 'mixed' && (
                        <div style={{ background:'var(--bg-surface)', borderRadius:'var(--radius-md)', padding:'var(--space-3)', border:'1px solid var(--border-primary)', marginBottom:'var(--space-3)' }}>
                          <div style={{ fontSize:'var(--text-xs)', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'var(--space-3)' }}>
                            Split by Mode
                          </div>
                          {paymentSplits.map((sp, idx) => (
                            <div key={idx} style={{ display:'flex', gap:'var(--space-2)', marginBottom:'var(--space-2)', alignItems:'center' }}>
                              <select className="form-input form-select" value={sp.mode} style={{ flex:'0 0 140px' }}
                                onChange={e => setPaymentSplits(prev => prev.map((s,i) => i===idx ? {...s, mode:e.target.value} : s))}>
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                              </select>
                              <input className="form-input" type="number" step="0.01" placeholder="Amount" value={sp.amount}
                                onChange={e => setPaymentSplits(prev => prev.map((s,i) => i===idx ? {...s, amount:e.target.value} : s))}
                                style={{ flex:1 }} />
                              {paymentSplits.length > 1 && (
                                <button type="button" className="btn btn--ghost btn--sm btn--icon" style={{ color:'var(--color-danger)' }}
                                  onClick={() => setPaymentSplits(prev => prev.filter((_,i) => i!==idx))}>
                                  <i className="fa-solid fa-minus" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn btn--outline btn--sm" onClick={() => setPaymentSplits(prev => [...prev, { mode:'cash', amount:'' }])}>
                            <i className="fa-solid fa-plus" style={{ marginRight:6 }} />Add Split
                          </button>
                          <div style={{ marginTop:'var(--space-2)', fontSize:'var(--text-sm)', fontWeight:600, color: 'var(--text-primary)' }}>
                            Total: ₹{fmt(mixedTotal)}
                          </div>
                        </div>
                      )}

                      <div className="form-row">
                        {(paymentMode === 'bank_transfer' || paymentMode === 'cheque' || paymentMode === 'upi') && (
                          <div className="form-group">
                            <label className="form-label">Reference / Txn No</label>
                            <input className="form-input" type="text" placeholder="Transaction / cheque number"
                              value={refNumber} onChange={e => setRefNumber(e.target.value)} />
                          </div>
                        )}
                        <div className="form-group">
                          <label className="form-label">Remarks / Notes</label>
                          <input className="form-input" type="text" placeholder="E.g., 2nd instalment" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal__footer" style={{ flexShrink:0 }}>
                <button type="button" className="btn btn--outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving || !selectedOrder}
                  style={{ background: isRefund ? '#dc2626' : undefined }}>
                  {saving ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight:6 }} />Saving…</>
                    : <><i className={`fa-solid ${isRefund ? 'fa-check' : 'fa-check'}`} style={{ marginRight:6 }} />
                      {isRefund ? `Refund ₹${fmt(paymentMode==='mixed' ? mixedTotal : newAmt)}` : `Record ₹${fmt(paymentMode==='mixed' ? mixedTotal : newAmt)}`}</>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Cancel Modal */}
      {cancelTarget && (
        <>
          <div className="overlay" onClick={() => { setCancelTarget(null); setCancelReason(''); }} style={{ zIndex:1000 }} />
          <div className="modal" style={{ maxWidth:480, width:'95%', zIndex:1001 }}>
            <div className="modal__header">
              <h2 className="modal__title"><i className="fa-solid fa-ban" style={{ marginRight:8, color:'var(--color-danger)' }} />Cancel Receipt</h2>
              <button className="btn btn--ghost btn--sm btn--icon" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal__body">
              <div style={{ marginBottom:'var(--space-3)', padding:'var(--space-3)', background:'rgba(239,68,68,0.08)', borderRadius:'var(--radius-md)', border:'1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontWeight:600, color:'var(--text-primary)' }}>{cancelTarget.receipt_no} — ₹{fmt(cancelTarget.amount)}</div>
                <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>
                  This will create reversing entries in the Ledger and Cash Book. The receipt will remain in the database with a CANCELLED status.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cancellation Reason *</label>
                <textarea className="form-input" rows={3} placeholder="Enter reason for cancellation…"
                  value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  style={{ resize:'vertical', minHeight:70 }} />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Back</button>
              <button className="btn btn--danger" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
                {cancelling ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight:6 }} />Cancelling…</>
                  : <><i className="fa-solid fa-ban" style={{ marginRight:6 }} />Confirm Cancel</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Receipt Preview Modal */}
      {showReceiptModal && activeReceipt && (
        <>
          <div className="overlay no-print" onClick={() => setShowReceiptModal(false)} style={{ zIndex:10000 }} />
          <div className="modal no-print" style={{ maxWidth:650, width:'95%', zIndex:10001, height:'85vh', display:'flex', flexDirection:'column' }}>
            <div className="modal__header" style={{ flexShrink:0 }}>
              <h2 className="modal__title"><i className="fa-solid fa-receipt" style={{ color:'var(--color-primary)', marginRight:10 }} />Receipt Preview</h2>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn--primary btn--sm" onClick={handlePrint}><i className="fa-solid fa-print" style={{ marginRight:6 }} />Print</button>
                <button className="btn btn--ghost btn--sm btn--icon" onClick={() => setShowReceiptModal(false)}><i className="fa-solid fa-xmark" /></button>
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', background:'#f0f0f0', padding:'20px 0', display:'flex', justifyContent:'center' }}>
              <ReceiptPreview receipt={activeReceipt} shopInfo={shopInfo} />
            </div>
          </div>
          {createPortal(<PrintLayout receipt={activeReceipt} shopInfo={shopInfo} />, document.body)}
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: DAILY CASH BOOK
// ═══════════════════════════════════════════════════════════
function CashBookTab({ shopInfo }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/payments/advances/cashbook/?date=${date}&shop=${shopInfo?.id || 1}`);
      setData(res.data);
    } catch { toast.error('Failed to load cash book.'); }
    finally { setLoading(false); }
  }, [date, shopInfo]);

  useEffect(() => { load(); }, [load]);

  const MODES = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];

  return (
    <div className="animate-fade-in-up">
      {/* Date picker */}
      <div className="billing-form" style={{ marginBottom:'var(--space-4)' }}>
        <div className="billing-form__header">
          <span className="billing-form__header-title"><i className="fa-solid fa-calendar-day" style={{ marginRight:8, opacity:0.6 }} />Select Date</span>
        </div>
        <div className="billing-form__body">
          <div style={{ display:'flex', gap:'var(--space-3)', alignItems:'center' }}>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth:200 }} id="cashbook-date-picker" />
            <button className="btn btn--primary" onClick={load} disabled={loading}>
              {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-sync" style={{ marginRight:6 }} />Refresh</>}
            </button>
          </div>
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(170px,1fr))', gap:'var(--space-3)', marginBottom:'var(--space-5)' }}>
            {[
              { label:'Opening Balance', value:`₹${fmt(data.opening_balance)}`, color:'var(--text-primary)', icon:'fa-wallet' },
              { label:'Total Cash In', value:`₹${fmt(data.total_in)}`, color:'#059669', icon:'fa-arrow-down' },
              { label:'Total Cash Out', value:`₹${fmt(data.total_out)}`, color:'#dc2626', icon:'fa-arrow-up' },
              { label:'Closing Balance', value:`₹${fmt(data.closing_balance)}`, color:'var(--color-primary)', icon:'fa-coins', bold:true },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-4)', boxShadow:'var(--shadow-sm)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <i className={`fa-solid ${c.icon}`} style={{ color:c.color, fontSize:'1.1rem' }} />
                  <span style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500 }}>{c.label}</span>
                </div>
                <div style={{ fontSize: c.bold ? 'var(--text-xl)' : 'var(--text-lg)', fontWeight:700, color:c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Mode-wise Summary */}
          <div className="billing-form" style={{ marginBottom:'var(--space-5)' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-chart-bar" style={{ marginRight:8, opacity:0.6 }} />By Payment Mode</span>
            </div>
            <div className="billing-form__body">
              <div style={{ overflowX:'auto' }}>
                <table className="table" style={{ fontSize:'var(--text-sm)' }}>
                  <thead>
                    <tr>
                      <th>Mode</th>
                      <th style={{ textAlign:'right', color:'#059669' }}>Cash In (₹)</th>
                      <th style={{ textAlign:'right', color:'#dc2626' }}>Cash Out (₹)</th>
                      <th style={{ textAlign:'right' }}>Net (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODES.filter(m => data.mode_summaries?.[m]?.in || data.mode_summaries?.[m]?.out).map(m => {
                      const ms = data.mode_summaries?.[m] || { in:0, out:0, net:0 };
                      return (
                        <tr key={m}>
                          <td><PaymentModeBadge mode={m} /></td>
                          <td style={{ textAlign:'right', color:'#059669', fontWeight:600 }}>₹{fmt(ms.in)}</td>
                          <td style={{ textAlign:'right', color:'#dc2626', fontWeight:600 }}>₹{fmt(ms.out)}</td>
                          <td style={{ textAlign:'right', fontWeight:700, color: ms.net >= 0 ? 'var(--text-primary)' : '#dc2626' }}>₹{fmt(ms.net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="billing-form">
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-list" style={{ marginRight:8, opacity:0.6 }} />Transactions ({data.entries?.length || 0})</span>
            </div>
            <div className="billing-form__body" style={{ padding:0 }}>
              {data.entries?.length === 0 ? (
                <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>No transactions for this date.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ fontSize:'var(--text-sm)' }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Mode</th>
                        <th>Reference</th>
                        <th>Notes</th>
                        <th style={{ textAlign:'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontSize:'var(--text-xs)', whiteSpace:'nowrap' }}>{fmtDateTime(e.created_at)}</td>
                          <td>
                            <span style={{ fontSize:'0.72rem', fontWeight:700, padding:'2px 7px', borderRadius:4,
                              background: e.entry_type==='in' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                              color: e.entry_type==='in' ? '#059669' : '#dc2626' }}>
                              {e.entry_type === 'in' ? '↓ IN' : '↑ OUT'}
                            </span>
                          </td>
                          <td><PaymentModeBadge mode={e.payment_mode} small /></td>
                          <td style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>{e.reference_number || '—'}</td>
                          <td style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)' }}>{e.notes || '—'}</td>
                          <td style={{ textAlign:'right', fontWeight:600, color: e.entry_type==='in' ? '#059669' : '#dc2626' }}>
                            {e.entry_type==='in' ? '' : '−'}₹{fmt(e.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: CUSTOMER LEDGER
// ═══════════════════════════════════════════════════════════
function LedgerTab({ shopInfo, customers }) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadLedger = useCallback(async () => {
    if (!selectedCustomer) return;
    setLoading(true);
    try {
      const res = await api.get(`/payments/advances/ledger/?customer=${selectedCustomer}&shop=${shopInfo?.id || 1}`);
      setData(res.data);
    } catch { toast.error('Failed to load ledger.'); }
    finally { setLoading(false); }
  }, [selectedCustomer, shopInfo]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const filteredCustomers = customerSearch
    ? customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch))
    : customers;

  const REFERENCE_LABELS = {
    order: { icon:'fa-file-invoice', color:'var(--color-primary)' },
    payment: { icon:'fa-hand-holding-dollar', color:'#059669' },
    refund: { icon:'fa-arrow-rotate-left', color:'#dc2626' },
    cancellation: { icon:'fa-ban', color:'#6b7280' },
    invoice: { icon:'fa-file-invoice-dollar', color:'#7c3aed' },
  };

  return (
    <div className="animate-fade-in-up">
      <div className="billing-form" style={{ marginBottom:'var(--space-5)' }}>
        <div className="billing-form__header">
          <span className="billing-form__header-title"><i className="fa-solid fa-user-tag" style={{ marginRight:8, opacity:0.6 }} />Select Customer</span>
        </div>
        <div className="billing-form__body">
          <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:220 }}>
              <input className="form-input" type="text" placeholder="Search customers by name or phone…"
                value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} id="ledger-customer-search" />
            </div>
            <select className="form-input form-select" value={selectedCustomer}
              onChange={e => setSelectedCustomer(e.target.value)} style={{ flex:1, minWidth:220 }} id="ledger-customer-select">
              <option value="">— Select Customer —</option>
              {filteredCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize:'2rem', display:'block', marginBottom:12 }} />Loading ledger…
        </div>
      )}

      {data && !loading && (
        <>
          {/* Balance Card */}
          <div style={{ background: data.current_balance <= 0 ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.05))' : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.05))',
            border: `1px solid ${data.current_balance <= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius:'var(--radius-lg)', padding:'var(--space-5)', marginBottom:'var(--space-5)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'var(--text-sm)', color:'var(--text-muted)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                {customers.find(c => String(c.id) === String(selectedCustomer))?.name || 'Customer'} — Current Balance
              </div>
              <div style={{ fontSize:'var(--text-3xl)', fontWeight:800, color: data.current_balance <= 0 ? '#059669' : '#dc2626', marginTop:4 }}>
                ₹{fmt(Math.abs(data.current_balance))}
              </div>
              <div style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', marginTop:4 }}>
                {data.current_balance <= 0 ? '✅ No outstanding dues' : '⚠️ Amount outstanding'}
              </div>
            </div>
            <i className={`fa-solid ${data.current_balance <= 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}
              style={{ fontSize:'3rem', opacity:0.2, color: data.current_balance <= 0 ? '#059669' : '#dc2626' }} />
          </div>

          {/* Ledger Table */}
          <div className="billing-form">
            <div className="billing-form__header">
              <span className="billing-form__header-title"><i className="fa-solid fa-table-list" style={{ marginRight:8, opacity:0.6 }} />Account Statement ({data.statement?.length || 0} entries)</span>
            </div>
            <div className="billing-form__body" style={{ padding:0 }}>
              {data.statement?.length === 0 ? (
                <div style={{ padding:'2rem', textAlign:'center', color:'var(--text-muted)' }}>No ledger entries for this customer.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ fontSize:'var(--text-sm)' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Description</th>
                        <th style={{ textAlign:'right', color:'#dc2626' }}>Debit (Dr)</th>
                        <th style={{ textAlign:'right', color:'#059669' }}>Credit (Cr)</th>
                        <th style={{ textAlign:'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statement.map(entry => {
                        const ref = REFERENCE_LABELS[entry.reference_type] || { icon:'fa-circle', color:'var(--text-muted)' };
                        return (
                          <tr key={entry.id}>
                            <td style={{ fontSize:'var(--text-xs)', whiteSpace:'nowrap' }}>{fmtDateTime(entry.created_at)}</td>
                            <td>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:'0.72rem', fontWeight:600,
                                padding:'2px 7px', borderRadius:4, background:`${ref.color}18`, color:ref.color }}>
                                <i className={`fa-solid ${ref.icon}`} style={{ fontSize:'0.6rem' }} />
                                {entry.reference_type?.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', maxWidth:220 }}>{entry.description}</td>
                            <td style={{ textAlign:'right', fontWeight:600, color:'#dc2626' }}>
                              {entry.entry_type === 'debit' ? `₹${fmt(entry.amount)}` : '—'}
                            </td>
                            <td style={{ textAlign:'right', fontWeight:600, color:'#059669' }}>
                              {entry.entry_type === 'credit' ? `₹${fmt(entry.amount)}` : '—'}
                            </td>
                            <td style={{ textAlign:'right', fontWeight:700, color: entry.running_balance > 0 ? '#dc2626' : '#059669' }}>
                              ₹{fmt(Math.abs(entry.running_balance))}
                              <span style={{ fontSize:'0.65rem', marginLeft:4, opacity:0.7 }}>
                                {entry.running_balance > 0 ? 'Dr' : 'Cr'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Receipt Preview (screen) ────────────────────────────────────────────────
function ReceiptPreview({ receipt, shopInfo }) {
  const order = receipt.order_detail || {};
  const cust = order.customer_detail || {};
  const amountInWords = amountWords(parseFloat(receipt.amount));
  const stampNo = receipt.receipt_no ? receipt.receipt_no.replace(/^\D+/g, '') : '';
  const shopName = shopInfo?.name || 'MY JEWELLERY SHOP';
  const shopAddress = shopInfo?.address || '';
  const isCancelled = receipt.status === 'cancelled';

  return (
    <div style={{ color:'#000', width:'100%', maxWidth:'700px', padding:'20px 24px', borderRadius:'8px',
      boxShadow:'0 6px 15px rgba(0,0,0,0.15)', fontFamily:'Arial, sans-serif', boxSizing:'border-box',
      border: isCancelled ? '2px solid #dc2626' : '1.5px solid #000', background:'#fff',
      position:'relative', display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight:420 }}>

      {/* CANCELLED watermark */}
      {isCancelled && (
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-35deg)',
          fontSize:'4rem', fontWeight:900, color:'rgba(220,38,38,0.18)', letterSpacing:'0.1em',
          whiteSpace:'nowrap', pointerEvents:'none', zIndex:1, userSelect:'none' }}>
          CANCELLED
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', height:'80px' }}>
        <div style={{ display:'flex', flexDirection:'column' }}>
          <span style={{ fontSize:'13px', fontWeight:'bold' }}>Sl. No.</span>
          <span style={{ color: isCancelled ? '#dc2626' : '#dc2626', fontFamily:'"Courier New", Courier, monospace', fontSize:'28px', fontWeight:'bold', marginTop:'2px', letterSpacing:'1px' }}>
            {stampNo || receipt.receipt_no || '—'}
          </span>
        </div>
        <div style={{ textAlign:'center', flex:1, padding:'0 10px' }}>
          <div style={{ textTransform:'uppercase', fontSize:'13px', fontWeight:'bold', textDecoration:'underline', letterSpacing:'1px', marginBottom:'2px' }}>
            {receipt.is_refund ? 'REFUND VOUCHER' : 'RECEIPT VOUCHER'}
          </div>
          <div style={{ fontSize:'20px', fontWeight:'900', letterSpacing:'0.5px', textTransform:'uppercase' }}>{shopName}</div>
          <div style={{ fontSize:'9px', fontWeight:'bold', textTransform:'uppercase', color:'#111', marginTop:'2px' }}>{shopAddress}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end' }}>
          <span style={{ fontSize:'13px', fontWeight:'bold' }}>Date</span>
          <span style={{ borderBottom:'1px solid #000', padding:'0 8px', marginTop:'4px', fontWeight:'bold', fontSize:'13px' }}>
            {receipt.payment_date ? fmtDateTime(receipt.payment_date) : ''}
          </span>
        </div>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse', border:'1.5px solid #000' }}>
        <tbody>
          <tr style={{ borderBottom:'1.5px solid #000' }}>
            <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', width:'22%', fontWeight:'bold', fontSize:'13px' }}>Received From</td>
            <td style={{ padding:'8px 10px', fontSize:'14px', fontWeight:'bold' }} colSpan="3">{cust.name || 'Walk-in'}</td>
          </tr>
          <tr style={{ borderBottom:'1.5px solid #000' }}>
            <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:'13px' }}>Rupees</td>
            <td style={{ padding:'8px 10px', fontSize:'13px', fontWeight:'bold', fontStyle:'italic', fontFamily:'serif' }} colSpan="3">{amountInWords}</td>
          </tr>
          <tr style={{ borderBottom:'1.5px solid #000' }}>
            <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:'13px' }}>Mode</td>
            <td style={{ padding:'8px 10px', fontSize:'13px', fontWeight:'bold', textTransform:'uppercase' }} colSpan="3">
              {receipt.payment_mode?.toUpperCase()} {receipt.reference_number ? `(Ref: ${receipt.reference_number})` : ''}
              {receipt.notes ? ` — ${receipt.notes}` : ''}
            </td>
          </tr>
          <tr style={{ borderBottom:'1.5px solid #000' }}>
            <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:'13px' }}>Dated</td>
            <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontSize:'13px' }}>
              {receipt.payment_date ? fmtDateTime(receipt.payment_date) : ''}
            </td>
            <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:'13px' }}>Against Order No.</td>
            <td style={{ padding:'8px 10px', fontSize:'14px', fontWeight:'bold' }}>{order.order_no || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding:'8px 10px' }} colSpan="2"></td>
            <td style={{ borderLeft:'none', borderRight:'1.5px solid #000', padding:'8px 10px', textAlign:'right', fontWeight:'900', fontSize:'14px' }}>RS.</td>
            <td style={{ padding:'8px 10px', fontSize:'16px', fontWeight:'900', background:'rgba(0,0,0,0.03)', color: receipt.is_refund ? '#dc2626' : '#000' }}>
              {receipt.is_refund ? '(−) ' : ''}₹ {fmt(receipt.amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {isCancelled && (
        <div style={{ marginTop:10, padding:'6px 12px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:4, fontSize:'11px', color:'#dc2626', fontWeight:600 }}>
          <i className="fa-solid fa-ban" style={{ marginRight:6 }} />
          CANCELLED — {receipt.cancellation_reason || 'No reason provided'}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'10px' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ borderBottom:'1px solid #000', width:'160px', height:'16px' }} />
          <div style={{ fontFamily:'serif', fontStyle:'italic', fontSize:'13px', marginTop:'4px', fontWeight:'bold' }}>Signature</div>
        </div>
      </div>
    </div>
  );
}

// ─── Print Layout ────────────────────────────────────────────────────────────
function PrintLayout({ receipt, shopInfo }) {
  const order = receipt.order_detail || {};
  const cust = order.customer_detail || {};
  const amountInWords = amountWords(parseFloat(receipt.amount));
  const stampNo = receipt.receipt_no ? receipt.receipt_no.replace(/^\D+/g, '') : '';
  const shopName = shopInfo?.name || 'MY JEWELLERY SHOP';
  const shopAddress = shopInfo?.address || '';
  const isCancelled = receipt.status === 'cancelled';

  return (
    <div className="print-only-container">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { margin:0!important; padding:0!important; width:210mm!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          body > *:not(.print-only-container) { display:none!important; }
          .print-only-container {
            display: block !important;
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 10mm !important;
            background: #fff !important;
            box-sizing: border-box !important;
          }
        }
        @media screen { .print-only-container { display:none; } }
      `}</style>
      <div style={{ color:'#000', fontFamily:'Arial, sans-serif', border: isCancelled ? '2px solid #dc2626' : '1.5px solid #000', padding:'20px 24px', borderRadius:8, position:'relative', minHeight:400, display:'flex', flexDirection:'column', justifyContent:'space-between', width: '100%', boxSizing: 'border-box' }}>
        {isCancelled && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-35deg)', fontSize:'72px', fontWeight:900, color:'rgba(220,38,38,0.12)', letterSpacing:'0.1em', whiteSpace:'nowrap', pointerEvents:'none', zIndex:1, userSelect:'none' }}>CANCELLED</div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div><span style={{ fontSize:13, fontWeight:'bold', display:'block' }}>Sl. No.</span><span style={{ color:'#dc2626', fontFamily:'"Courier New",monospace', fontSize:28, fontWeight:'bold', letterSpacing:1 }}>{stampNo}</span></div>
          <div style={{ textAlign:'center', flex:1, padding:'0 10px' }}>
            <div style={{ textTransform:'uppercase', fontSize:13, fontWeight:'bold', textDecoration:'underline', letterSpacing:1, marginBottom:2 }}>{receipt.is_refund ? 'REFUND VOUCHER' : 'RECEIPT VOUCHER'}</div>
            <div style={{ fontSize:20, fontWeight:900, textTransform:'uppercase' }}>{shopName}</div>
            <div style={{ fontSize:9, fontWeight:'bold', textTransform:'uppercase', marginTop:2 }}>{shopAddress}</div>
          </div>
          <div style={{ textAlign:'right' }}><span style={{ fontSize:13, fontWeight:'bold', display:'block' }}>Date</span><span style={{ fontWeight:'bold', fontSize:13 }}>{receipt.payment_date ? fmtDateTime(receipt.payment_date) : ''}</span></div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', border:'1.5px solid #000' }}>
          <tbody>
            <tr style={{ borderBottom:'1.5px solid #000' }}>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', width:'22%', fontWeight:'bold', fontSize:13 }}>Received From</td>
              <td style={{ padding:'8px 10px', fontSize:14, fontWeight:'bold' }} colSpan="3">{cust.name || 'Walk-in'}</td>
            </tr>
            <tr style={{ borderBottom:'1.5px solid #000' }}>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:13 }}>Rupees</td>
              <td style={{ padding:'8px 10px', fontSize:13, fontWeight:'bold', fontStyle:'italic', fontFamily:'serif' }} colSpan="3">{amountInWords}</td>
            </tr>
            <tr style={{ borderBottom:'1.5px solid #000' }}>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:13 }}>Mode</td>
              <td style={{ padding:'8px 10px', fontSize:13, fontWeight:'bold', textTransform:'uppercase' }} colSpan="3">
                {receipt.payment_mode?.toUpperCase()} {receipt.reference_number ? `(Ref: ${receipt.reference_number})` : ''}{receipt.notes ? ` — ${receipt.notes}` : ''}
              </td>
            </tr>
            <tr style={{ borderBottom:'1.5px solid #000' }}>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:13 }}>Dated</td>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontSize:13 }}>{receipt.payment_date ? fmtDateTime(receipt.payment_date) : ''}</td>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', fontWeight:'bold', fontSize:13 }}>Against Order No.</td>
              <td style={{ padding:'8px 10px', fontSize:14, fontWeight:'bold' }}>{order.order_no || '—'}</td>
            </tr>
            <tr>
              <td colSpan="2"></td>
              <td style={{ borderRight:'1.5px solid #000', padding:'8px 10px', textAlign:'right', fontWeight:900, fontSize:14 }}>RS.</td>
              <td style={{ padding:'8px 10px', fontSize:16, fontWeight:900 }}>{receipt.is_refund ? '(−) ' : ''}₹ {fmt(receipt.amount)}</td>
            </tr>
          </tbody>
        </table>
        {isCancelled && (
          <div style={{ marginTop:10, padding:'6px 12px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:4, fontSize:11, color:'#dc2626', fontWeight:600 }}>
            CANCELLED — {receipt.cancellation_reason || 'No reason provided'}
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ borderBottom:'1px solid #000', width:160, height:16 }} />
            <div style={{ fontFamily:'serif', fontStyle:'italic', fontSize:13, marginTop:4, fontWeight:'bold' }}>Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
