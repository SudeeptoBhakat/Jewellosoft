import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { extractList } from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs } from '../../contexts/TabContext';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';
import CreditNoteTemplate from '../pdfs/templates/CreditNoteTemplate';
import ExportButton from '../../components/elements/ExportButton';
import { toast } from '../../utils/toast';
import useTabRefresh from '../../hooks/useTabRefresh';
import { shortNo } from '../../utils/formatters';

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

  const [showCreateModal, setShowCreateModal] = useState(!!initCustId);
  const [viewCN, setViewCN] = useState(null);
  const [printData, setPrintData] = useState(null);

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

  const creditNoteColumns = useMemo(() => [
    { label: 'CN Number', key: 'credit_note_no' },
    { label: 'Date', key: 'created_at', transform: (val) => val ? new Date(val).toLocaleDateString('en-IN') : '' },
    { label: 'Customer Name', key: 'customer_detail.name' },
    { label: 'Customer Phone', key: 'customer_detail.phone' },
    { label: 'Source Invoice', key: 'source_invoice_no' },
    { label: 'Reason', key: 'reason' },
    { label: 'Total Credit (₹)', key: 'credit_amount' },
    { label: 'Remaining Credit (₹)', key: 'remaining_amount' },
    { label: 'Status', key: 'status', transform: (val) => String(val || '').toUpperCase() },
    { label: 'Expiry Date', key: 'expires_at', transform: (val) => val ? new Date(val).toLocaleDateString('en-IN') : 'No Expiry' }
  ], []);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Credit Notes</h1>
          <div className="page-header__actions">
            <ExportButton
              data={creditNotes}
              columns={creditNoteColumns}
              filename="Credit_Notes"
              sheetName="CreditNotes"
            />
            <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
              <i className="fa-solid fa-plus"></i> Issue Credit Note
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Manage customer store credits, exchanges, and return adjustments.</p>
      </div>

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
                <td style={{ fontWeight: 600, color: 'var(--color-primary-hover)', whiteSpace: 'nowrap' }} title={cn.credit_note_no}>{shortNo(cn.credit_note_no)}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{cn.customer_detail?.name || 'Walk-in'}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{cn.customer_detail?.phone || ''}</div>
                </td>
                <td>{cn.source_invoice_no ? <span style={{ fontFamily: 'monospace' }} title={cn.source_invoice_no}>{shortNo(cn.source_invoice_no)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
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

function CreditNoteDetailModal({ cn, onClose, onPrint }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 720 }}>
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

        <div style={{ padding: 'var(--space-5)', overflowY: 'auto', maxHeight: '80vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
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
                <span style={{ color: 'var(--text-muted)' }}>Source Invoice</span><span style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{cn.source_invoice_no || '—'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Expiry</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{cn.expires_at ? new Date(cn.expires_at).toLocaleDateString('en-IN') : 'No Expiry'}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Reason & Notes</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{cn.reason}</div>
            {cn.notes && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', borderTop: '1px dashed var(--border-soft)', paddingTop: 'var(--space-2)' }}>{cn.notes}</div>}
          </div>

          {cn.source_invoice_detail && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-file-invoice" style={{ color: 'var(--color-primary)' }}></i>
                Source Invoice Detail — {cn.source_invoice_detail.invoice_no}
              </div>

              {cn.source_invoice_detail.items && cn.source_invoice_detail.items.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>Products</div>
                  <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table className="data-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Product</th>
                          <th>Metal / Purity</th>
                          <th className="txt-right">Net Wt (g)</th>
                          <th className="txt-right">Metal Value</th>
                          <th className="txt-right">Making</th>
                          <th className="txt-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cn.source_invoice_detail.items.map((item, idx) => (
                          <tr key={item.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                            <td>
                              <span style={{ background: 'var(--bg-accent)', color: 'var(--color-primary)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                                {item.metal_type} {item.purity}
                              </span>
                            </td>
                            <td className="txt-right" style={{ fontFamily: 'monospace' }}>{parseFloat(item.net_weight).toFixed(3)}</td>
                            <td className="txt-right">{fmt(item.metal_value)}</td>
                            <td className="txt-right">{fmt(item.making_charge)}</td>
                            <td className="txt-right" style={{ fontWeight: 700 }}>{fmt(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Invoice Totals</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Metal Rate</span>
                    <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.metal_rate)} /10g</span>
                    <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                    <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.subtotal)}</span>
                    {parseFloat(cn.source_invoice_detail.discount) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>Discount</span>
                      <span style={{ textAlign: 'right', color: 'var(--color-success)' }}>-{fmt(cn.source_invoice_detail.discount)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.cgst) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>CGST</span>
                      <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.cgst)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.sgst) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>SGST</span>
                      <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.sgst)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.igst) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>IGST</span>
                      <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.igst)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.hallmark) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>Hallmark</span>
                      <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.hallmark)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.others) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>Others</span>
                      <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.others)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.round_off) !== 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>Round Off</span>
                      <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.round_off)}</span>
                    </>}
                    {parseFloat(cn.source_invoice_detail.credit_applied) > 0 && <>
                      <span style={{ color: 'var(--text-muted)' }}>Credit Applied</span>
                      <span style={{ textAlign: 'right', color: 'var(--color-success)' }}>-{fmt(cn.source_invoice_detail.credit_applied)}</span>
                    </>}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, borderTop: '1px solid var(--border-primary)', paddingTop: 6, marginTop: 4 }}>Grand Total</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', borderTop: '1px solid var(--border-primary)', paddingTop: 6, marginTop: 4 }}>{fmt(cn.source_invoice_detail.grand_total)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {cn.source_invoice_detail.old_settlement_mode && cn.source_invoice_detail.old_settlement_mode !== 'none' && (
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Old Gold Settlement</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Mode</span>
                        <span style={{ textAlign: 'right', fontWeight: 500, textTransform: 'capitalize' }}>{cn.source_invoice_detail.old_settlement_mode.replace(/_/g, ' ')}</span>
                        {parseFloat(cn.source_invoice_detail.old_weight) > 0 && <>
                          <span style={{ color: 'var(--text-muted)' }}>Old Weight</span>
                          <span style={{ textAlign: 'right' }}>{parseFloat(cn.source_invoice_detail.old_weight).toFixed(3)} g</span>
                        </>}
                        {parseFloat(cn.source_invoice_detail.old_metal_raw_value) > 0 && <>
                          <span style={{ color: 'var(--text-muted)' }}>Raw Value</span>
                          <span style={{ textAlign: 'right' }}>{fmt(cn.source_invoice_detail.old_metal_raw_value)}</span>
                        </>}
                        {parseFloat(cn.source_invoice_detail.old_deduct_percent) > 0 && <>
                          <span style={{ color: 'var(--text-muted)' }}>Deduct %</span>
                          <span style={{ textAlign: 'right' }}>{cn.source_invoice_detail.old_deduct_percent}%</span>
                        </>}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Net Deduction</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>-{fmt(cn.source_invoice_detail.old_deduct_amount || cn.source_invoice_detail.old_amount)}</span>
                        {cn.source_invoice_detail.purchase_voucher && <>
                          <span style={{ color: 'var(--text-muted)' }}>Voucher No</span>
                          <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{cn.source_invoice_detail.purchase_voucher.voucher_no}</span>
                          <span style={{ color: 'var(--text-muted)' }}>Rate Used</span>
                          <span style={{ textAlign: 'right', textTransform: 'capitalize' }}>{cn.source_invoice_detail.purchase_voucher.rate_used}</span>
                        </>}
                      </div>
                    </div>
                  )}

                  {cn.source_invoice_detail.advance_payments && cn.source_invoice_detail.advance_payments.length > 0 && (
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
                        Advance Payments ({cn.source_invoice_detail.advance_payments.length})
                      </div>
                      {cn.source_invoice_detail.advance_payments.map((ap, i) => (
                        <div key={ap.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < cn.source_invoice_detail.advance_payments.length - 1 ? '1px dashed var(--border-soft)' : 'none', fontSize: 'var(--text-sm)' }}>
                          <div>
                            <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--text-xs)', background: 'var(--bg-accent)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', marginRight: 6 }}>{ap.payment_mode}</span>
                            {ap.receipt_no && <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>#{ap.receipt_no}</span>}
                            {ap.payment_date && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{new Date(ap.payment_date).toLocaleDateString('en-IN')}</div>}
                            {ap.notes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{ap.notes}</div>}
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt(ap.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {cn.source_invoice_detail.credit_note_usages && cn.source_invoice_detail.credit_note_usages.length > 0 && (
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>
                        Credit Notes Applied on Invoice
                      </div>
                      {cn.source_invoice_detail.credit_note_usages.map((cu, i) => (
                        <div key={cu.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < cn.source_invoice_detail.credit_note_usages.length - 1 ? '1px dashed var(--border-soft)' : 'none', fontSize: 'var(--text-sm)' }}>
                          <div>
                            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{cu.credit_note_no}</span>
                            {cu.reason && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{cu.reason}</div>}
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>-{fmt(cu.amount_used)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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

function CreateCreditNoteModal({ onClose, onSave, validityDays, initialCustomerId, initialInvoiceId }) {
  const { shop } = useAuth();

  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const [custSuggestions, setCustSuggestions] = useState([]);
  const custWrapRef = useRef(null);

  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [showBillSuggestions, setShowBillSuggestions] = useState(false);
  const [billSuggestions, setBillSuggestions] = useState([]);
  const billWrapRef = useRef(null);

  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);

  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [customItemAmounts, setCustomItemAmounts] = useState({});

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const mouseHandler = (e) => {
      if (custWrapRef.current && !custWrapRef.current.contains(e.target)) {
        setShowCustSuggestions(false);
      }
      if (billWrapRef.current && !billWrapRef.current.contains(e.target)) {
        setShowBillSuggestions(false);
      }
    };
    document.addEventListener('mousedown', mouseHandler);
    return () => document.removeEventListener('mousedown', mouseHandler);
  }, []);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (custName.trim().length > 1 && !customerId) {
        try {
          const res = await api.get(`/customers/?search=${encodeURIComponent(custName.trim())}`);
          const list = extractList(res.data);
          setCustSuggestions(list);
          if (list.length > 0) setShowCustSuggestions(true);
        } catch (e) {
          setCustSuggestions([]);
        }
      } else {
        setCustSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [custName, customerId]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (billSearchQuery.trim().length > 1) {
        try {
          const res = await api.get(`/billing/invoices/?search=${encodeURIComponent(billSearchQuery.trim())}`);
          const list = extractList(res.data);
          setBillSuggestions(list);
          if (list.length > 0) setShowBillSuggestions(true);
        } catch (e) {
          setBillSuggestions([]);
        }
      } else {
        setBillSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [billSearchQuery]);

  useEffect(() => {
    if (customerId) {
      setLoadingInvoices(true);
      api.get(`/billing/invoices/?customer=${customerId}`)
        .then(res => setInvoices(extractList(res.data)))
        .catch(() => setInvoices([]))
        .finally(() => setLoadingInvoices(false));
    } else {
      setInvoices([]);
    }
  }, [customerId]);

  useEffect(() => {
    if (selectedInvoiceId) {
      setLoadingInvoiceDetails(true);
      api.get(`/billing/invoices/${selectedInvoiceId}/`)
        .then(res => {
          const inv = res.data;
          setSelectedInvoice(inv);
          const items = inv.items || [];
          setInvoiceItems(items);
          const initialSet = new Set(items.map(i => i.id));
          setSelectedItemIds(initialSet);

          const defaultAmounts = {};
          items.forEach(i => {
            defaultAmounts[i.id] = parseFloat(i.total || 0);
          });
          setCustomItemAmounts(defaultAmounts);

          if (inv.customer_detail && !customerId) {
            setCustomerId(inv.customer_detail.id || inv.customer);
            setCustName(inv.customer_detail.name || '');
            setCustMobile(inv.customer_detail.phone || '');
            setCustAddress(inv.customer_detail.address || '');
          }
        })
        .catch(err => {
          console.error(err);
        })
        .finally(() => setLoadingInvoiceDetails(false));
    } else {
      setSelectedInvoice(null);
      setInvoiceItems([]);
      setSelectedItemIds(new Set());
      setCustomItemAmounts({});
    }
  }, [selectedInvoiceId]);

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
        .catch(err => console.error(err));
    }
    if (initialInvoiceId) {
      setSelectedInvoiceId(String(initialInvoiceId));
    }
  }, [initialCustomerId, initialInvoiceId]);

  const selectCustomer = (c) => {
    setCustomerId(c.id);
    setCustName(c.name);
    setCustMobile(c.phone || '');
    setCustAddress(c.address || '');
    setShowCustSuggestions(false);
  };

  const selectInvoiceDirect = (inv) => {
    setSelectedInvoiceId(String(inv.id));
    setBillSearchQuery(inv.invoice_no);
    setShowBillSuggestions(false);
    if (inv.customer_detail) {
      setCustomerId(inv.customer_detail.id || inv.customer);
      setCustName(inv.customer_detail.name || '');
      setCustMobile(inv.customer_detail.phone || '');
      setCustAddress(inv.customer_detail.address || '');
    }
  };

  const toggleItem = (itemId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === invoiceItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(invoiceItems.map(i => i.id)));
    }
  };

  useEffect(() => {
    if (selectedInvoice && invoiceItems.length > 0) {
      const selectedItems = invoiceItems.filter(i => selectedItemIds.has(i.id));
      const totalCredit = selectedItems.reduce((s, i) => {
        const val = customItemAmounts[i.id] !== undefined ? parseFloat(customItemAmounts[i.id]) : parseFloat(i.total || 0);
        return s + (isNaN(val) ? 0 : val);
      }, 0);

      setAmount(totalCredit > 0 ? totalCredit.toFixed(2) : '');

      if (selectedItems.length === 0) {
        setReason(`Exchange against Invoice ${selectedInvoice.invoice_no}`);
        setNotes('');
      } else if (selectedItems.length === invoiceItems.length) {
        setReason(`Full return of ${invoiceItems.length} items from Invoice ${selectedInvoice.invoice_no}`);
        setNotes(`Returned items from #${selectedInvoice.invoice_no}:\n` + invoiceItems.map((it, idx) => `${idx + 1}. ${it.product_name} (${it.net_weight}g) - ₹${Number(it.total || 0).toLocaleString('en-IN')}`).join('\n'));
      } else if (selectedItems.length === 1) {
        const item = selectedItems[0];
        setReason(`Return of ${item.product_name} (${item.net_weight}g) from Invoice ${selectedInvoice.invoice_no}`);
        setNotes(`Returned item from #${selectedInvoice.invoice_no}: ${item.product_name} (${item.net_weight}g, ${item.purity || item.metal_type}) - ₹${Number(item.total || 0).toLocaleString('en-IN')}`);
      } else {
        setReason(`Return of ${selectedItems.length} items from Invoice ${selectedInvoice.invoice_no}: ${selectedItems.map(i => i.product_name).join(', ')}`);
        setNotes(`Returned items from #${selectedInvoice.invoice_no}:\n` + selectedItems.map((it, idx) => `${idx + 1}. ${it.product_name} (${it.net_weight}g) - ₹${Number(it.total || 0).toLocaleString('en-IN')}`).join('\n'));
      }
    }
  }, [selectedItemIds, customItemAmounts, selectedInvoice, invoiceItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!custName.trim()) return toast.error('Customer name is required.');
    if (!amount || parseFloat(amount) <= 0) return toast.error('Please enter a valid credit amount.');
    if (!reason.trim()) return toast.error('Reason is required.');

    setSubmitting(true);
    try {
      let finalCustId = customerId;
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
      toast.success('Credit Note issued successfully!');
      onSave();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to create Credit Note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 940, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="modal__header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-muted)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i className="fa-solid fa-wallet" style={{ color: 'var(--color-primary)', fontSize: '1rem' }} />
            </div>
            <div>
              <h2 className="modal__title" style={{ marginBottom: 2 }}>Issue Credit Note</h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Select customer or bill, choose returned products, and issue credit note
              </p>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4) var(--space-5)', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                  <i className="fa-solid fa-user" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    Customer Details
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ position: 'relative' }} ref={custWrapRef}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Customer Name / Phone *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search customer by name or phone..."
                      value={custName}
                      onChange={e => {
                        setCustName(e.target.value);
                        if (customerId) {
                          setCustomerId(null);
                          setCustMobile('');
                          setCustAddress('');
                          setSelectedInvoiceId('');
                        }
                      }}
                      autoComplete="off"
                      required
                    />
                    {showCustSuggestions && custSuggestions.length > 0 && (
                      <div className="search-ac__dropdown" style={{ top: '100%', left: 0, right: 0, zIndex: 9999 }}>
                        {custSuggestions.map(c => (
                          <div key={c.id} className="search-ac__item" onMouseDown={() => selectCustomer(c)}>
                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              {c.phone}{c.address ? ` · ${c.address}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 4 }}>Phone</label>
                      <input
                        type="text"
                        className="form-input"
                        value={custMobile}
                        onChange={e => setCustMobile(e.target.value)}
                        placeholder="Mobile number"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ marginBottom: 4 }}>Address</label>
                      <input
                        type="text"
                        className="form-input"
                        value={custAddress}
                        onChange={e => setCustAddress(e.target.value)}
                        placeholder="City / Address"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                  <i className="fa-solid fa-file-invoice" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    Link Bill / Invoice (Optional)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ position: 'relative' }} ref={billWrapRef}>
                    <label className="form-label" style={{ marginBottom: 4 }}>Search by Bill ID / Invoice No</label>
                    <div style={{ position: 'relative' }}>
                      <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search Invoice # (e.g. INV-2026-001)..."
                        value={billSearchQuery}
                        onChange={e => {
                          setBillSearchQuery(e.target.value);
                          if (!e.target.value) {
                            setSelectedInvoiceId('');
                          }
                        }}
                        style={{ paddingLeft: 30 }}
                        autoComplete="off"
                      />
                    </div>
                    {showBillSuggestions && billSuggestions.length > 0 && (
                      <div className="search-ac__dropdown" style={{ top: '100%', left: 0, right: 0, zIndex: 9999 }}>
                        {billSuggestions.map(inv => (
                          <div key={inv.id} className="search-ac__item" onMouseDown={() => selectInvoiceDirect(inv)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{inv.invoice_no}</span>
                              <span style={{ fontWeight: 600 }}>{fmt(inv.grand_total)}</span>
                            </div>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              {inv.customer_detail?.name || 'Walk-in'} • {new Date(inv.created_at).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label" style={{ marginBottom: 4 }}>Or Select Customer's Recent Bill</label>
                    <select
                      className="form-input form-select"
                      value={selectedInvoiceId}
                      onChange={e => {
                        setSelectedInvoiceId(e.target.value);
                        if (e.target.value) {
                          const match = invoices.find(i => String(i.id) === String(e.target.value));
                          if (match) setBillSearchQuery(match.invoice_no);
                        } else {
                          setBillSearchQuery('');
                        }
                      }}
                      disabled={!customerId || loadingInvoices}
                    >
                      <option value="">— Direct Credit / No Bill Linked —</option>
                      {invoices.map(i => (
                        <option key={i.id} value={i.id}>
                          {i.invoice_no} ({fmt(i.grand_total)}) • {new Date(i.created_at).toLocaleDateString('en-IN')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {selectedInvoiceId && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--color-primary)', fontSize: '0.9rem' }} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Associated Bill Products for Return
                    </span>
                    {invoiceItems.length > 0 && (
                      <span className="advance-badge">
                        {selectedItemIds.size} of {invoiceItems.length} selected
                      </span>
                    )}
                  </div>

                  {invoiceItems.length > 0 && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={toggleSelectAll}
                      style={{ fontSize: 'var(--text-xs)', height: 28 }}
                    >
                      <i className={`fa-solid ${selectedItemIds.size === invoiceItems.length ? 'fa-square-minus' : 'fa-square-check'}`} style={{ marginRight: 5 }} />
                      {selectedItemIds.size === invoiceItems.length ? 'Deselect All' : 'Select All Products'}
                    </button>
                  )}
                </div>

                {loadingInvoiceDetails ? (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ margin: '0 auto var(--space-2)' }} />
                    Loading bill products...
                  </div>
                ) : invoiceItems.length === 0 ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    No itemized products found on this invoice. You can specify the credit amount directly.
                  </div>
                ) : (
                  <div className="return-products-container">
                    {invoiceItems.map((item, idx) => {
                      const isSelected = selectedItemIds.has(item.id);
                      return (
                        <div
                          key={item.id || idx}
                          className={`return-product-card ${isSelected ? 'return-product-card--selected' : ''}`}
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className="return-product-card__checkbox">
                            {isSelected && <i className="fa-solid fa-check" />}
                          </div>
                          <div className="return-product-card__info">
                            <div className="return-product-card__title">
                              <span>{idx + 1}. {item.product_name}</span>
                              <span className="badge badge--info" style={{ fontSize: '0.6rem', padding: '1px 6px', textTransform: 'uppercase' }}>
                                {item.metal_type} {item.purity}
                              </span>
                            </div>
                            <div className="return-product-card__meta">
                              <span>Weight: <strong>{Number(item.net_weight || 0).toFixed(3)}g</strong></span>
                              <span>•</span>
                              <span>Metal: {fmt(item.metal_value)}</span>
                              <span>•</span>
                              <span>Making: {fmt(item.making_charge)}</span>
                            </div>
                          </div>
                          <div className="return-product-card__amount">
                            <div className="return-product-card__price">
                              {fmt(item.total)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)', marginTop: 2, fontWeight: 600 }}>
                              {isSelected ? 'Selected for Return' : 'Click to Select'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-4)' }}>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                  <i className="fa-solid fa-pen-to-square" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                    Credit & Reason Details
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 4 }}>Credit Amount (₹) *</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                          color: 'var(--color-success)', fontWeight: 700, fontSize: 'var(--text-sm)', pointerEvents: 'none',
                        }}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="form-input"
                          style={{ paddingLeft: 28, fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-success)' }}
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ marginBottom: 4 }}>Expiry Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={expiryDate}
                        onChange={e => setExpiryDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ marginBottom: 4 }}>Reason for Credit *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Return of 1 item from Invoice INV-2026-001..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ marginBottom: 4 }}>Internal Notes / Breakdown</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Itemized return notes or internal store instructions"
                      style={{ resize: 'vertical', fontSize: 'var(--text-xs)' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                  padding: 'var(--space-4)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                      Credit Summary
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--text-sm)' }}>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>Customer:</span>
                        <span style={{ fontWeight: 600 }}>{custName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>Linked Bill:</span>
                        <span style={{ fontWeight: 600, color: selectedInvoice ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                          {selectedInvoice ? `#${selectedInvoice.invoice_no}` : 'None'}
                        </span>
                      </div>
                      {selectedInvoice && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-tertiary)' }}>Returned Items:</span>
                          <span style={{ fontWeight: 600 }}>
                            {selectedItemIds.size} of {invoiceItems.length} items
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-tertiary)' }}>Expiry:</span>
                        <span>{expiryDate ? new Date(expiryDate).toLocaleDateString('en-IN') : 'No Expiry'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL CREDIT AMOUNT</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-success)' }}>
                      {amount && parseFloat(amount) > 0 ? fmt(parseFloat(amount)) : '₹0.00'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="modal__footer" style={{ flexShrink: 0, borderTop: '1px solid var(--border-primary)' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" style={{ gap: 8 }} disabled={submitting}>
              {submitting ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <i className="fa-solid fa-wallet" />}
              Issue Credit Note {amount && parseFloat(amount) > 0 ? `(${fmt(parseFloat(amount))})` : ''}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

