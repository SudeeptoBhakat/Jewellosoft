import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/axios';
import { toast } from '../../utils/toast';
import ExportButton from '../../components/elements/ExportButton';
import useTabRefresh from '../../hooks/useTabRefresh';
import { shortNo } from '../../utils/formatters';
import { getBillPrinterSettings } from '../../utils/labelPrinter';
import FallbackWatermarkSVG from "../../assets/icons/b503ee48-1ece-4256-8ef5-72c1d9f0a8de.png";


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
export default function Advances({ isActive = true }) {
  const [tab, setTab] = useState('receipts');
  const [shopInfo, setShopInfo] = useState(() => {
    try {
      const cached = localStorage.getItem('jewellosoft_shop_info');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [customers, setCustomers] = useState([]);

  useEffect(() => { fetchShopInfo(); fetchCustomers(); }, []);

  const fetchShopInfo = async () => {
    try {
      const r = await api.get('/accounts/shop/current/');
      if (r.data) {
        setShopInfo(r.data);
        localStorage.setItem('jewellosoft_shop_info', JSON.stringify(r.data));
      }
    } catch {}
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

      {tab === 'receipts' && <ReceiptsTab shopInfo={shopInfo} isActive={isActive} />}
      {tab === 'cashbook' && <CashBookTab shopInfo={shopInfo} />}
      {tab === 'ledger'   && <LedgerTab shopInfo={shopInfo} customers={customers} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: RECEIPTS & REFUNDS
// ═══════════════════════════════════════════════════════════
function ReceiptsTab({ shopInfo, isActive = true }) {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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

  // View details modal
  const [detailReceipt, setDetailReceipt] = useState(null);

  // Receipt preview modal
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => { fetchAdvances(); }, []);

  useTabRefresh(() => fetchAdvances(), isActive);

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
      const orderAdvance  = parseFloat(matched.advance || 0);
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
    if (e && e.preventDefault) e.preventDefault();
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
      toast.success(isRefund ? 'Refund recorded successfully!' : 'Advance payment recorded successfully!');
      closeModal();
      fetchAdvances();
      setActiveReceipt(res.data);
      setShowReceiptModal(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save advance payment.');
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { toast.error('Please provide a cancellation reason.'); return; }
    setCancelling(true);
    try {
      await api.post(`/payments/advances/${cancelTarget.id}/cancel/`, { reason: cancelReason.trim() });
      toast.success(`Receipt ${cancelTarget.receipt_no} cancelled.`);
      setCancelTarget(null); setCancelReason('');
      fetchAdvances();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel receipt.');
    } finally { setCancelling(false); }
  };

  const handlePrint = async () => {
    if (!activeReceipt) return;
    if (window.electronAPI) {
      const billSettings = getBillPrinterSettings();
      if (billSettings.outputMode === 'pdf') {
        const res = await window.electronAPI.printToPDF(`Receipt_${activeReceipt.receipt_no}.pdf`, { pageSize: 'A5' });
        if (res.success) toast.success('Receipt PDF saved successfully.');
        else if (res.reason !== 'canceled') toast.error(`PDF save failed: ${res.error}`);
      } else if (window.electronAPI.printDocument) {
        const res = await window.electronAPI.printDocument({
          deviceName: billSettings.printerName || '',
          pageSize: 'A5',
          silent: billSettings.silent !== false,
          copies: billSettings.copies || 1,
        });
        if (res.success) toast.success(`Receipt printed${billSettings.printerName ? ` (${billSettings.printerName})` : ''}`);
        else toast.error(`Print failed: ${res.error}`);
      } else {
        window.print();
      }
    } else {
      window.print();
    }
  };

  const filtered = useMemo(() => {
    return advances.filter(adv => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        adv.receipt_no?.toLowerCase().includes(q) ||
        adv.order_detail?.order_no?.toLowerCase().includes(q) ||
        adv.order_detail?.customer_detail?.name?.toLowerCase().includes(q) ||
        adv.order_detail?.customer_detail?.phone?.includes(q) ||
        adv.reference_number?.toLowerCase().includes(q) ||
        adv.notes?.toLowerCase().includes(q)
      );

      const matchesStatus =
        filterStatus === 'all' ||
        adv.status === filterStatus ||
        (filterStatus === 'refund' && adv.is_refund) ||
        (filterStatus === 'payment' && !adv.is_refund && adv.status === 'active');

      const matchesMode = filterMode === 'all' || adv.payment_mode === filterMode;

      let matchesDate = true;
      if (adv.payment_date) {
        const pDate = new Date(adv.payment_date);
        const now = new Date();
        if (dateFilter === 'today') {
          matchesDate = pDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = pDate >= weekAgo;
        } else if (dateFilter === 'month') {
          matchesDate = pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'custom') {
          if (fromDate) matchesDate = matchesDate && (pDate >= new Date(fromDate + 'T00:00:00'));
          if (toDate) matchesDate = matchesDate && (pDate <= new Date(toDate + 'T23:59:59'));
        }
      }

      return matchesSearch && matchesStatus && matchesMode && matchesDate;
    });
  }, [advances, searchQuery, filterStatus, filterMode, dateFilter, fromDate, toDate]);

  const activeAdvancesList = advances.filter(a => a.status === 'active' && !a.is_refund);
  const totalActive = activeAdvancesList.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
  const refundList = advances.filter(a => a.is_refund && a.status === 'active');
  const totalRefunds = refundList.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
  const totalCancelled = advances.filter(a => a.status === 'cancelled').length;

  const exportColumns = useMemo(() => [
    { label: 'Receipt No', key: 'receipt_no' },
    { label: 'Order No', key: 'order_detail', transform: (val) => val?.order_no || '—' },
    { label: 'Customer Name', key: 'order_detail', transform: (val) => val?.customer_detail?.name || 'Walk-in' },
    { label: 'Customer Phone', key: 'order_detail', transform: (val) => val?.customer_detail?.phone || '—' },
    { label: 'Payment Date', key: 'payment_date', transform: (val) => fmtDateTime(val) },
    { label: 'Type', key: 'is_refund', transform: (val) => val ? 'REFUND' : 'PAYMENT' },
    { label: 'Payment Mode', key: 'payment_mode', transform: (val) => String(val || '').toUpperCase() },
    { label: 'Amount (₹)', key: 'amount', transform: (val, row) => (row.is_refund ? '-' : '') + fmt(val) },
    { label: 'Status', key: 'status', transform: (val) => String(val || '').toUpperCase() },
    { label: 'Reference Number', key: 'reference_number' },
    { label: 'Notes', key: 'notes' },
    { label: 'Cancellation Reason', key: 'cancellation_reason' }
  ], []);

  return (
    <>
      {/* ── Summary Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {[
          { icon: 'fa-hand-holding-dollar', label: 'Advances Collected', value: `₹${fmt(totalActive)}`, sub: `${activeAdvancesList.length} active receipts`, accent: 'var(--color-primary-muted)', iconColor: 'var(--color-primary)' },
          { icon: 'fa-receipt', label: 'Total Transactions', value: advances.length, sub: 'All recorded entries', accent: 'rgba(34,197,94,0.15)', iconColor: '#10b981' },
          { icon: 'fa-arrow-rotate-left', label: 'Refunds Issued', value: `₹${fmt(totalRefunds)}`, sub: `${refundList.length} refund receipts`, accent: 'rgba(249,115,22,0.15)', iconColor: '#ea580c' },
          { icon: 'fa-ban', label: 'Cancelled Receipts', value: totalCancelled, sub: 'Reversed transactions', accent: 'rgba(239,68,68,0.12)', iconColor: '#dc2626' },
        ].map(c => (
          <div key={c.label} style={{ background: 'linear-gradient(135deg, var(--bg-card), var(--bg-surface))', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: c.accent, color: c.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
              <i className={`fa-solid ${c.icon}`} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar & Filters ── */}
      <div className="billing-form" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ flex: '1 1 240px', minWidth: 200, position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', fontSize: '0.85rem' }} />
            <input
              className="form-input"
              type="text"
              placeholder="Search receipt #, order #, customer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 34, paddingRight: searchQuery ? 30 : 12, height: 36, fontSize: 'var(--text-sm)' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            className="form-input form-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ height: 36, width: 'auto', minWidth: 135, fontSize: 'var(--text-sm)' }}
          >
            <option value="all">All Statuses</option>
            <option value="payment">Payments Only</option>
            <option value="refund">Refunds Only</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Mode filter */}
          <select
            className="form-input form-select"
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}
            style={{ height: 36, width: 'auto', minWidth: 120, fontSize: 'var(--text-sm)' }}
          >
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI / Online</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="mixed">Mixed</option>
          </select>

          {/* Date range filter */}
          <select
            className="form-input form-select"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ height: 36, width: 'auto', minWidth: 120, fontSize: 'var(--text-sm)' }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>

          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ height: 36, width: 130, fontSize: 'var(--text-xs)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>to</span>
              <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} style={{ height: 36, width: 130, fontSize: 'var(--text-xs)' }} />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <ExportButton
              data={filtered}
              columns={exportColumns}
              filename={`Advance_Payments_${new Date().toISOString().split('T')[0]}`}
              sheetName="Advances"
            />
            <button id="adv-record-refund-btn" className="btn btn--outline btn--sm" onClick={() => { setIsRefund(true); setShowAddModal(true); }} style={{ height: 36 }}>
              <i className="fa-solid fa-arrow-rotate-left" style={{ marginRight: 6 }} />Refund
            </button>
            <button id="adv-record-advance-btn" className="btn btn--primary btn--sm" onClick={() => { setIsRefund(false); setShowAddModal(true); }} style={{ height: 36 }}>
              <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Record Advance
            </button>
          </div>
        </div>
      </div>

      {/* ── Receipts Table ── */}
      {loading ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', display: 'block', marginBottom: 12, color: 'var(--color-primary)' }} />
          Loading advance payments...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-folder-open" style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.3, display: 'block' }} />
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{searchQuery || filterStatus !== 'all' || filterMode !== 'all' ? 'No matching advance records found' : 'No Advance Payments Recorded Yet'}</h3>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Use "Record Advance" to log booking deposits against customer orders.</p>
        </div>
      ) : (
        <div className="table-responsive" style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '13%' }}>Receipt No</th>
                <th style={{ width: '14%' }}>Order Ref</th>
                <th style={{ width: '20%' }}>Customer</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ width: '11%' }}>Payment Mode</th>
                <th style={{ width: '9%' }}>Type</th>
                <th style={{ width: '9%' }}>Status</th>
                <th style={{ width: '12%' }}>Date & Time</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(adv => {
                const cust = adv.order_detail?.customer_detail || {};
                const sb = statusBadge(adv.status);
                const isCancelled = adv.status === 'cancelled';
                const isRef = !!adv.is_refund;

                return (
                  <tr key={adv.id} style={{ opacity: isCancelled ? 0.6 : 1, transition: 'background-color 0.15s ease' }}>
                    <td>
                      <div
                        onClick={() => { setActiveReceipt(adv); setShowReceiptModal(true); }}
                        style={{
                          fontWeight: 700,
                          color: isCancelled ? 'var(--text-muted)' : 'var(--color-primary)',
                          textDecoration: isCancelled ? 'line-through' : 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                        title="Click to preview & print"
                      >
                        <i className="fa-solid fa-receipt" style={{ fontSize: '0.75rem', opacity: 0.7 }} />
                        {adv.receipt_no}
                      </div>
                    </td>

                    <td>
                      {adv.order_detail?.order_no ? (
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                            {shortNo(adv.order_detail.order_no)}
                          </span>
                          {adv.order_detail.order_type && (
                            <span style={{ marginLeft: 6, fontSize: '0.65rem', textTransform: 'uppercase', padding: '1px 5px', borderRadius: 3, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', color: 'var(--text-muted)' }}>
                              {adv.order_detail.order_type}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {cust.name || 'Walk-in Customer'}
                        </div>
                        {cust.phone && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                            <i className="fa-solid fa-phone" style={{ fontSize: '0.65rem', opacity: 0.6 }} />
                            {cust.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: isRef ? '#dc2626' : '#059669' }}>
                        {isRef ? '−' : '+'}₹{fmt(adv.amount)}
                      </div>
                      {adv.notes && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: 140, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={adv.notes}>
                          {adv.notes}
                        </div>
                      )}
                    </td>

                    <td>
                      <PaymentModeBadge mode={adv.payment_mode} />
                      {adv.reference_number && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                          #{adv.reference_number}
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: isRef ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                        color: isRef ? '#dc2626' : '#059669',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}>
                        <i className={`fa-solid ${isRef ? 'fa-arrow-rotate-left' : 'fa-plus'}`} style={{ fontSize: '0.6rem' }} />
                        {isRef ? 'REFUND' : 'DEPOSIT'}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: sb.bg, color: sb.color }}>
                        {sb.label}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {fmtDate(adv.payment_date)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        {adv.payment_date ? new Date(adv.payment_date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          className="btn btn--ghost btn--sm btn--icon"
                          title="Print / Preview Voucher"
                          onClick={() => { setActiveReceipt(adv); setShowReceiptModal(true); }}
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <i className="fa-solid fa-print" />
                        </button>
                        <button
                          className="btn btn--ghost btn--sm btn--icon"
                          title="View Details"
                          onClick={() => setDetailReceipt(adv)}
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <i className="fa-solid fa-eye" />
                        </button>
                        {!isCancelled && (
                          <button
                            className="btn btn--ghost btn--sm btn--icon"
                            title="Cancel Receipt"
                            style={{ color: 'var(--color-danger)' }}
                            onClick={() => setCancelTarget(adv)}
                          >
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

      {/* ── View Details Modal ── */}
      {detailReceipt && (
        <>
          <div className="overlay" onClick={() => setDetailReceipt(null)} style={{ zIndex: 1000 }} />
          <div className="modal" style={{ maxWidth: 540, width: '95%', zIndex: 1001, borderRadius: 'var(--radius-lg)' }}>
            <div className="modal__header">
              <h2 className="modal__title">
                <i className="fa-solid fa-file-invoice" style={{ marginRight: 8, color: 'var(--color-primary)' }} />
                Advance Receipt Details
              </h2>
              <button className="btn btn--ghost btn--sm btn--icon" onClick={() => setDetailReceipt(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal__body" style={{ padding: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-primary)' }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Receipt Number</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>{detailReceipt.receipt_no}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Amount</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: detailReceipt.is_refund ? '#dc2626' : '#059669' }}>
                    {detailReceipt.is_refund ? '−' : '+'}₹{fmt(detailReceipt.amount)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Customer</span>
                  <strong>{detailReceipt.order_detail?.customer_detail?.name || 'Walk-in'}</strong>
                  {detailReceipt.order_detail?.customer_detail?.phone && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Ph: {detailReceipt.order_detail.customer_detail.phone}</div>
                  )}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Linked Order</span>
                  <strong>{detailReceipt.order_detail?.order_no || 'Direct Advance'}</strong>
                  {detailReceipt.order_detail?.grand_total && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Order Total: ₹{fmt(detailReceipt.order_detail.grand_total)}</div>
                  )}
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Payment Mode</span>
                  <PaymentModeBadge mode={detailReceipt.payment_mode} />
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Date & Time</span>
                  <span>{fmtDateTime(detailReceipt.payment_date)}</span>
                </div>
                {detailReceipt.reference_number && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Reference / Txn #</span>
                    <span style={{ fontFamily: 'monospace' }}>{detailReceipt.reference_number}</span>
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', display: 'block' }}>Status</span>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{detailReceipt.status}</span>
                </div>
              </div>

              {Array.isArray(detailReceipt.payment_splits) && detailReceipt.payment_splits.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Payment Splits</div>
                  {detailReceipt.payment_splits.map((sp, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 2 }}>
                      <span style={{ textTransform: 'uppercase' }}>{sp.mode}</span>
                      <strong>₹{fmt(sp.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {detailReceipt.notes && (
                <div style={{ background: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Remarks: </span>
                  <span>{detailReceipt.notes}</span>
                </div>
              )}

              {detailReceipt.status === 'cancelled' && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: '#991b1b' }}>
                  <strong>Cancellation Reason: </strong>{detailReceipt.cancellation_reason || 'Not specified'}
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" onClick={() => setDetailReceipt(null)}>Close</button>
              <button className="btn btn--primary" onClick={() => { setActiveReceipt(detailReceipt); setDetailReceipt(null); setShowReceiptModal(true); }}>
                <i className="fa-solid fa-print" style={{ marginRight: 6 }} />Print Voucher
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Record Modal ── */}
      {showAddModal && (
        <>
          <div className="overlay" onClick={closeModal} style={{ zIndex: 1000 }} />
          <div className="modal" style={{ maxWidth: 700, width: '95%', zIndex: 1001, borderRadius: 'var(--radius-lg)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header" style={{ flexShrink: 0 }}>
              <h2 className="modal__title">
                <i className={`fa-solid ${isRefund ? 'fa-arrow-rotate-left' : 'fa-hand-holding-dollar'}`} style={{ marginRight: 8, color: isRefund ? '#dc2626' : 'var(--color-primary)' }} />
                {isRefund ? 'Record Refund Voucher' : 'Record Advance Payment'}
              </h2>
              <button className="btn btn--ghost btn--sm btn--icon" onClick={closeModal}><i className="fa-solid fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal__body" style={{ padding: 'var(--space-4)', overflowY: 'auto', flex: 1 }}>

                {/* Step 1: Find Order */}
                <div className="billing-form" style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="billing-form__header">
                    <span className="billing-form__header-title"><i className="fa-solid fa-magnifying-glass" style={{ marginRight: 6 }} />Find Order</span>
                  </div>
                  <div className="billing-form__body">
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <input className="form-input" type="text" placeholder="Order number, customer name or phone…"
                        value={orderQuery} onChange={e => setOrderQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchOrder())} autoFocus />
                      <button type="button" className="btn btn--primary" onClick={handleSearchOrder} disabled={orderSearching || !orderQuery.trim()} style={{ whiteSpace: 'nowrap' }}>
                        {orderSearching ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-search" style={{ marginRight: 6 }} />Search</>}
                      </button>
                    </div>
                    {selectedOrder && (
                      <div style={{ marginTop: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary)', overflow: 'hidden' }}>
                        <div style={{ background: 'var(--color-primary)', color: '#fff', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}><i className="fa-solid fa-file-invoice" style={{ marginRight: 6 }} />{selectedOrder.order_no}</span>
                          <span style={{ fontSize: 'var(--text-xs)', opacity: 0.9, textTransform: 'uppercase' }}>{selectedOrder.order_type}</span>
                        </div>
                        <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', fontSize: 'var(--text-sm)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 10 }}>
                            <div><span style={{ color: 'var(--text-muted)' }}>Customer:</span> <strong>{selectedOrder.customer_detail?.name || 'Walk-in'}</strong></div>
                            <div><span style={{ color: 'var(--text-muted)' }}>Phone:</span> <strong>{selectedOrder.customer_detail?.phone || '—'}</strong></div>
                          </div>
                          <div style={{ background: 'var(--bg-card)', borderRadius: 4, padding: '10px 12px', border: '1px solid var(--border-primary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Order Total</span>
                              <strong>₹{fmt(selectedOrder.grand_total)}</strong>
                            </div>
                            {selectedOrder.orderAdvance > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#059669' }}>
                                <span><i className="fa-solid fa-file-invoice" style={{ marginRight: 5, opacity: 0.7 }} />Order Advance (at booking)</span>
                                <span style={{ fontWeight: 600 }}>₹{fmt(selectedOrder.orderAdvance)}</span>
                              </div>
                            )}
                            {selectedOrder.receiptsPaid > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#059669' }}>
                                <span><i className="fa-solid fa-receipt" style={{ marginRight: 5, opacity: 0.7 }} />Advance Receipts</span>
                                <span style={{ fontWeight: 600 }}>₹{fmt(selectedOrder.receiptsPaid)}</span>
                              </div>
                            )}
                            {selectedOrder.refundsIssued > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#dc2626' }}>
                                <span><i className="fa-solid fa-arrow-rotate-left" style={{ marginRight: 5, opacity: 0.7 }} />Refunds Issued</span>
                                <span style={{ fontWeight: 600 }}>-₹{fmt(selectedOrder.refundsIssued)}</span>
                              </div>
                            )}
                            <div style={{ borderTop: '1px dashed var(--border-secondary)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>Balance Due</span>
                              <strong style={{ color: selectedOrder.balance > 0 ? 'var(--color-primary)' : '#16a34a', fontSize: '1.05rem' }}>₹{fmt(selectedOrder.balance)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Payment History */}
                {selectedOrder && orderAdvances.length > 0 && (
                  <div className="billing-form" style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="billing-form__header">
                      <span className="billing-form__header-title"><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 6 }} />Payment History</span>
                    </div>
                    <div className="billing-form__body">
                      <div style={{ border: '1px solid var(--border-primary)', borderRadius: 4, overflow: 'hidden' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-secondary)' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Receipt</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Date</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Mode</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Type</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Status</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderAdvances.map(p => {
                              const sb = statusBadge(p.status);
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-secondary)', opacity: p.status === 'cancelled' ? 0.55 : 1 }}>
                                  <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: p.status === 'cancelled' ? 'line-through' : 'none' }}>{p.receipt_no}</td>
                                  <td style={{ padding: '6px 10px' }}>{fmtDateTime(p.payment_date)}</td>
                                  <td style={{ padding: '6px 10px' }}><PaymentModeBadge mode={p.payment_mode} small /></td>
                                  <td style={{ padding: '6px 10px' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: p.is_refund ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: p.is_refund ? '#dc2626' : '#059669' }}>
                                      {p.is_refund ? 'REFUND' : 'PAYMENT'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '6px 10px' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: sb.bg, color: sb.color }}>{sb.label}</span>
                                  </td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: p.is_refund ? '#dc2626' : 'inherit' }}>
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
                        <i className={`fa-solid ${isRefund ? 'fa-minus-circle' : 'fa-plus-circle'}`} style={{ marginRight: 6 }} />
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
                              <div style={{ marginTop: 5, fontSize: 'var(--text-xs)', color: afterBalance > 0 ? 'var(--color-primary)' : '#16a34a' }}>
                                After payment, balance due: <strong>₹{fmt(afterBalance)}</strong>
                                {afterBalance === 0 && ' ✅ Fully paid!'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Mixed Split Inputs */}
                      {paymentMode === 'mixed' && (
                        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', border: '1px solid var(--border-primary)', marginBottom: 'var(--space-3)' }}>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-3)' }}>
                            Split by Mode
                          </div>
                          {paymentSplits.map((sp, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
                              <select className="form-input form-select" value={sp.mode} style={{ flex: '0 0 140px' }}
                                onChange={e => setPaymentSplits(prev => prev.map((s,i) => i===idx ? {...s, mode:e.target.value} : s))}>
                                <option value="cash">Cash</option>
                                <option value="upi">UPI</option>
                                <option value="card">Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                              </select>
                              <input className="form-input" type="number" step="0.01" placeholder="Amount" value={sp.amount}
                                onChange={e => setPaymentSplits(prev => prev.map((s,i) => i===idx ? {...s, amount:e.target.value} : s))}
                                style={{ flex: 1 }} />
                              {paymentSplits.length > 1 && (
                                <button type="button" className="btn btn--ghost btn--sm btn--icon" style={{ color: 'var(--color-danger)' }}
                                  onClick={() => setPaymentSplits(prev => prev.filter((_,i) => i!==idx))}>
                                  <i className="fa-solid fa-minus" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn btn--outline btn--sm" onClick={() => setPaymentSplits(prev => [...prev, { mode:'cash', amount:'' }])}>
                            <i className="fa-solid fa-plus" style={{ marginRight: 6 }} />Add Split
                          </button>
                          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
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
              <div className="modal__footer" style={{ flexShrink: 0 }}>
                <button type="button" className="btn btn--outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving || !selectedOrder}
                  style={{ background: isRefund ? '#dc2626' : undefined }}>
                  {saving ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Saving…</>
                    : <><i className={`fa-solid ${isRefund ? 'fa-check' : 'fa-check'}`} style={{ marginRight: 6 }} />
                      {isRefund ? `Refund ₹${fmt(paymentMode==='mixed' ? mixedTotal : newAmt)}` : `Record ₹${fmt(paymentMode==='mixed' ? mixedTotal : newAmt)}`}</>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Cancel Modal ── */}
      {cancelTarget && (
        <>
          <div className="overlay" onClick={() => { setCancelTarget(null); setCancelReason(''); }} style={{ zIndex: 1000 }} />
          <div className="modal" style={{ maxWidth: 480, width: '95%', zIndex: 1001 }}>
            <div className="modal__header">
              <h2 className="modal__title"><i className="fa-solid fa-ban" style={{ marginRight: 8, color: 'var(--color-danger)' }} />Cancel Receipt</h2>
              <button className="btn btn--ghost btn--sm btn--icon" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="modal__body">
              <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cancelTarget.receipt_no} — ₹{fmt(cancelTarget.amount)}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                  This will create reversing entries in the Ledger and Cash Book. The receipt will remain in the database with a CANCELLED status.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cancellation Reason *</label>
                <textarea className="form-input" rows={3} placeholder="Enter reason for cancellation…"
                  value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  style={{ resize: 'vertical', minHeight: 70 }} />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Back</button>
              <button className="btn btn--danger" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
                {cancelling ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Cancelling…</>
                  : <><i className="fa-solid fa-ban" style={{ marginRight: 6 }} />Confirm Cancel</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Receipt Preview Modal ── */}
      {showReceiptModal && activeReceipt && (
        <>
          <div className="overlay no-print" onClick={() => setShowReceiptModal(false)} style={{ zIndex: 10000 }} />
          <div className="modal no-print" style={{ maxWidth: 650, width: '95%', zIndex: 10001, height: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header" style={{ flexShrink: 0 }}>
              <h2 className="modal__title"><i className="fa-solid fa-receipt" style={{ color: 'var(--color-primary)', marginRight: 10 }} />Advance Receipt Voucher (Half A4)</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--primary btn--sm" onClick={handlePrint}><i className="fa-solid fa-print" style={{ marginRight: 6 }} />Print Voucher</button>
                <button className="btn btn--ghost btn--sm btn--icon" onClick={() => setShowReceiptModal(false)}><i className="fa-solid fa-xmark" /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#e2e8f0', padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
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
            <div className="billing-form__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="billing-form__header-title"><i className="fa-solid fa-list" style={{ marginRight:8, opacity:0.6 }} />Transactions ({data.entries?.length || 0})</span>
              <ExportButton
                data={data.entries || []}
                columns={[
                  { label: 'Time', key: 'created_at', transform: (val) => fmtDateTime(val) },
                  { label: 'Type', key: 'entry_type', transform: (val) => val === 'in' ? 'IN' : 'OUT' },
                  { label: 'Mode', key: 'payment_mode', transform: (val) => String(val || '').toUpperCase() },
                  { label: 'Reference', key: 'reference_number' },
                  { label: 'Notes', key: 'notes' },
                  { label: 'Amount (₹)', key: 'amount', transform: (val, row) => (row.entry_type === 'in' ? '' : '-') + fmt(val) }
                ]}
                filename={`CashBook_${date}`}
                sheetName="CashBook"
              />
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
            <div className="billing-form__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="billing-form__header-title"><i className="fa-solid fa-table-list" style={{ marginRight:8, opacity:0.6 }} />Account Statement ({data.statement?.length || 0} entries)</span>
              <ExportButton
                data={data.statement || []}
                columns={[
                  { label: 'Date', key: 'created_at', transform: (val) => fmtDateTime(val) },
                  { label: 'Reference Type', key: 'reference_type', transform: (val) => String(val || '').toUpperCase() },
                  { label: 'Description', key: 'description' },
                  { label: 'Debit (₹)', key: 'amount', transform: (val, row) => row.entry_type === 'debit' ? fmt(val) : '0.00' },
                  { label: 'Credit (₹)', key: 'amount', transform: (val, row) => row.entry_type === 'credit' ? fmt(val) : '0.00' },
                  { label: 'Balance (₹)', key: 'running_balance', transform: (val) => `${fmt(Math.abs(val))} ${val > 0 ? 'Dr' : 'Cr'}` }
                ]}
                filename={`Customer_Ledger_${selectedCustomer}`}
                sheetName="Ledger"
              />
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

// ─── Professional Half A4 (A5) Advance Receipt Voucher ──────────────────────
function AdvanceReceiptVoucher({ receipt, shopInfo, isPrint = false }) {
  if (!receipt) return null;

  let activeShop = shopInfo;
  if (!activeShop?.name) {
    try {
      const cached = localStorage.getItem('jewellosoft_shop_info');
      if (cached) activeShop = JSON.parse(cached);
    } catch {}
  }
  const shopName = activeShop?.name || 'MY JEWELLERY SHOP';
  const shopAddress = activeShop?.address || '';
  const shopPhone = activeShop?.phone || '';
  const shopEmail = activeShop?.email || '';
  const shopGstin = activeShop?.gst_number || '';
  const shopPan = activeShop?.pan_number || '';

  const order = receipt.order_detail || {};
  const cust = order.customer_detail || {};
  const isCancelled = receipt.status === 'cancelled';
  const isRefund = !!receipt.is_refund;
  const amount = parseFloat(receipt.amount || 0);
  const amountInWords = amountWords(amount);

  // Financial reconciliation if order details are present
  const grandTotal = parseFloat(order.grand_total || 0);
  const orderAdvance = parseFloat(order.advance || 0);

  const shopMeta = [
    shopAddress,
    shopPhone && `Tel: ${shopPhone}`,
    shopEmail && `Email: ${shopEmail}`,
  ].filter(Boolean).join(' | ');

  const taxMeta = [
    shopGstin && `GSTIN: ${shopGstin}`,
    shopPan && `PAN: ${shopPan}`,
  ].filter(Boolean).join(' | ');

  const splits = Array.isArray(receipt.payment_splits) ? receipt.payment_splits : [];

  return (
    <div style={{
      width: '148mm',
      // height: 'mm',
      maxHeight: '210mm',
      margin: '0 auto',
      padding: '4mm 6mm 4mm',
      backgroundColor: '#ffffff',
      color: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
      fontSize: '8pt',
      lineHeight: 1.3,
      boxSizing: 'border-box',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      border: isCancelled ? '1.5px solid #dc2626' : (isPrint ? 'none' : '1px solid #cbd5e1'),
      borderRadius: isPrint ? 0 : '4px',
      boxShadow: isPrint ? 'none' : '0 4px 18px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      pageBreakInside: 'avoid',
      pageBreakAfter: 'avoid',
    }}>
      {/* CANCELLED Watermark Stamp */}
      {isCancelled && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%) rotate(-32deg)',
          fontSize: '44pt',
          fontWeight: 900,
          color: 'rgba(220,38,38,0.12)',
          letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 1,
          userSelect: 'none',
        }}>
          CANCELLED
        </div>
      )}

      {/* ── TOP SECTION: Header + Meta ── */}
      <div>
        {/* Shop Header */}
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '1.5mm', marginBottom: '2mm', textAlign: 'center' }}>
          <h1 style={{
            margin: 0,
            fontSize: '13pt',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#0f172a',
            lineHeight: 1.15,
          }}>
            {shopName}
          </h1>
          {shopMeta && (
            <div style={{ fontSize: '7pt', color: '#475569', marginTop: '1mm', lineHeight: 1.3 }}>
              {shopMeta}
            </div>
          )}
          {taxMeta && (
            <div style={{ fontSize: '7pt', fontWeight: 600, color: '#334155', marginTop: '0.5mm' }}>
              {taxMeta}
            </div>
          )}
        </div>

        {/* Voucher Title & Date Strip */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: isRefund ? '#fef2f2' : '#f8fafc',
          border: `1px solid ${isRefund ? '#fecaca' : '#e2e8f0'}`,
          borderRadius: '3px',
          padding: '1.5mm 3mm',
          marginBottom: '2mm',
        }}>
          <div>
            <span style={{
              display: 'inline-block',
              fontWeight: 800,
              fontSize: '8.5pt',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: isRefund ? '#b91c1c' : '#0f172a',
            }}>
              {isRefund ? 'REFUND VOUCHER' : 'ADVANCE PAYMENT RECEIPT'}
            </span>
            <div style={{ fontSize: '7pt', color: '#64748b', marginTop: '0.5px' }}>
              Receipt No: <strong style={{ color: isCancelled ? '#dc2626' : '#0f172a', fontFamily: 'monospace', fontSize: '8pt' }}>{receipt.receipt_no || '—'}</strong>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '7pt', color: '#475569' }}>
            <div>Date: <strong style={{ color: '#0f172a' }}>{receipt.payment_date ? fmtDate(receipt.payment_date) : '—'}</strong></div>
            <div style={{ fontSize: '6.5pt', color: '#64748b' }}>Time: {receipt.payment_date ? new Date(receipt.payment_date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</div>
          </div>
        </div>

        {/* Customer & Order Reference Card */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2.5mm',
          backgroundColor: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: '3px',
          padding: '2mm 3mm',
          marginBottom: '2mm',
          fontSize: '7.5pt',
        }}>
          <div>
            <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5mm' }}>
              Customer Details
            </div>
            <div style={{ fontWeight: 700, fontSize: '8.5pt', color: '#0f172a' }}>
              {cust.name || 'Walk-in Customer'}
            </div>
            {cust.phone && (
              <div style={{ color: '#334155', marginTop: '0.5mm', fontSize: '7pt' }}>
                Ph: {cust.phone}
              </div>
            )}
            {cust.address && (
              <div style={{ color: '#64748b', marginTop: '0.5mm', fontSize: '6.5pt', lineHeight: 1.25 }}>
                {cust.address}
              </div>
            )}
          </div>

          <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '2.5mm' }}>
            <div style={{ fontSize: '6.5pt', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.5mm' }}>
              Linked Order
            </div>
            {order.order_no ? (
              <>
                <div style={{ fontSize: '7.5pt' }}>
                  Order No: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{order.order_no}</strong>
                </div>
                {order.order_type && (
                  <div style={{ fontSize: '6.5pt', color: '#64748b', textTransform: 'capitalize' }}>
                    Type: {order.order_type}
                  </div>
                )}
                {order.delivery_date && (
                  <div style={{ fontSize: '6.5pt', color: '#0f172a', marginTop: '0.5mm' }}>
                    Est. Delivery: <strong>{fmtDate(order.delivery_date)}</strong>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '7pt' }}>
                Direct / Advance Booking
              </div>
            )}
          </div>
        </div>

        {/* Financial Particulars Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2mm', fontSize: '7.5pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
              <th style={{ padding: '1.5mm 2.5mm', textAlign: 'left', fontWeight: 600, fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Particulars / Description</th>
              <th style={{ padding: '1.5mm 2.5mm', textAlign: 'center', fontWeight: 600, fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.04em', width: '28%' }}>Payment Mode</th>
              <th style={{ padding: '1.5mm 2.5mm', textAlign: 'right', fontWeight: 600, fontSize: '6.5pt', textTransform: 'uppercase', letterSpacing: '0.04em', width: '25%' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <td style={{ padding: '2mm 2.5mm', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>
                  {isRefund ? 'Refund of Advance Deposit' : 'Customer Advance Deposit'}
                </div>
                {order.order_no && (
                  <div style={{ fontSize: '6.5pt', color: '#64748b', marginTop: '1px' }}>
                    Against Order #{order.order_no}
                  </div>
                )}
                {receipt.notes && (
                  <div style={{ fontSize: '6.5pt', color: '#334155', marginTop: '1px', fontStyle: 'italic' }}>
                    Note: {receipt.notes}
                  </div>
                )}
              </td>
              <td style={{ padding: '2mm 2.5mm', textAlign: 'center', verticalAlign: 'top' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontWeight: 700,
                  fontSize: '6.5pt',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                }}>
                  {receipt.payment_mode?.toUpperCase()}
                </span>
                {receipt.reference_number && (
                  <div style={{ fontSize: '6pt', color: '#64748b', marginTop: '1px', fontFamily: 'monospace' }}>
                    Ref: {receipt.reference_number}
                  </div>
                )}
                {splits.length > 0 && (
                  <div style={{ fontSize: '6pt', color: '#64748b', marginTop: '1.5px' }}>
                    {splits.map((sp, idx) => (
                      <div key={idx}>{sp.mode?.toUpperCase()}: ₹{fmt(sp.amount)}</div>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ padding: '2mm 2.5mm', textAlign: 'right', verticalAlign: 'top', fontWeight: 700, fontSize: '9pt', color: isRefund ? '#dc2626' : '#0f172a' }}>
                {isRefund ? '−' : ''}₹{fmt(amount)}
              </td>
            </tr>

            {/* Reconciliation summary rows when linked to an order with grand total */}
            {grandTotal > 0 && (
              <>
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa', fontSize: '7pt' }}>
                  <td colSpan={2} style={{ padding: '1.2mm 2.5mm', color: '#64748b' }}>Order Grand Total:</td>
                  <td style={{ padding: '1.2mm 2.5mm', textAlign: 'right', fontWeight: 600, color: '#334155' }}>₹{fmt(grandTotal)}</td>
                </tr>
                {orderAdvance > 0 && (
                  <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa', fontSize: '7pt' }}>
                    <td colSpan={2} style={{ padding: '1.2mm 2.5mm', color: '#64748b' }}>Order Booking Advance:</td>
                    <td style={{ padding: '1.2mm 2.5mm', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{fmt(orderAdvance)}</td>
                  </tr>
                )}
              </>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #0f172a', backgroundColor: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '2mm 2.5mm', fontWeight: 800, fontSize: '8pt', textTransform: 'uppercase', color: '#0f172a' }}>
                {isRefund ? 'Total Refund Amount' : 'Net Received in this Receipt'}
              </td>
              <td style={{ padding: '2mm 2.5mm', textAlign: 'right', fontWeight: 800, fontSize: '9.5pt', color: isRefund ? '#dc2626' : '#047857' }}>
                ₹ {fmt(amount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Amount in Words Strip */}
        <div style={{
          backgroundColor: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: '3px',
          padding: '1.5mm 2.5mm',
          fontSize: '7pt',
          color: '#1e293b',
          marginBottom: '2mm',
        }}>
          <span style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase', fontSize: '6pt', letterSpacing: '0.04em' }}>Amount in Words: </span>
          <span style={{ fontWeight: 700, fontStyle: 'italic' }}>{amountInWords}</span>
        </div>

        {/* Cancellation Notice if cancelled */}
        {isCancelled && (
          <div style={{
            padding: '1.5mm 2.5mm',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '3px',
            fontSize: '7pt',
            color: '#991b1b',
            fontWeight: 600,
            marginBottom: '2mm',
          }}>
            <i className="fa-solid fa-ban" style={{ marginRight: 6 }} />
            CANCELLED: {receipt.cancellation_reason || 'No cancellation reason specified.'}
          </div>
        )}
      </div>

      {/* ── BOTTOM SECTION: Signatures ── */}
      <div>
        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #334155', width: '34mm', paddingTop: '1mm', fontSize: '6.5pt', fontWeight: 600, color: '#334155' }}>
              Customer Signature
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '6pt', color: '#64748b', marginBottom: '0.5mm' }}>
              For {shopName}
            </div>
            <div style={{ borderTop: '1px solid #334155', width: '40mm', paddingTop: '1mm', fontSize: '6.5pt', fontWeight: 700, color: '#0f172a' }}>
              Authorised Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Receipt Preview (screen modal) ──────────────────────────────────────────
function ReceiptPreview({ receipt, shopInfo }) {
  return (
    <div style={{ transform: 'scale(0.92)', transformOrigin: 'top center' }}>
      <AdvanceReceiptVoucher receipt={receipt} shopInfo={shopInfo} isPrint={false} />
    </div>
  );
}

// ─── Print Layout (physical & PDF print engine) ───────────────────────────────
function PrintLayout({ receipt, shopInfo }) {
  return (
    <div className="print-only-container">
      <style>{`
        @page {
          size: A5 portrait;
          margin: 0;
        }
        @media print {
          html, body {
            width: 148mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }
          body > *:not(.print-only-container) {
            display: none !important;
          }
          .print-only-container {
            display: block !important;
            width: 148mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        @media screen {
          .print-only-container {
            display: none;
          }
        }
      `}</style>
      <AdvanceReceiptVoucher receipt={receipt} shopInfo={shopInfo} isPrint={true} />
    </div>
  );
}
