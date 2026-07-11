/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { extractList } from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs } from '../../contexts/TabContext';
import { toast } from '../../utils/toast';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OldPurchaseVoucher({ tabId, isActive }) {
  const { shop } = useAuth();
  const { closeTabAndSwitch, closeTab } = useTabs();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const voucherId = searchParams.get('id');

  // Basic voucher state
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [metalType, setMetalType] = useState('gold');
  const [description, setDescription] = useState('');
  const [noOfArticles, setNoOfArticles] = useState('1');
  const [purity, setPurity] = useState('22K');
  const [grossWeight, setGrossWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [ratePer10gm, setRatePer10gm] = useState(0);
  const [customRate, setCustomRate] = useState('');
  const [amountOverride, setAmountOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('not_adjusted');
  const [allRates, setAllRates] = useState({});

  // Customer state
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const [custSuggestions, setCustSuggestions] = useState([]);
  const custWrapRef = useRef(null);

  // Auto-calculated amount
  const activeRate = useMemo(() => {
    return parseFloat(customRate) || ratePer10gm || 0;
  }, [customRate, ratePer10gm]);

  const computedAmount = useMemo(() => {
    const netWt = parseFloat(netWeight) || 0;
    return Math.round((netWt * (activeRate / 10)) * 100) / 100;
  }, [netWeight, activeRate]);

  const finalAmount = amountOverride !== '' ? parseFloat(amountOverride) || 0 : computedAmount;

  const purityRatio = useMemo(() => {
    if (purity === '22K') return 0.916;
    if (purity === '24K') return 0.999;
    if (purity === '18K') return 0.750;
    if (purity === '925') return 0.925;
    if (purity === '999') return 0.999;
    return 1.0;
  }, [purity]);

  // Auto-calculate Net Weight when Gross Weight or Purity changes
  useEffect(() => {
    const gw = parseFloat(grossWeight) || 0;
    if (gw > 0) {
      const calculatedNet = Math.round(gw * purityRatio * 1000) / 1000;
      // Only set if not already manually updated to exactly this or close
      setNetWeight(String(calculatedNet));
    } else {
      setNetWeight('');
    }
  }, [grossWeight, purityRatio]);

  // Print Preview
  const [printData, setPrintData] = useState(null);

  // Fetch latest rates once on mount
  useEffect(() => {
    api.get('/rates/latest/')
      .then(res => {
        setAllRates(res.data || {});
      })
      .catch(() => { });
  }, []);

  // Update purity options when metalType changes
  useEffect(() => {
    if (metalType === 'gold') {
      if (!['22K', '24K', '18K'].includes(purity)) {
        setPurity('22K');
      }
    } else {
      if (!['925', '999'].includes(purity)) {
        setPurity('999');
      }
    }
  }, [metalType, purity]);

  // Update ratePer10gm dynamically when metalType, purity, or allRates change
  useEffect(() => {
    if (!allRates || Object.keys(allRates).length === 0) return;
    const key = metalType + purity.toLowerCase();
    const rateObj = allRates[key];
    if (rateObj) {
      setRatePer10gm((rateObj.rate_per_gram || 0) * 10);
    } else {
      // Fallback
      if (metalType === 'gold') {
        const fallbackObj = allRates.gold22k || allRates.gold24k || {};
        setRatePer10gm((fallbackObj.rate_per_gram || 0) * 10);
      } else {
        const fallbackObj = allRates.silver999 || allRates.silver925 || {};
        setRatePer10gm((fallbackObj.rate_per_gram || 0) * 10);
      }
    }
  }, [metalType, purity, allRates]);

  // Load voucher details if in Edit Mode
  useEffect(() => {
    if (voucherId && !voucherId.startsWith('old-purchases')) {
      api.get(`/old-purchases/vouchers/${voucherId}/`)
        .then(res => {
          const v = res.data;
          setVoucherNo(v.voucher_no);
          setVoucherDate(v.date);
          setMetalType(v.metal_type);
          setPurity(v.purity);
          setGrossWeight(String(v.gross_weight || ''));
          setNetWeight(String(v.net_weight || ''));
          setRatePer10gm(parseFloat(v.rate_per_10gm || 0));
          
          const computed = Math.round(((parseFloat(v.net_weight) || 0) * (parseFloat(v.rate_per_10gm || 0) / 10)) * 100) / 100;
          if (Math.abs(parseFloat(v.amount) - computed) > 1) {
            setAmountOverride(String(v.amount || ''));
          }
          setCustomRate(String(v.rate_per_10gm || ''));
          setNotes(v.notes || '');
          setStatus(v.status);
          
          if (v.customer_detail) {
            setCustomerId(v.customer_detail.id);
            setCustName(v.customer_detail.name);
            setCustMobile(v.customer_detail.phone || '');
            setCustAddress(v.customer_detail.address || '');
          }
        })
        .catch(err => {
          console.error(err);
          toast.error('Failed to load voucher details.');
        });
    }
  }, [voucherId]);

  // Customer Autocomplete Search
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

  // Handle click outside suggestions
  useEffect(() => {
    const mouseHandler = (e) => {
      if (!isActive) return;
      if (custWrapRef.current && !custWrapRef.current.contains(e.target)) {
        setShowCustSuggestions(false);
      }
    };
    document.addEventListener('mousedown', mouseHandler);
    return () => document.removeEventListener('mousedown', mouseHandler);
  }, [isActive]);

  const selectCustomer = (c) => {
    setCustomerId(c.id);
    setCustName(c.name);
    setCustMobile(c.phone || '');
    setCustAddress(c.address || '');
    setShowCustSuggestions(false);
  };

  const handleSave = async (redirectAfter = true) => {
    try {
      let finalCustId = customerId;
      // 1. Create customer if new
      if (custName.trim() && !finalCustId) {
        try {
          const custRes = await api.post('/customers/', {
            shop: shop?.id || 1,
            name: custName.trim(),
            phone: custMobile || `NA-${Date.now().toString().slice(-8)}`,
            address: custAddress,
          });
          finalCustId = custRes.data.id;
          setCustomerId(finalCustId);
        } catch (custErr) {
          console.error('Failed to create customer:', custErr);
        }
      }

      const payload = {
        customer: finalCustId,
        date: voucherDate,
        metal_type: metalType,
        description,
        no_of_articles: parseInt(noOfArticles) || 1,
        purity,
        gross_weight: parseFloat(grossWeight) || 0,
        net_weight: parseFloat(netWeight) || 0,
        rate_per_10gm: activeRate,
        amount: finalAmount,
        notes,
      };

      let savedVoucher;
      const isEdit = voucherId && !voucherId.startsWith('old-purchases');
      if (isEdit) {
        const res = await api.patch(`/old-purchases/vouchers/${voucherId}/`, payload);
        savedVoucher = res.data;
        toast.success(`Purchase Voucher ${savedVoucher.voucher_no} updated successfully!`);
      } else {
        const res = await api.post('/old-purchases/vouchers/', payload);
        savedVoucher = res.data;
        // Immediately update voucher number in form state so Save & Print shows it
        if (savedVoucher.voucher_no) {
          setVoucherNo(savedVoucher.voucher_no);
        }
        toast.success(`Purchase Voucher ${savedVoucher.voucher_no} created successfully!`);
      }

      // Notify any mounted list tabs to refresh immediately
      window.dispatchEvent(new CustomEvent('jewellosoft:voucherSaved', { detail: savedVoucher }));

      if (redirectAfter) {
        closeTabAndSwitch(tabId, '/old-purchases/list', 'Vouchers List');
      }
      return savedVoucher;
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save Purchase Voucher.');
      return null;
    }
  };

  const handleSaveAndPrint = async () => {
    const savedVoucher = await handleSave(false);
    if (savedVoucher) {
      const finalCustName = custName.trim() || 'Walk-in';
      const docData = {
        isVoucher: true,
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
        customer: { name: finalCustName, phone: custMobile, address: custAddress },
        voucher: savedVoucher,
      };
      setPrintData(docData);
    }
  };

  const isEdit = voucherId && !voucherId.startsWith('old-purchases');
  const isAdjusted = status !== 'not_adjusted';

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header__top">
          <div className="flex items-center gap-3">
            <h1 className="page-header__title">{isEdit ? 'Edit Purchase Voucher' : 'New Purchase Voucher'}</h1>
            <span className="badge badge--primary" style={{ fontSize: 'var(--text-sm)', padding: '4px 12px' }}>
              {isEdit ? (voucherNo || 'PV-TBD') : `PV-${new Date().getFullYear()}-TBD`}
            </span>
          </div>
          <div className="page-header__actions">
            <button className="btn btn--ghost" onClick={() => closeTab(tabId)}>Cancel</button>
            <button className="btn btn--secondary" onClick={handleSaveAndPrint} disabled={isAdjusted}>
              <i className="fa-solid fa-print"></i> Save & Print
            </button>
            <button className="btn btn--success" onClick={() => handleSave(true)} disabled={isAdjusted}>
              <i className="fa-solid fa-check"></i> {isEdit ? 'Update Voucher' : 'Save Voucher'}
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">
          {isEdit ? 'Modify old gold/silver purchase details.' : 'Record old gold/silver purchase from customer.'}
        </p>
      </div>

      {isAdjusted && (
        <div className="alert alert--danger" style={{ 
          marginBottom: 'var(--space-4)', 
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '1.1rem' }}></i>
          <span>
            This voucher has been adjusted against a bill/estimate. Editing is disabled to maintain financial integrity.
          </span>
        </div>
      )}

      {/* Customer Information */}
      <div className="billing-form animate-fade-in-up" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="billing-form__header">
          <span className="billing-form__header-title">
            <i className="fa-solid fa-user" style={{ marginRight: 8, opacity: 0.6 }}></i>
            Customer Information
          </span>
        </div>
        <div className="billing-form__body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <div className="form-row" style={{ gridTemplateColumns: '1.5fr 1fr 2fr' }}>
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={custWrapRef}>
              <label className="form-label">Customer Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter customer name"
                value={custName}
                onChange={e => { setCustName(e.target.value); setCustomerId(null); setShowCustSuggestions(true); }}
                disabled={isAdjusted}
              />
              {showCustSuggestions && custSuggestions.length > 0 && !isAdjusted && (
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
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mobile Number</label>
              <input className="form-input" type="tel" placeholder="Phone number" value={custMobile} onChange={e => setCustMobile(e.target.value)} disabled={isAdjusted} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Address</label>
              <input className="form-input" type="text" placeholder="Customer address" value={custAddress} onChange={e => setCustAddress(e.target.value)} disabled={isAdjusted} />
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Details */}
      <div className="billing-form animate-fade-in-up animate-delay-100" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="billing-form__header">
          <span className="billing-form__header-title">
            <i className="fa-solid fa-file-invoice" style={{ marginRight: 8, opacity: 0.6 }}></i>
            Voucher Metal Details
          </span>
        </div>
        <div className="billing-form__body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
          <div className="form-row" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Voucher Date</label>
              <input className="form-input" type="date" value={voucherDate} onChange={e => setVoucherDate(e.target.value)} disabled={isAdjusted} />
            </div>
            <div className="form-group">
              <label className="form-label">Metal Type</label>
              <select className="form-input form-select" value={metalType} onChange={e => setMetalType(e.target.value)} disabled={isAdjusted}>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Purity</label>
              {metalType === 'gold' ? (
                <select className="form-input form-select" value={purity} onChange={e => setPurity(e.target.value)} disabled={isAdjusted}>
                  <option value="22K">22K (916)</option>
                  <option value="24K">24K (999)</option>
                  <option value="18K">18K (750)</option>
                </select>
              ) : (
                <select className="form-input form-select" value={purity} onChange={e => setPurity(e.target.value)} disabled={isAdjusted}>
                  <option value="925">Silver 925</option>
                  <option value="999">Silver 999</option>
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">No. of Articles</label>
              <input className="form-input" type="number" value={noOfArticles} onChange={e => setNoOfArticles(e.target.value)} min="1" disabled={isAdjusted} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" type="text" placeholder="e.g. Ring, Chain" value={description} onChange={e => setDescription(e.target.value)} disabled={isAdjusted} />
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1.2fr 1.2fr 1.2fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Gross Weight (g)</label>
              <input className="form-input" type="number" step="0.001" placeholder="0.000" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} disabled={isAdjusted} />
            </div>
            <div className="form-group">
              <label className="form-label">Net Weight (g)</label>
              <input className="form-input" type="number" step="0.001" placeholder="0.000" value={netWeight} onChange={e => setNetWeight(e.target.value)} disabled={isAdjusted} />
            </div>
            <div className="form-group">
              <label className="form-label">Auto-fetched Rate/10g</label>
              <div className="form-input-readonly" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', height: 38, display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                {fmt(ratePer10gm)}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Rate Override / 10g</label>
              <input className="form-input" type="number" placeholder="Custom Rate" value={customRate} onChange={e => setCustomRate(e.target.value)} disabled={isAdjusted} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount Override (₹)</label>
              <input className="form-input" type="number" placeholder={fmt(computedAmount)} value={amountOverride} onChange={e => setAmountOverride(e.target.value)} style={{ fontWeight: 600, color: 'var(--color-accent)' }} disabled={isAdjusted} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary and Notes */}
      <div className="bill-bottom-grid" style={{ marginTop: 'var(--space-4)' }}>
        <div>
          <div className="billing-form animate-fade-in-up animate-delay-200" style={{ height: '100%' }}>
            <div className="billing-form__header">
              <span className="billing-form__header-title">Notes</span>
            </div>
            <div className="billing-form__body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <textarea className="form-input" placeholder="Any additional notes..." value={notes} onChange={e => setNotes(e.target.value)} style={{ minHeight: 100, resize: 'none' }} disabled={isAdjusted} />
            </div>
          </div>
        </div>

        <div>
          <div className="billing-form animate-fade-in-up animate-delay-200">
            <div className="billing-form__header">
              <span className="billing-form__header-title">Voucher Summary</span>
            </div>
            <div className="billing-form__body" style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="flex justify-between"><span>Net Weight</span><span style={{ fontWeight: 600 }}>{parseFloat(netWeight || 0).toFixed(3)}g</span></div>
                <div className="flex justify-between"><span>Rate per 10g</span><span style={{ fontWeight: 600 }}>{fmt(activeRate)}</span></div>
                <div className="flex justify-between"><span>Purity / Metal</span><span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{purity} {metalType}</span></div>
                <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 10, marginTop: 5, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
                  <span>Voucher Amount</span>
                  <span style={{ color: 'var(--color-accent)' }}>{fmt(finalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {printData && (
        <PrintPreviewModal
          isOpen={!!printData}
          data={printData}
          onClose={() => setPrintData(null)}
          isVoucher={true}
          CustomPDFTemplate={OldPurchaseVoucherPDF}
        />
      )}
    </div>
  );
}
