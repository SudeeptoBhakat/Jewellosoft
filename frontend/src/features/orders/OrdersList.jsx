import { useState, useEffect, useMemo } from 'react';
import api, { extractList } from '../../lib/axios';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Item Status Pipeline ─── */
const ITEM_STATUSES = [
  { key: 'created', label: 'Created', icon: 'fa-file', color: 'info' },
  { key: 'processing', label: 'Processing', icon: 'fa-spinner', color: 'info' },
  { key: 'karigar_assigned', label: 'Karigar Assigned', icon: 'fa-user-tag', color: 'warning' },
  { key: 'in_progress', label: 'In Progress', icon: 'fa-hammer', color: 'warning' },
  { key: 'hallmarking', label: 'Hallmarking', icon: 'fa-stamp', color: 'primary' },
  { key: 'ready', label: 'Ready for delivery', icon: 'fa-box-open', color: 'success' },
  { key: 'complete', label: 'Complete', icon: 'fa-check-circle', color: 'success' },
  { key: 'cancelled', label: 'Cancelled', icon: 'fa-ban', color: 'danger' },
];

const getStatusIdx = (key) => ITEM_STATUSES.findIndex(s => s.key === key);
const getStatusInfo = (key) => ITEM_STATUSES.find(s => s.key === key) || ITEM_STATUSES[0];
const getNextStatus = (key) => {
  const idx = getStatusIdx(key);
  if (idx < ITEM_STATUSES.length - 2) return ITEM_STATUSES[idx + 1].key; // Stop before cancelled
  return key;
};
const getProgress = (key) => {
  if (key === 'cancelled') return 0;
  const idx = getStatusIdx(key);
  return Math.round(((idx + 1) / (ITEM_STATUSES.length - 1)) * 100);
};

const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

/* ─── Order Status Colors ─── */
const orderStatusMap = { pending: 'warning', in_progress: 'info', completed: 'success', delivered: 'primary', cancelled: 'danger' };

/* ─── Derive order status from item statuses ─── */
function deriveOrderStatus(items, originalStatus) {
  if (originalStatus === 'cancelled' || originalStatus === 'delivered' || originalStatus === 'completed') return originalStatus;
  if (!items || items.length === 0) return originalStatus || 'pending';
  if (items.every(i => i.status === 'complete')) return 'completed';
  if (items.some(i => i.status !== 'created')) return 'in_progress';
  return 'pending';
}

/* ═══════════════════════════════════════════
   ORDER DETAIL / TRACKING MODAL
   ═══════════════════════════════════════════ */
function OrderDetailModal({ order, onClose, onPrint, onUpdateItemStatus, onAddToInventory }) {
  if (!order) return null;
  const totalWeight = order.items?.reduce((s, i) => s + parseFloat(i.expected_weight || 0), 0) || 0;
  const allComplete = order.items?.every(i => i.status === 'complete');
  const orderProg = order.items && order.items.length > 0 ? Math.round(order.items.reduce((s, i) => s + getProgress(i.status), 0) / order.items.length) : 0;
  const orderSt = deriveOrderStatus(order.items, order.order_status);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 840, maxHeight: '94vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="modal__header" style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
          <div>
            <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-box" style={{ color: 'var(--color-warning)' }}></i>
              {order.order_no}
            </h2>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              {order.metal_type} Order • {order.priority} Priority • {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="flex gap-2">
            <span className={`badge badge--${orderStatusMap[orderSt] || 'info'}`} style={{ textTransform: 'capitalize' }}>{orderSt.replace('_', ' ')}</span>
            <button className="btn btn--ghost btn--sm" onClick={onPrint}><i className="fa-solid fa-print"></i></button>
            <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        <div style={{ padding: 'var(--space-5)' }}>
          {/* Progress Bar */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>Overall Progress</span>
              <span style={{ fontWeight: 600, color: allComplete ? 'var(--color-accent)' : 'var(--color-primary)' }}>{orderProg}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${orderProg}%`, background: allComplete ? 'var(--color-accent)' : 'var(--color-primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* Customer & Order Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Customer</div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', marginBottom: 4 }}>{order.customer_detail?.name || 'Walk-in'}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}><i className="fa-solid fa-phone" style={{ marginRight: 6, opacity: 0.5 }}></i>{order.customer_detail?.phone || '—'}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}><i className="fa-solid fa-location-dot" style={{ marginRight: 6, opacity: 0.5 }}></i>{order.customer_detail?.address || '—'}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-2)' }}>Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Worker</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{order.worker?.split('—')[0]?.trim() || '—'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Metal</span><span style={{ textAlign: 'right', fontWeight: 500, textTransform: 'capitalize' }}>{order.metal_type} @ {fmt(order.metal_rate)}/g</span>
                <span style={{ color: 'var(--text-muted)' }}>Delivery</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '—'}</span>
                <span style={{ color: 'var(--text-muted)' }}>Items</span><span style={{ textAlign: 'right', fontWeight: 500 }}>{order.items?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Design Notes & Images */}
          {(order.design_notes || (order.images && order.images.length > 0)) && (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)' }}>
              {order.design_notes && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: (order.images && order.images.length > 0) ? 'var(--space-3)' : 0 }}>
                  <i className="fa-solid fa-palette" style={{ marginRight: 6, opacity: 0.5 }}></i>
                  <strong>Design Notes:</strong> {order.design_notes}
                </div>
              )}
              {order.images && order.images.length > 0 && (
                <div style={{ paddingTop: order.design_notes ? 'var(--space-3)' : 0, borderTop: order.design_notes ? '1px dashed var(--border-primary)' : 'none' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>ATTACHED IMAGES</div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {order.images.map((img) => (
                      <a key={img.id} href={img.image} target="_blank" rel="noreferrer" style={{ display: 'block', width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
                        <img src={img.image} alt="Design Ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Items with Status Tracking ─── */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>
              Item Status Tracking
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {order.items?.map((item, idx) => {
                const si = getStatusInfo(item.status);
                const prog = getProgress(item.status);
                const isComplete = item.status === 'complete';
                const hasInventory = !!item.inventory_item;

                const mainStatuses = ITEM_STATUSES.filter(st => st.key !== 'cancelled');

                return (
                  <div key={item.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', transition: 'all 150ms ease' }}>
                    {/* Item Header */}
                    <div className="flex justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{idx + 1}. {item.product_name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.expected_weight}g • {fmt(item.total)} • {item.size && `Size: ${item.size}`} {item.design_remarks && `• ${item.design_remarks}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span className={`badge badge--${si.color}`}>
                          <i className={`fa-solid ${si.icon}`} style={{ fontSize: '0.6rem' }}></i>
                          {si.label}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: 6, background: 'var(--bg-deep)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-3)' }}>
                      <div style={{ height: '100%', width: `${prog}%`, background: isComplete ? 'var(--color-accent)' : `var(--color-${si.color})`, borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
                    </div>

                    {/* Status Pipeline */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {mainStatuses.map((st, si2) => {
                        const currentIdx = getStatusIdx(item.status);
                        const isPast = si2 <= currentIdx;
                        const isCurrent = si2 === currentIdx;
                        return (
                          <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.5rem', fontWeight: 700,
                              background: isPast ? (st.key === 'complete' && isCurrent ? 'var(--color-accent)' : 'var(--color-primary)') : 'var(--bg-deep)',
                              color: isPast ? 'white' : 'transparent',
                              border: isCurrent ? '2px solid var(--color-primary-hover)' : '2px solid transparent',
                              transition: 'all 0.3s ease',
                            }}>
                              <i className="fa-solid fa-check"></i>
                            </div>
                            {si2 < mainStatuses.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: isPast && si2 < currentIdx ? 'var(--color-primary)' : 'var(--bg-deep)', borderRadius: 1, transition: 'background 0.3s ease' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 4, paddingLeft: 2 }}>
                      {mainStatuses.map(st => <span key={st.key} style={{ width: `${100 / mainStatuses.length}%`, textAlign: 'center' }}>{st.label.replace(' ', '\n')}</span>)}
                    </div>

                    {/* Advance / Add to Inventory Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                      {isComplete && !hasInventory && (
                        <button className="btn btn--accent btn--sm" onClick={() => onAddToInventory(item)}>
                          <i className="fa-solid fa-plus-circle"></i> Add to Inventory
                        </button>
                      )}
                      {isComplete && hasInventory && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
                          <i className="fa-solid fa-check-double" style={{ marginRight: 4 }}></i> In Inventory
                        </div>
                      )}
                      {!isComplete && item.status !== 'cancelled' && (
                        <button className="btn btn--primary btn--sm" onClick={() => onUpdateItemStatus(order.id, item.id, getNextStatus(item.status))} style={{ gap: 6 }}>
                          <i className="fa-solid fa-arrow-right"></i>
                          Advance to {getStatusInfo(getNextStatus(item.status)).label}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>Cost Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-sm)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Total Weight</span><span style={{ fontWeight: 600 }}>{totalWeight.toFixed(3)}g</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Metal Value Base</span><span style={{ fontWeight: 600 }}>{fmt(order.subtotal - order.making_total)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Making</span><span style={{ fontWeight: 600 }}>{fmt(order.making_total)}</span></div>
              </div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)' }}>Financial</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-sm)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Grand Total</span><span style={{ fontWeight: 700 }}>{fmtInt(order.grand_total)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-tertiary)' }}>Advance</span><span style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{fmtInt(order.advance)}</span></div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 6 }}>
                  <span style={{ fontWeight: 600 }}>Balance</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmtInt(order.grand_total - order.advance)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', position: 'sticky', bottom: 0, background: 'var(--bg-card)' }}>
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
          <button className="btn btn--primary" onClick={onPrint}><i className="fa-solid fa-print"></i> Print Order</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   INVENTORY MODAL
   ═══════════════════════════════════════════ */
function InventoryModal({ item, onClose, onSuccess }) {
  const [huid, setHuid] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pMetal = (item.metal_type || 'gold').toLowerCase();
      const payload = {
        name: item.product_name,
        barcode: `INV-ORD-${Date.now().toString().slice(-6)}`, // Auto generate barcode
        metal_type: pMetal,
        purity: pMetal === 'silver' ? '925' : '22K',
        huid: huid,
        net_weight: item.expected_weight,
        status: 'available',
        shop: 1
      };
      const res = await api.post('/inventory/', payload);
      onSuccess(item.id, res.data.id);
    } catch (e) {
      console.error(e);
      alert('Failed to add to inventory.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="overlay" style={{ zIndex: 10000 }} onClick={onClose} />
      <div className="modal" style={{ maxWidth: 450, zIndex: 10001 }}>
        <div className="modal__header">
          <h2 className="modal__title"><i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--color-secondary)', marginRight: 10 }}></i>Add to Inventory</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal__body" style={{ padding: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
              Provide the HUID for <strong>{item.product_name}</strong> ({item.expected_weight}g) to add it to physical stock.
            </p>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">HUID (Optional)</label>
              <input className="form-input" type="text" maxLength={6} placeholder="e.g. A1B2C3" value={huid} onChange={e => setHuid(e.target.value.toUpperCase())} style={{ fontFamily: 'monospace', fontSize: 'var(--text-md)', letterSpacing: '0.1em' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Availability Status</label>
              <select className="form-input form-select" disabled>
                <option>Available</option>
              </select>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--secondary" disabled={loading}>
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
              Save to Stock
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   ORDERS LIST MAIN PAGE
   ═══════════════════════════════════════════ */
export default function OrdersList() {
  const { shop } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [viewOrder, setViewOrder] = useState(null);
  const [inventoryItem, setInventoryItem] = useState(null);
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/');
      setOrders(extractList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (order) => {
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
        docType: 'ORDER RECEIPT',
        theme: (order.metal_type || 'gold').toLowerCase(),
        customer: { name: order.customer_detail?.name || 'Walk-in', phone: order.customer_detail?.phone, address: order.customer_detail?.address },
        meta: { number: order.order_no, date: new Date(order.created_at).toLocaleDateString('en-IN') },
        rates: { rate10gm: parseFloat(order.metal_rate || 0), priority: order.priority },
        items: (order.items || []).map(i => ({ 
            name: i.product_name + (i.size ? ` (Size: ${i.size})` : ''), 
            weight: parseFloat(i.expected_weight) || 0, 
            metalValue: (parseFloat(i.expected_weight) || 0) * (parseFloat(order.metal_rate) / 10), 
            making: parseFloat(i.making_charge) || 0, 
            total: parseFloat(i.total) || 0
        })),
        oldMetal: null,
        totals: {
            subtotal: order.subtotal,
            advance: order.advance,
            finalAmount: order.grand_total
        },
        payment: { amounts: [{mode: 'ADVANCE', amount: order.advance}].filter(x => x.amount > 0) }
    };
    setPrintData(docData);
  };

  /* ─── Advance item status ─── */
  const handleUpdateItemStatus = async (orderId, itemId, newStatus) => {
    try {
      await api.patch(`/orders/${orderId}/update-item-status/`, { item_id: itemId, status: newStatus });
      setOrders(prev => prev.map(o => {
        if (o.id !== orderId) return o;
        const mappedItems = o.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
        // compute new order status if needed locally
        const newOrderStatus = deriveOrderStatus(mappedItems, o.order_status);
        return { ...o, items: mappedItems, order_status: newOrderStatus };
      }));
      // Live update view modal
      setViewOrder(prev => {
        if (!prev || prev.id !== orderId) return prev;
        const mappedItems = prev.items.map(i => i.id === itemId ? { ...i, status: newStatus } : i);
        const newOrderStatus = deriveOrderStatus(mappedItems, prev.order_status);
        return { ...prev, items: mappedItems, order_status: newOrderStatus };
      });
    } catch (e) {
      console.error(e);
      alert('Failed to update status.');
    }
  };

  const handleInventorySuccess = (itemId, invId) => {
    setOrders(prev => prev.map(o => {
      return {
        ...o,
        items: o.items.map(i => i.id === itemId ? { ...i, inventory_item: invId } : i)
      };
    }));
    setViewOrder(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i => i.id === itemId ? { ...i, inventory_item: invId } : i)
      };
    });
    setInventoryItem(null);
  };

  /* ─── Filtered ─── */
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const q = search.toLowerCase();
      const st = deriveOrderStatus(o.items, o.order_status);
      const matchSearch = o.order_no?.toLowerCase().includes(q) || o.customer_detail?.name?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'All' || st.toLowerCase() === statusFilter.toLowerCase().replace(' ', '_');
      const matchPriority = priorityFilter === 'All' || o.priority === priorityFilter.toLowerCase();
      const matchFrom = !dateFrom || o.created_at >= dateFrom;
      const matchTo = !dateTo || o.created_at.split('T')[0] <= dateTo;
      return matchSearch && matchStatus && matchPriority && matchFrom && matchTo;
    });
  }, [orders, search, statusFilter, priorityFilter, dateFrom, dateTo]);

  /* ─── Stats ─── */
  const stats = useMemo(() => {
    let pending = 0, inProgress = 0, completed = 0;
    orders.forEach(o => {
      const st = deriveOrderStatus(o.items, o.order_status);
      if (st === 'pending') pending++;
      else if (st === 'in_progress') inProgress++;
      else if (st === 'completed') completed++;
    });
    return { total: orders.length, pending, inProgress, completed };
  }, [orders]);

  const hasFilters = search || statusFilter !== 'All' || priorityFilter !== 'All' || dateFrom || dateTo;
  const clearFilters = () => { setSearch(''); setStatusFilter('All'); setPriorityFilter('All'); setDateFrom(''); setDateTo(''); };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Orders List</h1>
          <div className="page-header__actions">
            <button className="btn btn--primary" onClick={() => window.location.href = '/orders'}><i className="fa-solid fa-plus"></i> New Order</button>
          </div>
        </div>
        <p className="page-header__subtitle">Track, manage, and update all custom jewelry orders.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Orders', value: stats.total, icon: 'fa-box', color: 'primary' },
          { label: 'Pending', value: stats.pending, icon: 'fa-clock', color: 'warning' },
          { label: 'In Progress', value: stats.inProgress, icon: 'fa-hammer', color: 'info' },
          { label: 'Completed', value: stats.completed, icon: 'fa-check-circle', color: 'success' },
        ].map((s, i) => (
          <div key={i} className="card animate-fade-in-up" style={{ padding: 'var(--space-4)' }}>
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

      {/* Filters */}
      <div className="data-table-wrapper animate-fade-in-up">
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 180 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Search</label>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }}></i>
                <input className="form-input" type="text" placeholder="Order #, customer name..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, height: 36, fontSize: 'var(--text-sm)' }} />
              </div>
            </div>
            <div style={{ minWidth: 125 }}>
              <label className="form-label" style={{ marginBottom: 4 }}>Status</label>
              <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ height: 36, fontSize: 'var(--text-sm)' }}>
                {['All', 'Pending', 'In Progress', 'Completed'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {hasFilters && <button className="btn btn--ghost btn--sm" onClick={clearFilters} style={{ height: 36 }}><i className="fa-solid fa-xmark"></i> Clear</button>}
          </div>
        </div>

        {/* Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Metal</th>
              <th>Items</th>
              <th>Total</th>
              <th>Advance</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Added On</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>No orders found</td></tr>
            ) : filtered.map(order => {
              const orderSt = deriveOrderStatus(order.items, order.order_status);
              return (
                <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => setViewOrder(order)}>
                  <td style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{order.order_no}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{order.customer_detail?.name || 'Walk-in'}</div>
                  </td>
                  <td style={{ fontSize: 'var(--text-sm)' }}><span style={{ textTransform: 'capitalize' }}>{order.metal_type}</span></td>
                  <td style={{ fontWeight: 500 }}>{order.items?.length || 0}</td>
                  <td style={{ fontWeight: 700 }}>{fmtInt(order.grand_total)}</td>
                  <td style={{ color: 'var(--color-accent)' }}>{fmtInt(order.advance)}</td>
                  <td><span className={`badge badge--${order.priority === 'urgent' ? 'danger' : order.priority === 'high' ? 'warning' : 'primary'}`} style={{ fontSize: '0.6rem', textTransform: 'capitalize' }}>{order.priority}</span></td>
                  <td><span className={`badge badge--${orderStatusMap[orderSt] || 'info'}`} style={{ textTransform: 'capitalize' }}>{orderSt.replace('_', ' ')}</span></td>
                  <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <div className="flex gap-2" style={{ justifyContent: 'center' }}>
                      <button className="btn btn--ghost btn--sm btn--icon" title="View" onClick={() => setViewOrder(order)}><i className="fa-solid fa-eye"></i></button>
                      <button className="btn btn--ghost btn--sm btn--icon" title="Print" onClick={() => handlePrint(order)}><i className="fa-solid fa-print"></i></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewOrder && <OrderDetailModal order={viewOrder} onClose={() => setViewOrder(null)} onPrint={() => { setViewOrder(null); handlePrint(viewOrder); }} onUpdateItemStatus={handleUpdateItemStatus} onAddToInventory={(item) => setInventoryItem(item)} />}
      {inventoryItem && <InventoryModal item={inventoryItem} onClose={() => setInventoryItem(null)} onSuccess={handleInventorySuccess} />}
      <PrintPreviewModal isOpen={!!printData} data={printData} onClose={() => setPrintData(null)} />
    </div>
  );
}
