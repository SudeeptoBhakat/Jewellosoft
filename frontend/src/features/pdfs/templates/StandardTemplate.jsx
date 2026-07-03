import React from "react";
import "../../../assets/styles/pdf-standard.css";
import FallbackWatermarkSVG from "../../../assets/media/svg.svg";

const fmt = (n) =>
    `₹ ${Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

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
        advanceHistory = [],
        theme = "gold",
        hideMetalValue = false,
        hideMaking = false,
        hideCustomerDetails = false,
        designNotes = '',
        designImages = [],
        returnBreakdown = null,
        isCancelled = false,
        paymentStatus = null,
    } = data;

    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;

    const hasHuid = items.some((i) => i.huid && i.huid.trim() && i.huid !== "—");
    const hasMetalVal = !hideMetalValue && items.some((i) => has(i.metalValue));
    const hasMaking = !hideMaking && items.some((i) => has(i.making));
    // console.log(hasMaking);
    const isInvoice = docType.includes("INVOICE");

    const ratePerGm = has(rates.rate10gm) ? Number(rates.rate10gm) / 10 : 0;
    const rateLabel = theme?.toLowerCase() === "silver" ? "SILVER" : "GOLD";

    const transactionType = totals.transactionType || 'payable';
    const isReturn = transactionType === 'return';
    const finalLabel = isReturn ? 'RETURN TO CUSTOMER' : 'CUSTOMER PAYABLE';
    const isOrderReceipt = docType === 'ORDER RECEIPT';

    const hasOldMetal = oldMetal && (has(oldMetal.value) || has(oldMetal.weight));
    // console.log(oldMetal.weight);

    const displayItems = [...items];
    while (displayItems.length < 5) {
        displayItems.push({ _isEmpty: true });
    }

    return (
        <div className="pdf-root">

            <img
                src={watermarkSrc}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => (e.target.style.display = "none")}
            />

            {/* CANCELLED overlay */}
            {isCancelled && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%) rotate(-35deg)',
                    fontSize: '72px', fontWeight: 900,
                    color: 'rgba(220,38,38,0.14)',
                    letterSpacing: '0.1em', whiteSpace: 'nowrap',
                    pointerEvents: 'none', zIndex: 10, userSelect: 'none',
                }}>CANCELLED</div>
            )}

            <div className="pdf-container">

                <div className="pdf-header">
                    <div className="pdf-top-strip-right"></div>
                    <div className="pdf-top-strip-left"></div>

                    <div className="pdf-title">
                        {isOrderReceipt ? 'ORDER RECEIPT' : docType.includes("INVOICE") ? "INVOICE" : "ESTIMATE"}
                    </div>

                    <div className="pdf-shop-name">
                        {(shop.name || "JEWELLERY SHOP").toUpperCase()}
                    </div>

                    {(shop.address || shop.phone) && (
                        <div className="pdf-shop-address-row">
                            {shop.address && <span>{shop.address}</span>}
                            {shop.phone && <span>MOB: {shop.phone}</span>}
                        </div>
                    )}

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
                        {has(rates.makingRate || rates.makingPerGm) && <span>MAKING RATE: ₹ {Number(rates.makingRate || rates.makingPerGm).toLocaleString("en-IN")}</span>}
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

                            <span style={{ fontWeight: 700 }}>

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


                <div style={{ width: '100%', marginTop: '20px', fontFamily: 'Arial, sans-serif', padding: "0 25px" }}>
                    {/* Normal Summary Banner */}
                    <div
                        className="pdf-summary-head"
                        style={{
                            gridTemplateColumns: isInvoice
                                ? "repeat(8, 1fr)"
                                : "repeat(6, 1fr)"
                        }}
                    >
                        <div>GRAND TOTAL</div>
                        <div>ROUND OFF</div>
                        <div>LESS ADVANCE</div>
                        <div>HALLMARK</div>
                        <div>OTHER CHARGES</div>

                        {isInvoice && (
                            <>
                                <div>CGST</div>
                                <div>SGST</div>
                            </>
                        )}

                        <div>TOTAL</div>
                    </div>
                    <div className="pdf-summary-values"
                        style={{
                            gridTemplateColumns: isInvoice ? "repeat(8, 1fr)" : "repeat(6, 1fr)",
                            borderBottomLeftRadius: '15px',
                            borderBottomRightRadius: '15px'
                        }}
                    >
                        <div className="bold">{fmt(totals.finalAmount)}</div>

                        <div className="red">{has(totals.roundOff) ? Number(totals.roundOff).toFixed(2) : '₹ 0.00'}</div>

                        <div>{has(totals.advance) ? fmt(totals.advance) : '₹ 0.00'}</div>

                        <div>{has(totals.hallmark) ? fmt(totals.hallmark) : '₹ 0.00'}</div>

                        <div>{has(totals.otherCharges) ? fmt(totals.otherCharges) : '₹ 0.00'}</div>

                        {isInvoice && (
                            <>
                                <div>{fmt(totals.cgst)}</div>
                                <div>{fmt(totals.sgst)}</div>
                            </>
                        )}

                        <div className="bold"> {fmt(totals.subtotal)}</div>
                    </div>
                </div>

                {/* AMOUNT IN WORDS */}
                <div className="pdf-amount-strip">
                    {totals.amountInWords && totals.amountInWords.trim()
                        ? totals.amountInWords.toUpperCase()
                        : "—"}
                </div>

                {/* PAYMENT — only if amounts exist */}
                {totals?.transactionType === "payable" ? (
                    payment?.amounts?.filter(p => has(p.amount)).length > 0 && (
                        <div className="pdf-payment">
                            <div className="label">PAYMENT METHOD</div>

                            {payment.amounts
                                .filter(p => has(p.amount))
                                .map((p, i) => (
                                    <div key={i}>
                                        {p.mode.toUpperCase()} : {fmt(p.amount)}
                                    </div>
                                ))}
                        </div>
                    )
                ) : (
                    <div className="pdf-payment">
                        <div className="label">TRANSACTION TYPE</div>
                        <div style={{ color: '#dc2626', fontWeight: 700 }}>
                            RETURN AMOUNT TO CUSTOMER : {fmt(totals?.finalAmount)}
                        </div>
                    </div>
                )}

                {/* Advance Payment History — shown when bill is linked to an order with advance receipts */}
                {advanceHistory && advanceHistory.length > 0 && (
                    <div style={{ margin: '6px 0', padding: '8px 14px', background: '#fff9e6', borderRadius: 6, border: '1px solid #f0d060', fontSize: '10px', lineHeight: 1.7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a5a00' }}>Advance Payment History</div>
                            {paymentStatus && (
                                <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                                    background: paymentStatus === 'paid' ? 'rgba(16,185,129,0.15)' : paymentStatus === 'partially_paid' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.12)',
                                    color: paymentStatus === 'paid' ? '#065f46' : paymentStatus === 'partially_paid' ? '#854d0e' : '#991b1b',
                                    textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {paymentStatus.replace(/_/g, ' ')}
                                </span>
                            )}
                        </div>
                        {advanceHistory.map((adv, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: idx < advanceHistory.length - 1 ? '1px dashed #e8d08a' : 'none', padding: '2px 0',
                                opacity: adv.status === 'cancelled' ? 0.5 : 1 }}>
                                <span style={{ textDecoration: adv.status === 'cancelled' ? 'line-through' : 'none' }}>
                                    {adv.receiptNo}&nbsp;({adv.date})&nbsp;
                                    <span style={{ color: '#888', textTransform: 'uppercase' }}>{adv.paymentMode}</span>
                                    {adv.status === 'cancelled' ? ' [CANCELLED]' : ''}
                                    {adv.isRefund ? ' [REFUND]' : ''}
                                </span>
                                <span style={{ fontWeight: 600, color: adv.isRefund ? '#dc2626' : 'inherit' }}>
                                    {adv.isRefund ? '−' : ''}{fmt(adv.amount)}
                                </span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e8d08a', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
                            <span>Total Advance Paid</span>
                            <span>{fmt(advanceHistory.filter(a => a.status !== 'cancelled' && !a.isRefund).reduce((s, a) => s + a.amount, 0))}</span>
                        </div>
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