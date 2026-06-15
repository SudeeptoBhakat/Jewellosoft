import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { extractList } from '../../lib/axios';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';
import { useAuth } from '../../contexts/AuthContext';
import ProductNameInput from '../../components/elements/ProductNameInput';
import { calculateBill, fmtCurrency as fmt, fmtInt } from '../../utils/billingCalcEngine';
import { useTabs } from '../../contexts/TabContext';
import { toast } from '../../utils/toast';



/* ─── Products are fetched from inventory API ─── */

/* ═══════════════════════════════════════════
   BILL SETUP MODAL
   ═══════════════════════════════════════════ */
function BillSetupModal({ onStart, onClose }) {
  const [metal, setMetal] = useState('');
  const [billType, setBillType] = useState('');
  const [liveRates, setLiveRates] = useState({ Gold: 0, Silver: 0 });
  const [ratesData, setRatesData] = useState({ Gold: { rate: 0, making: 0 }, Silver: { rate: 0, making: 0 } });

  useEffect(() => {
    api.get('/rates/latest/').then(res => {
      const d = res.data;
      const goldRateObj = d.gold22k || d.gold24k || {};
      const silverRateObj = d.silver925 || d.silver999 || {};
      setRatesData({
        Gold: { rate: goldRateObj.rate_per_gram || 0, making: goldRateObj.making_per_gram || 0 },
        Silver: { rate: silverRateObj.rate_per_gram || 0, making: silverRateObj.making_per_gram || 0 }
      });
      setLiveRates({
        Gold: goldRateObj.rate_per_gram || 0,
        Silver: silverRateObj.rate_per_gram || 0,
      });
    }).catch(() => { });
  }, []);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 520, overflow: 'visible' }}>
        <div className="modal__header" style={{ borderBottom: '1px solid var(--border-primary)', position: 'relative' }}>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: 16,
              top: 16,
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          <h2 className="modal__title">
            <i className="fa-solid fa-file-invoice-dollar" style={{ marginRight: 10, color: 'var(--color-primary)' }}></i>
            Start New Bill
          </h2>
        </div>

        <div className="modal__body" style={{ padding: 'var(--space-6)' }}>
          {/* Metal Type */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Select Metal Type
            </label>
            <div className="bsetup-grid">
              <button
                type="button"
                className={`bsetup-card${metal === 'Gold' ? ' bsetup-card--active' : ''}`}
                onClick={() => setMetal('Gold')}
              >
                <div className="bsetup-card__icon" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#78350f' }}>
                  <i className="fa-solid fa-coins"></i>
                </div>
                <div className="bsetup-card__title">Gold</div>
                <div className="bsetup-card__rate">{liveRates.Gold ? fmt(liveRates.Gold) + '/g' : 'Loading...'}</div>
              </button>

              <button
                type="button"
                className={`bsetup-card${metal === 'Silver' ? ' bsetup-card--active' : ''}`}
                onClick={() => setMetal('Silver')}
              >
                <div className="bsetup-card__icon" style={{ background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)', color: '#1e293b' }}>
                  <i className="fa-solid fa-coins"></i>
                </div>
                <div className="bsetup-card__title">Silver</div>
                <div className="bsetup-card__rate">{liveRates.Silver ? fmt(liveRates.Silver) + '/g' : 'Loading...'}</div>
              </button>
            </div>
          </div>

          {/* Bill Type */}
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Select Bill Type
            </label>
            <div className="bsetup-grid">
              <button
                type="button"
                className={`bsetup-card${billType === 'Invoice' ? ' bsetup-card--active' : ''}`}
                onClick={() => setBillType('Invoice')}
              >
                <div className="bsetup-card__icon" style={{ background: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}>
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <div className="bsetup-card__title">Invoice</div>
                <div className="bsetup-card__rate">With GST (3%)</div>
              </button>

              <button
                type="button"
                className={`bsetup-card${billType === 'Estimate' ? ' bsetup-card--active' : ''}`}
                onClick={() => setBillType('Estimate')}
              >
                <div className="bsetup-card__icon" style={{ background: 'var(--color-info-muted)', color: 'var(--color-info)' }}>
                  <i className="fa-solid fa-file-lines"></i>
                </div>
                <div className="bsetup-card__title">Estimate</div>
                <div className="bsetup-card__rate">No GST</div>
              </button>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button
            className="btn btn--primary btn--lg"
            style={{ width: '100%', gap: 10 }}
            disabled={!metal || !billType}
            onClick={() => onStart(metal, billType, ratesData[metal]?.rate || 0, ratesData[metal]?.making || 0)}
          >
            <i className="fa-solid fa-arrow-right"></i>
            Start Billing
          </button>
        </div>
      </div>
    </>
  );
}

export default function Billing({ tabId, isActive }) {
  const navigate = useNavigate();
  const { shop } = useAuth();
  const { closeTab, closeTabAndSwitch } = useTabs();
  const searchRef = useRef(null);
  const searchWrapRef = useRef(null);

  /* ─── Modal State ─── */
  const [showModal, setShowModal] = useState(true);
  const [metalType, setMetalType] = useState('');
  const [billType, setBillType] = useState('');

  /* ─── Customer Warning Modal State ─── */
  const [showCustWarning, setShowCustWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'save' | 'print'


  /* ─── Bill Info ─── */
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const billNumber = billType === 'Invoice' ? 'INV-2024-0848' : 'EST-2024-0023';

  /* ─── Customer ─── */
  const [customerId, setCustomerId] = useState(null);
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custSuggestions, setCustSuggestions] = useState([]);
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const custWrapRef = useRef(null);

  // Debounced Customer Search
  useEffect(() => {
    const handler = setTimeout(async () => {
      if (custName.length > 2 && !customerId) {
        try {
          const res = await api.get(`/customers/?search=${encodeURIComponent(custName)}`);
          setCustSuggestions(extractList(res.data));
          setShowCustSuggestions(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        setShowCustSuggestions(false);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [custName, customerId]);

  const selectCustomer = (c) => {
    setCustomerId(c.id);
    setCustName(c.name);
    setCustMobile(c.phone || '');
    setCustAddress(c.address || '');
    setShowCustSuggestions(false);
  };

  /* ─── Metal Rate (editable) ─── */
  const [metalRate, setMetalRate] = useState(0);
  const [makingRate, setMakingRate] = useState(0);
  // console.log(makingRate);
  const [allRates, setAllRates] = useState({});

  useEffect(() => {
    api.get('/rates/latest/').then(res => setAllRates(res.data)).catch(() => { });
  }, []);

  const rateOptions = useMemo(() => {
    const isGold = metalType.toLowerCase() === 'gold';
    const prefix = isGold ? 'gold' : 'silver';
    const labels = isGold
      ? { gold24k: 'Gold 24K (999)', gold22k: 'Gold 22K (916)', gold18k: 'Gold 18K (750)' }
      : { silver999: 'Silver 999 (Pure)', silver925: 'Silver 925 (Sterling)' };
    return Object.entries(labels)
      .filter(([key]) => allRates[key]?.rate_per_gram > 0)
      .map(([key, label]) => ({ key, label, rate: allRates[key].rate_per_gram, making: allRates[key].making_per_gram || 0 }));
  }, [metalType, allRates]);

  /* ─── Items ─── */
  const [items, setItems] = useState([]);

  /* ─── Product Search ─── */
  const [searchQ, setSearchQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQ.length > 1) {
        try {
          const mTypeParam = metalType ? `&metal_type=${metalType.toLowerCase()}` : '';
          const res = await api.get(`/inventory/?status=available&search=${encodeURIComponent(searchQ)}${mTypeParam}`);
          setSuggestions(extractList(res.data));
          if (extractList(res.data).length > 0) setShowSuggestions(true);
        } catch (e) {
          console.error(e);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQ, metalType]);

  /* ─── Old Exchange ─── */
  const [oldSettlementMode, setOldSettlementMode] = useState('none');
  const [oldWeight, setOldWeight] = useState('');
  const [oldDeductPct, setOldDeductPct] = useState('10');
  const [oldValueDirect, setOldValueDirect] = useState('');

  /* ─── Tax & Charges ─── */
  const [otherCharges, setOtherCharges] = useState('');
  const [hallmarkCount, setHallmarkCount] = useState('');
  const [advance, setAdvance] = useState('');
  const [discount, setDiscount] = useState('');

  /* ─── Payment ─── */
  const [cashAmt, setCashAmt] = useState('');
  const [onlineAmt, setOnlineAmt] = useState('');



  /* ─── Print Preview ─── */
  const [printData, setPrintData] = useState(null);

  /* ─── Settings (from localStorage) ─── */
  const hallmarkValue = useMemo(() => {
    try { return Number(localStorage.getItem('jewellosoft_hallmark_value')) || 53; }
    catch { return 53; }
  }, []);

  /* ─── Modal Handler ─── */
  const handleStart = useCallback((metal, type, rate, making) => {
    setMetalType(metal);
    setBillType(type);
    setMetalRate(rate || 0);
    setMakingRate(making || 0);
    setItems([createEmptyItem()]);
    setShowModal(false);
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  /* ─── Item Helpers ─── */
  const createEmptyItem = () => ({
    id: Date.now() + Math.random(),
    name: '', huid: '', weight: '', makingCharges: '', metalValue: 0, total: 0,
  });

  const recalcItem = (item, rate, mRate) => {
    const w = parseFloat(item.weight) || 0;
    const _autoMaking = Math.round(w * mRate * 100) / 100;
    
    let mkStr = item.makingCharges;
    if (!mkStr || mkStr === String(item._autoMaking || '')) {
       mkStr = _autoMaking ? String(_autoMaking) : '';
    }

    const mk = parseFloat(mkStr) || 0;
    const mv = Math.round(w * rate * 100) / 100;
    return { ...item, makingCharges: mkStr, metalValue: mv, total: Math.round((mv + mk) * 100) / 100, _autoMaking: _autoMaking ? String(_autoMaking) : '' };
  };

  const updateItem = useCallback((id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      if (field === 'makingCharges') {
        updated._autoMaking = undefined;
      }
      if (field === 'weight' || field === 'makingCharges') {
        return recalcItem(updated, metalRate, makingRate);
      }
      return updated;
    }));
  }, [metalRate, makingRate]);

  const addItemFromSearch = useCallback((product) => {
    const newItem = recalcItem({
      ...createEmptyItem(),
      inventory_id: product.id,
      name: product.name,
      huid: product.huid || '',
      weight: product.net_weight || product.gross_weight || ''
    }, metalRate, makingRate);
    setItems(prev => [...prev, newItem]);
    setSearchQ('');
    setShowSuggestions(false);
  }, [metalRate, makingRate]);

  /* ─── Click-outside & Keyboard Shortcuts ─── */
  useEffect(() => {
    const mouseHandler = (e) => {
      if (!isActive) return;
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (custWrapRef.current && !custWrapRef.current.contains(e.target)) {
        setShowCustSuggestions(false);
      }
    };

    const keyHandler = (e) => {
      if (!isActive) return;
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); handlePrint(); }
      if (e.key === 'Escape' && !showModal) { handleCancel(); }
    };

    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [showModal, isActive]);


  const addEmptyItem = useCallback(() => {
    setItems(prev => [...prev, createEmptyItem()]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(it => it.id !== id));
  }, []);

  /* ─── Recalc all items when rate changes ─── */
  useEffect(() => {
    if (metalRate > 0) {
      setItems(prev => prev.map(it => recalcItem(it, metalRate, makingRate)));
    }
  }, [metalRate, makingRate]);

  /* ═══ INSTANT LOCAL CALCULATIONS (Shared Engine) ═══ */
  const calc = useMemo(() => {
    return calculateBill({
      items,
      metalRate,
      oldSettlementMode,
      oldWeight,
      oldDeductPct,
      oldValueDirect,
      hallmarkCount,
      hallmarkValue,
      isInvoice: billType === 'Invoice',
      otherCharges,
      advance,
      discount,
      cashAmt,
      onlineAmt,
    });
  }, [items, metalRate, oldSettlementMode, oldWeight, oldDeductPct, oldValueDirect, hallmarkCount, hallmarkValue, billType, otherCharges, advance, discount, cashAmt, onlineAmt]);

  /* ─── Order Integration ─── */
  const [orderLoading, setOrderLoading] = useState(false);
  const handleLoadOrder = async () => {
    if (!orderNumber.trim()) return;
    setOrderLoading(true);
    try {
      const res = await api.get(`/orders/?search=${encodeURIComponent(orderNumber)}`);
      const orders = res.data.results || res.data || [];
      const ord = orders.length > 0 ? orders[0] : null;

      if (!ord || ord.order_no !== orderNumber) {
        alert('Order not found or invalid.');
        return;
      }
      if (ord.order_status !== 'complete') {
        alert('Billing is only allowed for Orders in "complete" status.');
        return;
      }

      // Map complete order to UI
      setCustomerId(ord.customer);
      setCustName(ord.customer_detail?.name || '');
      setCustMobile(ord.customer_detail?.phone || '');
      setCustAddress(ord.customer_detail?.address || '');
      setOrderDate(ord.created_at?.split('T')[0] || '');

      // Pull items
      if (ord.items && ord.items.length > 0) {
        const mappedItems = ord.items.map(i => ({
          id: Date.now() + Math.random(),
          name: i.product_name,
          huid: i.huid || '',
          weight: i.expected_weight || i.weight || '',
          makingCharges: i.making_charge || '',
          metalValue: 0, total: 0
        }));
        setItems(mappedItems);
        // Force recalc based on current UI metal rate
        setTimeout(() => setMetalRate(prev => prev), 50);
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching order.');
    } finally {
      setOrderLoading(false);
    }
  };

  /* ─── Actions ─── */
  const handleSave = async (redirectList = true, bypassWarning = false) => {
    if (!custName.trim() && !bypassWarning) {
      setPendingAction(redirectList ? 'save' : 'save_silent');
      setShowCustWarning(true);
      return false;
    }
    try {
      const finalCustName = custName.trim() || 'Walk-in';
      let finalId = customerId;
      if (!finalId) {
        const cr = await api.post('/customers/', {
          shop: 1, name: finalCustName, phone: custMobile || `NA-${Date.now().toString().slice(-8)}`, address: custAddress
        });
        finalId = cr.data.id;
        setCustomerId(finalId);
      }

      const payload = {
        shop_id: 1,
        customer_id: finalId, // Explicit backend FK
        customer_name: finalCustName,
        customer_mobile: custMobile,
        customer_address: custAddress,
        metal_type: metalType,
        rate_10gm: (metalRate * 10) || 0,
        making_rate: makingRate || 0,
        invoice_no: billType === 'Invoice' ? null : undefined, // Trigger auto-gen
        items: items.map(it => ({
          inventory_id: it.inventory_id,
          weight: it.weight || 0,
          making: it.makingCharges || 0,
          metalValue: it.metalValue || 0,
          total: it.total || 0,
          product_name: it.name,
          purity: metalType.toLowerCase() === 'silver' ? '925' : '22K'
        })),
        totals: {
          total_weight: calc.totalWeight,
          making_total: calc.totalMaking,
          subtotal: calc.subtotal,
          old_weight: calc.oldWt,
          old_amount: calc.effectiveOldValue || 0,
          old_value_direct: calc.oldValueDirect || 0,
          old_settlement_mode: calc.oldMode || 'none',
          old_metal_raw_value: calc.oldMV || 0,
          old_deduct_percent: calc.oldDeductPct || 0,
          old_deduct_amount: calc.oldDeductAmt || 0,
          advance: calc.advanceVal,
          discount: calc.discountVal,
          hallmark: calc.hallmarkAmt,
          others: calc.otherChargesVal,
          cgst: calc.cgst,
          sgst: calc.sgst,
          round_off: calc.roundOffVal,
          grand_total: calc.finalAmt,
          transaction_type: calc.transactionType
        },
        payments: [
          { mode: 'cash', amount: cashAmt },
          { mode: 'upi', amount: onlineAmt }
        ].filter(p => p.amount > 0)
      };

      if (billType === 'Invoice') {
        await api.post('/billing/invoices/', payload);
      } else {
        await api.post('/billing/estimates/', payload);
      }
      if (redirectList) {
        toast.success('Bill saved successfully!');
        closeTabAndSwitch(tabId, '/billing/list', 'Bills List');
      }
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Failed to save bill on backend.');
      return false;
    }
  };

  const handlePrint = async () => {
    if (!custName.trim()) {
      setPendingAction('print');
      setShowCustWarning(true);
      return;
    }
    await handleSaveAndPrint(true);
  };

  const handleSaveAndPrint = async (bypassWarning = false) => {
    const success = await handleSave(false, bypassWarning);
    if (success) {
      const finalCustName = custName.trim() || 'Walk-in';
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
        docType: billType === 'Invoice' ? 'TAX INVOICE' : 'ESTIMATE',
        theme: metalType.toLowerCase() === 'silver' ? 'silver' : 'gold',
        customer: { name: finalCustName, phone: custMobile, address: custAddress },
        meta: { number: billNumber || 'TBD', date: orderDate || new Date().toLocaleDateString('en-IN') },
        rates: { rate10gm: metalRate * 10, makingRate: makingRate },
        items: items.map(it => ({
          name: it.name,
          huid: billType === 'Invoice' ? it.huid : undefined,
          weight: it.weight || 0,
          metalValue: it.metalValue || 0,
          making: it.makingCharges || 0,
          total: it.total || 0
        })),
        oldMetal: calc.hasOld ? { weight: calc.oldWt, value: calc.effectiveOldValue, mode: calc.oldMode, rawValue: calc.oldMV, deductPct: calc.oldDeductPct, deductAmt: calc.oldDeductAmt } : null,
        returnBreakdown: calc.returnBreakdown || null,
        totals: {
          makingTotal: calc.totalMaking,
          subtotal: calc.subtotal,
          cgst: calc.cgst,
          sgst: calc.sgst,
          otherCharges: calc.otherChargesVal,
          hallmark: calc.hallmarkAmt,
          advance: calc.advanceVal,
          discount: calc.discountVal,
          roundOff: calc.roundOffVal,
          finalAmount: calc.finalAmt,
          amountInWords: calc.amountInWords,
          transactionType: calc.transactionType
        },
        payment: {
          amounts: [
            { mode: 'CASH', amount: parseFloat(cashAmt) || 0 },
            { mode: 'ONLINE', amount: parseFloat(onlineAmt) || 0 }
          ].filter(x => x.amount > 0)
        }
      };

      setPrintData(docData);
    }
  };

  const handleCancel = () => {
    closeTab(tabId);
  };

  const handleProceedWalkin = async () => {
    setShowCustWarning(false);
    if (pendingAction === 'save') {
      await handleSave(true, true);
    } else if (pendingAction === 'save_silent') {
      await handleSave(false, true);
    } else if (pendingAction === 'print') {
      await handleSaveAndPrint(true);
    }
    setPendingAction(null);
  };

  const handleCancelWarning = () => {
    setShowCustWarning(false);
    setPendingAction(null);
    setTimeout(() => {
      const nameInput = document.getElementById('bill-cust-name');
      if (nameInput) nameInput.focus();
    }, 100);
  };


  /* ═══ RENDER ═══ */
  if (showModal) {
    return <BillSetupModal onStart={handleStart} onClose={() => navigate('/dashboard')} />;
  }

  return (
    <div className="animate-fade-in">
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <div className="page-header__top">
          <div className="flex items-center gap-3">
            <h1 className="page-header__title">
              New {metalType} {billType}
            </h1>
            <span className={`badge ${billType === 'Invoice' ? 'badge--primary' : 'badge--info'}`} style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>
              {billNumber}
            </span>
            <span className="badge badge--warning" style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>
              <i className="fa-solid fa-coins" style={{ marginRight: 4 }}></i>
              {metalType} @ {fmt(metalRate)}/g
            </span>
            {billType === 'Invoice' && (
              <span className="badge badge--success" style={{ fontSize: 'var(--text-xs)', padding: '3px 8px' }}>GST 3%</span>
            )}
          </div>
          <div className="page-header__actions">
            <span className="kbd-hint">Ctrl+S Save</span>
            <span className="kbd-hint">Ctrl+P Print</span>
            <button className="btn btn--ghost btn--sm" onClick={handleCancel}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
            <button className="btn btn--ghost" onClick={handlePrint}>
              <i className="fa-solid fa-print"></i> Print Bill
            </button>
            <button className="btn btn--success" onClick={handleSave}>
              <i className="fa-solid fa-check"></i> Save Bill
            </button>
          </div>
        </div>
      </div>

      {/* ─── Customer + Bill Info ─── */}
      <div className="billing-form animate-fade-in-up" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="billing-form__header">
          <span className="billing-form__header-title">
            <i className="fa-solid fa-user" style={{ marginRight: 8, opacity: 0.6 }}></i>
            Customer & Bill Information
          </span>
        </div>
        <div className="billing-form__body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <div className="form-row" style={{ gridTemplateColumns: '1.5fr 1fr 2fr' }}>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)', position: 'relative' }} ref={custWrapRef}>
              <label className="form-label">Customer Name *</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter customer name"
                value={custName}
                onChange={e => { setCustName(e.target.value); setCustomerId(null); setShowCustSuggestions(true); }}
                id="bill-cust-name"
              />
              {showCustSuggestions && custSuggestions.length > 0 && (
                <div className="search-ac__dropdown">
                  {custSuggestions.map(c => (
                    <div key={c.id} className="search-ac__item" onClick={() => selectCustomer(c)}>
                      <span>{c.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Mobile Number</label>
              <input className="form-input" type="tel" placeholder="Phone number" value={custMobile} onChange={e => setCustMobile(e.target.value)} id="bill-cust-mobile" />
            </div>
            <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
              <label className="form-label">Address</label>
              <input className="form-input" type="text" placeholder="Customer address" value={custAddress} onChange={e => setCustAddress(e.target.value)} id="bill-cust-addr" />
            </div>
          </div>
          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bill Date *</label>
              <input className="form-input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} id="bill-date" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Order Number</label>
              <div className="flex gap-2">
                <input className="form-input" type="text" placeholder="Order #" value={orderNumber} onChange={e => setOrderNumber(e.target.value)} id="bill-order-num" />
                <button
                  className="btn btn--secondary btn--sm"
                  style={{ padding: '0 10px' }}
                  onClick={handleLoadOrder}
                  disabled={orderLoading || !orderNumber.trim()}
                  title="Load Complete Order"
                >
                  {orderLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-down"></i>}
                </button>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Order Date</label>
              <input className="form-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} id="bill-order-date" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{metalType} Rate (₹/g)</label>
              <select
                className="form-input form-select"
                value={`${metalRate}_${makingRate}`}
                onChange={e => {
                   const [rt, mk] = e.target.value.split('_');
                   setMetalRate(parseFloat(rt) || 0);
                   setMakingRate(parseFloat(mk) || 0);
                }}
                id="bill-metal-rate"
                style={{ fontWeight: 700, color: 'var(--color-warning)' }}
              >
                {rateOptions.length === 0 && <option value={`${metalRate}_${makingRate}`}>{metalRate > 0 ? `₹${metalRate}` : 'No rates set'}</option>}
                {rateOptions.map(r => (
                  <option key={r.key} value={`${r.rate}_${r.making}`}>{r.label} — ₹{r.rate.toLocaleString('en-IN')}/g</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Product Search + Items Table ─── */}
      <div className="billing-form animate-fade-in-up" style={{ animationDelay: '60ms', animationFillMode: 'both', marginBottom: 'var(--space-4)' }}>
        <div className="billing-form__header">
          <span className="billing-form__header-title">
            <i className="fa-solid fa-gem" style={{ marginRight: 8, opacity: 0.6 }}></i>
            Bill Items
          </span>
          <div className="flex gap-2">
            <div className="search-ac" ref={searchWrapRef} style={{ width: 340 }}>
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', pointerEvents: 'none' }}></i>
                <input
                  ref={searchRef}
                  className="form-input"
                  type="text"
                  placeholder="Search product to add..."
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => searchQ && setShowSuggestions(true)}
                  style={{ height: 34, fontSize: 'var(--text-sm)', paddingLeft: 34 }}
                  id="bill-product-search"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="search-ac__dropdown">
                  {suggestions.map((p, i) => (
                    <div key={p.id || i} className="search-ac__item" onClick={() => addItemFromSearch(p)}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{p.barcode} • {p.purity} • {Number(p.net_weight).toFixed(3)}g</span>
                      </div>
                      <span className={`badge badge--${p.metal_type === 'gold' ? 'warning' : 'info'}`} style={{ fontSize: '0.6rem', padding: '1px 6px', textTransform: 'capitalize' }}>{p.metal_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn--primary btn--sm" onClick={addEmptyItem} title="Add empty row">
              <i className="fa-solid fa-plus"></i> Add Item
            </button>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="billing-items-table">
            <thead>
              <tr>
                <th style={{ width: '3%' }}>#</th>
                <th style={{ width: billType === 'Invoice' ? '22%' : '28%' }}>Product Name</th>
                {billType === 'Invoice' && <th style={{ width: '10%' }}>HUID</th>}
                <th style={{ width: '10%' }}>Weight (g)</th>
                <th style={{ width: '14%' }}>Metal Value (₹)</th>
                <th style={{ width: '12%' }}>Making (₹)</th>
                <th style={{ width: '14%' }}>Total (₹)</th>
                <th style={{ width: '4%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={billType === 'Invoice' ? 8 : 7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-box-open" style={{ fontSize: '1.5rem', marginBottom: 8, display: 'block', opacity: 0.3 }}></i>
                    Search for a product above or click "Add Item"
                  </td>
                </tr>
              ) : items.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{idx + 1}</td>
                  <td>
                    <ProductNameInput value={item.name} onChange={val => updateItem(item.id, 'name', val)} placeholder="Product name" style={{ height: 32, fontSize: 'var(--text-sm)' }} />
                  </td>
                  {billType === 'Invoice' && (
                    <td>
                      <input className="form-input" type="text" placeholder="HUID" value={item.huid} onChange={e => updateItem(item.id, 'huid', e.target.value)} style={{ height: 32, fontSize: 'var(--text-sm)', fontFamily: 'monospace', letterSpacing: '0.05em' }} maxLength={6} />
                    </td>
                  )}
                  <td>
                    <input className="form-input" type="number" step="0.001" placeholder="0.000" value={item.weight} onChange={e => updateItem(item.id, 'weight', e.target.value)} style={{ height: 32, fontSize: 'var(--text-sm)' }} />
                  </td>
                  <td>
                    <span className="bill-readonly-val">{item.metalValue ? fmt(item.metalValue) : '—'}</span>
                  </td>
                  <td>
                    <input className="form-input" type="number" step="1" placeholder="0" value={item.makingCharges} onChange={e => updateItem(item.id, 'makingCharges', e.target.value)} style={{ height: 32, fontSize: 'var(--text-sm)' }} />
                  </td>
                  <td>
                    <span className="bill-readonly-val bill-readonly-val--highlight">{item.total ? fmt(item.total) : '—'}</span>
                  </td>
                  <td>
                    <button className="btn btn--ghost btn--sm btn--icon" onClick={() => removeItem(item.id)} title="Remove" style={{ color: 'var(--color-danger)', width: 28, height: 28 }}>
                      <i className="fa-solid fa-trash-can" style={{ fontSize: '0.7rem' }}></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Row */}
        {items.length > 0 && (
          <div className="bill-totals-bar">
            <div className="bill-totals-item">
              <span className="bill-totals-label">Total Weight</span>
              <span className="bill-totals-value">{calc.totalWeight.toFixed(3)} g</span>
            </div>
            <div className="bill-totals-item">
              <span className="bill-totals-label">Total Metal Value</span>
              <span className="bill-totals-value">{fmt(calc.totalMetalValue)}</span>
            </div>
            <div className="bill-totals-item">
              <span className="bill-totals-label">Total Making</span>
              <span className="bill-totals-value">{fmt(calc.totalMaking)}</span>
            </div>
            <div className="bill-totals-item" style={{ borderLeft: '2px solid var(--color-primary)', paddingLeft: 'var(--space-4)' }}>
              <span className="bill-totals-label" style={{ color: 'var(--color-primary-hover)' }}>{calc.hasOld ? 'Net Weight' : 'Product Value'}</span>
              <span className="bill-totals-value" style={{ color: 'var(--color-primary-hover)', fontSize: 'var(--text-md)', fontWeight: 700 }}>{calc.hasOld ? `${(calc.totalWeight - calc.oldWt).toFixed(3)}g` : fmt(calc.newProductValue)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Section: 2 Columns ─── */}
      <div className="bill-bottom-grid">
        {/* ═══ LEFT COLUMN ═══ */}
        <div>
          {/* Old Exchange */}
          <div className="billing-form animate-fade-in-up" style={{ animationDelay: '120ms', animationFillMode: 'both', marginBottom: 'var(--space-4)' }}>
            <div className="billing-form__header" style={{ padding: 'var(--space-3) var(--space-5)' }}>
              <span className="billing-form__header-title" style={{ fontSize: 'var(--text-sm)' }}>
                <i className="fa-solid fa-scale-balanced" style={{ marginRight: 8, opacity: 0.6 }}></i>
                Old Metal Exchange
              </span>
            </div>
            <div className="billing-form__body" style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)' }}>
              {/* Settlement Mode Toggle */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {[['none', 'No Old Metal', 'fa-xmark'], ['weight', 'By Weight', 'fa-weight-scale'], ['value', 'By Direct Value', 'fa-indian-rupee-sign']].map(([mode, label, icon]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn btn--sm ${oldSettlementMode === mode ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => { setOldSettlementMode(mode); if (mode === 'none') { setOldWeight(''); setOldValueDirect(''); } }}
                    style={{ flex: 1, fontSize: 'var(--text-xs)', gap: 4 }}
                  >
                    <i className={`fa-solid ${icon}`}></i> {label}
                  </button>
                ))}
              </div>

              {oldSettlementMode !== 'none' && (
                <>
                  <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                      <label className="form-label" style={{ opacity: oldSettlementMode === 'value' ? 0.4 : 1 }}>Old Metal Weight (g)</label>
                      <input
                        className="form-input" type="number" step="0.001" placeholder="0.000"
                        value={oldWeight}
                        onChange={e => setOldWeight(e.target.value)}
                        disabled={oldSettlementMode === 'value'}
                        style={{ opacity: oldSettlementMode === 'value' ? 0.4 : 1 }}
                        id="bill-old-wt"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                      <label className="form-label" style={{ opacity: oldSettlementMode === 'value' ? 0.4 : 1 }}>Deduction %</label>
                      <div className="flex gap-2">
                        <select
                          className="form-input form-select" value={oldDeductPct}
                          onChange={e => setOldDeductPct(e.target.value)}
                          disabled={oldSettlementMode === 'value'}
                          style={{ width: '50%', opacity: oldSettlementMode === 'value' ? 0.4 : 1 }}
                          id="bill-old-deduct"
                        >
                          <option value="8">8%</option>
                          <option value="10">10%</option>
                          <option value="12">12%</option>
                        </select>
                        <input
                          className="form-input" type="number" step="0.1" placeholder="Custom %"
                          value={oldDeductPct}
                          onChange={e => setOldDeductPct(e.target.value)}
                          disabled={oldSettlementMode === 'value'}
                          style={{ width: '50%', opacity: oldSettlementMode === 'value' ? 0.4 : 1 }}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                      <label className="form-label" style={{ opacity: oldSettlementMode === 'weight' ? 0.4 : 1 }}>Old Value (₹)</label>
                      <input
                        className="form-input" type="number" step="1" placeholder="Enter amount"
                        value={oldValueDirect}
                        onChange={e => setOldValueDirect(e.target.value)}
                        disabled={oldSettlementMode === 'weight'}
                        style={{ opacity: oldSettlementMode === 'weight' ? 0.4 : 1, fontWeight: 600, color: 'var(--color-accent)' }}
                        id="bill-old-value-direct"
                      />
                    </div>
                  </div>

                  {/* Old Metal Summary */}
                  {calc.hasOld && (
                    <div className="bill-old-summary animate-fade-in">
                      {oldSettlementMode === 'weight' && (
                        <>
                          <div className="flex justify-between"><span>Old Metal Value</span><span style={{ fontWeight: 600 }}>{fmt(calc.oldMV)}</span></div>
                          {calc.oldDeductAmt > 0 && (
                            <div className="flex justify-between"><span>Deduction ({oldDeductPct}%)</span><span style={{ color: 'var(--color-danger)' }}>−{fmt(calc.oldDeductAmt)}</span></div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between" style={{ fontWeight: 700, color: 'var(--color-accent)', borderTop: oldSettlementMode === 'weight' ? '1px solid var(--border-primary)' : 'none', paddingTop: oldSettlementMode === 'weight' ? 6 : 0, marginTop: oldSettlementMode === 'weight' ? 6 : 0 }}>
                        <span>{oldSettlementMode === 'value' ? 'Old Value (Direct Entry)' : 'Old Value (Credit)'}</span>
                        <span>{fmt(calc.effectiveOldValue)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tax & Charges */}
          <div className="billing-form animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'both', marginBottom: 'var(--space-4)' }}>
            <div className="billing-form__header" style={{ padding: 'var(--space-3) var(--space-5)' }}>
              <span className="billing-form__header-title" style={{ fontSize: 'var(--text-sm)' }}>
                <i className="fa-solid fa-calculator" style={{ marginRight: 8, opacity: 0.6 }}></i>
                Charges & Deductions
              </span>
            </div>
            <div className="billing-form__body" style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)' }}>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label">Other Charges (₹)</label>
                  <input className="form-input" type="number" step="1" placeholder="0" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} id="bill-other-charges" />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label">Hallmark Count <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(×₹{hallmarkValue})</span></label>
                  <input className="form-input" type="number" step="1" placeholder="0" value={hallmarkCount} onChange={e => setHallmarkCount(e.target.value)} id="bill-hallmark-count" />
                </div>
              </div>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label">Less Advance (₹)</label>
                  <input className="form-input" type="number" step="1" placeholder="0" value={advance} onChange={e => setAdvance(e.target.value)} id="bill-advance" />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label">Discount (₹)</label>
                  <input className="form-input" type="number" step="1" placeholder="0" value={discount} onChange={e => setDiscount(e.target.value)} id="bill-discount" />
                </div>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="billing-form animate-fade-in-up" style={{ animationDelay: '180ms', animationFillMode: 'both', marginBottom: 'var(--space-4)' }}>
            <div className="billing-form__header" style={{ padding: 'var(--space-3) var(--space-5)' }}>
              <span className="billing-form__header-title" style={{ fontSize: 'var(--text-sm)' }}>
                <i className="fa-solid fa-wallet" style={{ marginRight: 8, opacity: 0.6 }}></i>
                Payment
              </span>
            </div>
            <div className="billing-form__body" style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)' }}>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label"><i className="fa-solid fa-money-bill-wave" style={{ marginRight: 6, color: 'var(--color-accent)' }}></i>Cash (₹)</label>
                  <input className="form-input" type="number" step="1" placeholder="0" value={cashAmt} onChange={e => setCashAmt(e.target.value)} id="bill-cash" style={{ fontSize: 'var(--text-md)', fontWeight: 600 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label"><i className="fa-solid fa-mobile-screen" style={{ marginRight: 6, color: 'var(--color-info)' }}></i>Online (₹)</label>
                  <input className="form-input" type="number" step="1" placeholder="0" value={onlineAmt} onChange={e => setOnlineAmt(e.target.value)} id="bill-online" style={{ fontSize: 'var(--text-md)', fontWeight: 600 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN — SUMMARY ═══ */}
        <div className="bill-summary-card animate-fade-in-up" style={{ animationDelay: '120ms', animationFillMode: 'both' }}>
          <div className="billing-form__header" style={{ padding: 'var(--space-3) var(--space-5)' }}>
            <span className="billing-form__header-title" style={{ fontSize: 'var(--text-sm)' }}>
              <i className="fa-solid fa-receipt" style={{ marginRight: 8, opacity: 0.6 }}></i>
              Bill Summary
            </span>
          </div>
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {/* Summary Lines */}
            <div className="bill-summary-lines">
              {calc.returnBreakdown ? (
                <>
                  {/* ── SCENARIO 3: Step-by-step Return Breakdown ── */}
                  <div style={{ padding: '8px 12px', background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.04))', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <i className="fa-solid fa-scale-balanced" style={{ color: 'var(--color-success)', fontSize: '0.75rem' }}></i>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>Old Metal Return Breakdown</span>
                    </div>
                    <div className="bill-sline" style={{ marginBottom: 2 }}>
                      <span style={{ fontSize: 'var(--text-sm)' }}>Old: <strong>{calc.oldWt.toFixed(3)}g</strong> → New: <strong>{calc.totalWeight.toFixed(3)}g</strong></span>
                      <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>+{calc.returnBreakdown.excessWeight.toFixed(3)}g extra</span>
                    </div>
                  </div>

                  <div className="bill-sline">
                    <span>Excess Value <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({calc.returnBreakdown.excessWeight.toFixed(3)}g × ₹{metalRate.toLocaleString('en-IN')})</span></span>
                    <span>{fmt(calc.returnBreakdown.excessMetalValue)}</span>
                  </div>
                  {calc.returnBreakdown.deductionAmt > 0 && (
                    <div className="bill-sline" style={{ color: 'var(--color-danger)' }}>
                      <span>(−) Deduction ({calc.returnBreakdown.deductionPct}%)</span>
                      <span>−{fmt(calc.returnBreakdown.deductionAmt)}</span>
                    </div>
                  )}
                  <div className="bill-sline" style={{ fontWeight: 700, borderTop: '1px solid var(--border-primary)', paddingTop: 6, marginTop: 4, marginBottom: 10 }}>
                    <span>Return Base Amount</span>
                    <span style={{ color: 'var(--color-success)' }}>{fmt(calc.returnBreakdown.afterDeduction)}</span>
                  </div>

                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Charges Deducted from Return</div>
                  {calc.returnBreakdown.steps.map((step, i) => (
                    <div key={i}>
                      {step.isFlip && (
                        <div style={{ textAlign: 'center', margin: '6px 0', padding: '4px 0' }}>
                          <span style={{ fontSize: '0.65rem', padding: '3px 12px', background: 'rgba(251,191,36,0.15)', color: '#b45309', borderRadius: 12, fontWeight: 700, letterSpacing: '0.03em' }}>
                            Return Fulfilled — Customer Now Pays
                          </span>
                        </div>
                      )}
                      <div className="bill-sline" style={{ fontSize: 'var(--text-sm)' }}>
                        <span>
                          {step.isSubtract ? '(−)' : '(+)'} {step.label}
                          {step.detail && <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}> ({step.detail})</span>}
                          {step.isFlip && <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}> — {fmt(step.absorbed)} absorbed</span>}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: step.isSubtract ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600 }}>
                            {step.isSubtract ? '−' : '+'}{fmt(step.amount)}
                          </span>
                          <span style={{ fontSize: '0.6rem', color: step.balance >= 0 ? '#16a34a' : '#dc2626', background: step.balance >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', padding: '1px 6px', borderRadius: 4, fontWeight: 600, minWidth: 55, textAlign: 'right' }}>
                            {step.balance >= 0 ? '↩' : '↑'} {fmt(Math.abs(step.balance))}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="bill-sline" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
                    <span>Round Off</span>
                    <span>{calc.roundOffVal >= 0 ? '+' : ''}{calc.roundOffVal.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  {/* ── Normal / Old≤New Scenario ── */}
                  <div className="bill-sline"><span>New Product Value <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({calc.totalWeight.toFixed(3)}g × ₹{metalRate.toLocaleString('en-IN')} + Making)</span></span><span>{fmt(calc.newProductValue)}</span></div>
                  {calc.hasOld && (
                    <div className="bill-sline" style={{ color: 'var(--color-danger)' }}>
                      <span>(−) Old {metalType} {calc.oldMode === 'value' ? '(Direct)' : `(${calc.oldWt.toFixed(3)}g)`}</span>
                      <span>{fmt(calc.effectiveOldValue)}</span>
                    </div>
                  )}
                  <div className="bill-sline" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '4px' }}>
                    <span style={{ fontWeight: 600 }}>Subtotal</span>
                    <span style={{ fontWeight: 600 }}>{fmt(calc.subtotal)}</span>
                  </div>
                  {calc.hallmarkAmt > 0 && (
                    <div className="bill-sline">
                      <span>(+) Hallmark <span style={{ color: 'var(--text-muted)' }}>({hallmarkCount} × ₹{hallmarkValue})</span></span>
                      <span>{fmt(calc.hallmarkAmt)}</span>
                    </div>
                  )}
                  {billType === 'Invoice' && (
                    <>
                      <div className="bill-sline"><span>(+) CGST @ 1.5%</span><span>{fmt(calc.cgst)}</span></div>
                      <div className="bill-sline"><span>(+) SGST @ 1.5%</span><span>{fmt(calc.sgst)}</span></div>
                      <div className="bill-sline" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        <span>GST Base: {fmt(calc.gstBase)}</span><span></span>
                      </div>
                    </>
                  )}
                  {calc.otherChargesVal > 0 && <div className="bill-sline"><span>(+) Other Charges</span><span>{fmt(calc.otherChargesVal)}</span></div>}
                  {calc.advanceVal > 0 && <div className="bill-sline bill-sline--deduct"><span>(−) Advance</span><span>{fmt(calc.advanceVal)}</span></div>}
                  {calc.discountVal > 0 && <div className="bill-sline bill-sline--deduct"><span>(−) Discount</span><span>{fmt(calc.discountVal)}</span></div>}
                  <div className="bill-sline" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                    <span>Round Off</span>
                    <span>{calc.roundOffVal >= 0 ? '+' : ''}{calc.roundOffVal.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Final Amount */}
            <div className="bill-final-block">
              <div className="bill-final-label">{calc.transactionType === 'return' ? 'RETURN AMOUNT' : 'FINAL AMOUNT'}</div>
              <div className="bill-final-value" style={{ color: calc.transactionType === 'return' ? 'var(--color-success)' : 'var(--text-primary)' }}>
                {fmtInt(Math.abs(calc.finalAmt))}
              </div>
              <div className="bill-final-words">{calc.amountInWords}</div>
            </div>

            {/* Indicator */}
            {calc.finalAmt !== 0 && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
                {calc.transactionType === 'payable' ? (
                  <span className="bill-indicator bill-indicator--pay">
                    <i className="fa-solid fa-arrow-up"></i> Customer Pays
                  </span>
                ) : (
                  <span className="bill-indicator bill-indicator--return">
                    <i className="fa-solid fa-arrow-down"></i> Return {fmt(Math.abs(calc.finalAmt))} to Customer
                  </span>
                )}
              </div>
            )}

            {/* Payment Balance */}
            {calc.totalPaid > 0 && (
              <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
                <div className="flex justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Paid (Cash + Online)</span>
                  <span style={{ fontWeight: 600 }}>{fmtInt(calc.totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-tertiary)' }}>Balance</span>
                  <span style={{ fontWeight: 700, color: calc.balance > 0 ? 'var(--color-danger)' : 'var(--color-accent)' }}>
                    {calc.balance === 0 ? 'Settled' : fmtInt(Math.abs(calc.balance))}
                    {calc.balance > 0 ? ' Due' : calc.balance < 0 ? ' Return' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div style={{ padding: 'var(--space-3) var(--space-5) var(--space-4)', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn--ghost" onClick={handleCancel} style={{ flex: 1 }}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
            <button className="btn btn--ghost" onClick={handlePrint} style={{ flex: 1 }}>
              <i className="fa-solid fa-print"></i> Print
            </button>
            <button className="btn btn--success" onClick={handleSave} style={{ flex: 1.5 }}>
              <i className="fa-solid fa-check"></i> Save Bill
            </button>
          </div>
        </div>
      </div>
      <PrintPreviewModal isOpen={!!printData} data={printData} onClose={() => setPrintData(null)} />
      {showCustWarning && (
        <>
          <div className="overlay" style={{ zIndex: 11000 }} onClick={handleCancelWarning} />
          <div className="modal" style={{ maxWidth: 450, zIndex: 11001, padding: 'var(--space-5)' }}>
            <div className="modal__header" style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-primary)', paddingBottom: 'var(--space-3)' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--color-warning, #f59e0b)', fontSize: 24 }}></i>
              <h3 className="modal__title" style={{ margin: 0 }}>Missing Customer Details</h3>
            </div>
            <div className="modal__body" style={{ padding: 'var(--space-4) 0 var(--space-5)' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Customer Name is blank. Would you like to proceed by adding a <strong>"Walk-in"</strong> customer, or go back to enter customer details?
              </p>
            </div>
            <div className="modal__footer" style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', borderTop: 'none', paddingTop: 0 }}>
              <button className="btn btn--ghost" onClick={handleCancelWarning}>
                Go Back
              </button>
              <button className="btn btn--warning" onClick={handleProceedWalkin}>
                Proceed as Walk-in
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
