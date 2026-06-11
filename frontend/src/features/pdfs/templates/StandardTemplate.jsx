import React from "react";
import "../../../assets/styles/pdf-standard.css";
import FallbackWatermarkSVG from "../../../assets/media/svg.svg";

const fmt = (n) =>
    `₹ ${Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

/** Returns true only if value is a real, non-zero number */
const has = (v) => Number(v) !== 0 && Number.isFinite(Number(v));

export default function StandardTemplate({ data }) {
    if (!data) return null;
    console.log(data);

    const {
        docType = "INVOICE",
        shop = {},
        customer = {},
        meta = {},
        rates = {},
        items = [],
        oldMetal = null,
        totals = {},
        payment = null,
        theme = "gold",
        hideMetalValue = false,
        hideMaking = false,
        hideCustomerDetails = false,
        designNotes = '',
        designImages = [],
        returnBreakdown = null,
    } = data;

    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;

    // ── Derive which item columns have data (respecting hide flags) ──
    const hasHuid = items.some((i) => i.huid && i.huid.trim() && i.huid !== "—");
    const hasMetalVal = !hideMetalValue && items.some((i) => has(i.metalValue));
    const hasMaking = !hideMaking && items.some((i) => has(i.making));

    // ── Derive rate display values ──
    const ratePerGm = has(rates.rate10gm) ? Number(rates.rate10gm) / 10 : 0;
    const rateLabel = theme?.toLowerCase() === "silver" ? "SILVER" : "GOLD";

    // ── Transaction direction ──
    const transactionType = totals.transactionType || 'payable';
    const isReturn = transactionType === 'return';
    const finalLabel = isReturn ? 'RETURN TO CUSTOMER' : 'CUSTOMER PAYABLE';
    const isOrderReceipt = docType === 'ORDER RECEIPT';

    // ── Old metal ──
    const hasOldMetal = oldMetal && (has(oldMetal.value) || has(oldMetal.weight));
    // console.log(oldMetal.weight);

    // ── Pad items array to always have at least 5 rows ──
    const displayItems = [...items];
    while (displayItems.length < 5) {
        displayItems.push({ _isEmpty: true });
    }

    return (
        <div className="pdf-root">

            {/* WATERMARK */}
            <img
                src={watermarkSrc}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => (e.target.style.display = "none")}
            />

            <div className="pdf-container">

                <div className="pdf-header">
                    {/* TOP DESIGN STRIP */}
                    <div className="pdf-top-strip-right"></div>
                    <div className="pdf-top-strip-left"></div>

                    <div className="pdf-title">
                        {isOrderReceipt ? 'ORDER RECEIPT' : docType.includes("INVOICE") ? "INVOICE" : "ESTIMATE"}
                    </div>

                    <div className="pdf-shop-name">
                        {(shop.name || "JEWELLERY SHOP").toUpperCase()}
                    </div>

                    {/* Shop address & phone — only if available */}
                    {(shop.address || shop.phone) && (
                        <div className="pdf-shop-address-row">
                            {shop.address && <span>{shop.address}</span>}
                            {shop.phone && <span>MOB: {shop.phone}</span>}
                        </div>
                    )}

                    {/* GST & PAN — only if available */}
                    {(shop.gst_number || shop.pan_number) && (
                        <div className="pdf-shop-meta-row">
                            {shop.gst_number && <span><strong>GSTIN:</strong> {shop.gst_number}</span>}
                            {shop.pan_number && <span><strong>PAN:</strong> {shop.pan_number}</span>}
                        </div>
                    )}
                </div>

                {/* CUSTOMER + META */}
                <div className="pdf-top-row">
                    <div className="pdf-customer" style={hideCustomerDetails ? { visibility: 'hidden' } : {}}>
                        <div className="label">ISSUED TO:</div>
                        <div className="bold">{customer.name || "Walk-in Customer"}</div>
                        {customer.address && <div>{customer.address}</div>}
                        {customer.phone && <div>{customer.phone}</div>}
                    </div>

                    <div className="pdf-meta">
                        {meta.number && <div className="bold">#{meta.number}</div>}
                        {meta.date && <div>Date: {meta.date}</div>}
                    </div>
                </div>

                {/* RATE PILL — only if rate exists */}
                {has(rates.rate10gm) && (
                    <div className="pdf-rate-pill">
                        <span>RATE OF {rateLabel}: ₹ {ratePerGm.toLocaleString("en-IN")}/g</span>
                        <span>PER 10GM: ₹ {Number(rates.rate10gm).toLocaleString("en-IN")}</span>
                        {has(rates.makingPerGm) && <span>MC PER GM: ₹ {Number(rates.makingPerGm).toLocaleString("en-IN")}</span>}
                    </div>
                )}

                {/* ITEMS TABLE — columns are conditional */}
                <table className="pdf-table">
                    <thead>
                        <tr>
                            <th>SL NO</th>
                            <th>DESCRIPTION</th>
                            {hasHuid && <th>HUID</th>}
                            <th>WEIGHT</th>
                            {hasMetalVal && <th>{rateLabel} VALUE</th>}
                            {hasMaking && <th>MAKING</th>}
                            <th>TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayItems.length === 0 ? (
                            <tr>
                                <td colSpan={3 + (hasHuid ? 1 : 0) + (hasMetalVal ? 1 : 0) + (hasMaking ? 1 : 0)} style={{ textAlign: "center", padding: 20, color: "#999" }}>
                                    No items
                                </td>
                            </tr>
                        ) : (
                            displayItems.map((item, i) => (
                                <tr key={i}>
                                    {item._isEmpty ? (
                                        <>
                                            <td>&nbsp;</td>
                                            <td></td>
                                            {hasHuid && <td></td>}
                                            <td></td>
                                            {hasMetalVal && <td></td>}
                                            {hasMaking && <td></td>}
                                            <td></td>
                                        </>
                                    ) : (
                                        <>
                                            <td>{i + 1}</td>
                                            <td style={{ textAlign: "left" }}>{item.name}</td>
                                            {hasHuid && <td>{item.huid || "-"}</td>}
                                            <td>{Number(item.weight || 0).toFixed(3)} g</td>
                                            {hasMetalVal && <td>{fmt(item.metalValue)}</td>}
                                            {hasMaking && <td>{fmt(item.making)}</td>}
                                            <td>{fmt(item.total)}</td>
                                        </>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* ── OLD GOLD CALCULATION BREAKDOWN ROW ── */}

                {hasOldMetal && Number(oldMetal.weight || 0) > 0 && (() => {
                    const oldW = Number(oldMetal.weight || 0);
                    const newW = Number(totals.weightTotal || 0);
                    const ratePerGram = Number(rates.rate10gm || 0) / 10;
                    const isOldHeavier = oldW > newW;
                    const diffWeight = Math.abs(oldW - newW);
                    const diffMetalValue = isOldHeavier
                        ? Number(oldMetal.value) 
                        : diffWeight * ratePerGram;

                    return (
                        <div className="old-calc-breakdown-row">
                            {/* <span>Old Gold: {oldW.toFixed(2)}g</span>
                            <span style={{ color: '#64748b', margin: '0 4px' }}>|</span>

                            <span>New Gold: {newW.toFixed(2)}g</span> */}

                            <span style={{ color: isOldHeavier ? '#dc2626' : '#16a34a', fontWeight: 700 }}>

                                {isOldHeavier
                                    ? `Old Metal: ${oldW.toFixed(3)} - New Metal: ${newW.toFixed(3)} `
                                    : `New Metal: ${newW.toFixed(3)} - Old Metal: ${oldW.toFixed(3)} `
                                }
                                = {diffWeight.toFixed(2)}g
                            </span>

                            <span style={{ color: '#64748b', margin: '0 8px' }}>|</span>

                            <span>
                                {fmt(diffMetalValue)}
                            </span>
                            <span style={{ color: '#64748b', margin: '0 4px' }}>
                                {isOldHeavier ? '−' : '+'}
                            </span>
                            <span>
                                Making: {fmt(totals.makingTotal)}
                            </span>

                            <span style={{ fontWeight: 700 }}>
                                = {fmt(totals.subtotal)}
                            </span>

                        </div>
                    );
                })()}

                {/* Old Breakdown End */}

                {/* ── CALCULATION BREAKDOWN ── */}
                {returnBreakdown ? (
                    <div style={{ width: '100%', marginTop: '20px', fontFamily: 'Arial, sans-serif', padding: '0 25px' }}>
                        {/* Return Waterfall */}
                        <div className="pdf-summary-head" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px' }}>
                            <span>OLD METAL RETURN BREAKDOWN</span>
                            <span>Old: {Number(oldMetal?.weight || 0).toFixed(3)}g → New: {items.reduce((s, it) => s + Number(it.weight || 0), 0).toFixed(3)}g | Extra: {returnBreakdown.excessWeight.toFixed(3)}g</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #ddd' }}>
                            <tbody>
                                <tr style={{ background: '#f9f9f9' }}>
                                    <td style={{ padding: '4px 10px' }}>Excess Value ({returnBreakdown.excessWeight.toFixed(3)}g)</td>
                                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{fmt(returnBreakdown.excessMetalValue)}</td>
                                </tr>
                                {returnBreakdown.deductionAmt > 0 && (
                                    <tr><td style={{ padding: '4px 10px', color: '#e53935' }}>Less Deduction ({returnBreakdown.deductionPct}%)</td><td style={{ padding: '4px 10px', textAlign: 'right', color: '#e53935' }}>−{fmt(returnBreakdown.deductionAmt)}</td></tr>
                                )}
                                <tr style={{ borderTop: '2px solid #333', fontWeight: 700 }}>
                                    <td style={{ padding: '5px 10px' }}>Return Base</td>
                                    <td style={{ padding: '5px 10px', textAlign: 'right', color: '#2e7d32' }}>{fmt(returnBreakdown.afterDeduction)}</td>
                                </tr>
                                {returnBreakdown.steps.map((step, i) => (
                                    <React.Fragment key={i}>
                                        {step.isFlip && (
                                            <tr><td colSpan={2} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: '#e65100', background: '#fff3e0', padding: '4px 0' }}>RETURN FULFILLED — REMAINING CHARGED TO CUSTOMER</td></tr>
                                        )}
                                        <tr style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                                            <td style={{ padding: '3px 10px' }}>{step.isSubtract ? '(−)' : '(+)'} {step.label}{step.isFlip ? ` (${fmt(step.absorbed)} absorbed)` : ''}</td>
                                            <td style={{ padding: '3px 10px', textAlign: 'right', color: step.isSubtract ? '#e53935' : '#2e7d32' }}>{step.isSubtract ? '−' : '+'}{fmt(step.amount)}</td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                                {has(totals.roundOff) && (
                                    <tr><td style={{ padding: '3px 10px', color: '#888', fontSize: '10px' }}>Round Off</td><td style={{ padding: '3px 10px', textAlign: 'right', fontSize: '10px' }}>{Number(totals.roundOff).toFixed(2)}</td></tr>
                                )}
                                <tr style={{ background: isReturn ? '#e8f5e9' : '#e3f2fd', fontWeight: 700, fontSize: '13px' }}>
                                    <td style={{ padding: '6px 10px', color: isReturn ? '#1b5e20' : '#1565c0' }}>{finalLabel}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', color: isReturn ? '#1b5e20' : '#1565c0' }}>{fmt(totals.finalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ width: '100%', marginTop: '20px', fontFamily: 'Arial, sans-serif', padding: "0 25px" }}>
                        {/* Normal Summary Banner */}
                        <div className="pdf-summary-head">
                            <div>GRAND TOTAL</div>
                            <div>ROUND OFF</div>
                            <div>LESS ADVANCE</div>
                            <div>HALLMARK CHARGES</div>
                            <div>OTHER CHARGES</div>
                            <div>TOTAL</div>
                        </div>
                        <div className="pdf-summary-values" style={{ borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px' }}>
                            <div className="bold">{fmt(totals.finalAmount)}</div>
                            <div className="red">{has(totals.roundOff) ? `${Number(totals.roundOff).toFixed(2)}` : '₹ 0.00'}</div>
                            <div>{has(totals.advance) ? `${fmt(totals.advance)}` : '₹ 0.00'}</div>
                            <div>{has(totals.hallmark) ? `${fmt(totals.hallmark)}` : '₹ 0.00'}</div>
                            <div>{has(totals.otherCharges) ? `${fmt(totals.otherCharges)}` : '₹ 0.00'}</div>
                            <div className="bold">{fmt(totals.subtotal)}</div>
                        </div>
                    </div>
                )}

                {/* AMOUNT IN WORDS */}
                <div className="pdf-amount-strip">
                    {totals.amountInWords && totals.amountInWords.trim()
                        ? totals.amountInWords.toUpperCase()
                        : "—"}
                </div>

                {/* PAYMENT — only if amounts exist */}
                {payment?.amounts?.filter(p => has(p.amount)).length > 0 && (
                    <div className="pdf-payment">
                        <div className="label">PAYMENT METHOD</div>
                        {payment.amounts.filter(p => has(p.amount)).map((p, i) => (
                            <div key={i}>
                                {p.mode.toUpperCase()} : {fmt(p.amount)}
                            </div>
                        ))}
                    </div>
                )}

                {/* DESIGN NOTES & IMAGES (Order Receipts Only) */}
                {isOrderReceipt && designNotes && designNotes.trim() && (
                    <div style={{ padding: '8px 14px', background: '#fafafa', borderRadius: 4, fontSize: '10px', lineHeight: 1.6, margin: '6px 0', border: '1px solid #eee' }}>
                        <strong style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888' }}>Design Notes:</strong><br />
                        {designNotes}
                    </div>
                )}
                {isOrderReceipt && designImages && designImages.length > 0 && (
                    <div style={{ padding: '8px 14px', margin: '4px 0' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 6 }}>Design References</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {designImages.slice(0, 4).map((src, i) => (
                                <img key={i} src={src} alt={`Design ${i + 1}`} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} onError={(e) => { e.target.style.display = 'none'; }} />
                            ))}
                        </div>
                    </div>
                )}

                {/* FOOTER */}
                <div className="pdf-footer">
                    <div className="signature">Customer Signature</div>
                    <div className="thank-text">THANK YOU | VISIT US AGAIN</div>
                    <div className="signature">Authorized Signature</div>
                </div>

            </div>
        </div>
    );
}