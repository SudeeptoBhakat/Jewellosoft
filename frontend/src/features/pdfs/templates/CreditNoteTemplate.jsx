/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import React from "react";
import "../../../assets/styles/pdf.css";
import FallbackWatermarkSVG from "../../../assets/media/svg.svg";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CreditNoteTemplate({ data }) {
    if (!data) return null;

    const {
        shop = {},
        customer = {},
        creditNote = {},
    } = data;

    const shopName = shop.name || "My Jewellery Shop";
    const shopAddress = shop.address || "";
    const shopPhone = shop.phone || "";
    const shopEmail = shop.email || "";
    const shopGST = shop.gst_number || "";
    const shopPAN = shop.pan_number || "";

    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;

    // Details parts
    const detailParts = [];
    if (shopAddress) detailParts.push(shopAddress);
    const contactParts = [];
    if (shopPhone) contactParts.push(`Phone: ${shopPhone}`);
    if (shopEmail) contactParts.push(`Email: ${shopEmail}`);
    const idParts = [];
    if (shopGST) idParts.push(`GSTIN: ${shopGST}`);
    if (shopPAN) idParts.push(`PAN: ${shopPAN}`);

    const issueDate = creditNote.created_at 
        ? new Date(creditNote.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        
    const issueTime = creditNote.created_at 
        ? new Date(creditNote.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
        <div className={`pdf-print-wrapper theme-gold`}>
            {/* Watermark */}
            <img
                src={watermarkSrc}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div className="pdf-content-layer">
                {/* Header */}
                <div className="pdf-header" style={{ borderBottom: '2px solid var(--color-primary, #d97706)' }}>
                    <div className="pdf-header-left">
                        <h1 className="pdf-shop-name">{shopName}</h1>
                        {(detailParts.length > 0 || contactParts.length > 0 || idParts.length > 0) && (
                            <div className="pdf-shop-details">
                                {detailParts.length > 0 && <>{detailParts.join(', ')}<br /></>}
                                {contactParts.length > 0 && <>{contactParts.join(' | ')}<br /></>}
                                {idParts.length > 0 && <>{idParts.join(' | ')}</>}
                            </div>
                        )}
                    </div>
                    <div className="pdf-header-right">
                        <h2 className="pdf-document-title" style={{ color: 'var(--color-primary, #d97706)' }}>CREDIT NOTE</h2>
                        <div className="pdf-meta-box">
                            <div><strong>No:</strong> {creditNote.credit_note_no}</div>
                            <div><strong>Date:</strong> {issueDate}</div>
                            <div><strong>Time:</strong> {issueTime}</div>
                        </div>
                    </div>
                </div>

                {/* Customer Details & Credit Info */}
                <div className="pdf-info-row" style={{ marginBottom: 30 }}>
                    <div className="pdf-customer-box">
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Issued To</h4>
                        <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: '4px 0' }}>{customer.name || "Walk-in Customer"}</p>
                        {customer.phone && <span style={{ display: 'block', fontSize: '0.9rem' }}>Phone: {customer.phone}</span>}
                        {customer.address && <span style={{ display: 'block', fontSize: '0.9rem', marginTop: 2 }}>{customer.address}</span>}
                    </div>

                    <div className="pdf-rate-box" style={{ minWidth: 240 }}>
                        <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>Credit Summary</h4>
                        <div className="pdf-rate-item">
                            <span>Status:</span>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{creditNote.status?.replace('_', ' ')}</span>
                        </div>
                        {creditNote.source_invoice_no && (
                            <div className="pdf-rate-item">
                                <span>Source Invoice:</span>
                                <span style={{ fontFamily: 'monospace' }}>{creditNote.source_invoice_no}</span>
                            </div>
                        )}
                        <div className="pdf-rate-item">
                            <span>Valid Until:</span>
                            <span>{creditNote.expires_at ? new Date(creditNote.expires_at).toLocaleDateString('en-IN') : 'No Expiry'}</span>
                        </div>
                    </div>
                </div>

                {/* Details Table */}
                <table className="pdf-table" style={{ marginBottom: 30 }}>
                    <thead>
                        <tr>
                            <th style={{ width: '60%' }}>Reason / Description</th>
                            <th className="txt-right" style={{ width: '40%' }}>Total Credit Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ padding: '20px 15px', fontSize: '1.05rem', fontWeight: 500 }}>
                                {creditNote.reason}
                                {creditNote.notes && (
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 8, fontStyle: 'italic' }}>
                                        Notes: {creditNote.notes}
                                    </div>
                                )}
                            </td>
                            <td className="txt-right" style={{ padding: '20px 15px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary, #d97706)' }}>
                                {fmt(creditNote.credit_amount)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Usage History (if partially or fully used) */}
                {creditNote.usages && creditNote.usages.length > 0 && (
                    <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: 10, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
                            Credit Consumption History
                        </h3>
                        <table className="pdf-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Applied To</th>
                                    <th>Description</th>
                                    <th className="txt-right">Amount Consumed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {creditNote.usages.map((u, i) => (
                                    <tr key={i}>
                                        <td>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{u.invoice_no || u.estimate_no}</td>
                                        <td>{u.note || '—'}</td>
                                        <td className="txt-right" style={{ fontWeight: 700 }}>{fmt(u.amount_used)}</td>
                                    </tr>
                                ))}
                                <tr className="pdf-table-total-row">
                                    <td colSpan={3} className="txt-right" style={{ fontWeight: 700 }}>TOTAL CREDIT USED</td>
                                    <td className="txt-right" style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(creditNote.used_amount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Final Balance Box */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
                    <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '15px 25px', minWidth: 260 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#78350f', marginBottom: 6 }}>
                            <span>Total Credit Value:</span>
                            <span style={{ fontWeight: 600 }}>{fmt(creditNote.credit_amount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#78350f', marginBottom: 8, borderBottom: '1px dashed #f59e0b', paddingBottom: 6 }}>
                            <span>Consumed Credit:</span>
                            <span style={{ fontWeight: 600 }}>{fmt(creditNote.used_amount)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, color: '#78350f' }}>
                            <span>Remaining Balance:</span>
                            <span>{fmt(creditNote.remaining_amount)}</span>
                        </div>
                    </div>
                </div>

                {/* Signatures */}
                <div className="pdf-footer" style={{ marginTop: 'auto', paddingTop: 60 }}>
                    <div style={{ paddingLeft: '20px' }}>
                        <div className="pdf-signature">Customer Signature</div>
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7, alignSelf: 'flex-end', paddingBottom: 10 }}>
                        Offline store credit issued by {shopName}. Valid as per terms.
                    </div>
                    <div style={{ paddingRight: '20px' }}>
                        <div className="pdf-signature">Authorized Signature</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
