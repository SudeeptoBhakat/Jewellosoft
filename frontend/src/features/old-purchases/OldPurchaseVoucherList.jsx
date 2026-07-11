/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { extractList } from '../../lib/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTabs } from '../../contexts/TabContext';
import { fetchVouchers, deleteVoucher } from './services';
import PrintPreviewModal from '../pdfs/PrintPreviewModal';
import OldPurchaseVoucherPDF from './OldPurchaseVoucherPDF';

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadge = (status) => {
  if (status === 'adjusted_invoice') {
    return <span className="badge badge--info">Adjusted Invoice</span>;
  }
  if (status === 'adjusted_estimate') {
    return <span className="badge badge--warning">Adjusted Estimate</span>;
  }
  return <span className="badge badge--success">Not Adjusted</span>;
};

export default function OldPurchaseVoucherList() {
  const { shop } = useAuth();
  const { openTab } = useTabs();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [metalFilter, setMetalFilter] = useState('All');
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Print Preview
  const [printData, setPrintData] = useState(null);

  const loadVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (metalFilter !== 'All') params.metal_type = metalFilter.toLowerCase();
      if (search.trim()) params.search = search;

      const data = await fetchVouchers(params);
      setVouchers(data.results);
    } catch (e) {
      console.error('Failed to load vouchers:', e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, metalFilter]);

  // Initial + filter-change load (debounced for search typing)
  useEffect(() => {
    const delay = setTimeout(() => {
      loadVouchers();
    }, 400);
    return () => clearTimeout(delay);
  }, [loadVouchers]);

  // Auto-refresh when a voucher is saved from the form tab
  useEffect(() => {
    const handler = () => loadVouchers();
    window.addEventListener('jewellosoft:voucherSaved', handler);
    return () => window.removeEventListener('jewellosoft:voucherSaved', handler);
  }, [loadVouchers]);


  // Vouchers stats
  const stats = useMemo(() => {
    return {
      total: vouchers.length,
      totalAmount: vouchers.reduce((s, v) => s + parseFloat(v.amount || 0), 0),
      notAdjusted: vouchers.filter(v => v.status === 'not_adjusted').length,
      adjusted: vouchers.filter(v => v.status.startsWith('adjusted')).length,
    };
  }, [vouchers]);

  const handleDelete = async (id, vNo) => {
    if (window.confirm(`Are you sure you want to delete purchase voucher ${vNo}?`)) {
      try {
        await deleteVoucher(id);
        setVouchers(prev => prev.filter(v => v.id !== id));
      } catch (err) {
        console.error('Failed to delete:', err);
        alert('Failed to delete voucher.');
      }
    }
  };

  const handlePrint = (voucher) => {
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
      customer: {
        name: voucher.customer_detail?.name || 'Walk-in Customer',
        phone: voucher.customer_detail?.phone || '',
        address: voucher.customer_detail?.address || '',
      },
      voucher,
    };
    setPrintData(docData);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__top">
          <h1 className="page-header__title">Purchase Vouchers</h1>
          <div className="page-header__actions">
            <button className="btn btn--primary" onClick={() => openTab('/old-purchases', 'New Voucher')}>
              <i className="fa-solid fa-plus"></i> New Voucher
            </button>
          </div>
        </div>
        <p className="page-header__subtitle">Manage old metal purchase receipts from customers.</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Vouchers', value: stats.total, icon: 'fa-file-invoice', color: 'primary' },
          { label: 'Total Value', value: fmt(stats.totalAmount), icon: 'fa-indian-rupee-sign', color: 'success' },
          { label: 'Not Adjusted', value: stats.notAdjusted, icon: 'fa-clock', color: 'success' },
          { label: 'Adjusted', value: stats.adjusted, icon: 'fa-check', color: 'info' },
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

      {/* Filters */}
      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              className="form-input"
              type="text"
              placeholder="Search by voucher #, customer name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="not_adjusted">Not Adjusted</option>
              <option value="adjusted_invoice">Adjusted Invoice</option>
              <option value="adjusted_estimate">Adjusted Estimate</option>
            </select>
          </div>
          <div>
            <select className="form-input form-select" value={metalFilter} onChange={e => setMetalFilter(e.target.value)}>
              <option value="All">All Metals</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {loading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i> Loading Vouchers...
          </div>
        ) : vouchers.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
            No vouchers found.
          </div>
        ) : (
          <table className="data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Voucher #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Metal Type</th>
                <th>Purity</th>
                <th>Net Weight</th>
                <th>Rate / 10g</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.voucher_no}</td>
                  <td>{v.date}</td>
                  <td>{v.customer_detail?.name || 'Walk-in'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{v.metal_type}</td>
                  <td>{v.purity || '—'}</td>
                  <td>{Number(v.net_weight || 0).toFixed(3)}g</td>
                  <td>{fmt(v.rate_per_10gm)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{fmt(v.amount)}</td>
                  <td>{statusBadge(v.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn--ghost btn--sm btn--icon" onClick={() => openTab(`/old-purchases?id=${v.id}`, `Edit Voucher ${v.voucher_no || 'TBD'}`)} title="Edit">
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button className="btn btn--ghost btn--sm btn--icon" onClick={() => handlePrint(v)} title="Print">
                        <i className="fa-solid fa-print"></i>
                      </button>
                      <button className="btn btn--ghost btn--sm btn--icon btn--danger" onClick={() => handleDelete(v.id, v.voucher_no)} title="Delete">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
