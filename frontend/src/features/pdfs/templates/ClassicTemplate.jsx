/**
 * ─── Classic Invoice Template ───────────────────────────────────
 * The original JewelloSoft signature design.
 *
 * Features:
 *   • Gold/Silver themed gradients on table headers & totals
 *   • Decorative borders with theme-colored accents
 *   • Custom SVG or uploaded watermark behind content
 *   • All shop details rendered dynamically from data.shop
 *   • Smart conditional rendering: columns & rows only show with valid data
 *   • hideMetalValue / hideMaking flags to suppress columns in PDF
 *
 * Data Contract:
 *   data.shop     — { name, address, phone, email, gst_number, pan_number, watermark_logo_url }
 *   data.docType  — "TAX INVOICE" | "ESTIMATE" | "ORDER RECEIPT"
 *   data.theme    — "gold" | "silver" (metal-based color scheme)
 *   data.customer — { name, phone, address }
 *   data.meta     — { number, date }
 *   data.rates    — { rate10gm, makingPerGm, priority }
 *   data.items    — [{ name, huid, weight, metalValue, making, total }]
 *   data.oldMetal — { weight, value, mode } | null
 *   data.totals   — { subtotal, cgst, sgst, otherCharges, hallmark, advance, discount, roundOff, finalAmount, amountInWords }
 *   data.payment  — { amounts: [{ mode, amount }] }
 *   data.hideMetalValue — boolean (suppress metal value column)
 *   data.hideMaking     — boolean (suppress making charge column)
 * ────────────────────────────────────────────────────────────────
 */

import React from "react";
import "../../../assets/styles/pdf.css";
import FallbackWatermarkSVG from "../../../assets/media/svg.svg";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Returns true only if value is a real, non-zero number */
const has = (v) => Number(v) !== 0 && Number.isFinite(Number(v));

export default function ClassicTemplate({ data }) {
    if (!data) return null;

    const {
        docType = "TAX INVOICE",
        theme = "gold",
        shop = {},
        customer = {},
        meta = {},
        rates = {},
        items = [],
        oldMetal = null,
        totals = {},
        payment = null,
        hideMetalValue = false,
        hideMaking = false,
    } = data;

    // ── Shop details with fallbacks ──
    const shopName = shop.name || "My Jewellery Shop";
    const shopAddress = shop.address || "";
    const shopPhone = shop.phone || "";
    const shopEmail = shop.email || "";
    const shopGST = shop.gst_number || "";
    const shopPAN = shop.pan_number || "";

    // ── Watermark: prefer uploaded logo, fallback to built-in SVG ──
    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;

    // ── Derive which item columns have data (respecting hide flags) ──
    const hasHuid     = items.some((i) => i.huid && i.huid.trim() && i.huid !== "—");
    const hasMetalVal = !hideMetalValue && items.some((i) => has(i.metalValue));
    const hasMaking   = !hideMaking && items.some((i) => has(i.making));

    // ── Only compute totals if corresponding columns exist ──
    const totalWeight     = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
    const totalMaking     = hasMaking   ? items.reduce((sum, item) => sum + (Number(item.making) || 0), 0) : 0;
    const totalMetalValue = hasMetalVal ? items.reduce((sum, item) => sum + (Number(item.metalValue) || 0), 0) : 0;

    const isInvoice = docType.includes("INVOICE");

    // ── Determine column count for colspan calculations ──
    const dataColCount = 2 + (hasHuid ? 1 : 0) + 1 + (hasMetalVal ? 1 : 0) + (hasMaking ? 1 : 0) + 1;

    // ── Build shop detail lines ──
    const detailParts = [];
    if (shopAddress) detailParts.push(shopAddress);
    const contactParts = [];
    if (shopPhone) contactParts.push(`Phone: ${shopPhone}`);
    if (shopEmail) contactParts.push(`Email: ${shopEmail}`);
    const idParts = [];
    if (shopGST) idParts.push(`GSTIN: ${shopGST}`);
    if (shopPAN) idParts.push(`PAN: ${shopPAN}`);

    // ── Old metal display ──
    const hasOldMetal = oldMetal && (has(oldMetal.value) || has(oldMetal.weight));
    const oldMetalLabel = hasOldMetal
        ? (oldMetal.mode === "value"
            ? "Old Metal (Direct Entry)"
            : `Old Metal (${Number(oldMetal.weight || 0).toFixed(3)}g)`)
        : "";

    return (
        <div className={`pdf-print-wrapper theme-${theme.toLowerCase()}`}>

            {/* Watermark */}
            <img
                src={watermarkSrc}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div className="pdf-content-layer">

                {/* Header */}
                <div className="pdf-header">
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
                        <h2 className="pdf-document-title">{docType}</h2>
                        <div className="pdf-meta-box">
                            {meta.number && <div><strong>No:</strong> {meta.number}</div>}
                            {meta.date && <div><strong>Date:</strong> {meta.date}</div>}
                        </div>
                    </div>
                </div>

                {/* Info Row: Customer & Rates */}
                <div className="pdf-info-row">
                    <div className="pdf-customer-box">
                        <h4>Billed To</h4>
                        <p>{customer.name || "Walk-in Customer"}</p>
                        {customer.phone && <span>{customer.phone}</span>}
                        {customer.address && <span>{customer.address}</span>}
                    </div>

                    <div className="pdf-rate-box">
                        <div className="pdf-rate-item">
                            <span>Metal:</span>
                            <span>{theme.toUpperCase()}</span>
                        </div>
                        {has(rates.rate10gm) && (
                            <>
                                <div className="pdf-rate-item">
                                    <span>Rate / 1g:</span>
                                    <span>{fmt(rates.rate10gm / 10)}</span>
                                </div>
                                <div className="pdf-rate-item">
                                    <span>Rate / 10g:</span>
                                    <span>{fmt(rates.rate10gm)}</span>
                                </div>
                            </>
                        )}
                        {has(rates.makingPerGm) && (
                            <div className="pdf-rate-item">
                                <span>Making / 1g:</span>
                                <span>{fmt(rates.makingPerGm)}</span>
                            </div>
                        )}
                        {rates.priority && (
                            <div className="pdf-rate-item">
                                <span>Priority:</span>
                                <span>{rates.priority}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Items Table — columns only render if items have data & not hidden */}
                <table className="pdf-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            {hasHuid && <th>HUID</th>}
                            <th className="txt-right">Weight (g)</th>
                            {hasMetalVal && <th className="txt-right">Metal Value</th>}
                            {hasMaking && <th className="txt-right">Making</th>}
                            <th className="txt-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr><td colSpan={dataColCount} className="txt-center">No items</td></tr>
                        ) : (
                            items.map((item, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>{item.name}</td>
                                    {hasHuid && <td>{item.huid || "—"}</td>}
                                    <td className="txt-right">{Number(item.weight || 0).toFixed(3)}</td>
                                    {hasMetalVal && <td className="txt-right">{fmt(item.metalValue)}</td>}
                                    {hasMaking && <td className="txt-right">{fmt(item.making)}</td>}
                                    <td className="txt-right">{fmt(item.total)}</td>
                                </tr>
                            ))
                        )}
                        {/* Totals footer row — only show columns that exist */}
                        {items.length > 0 && (
                            <tr className="pdf-table-total-row">
                                <td colSpan={1 + 1 + (hasHuid ? 1 : 0)} className="txt-right">TOTAL ITEMS</td>
                                <td className="txt-right">{totalWeight.toFixed(3)}g</td>
                                {hasMetalVal && <td className="txt-right">{fmt(totalMetalValue)}</td>}
                                {hasMaking && <td className="txt-right">{fmt(totalMaking)}</td>}
                                <td className="txt-right">{fmt(totalMetalValue + totalMaking)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Old Settlement Box — conditional on actual data */}
                {hasOldMetal && (
                    <div className="pdf-settlement-box">
                        <div className="pdf-settlement-title">Old Metal Exchange Details</div>
                        {has(oldMetal.weight) && oldMetal.mode !== "value" && (
                            <div className="pdf-s-row">
                                <span>Old Metal Weight Exchanged</span>
                                <span>{Number(oldMetal.weight).toFixed(3)} g</span>
                            </div>
                        )}
                        <div className="pdf-s-row negative">
                            <span>Net Value of Old Metal (−)</span>
                            <span>{fmt(oldMetal.value)}</span>
                        </div>
                    </div>
                )}

                {/* Bottom Summary Grid */}
                <div className="pdf-summary-grid">

                    {/* Left: Amount in Words + Payment */}
                    <div className="pdf-sg-left">
                        {totals.amountInWords && totals.amountInWords.trim() && (
                            <div className="pdf-amount-words">
                                Amount in Words: {totals.amountInWords}
                            </div>
                        )}
                        {payment?.amounts?.filter(p => has(p.amount)).length > 0 && (
                            <div className="pdf-payment-info">
                                <strong>Payment Received:</strong><br />
                                {payment.amounts.filter(p => has(p.amount)).map(p => (
                                    <span key={p.mode} style={{ marginRight: 15 }}>
                                        {p.mode.toUpperCase()}: {fmt(p.amount)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Calculations — only rows with valid data */}
                    <div className="pdf-sg-right">
                        <table className="pdf-summary-table">
                            <tbody>
                                {has(totals.subtotal) && (
                                    <tr>
                                        <td>Subtotal (Metal + Making)</td>
                                        <td>{fmt(totals.subtotal)}</td>
                                    </tr>
                                )}
                                {has(totals.otherCharges) && (
                                    <tr>
                                        <td>Other Charges (+)</td>
                                        <td>{fmt(totals.otherCharges)}</td>
                                    </tr>
                                )}
                                {has(totals.hallmark) && (
                                    <tr>
                                        <td>Hallmark Charges (+)</td>
                                        <td>{fmt(totals.hallmark)}</td>
                                    </tr>
                                )}
                                {has(totals.cgst) && (
                                    <tr>
                                        <td>CGST (1.5%) (+)</td>
                                        <td>{fmt(totals.cgst)}</td>
                                    </tr>
                                )}
                                {has(totals.sgst) && (
                                    <tr>
                                        <td>SGST (1.5%) (+)</td>
                                        <td>{fmt(totals.sgst)}</td>
                                    </tr>
                                )}
                                {hasOldMetal && (
                                    <tr>
                                        <td>{oldMetalLabel} (−)</td>
                                        <td style={{ color: '#e53935' }}>{fmt(oldMetal.value)}</td>
                                    </tr>
                                )}
                                {has(totals.advance) && (
                                    <tr>
                                        <td>Advance Deducted (−)</td>
                                        <td style={{ color: '#e53935' }}>{fmt(totals.advance)}</td>
                                    </tr>
                                )}
                                {has(totals.discount) && (
                                    <tr>
                                        <td>Discount (−)</td>
                                        <td style={{ color: '#e53935' }}>{fmt(totals.discount)}</td>
                                    </tr>
                                )}
                                {has(totals.roundOff) && (
                                    <tr>
                                        <td>Round Off</td>
                                        <td>{Number(totals.roundOff).toFixed(2)}</td>
                                    </tr>
                                )}
                                <tr className="pdf-grand-total">
                                    <td>FINAL AMOUNT</td>
                                    <td>{fmt(totals.finalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Signatures */}
                <div className="pdf-footer">
                    <div style={{ paddingLeft: '20px' }}>
                        <div className="pdf-signature">Customer Signature</div>
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: '2em', opacity: 0.8 }}>
                        THANK YOU | VISIT AGAIN
                    </div>
                    <div style={{ paddingRight: '20px' }}>
                        <div className="pdf-signature">For {shopName}</div>
                    </div>
                </div>

            </div>
        </div>
    );
}
