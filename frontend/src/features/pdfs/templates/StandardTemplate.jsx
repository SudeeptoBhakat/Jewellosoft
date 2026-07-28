import React from "react";
import "../../../assets/styles/pdf-standard.css";
import FallbackWatermarkSVG from "../../../assets/media/svg.svg";

/* ─── Helpers ─── */

/** Format a numeric value as Indian rupee string. Safe against null/undefined/NaN. */
const fmt = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "₹ 0.00";
    return `₹ ${num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/** True when the value is a non-zero, finite number. */
const has = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0;
};

/** Safe parseFloat — returns 0 for anything falsy or NaN. */
const safe = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** Format a date string or ISO string to a compact Indian locale string. */
const fmtDate = (d) => {
    if (!d) return "";
    try {
        return new Date(d).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return String(d);
    }
};


export default function StandardTemplate({ data }) {
    if (!data) return null;

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
        designNotes = "",
        designImages = [],
        returnBreakdown = null,
        isCancelled = false,
        paymentStatus = null,
    } = data;

    /* ── Derived flags ── */
    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;
    const hasHuid = Array.isArray(items) && items.some((i) => i && i.huid && String(i.huid).trim() && i.huid !== "—");
    const hasMetalVal = !hideMetalValue && Array.isArray(items) && items.some((i) => i && has(i.metalValue));
    const hasMaking = !hideMaking && Array.isArray(items) && items.some((i) => i && has(i.making));
    const isInvoice = docType.includes("INVOICE") || data.orderType?.toLowerCase() === "invoice";
    const isOrderReceipt = docType === "ORDER RECEIPT";
    const ratePerGm = has(rates?.rate10gm) ? safe(rates.rate10gm) / 10 : 0;
    const rateLabel = theme?.toLowerCase() === "silver" ? "SILVER" : "GOLD";
    const transactionType = totals?.transactionType || "payable";
    const isReturn = transactionType === "return";
    const hasOldMetal = oldMetal && (has(oldMetal.value) || has(oldMetal.weight));

    /* ── Applied credit notes — support both creation-flow and list-view shapes ── */
    // Creation flow: totals.appliedCreditNotes = [{ credit_note_no, amount, reason, ... }]
    // List/view flow: passed as creditNoteUsages = [{ credit_note_no, amount_used, reason, created_at }]
    const appliedCreditNotes = (() => {
        const fromTotals = Array.isArray(totals?.appliedCreditNotes) ? totals.appliedCreditNotes : [];
        const fromUsages = Array.isArray(data?.creditNoteUsages) ? data.creditNoteUsages : [];

        // Merge: prefer fromTotals (creation flow), fall back to fromUsages (list reprint)
        if (fromTotals.length > 0) {
            return fromTotals.map((n) => ({
                creditNoteNo: n.credit_note_no || n.creditNoteNo || "",
                amount: safe(n.amount),
                reason: n.reason || "",
                date: n.date || n.created_at || "",
            }));
        }
        return fromUsages.map((u) => ({
            creditNoteNo: u.credit_note_no || u.creditNoteNo || "",
            amount: safe(u.amount_used || u.amount),
            reason: u.reason || "",
            date: u.created_at || u.date || "",
        }));
    })();

    const totalCreditApplied = appliedCreditNotes.reduce((s, n) => s + n.amount, 0);
    const hasCreditNotes = appliedCreditNotes.length > 0 && totalCreditApplied > 0;

    /* ── Old purchase voucher ── */
    const hasVoucher =
        hasOldMetal &&
        oldMetal.mode === "voucher" &&
        oldMetal.voucherNo &&
        String(oldMetal.voucherNo).trim();

    /* ── Discount ── */
    const discountAmt = safe(totals?.discount);
    const hasDiscount = discountAmt > 0;

    /* ── Advance history ── */
    const activeAdvances = Array.isArray(advanceHistory)
        ? advanceHistory.filter((a) => a && a.status !== "cancelled")
        : [];
    const hasAdvances = activeAdvances.length > 0;

    /* ── Summary grid column count (dynamic based on visible columns) ── */
    const summaryColCount = (() => {
        // Base cols: GRAND TOTAL | ROUND OFF | HALLMARK | OTHER CHARGES | TOTAL
        let cols = 5;
        if (hasVoucher) cols++;
        if (hasDiscount) cols++;
        if (isInvoice) {
            cols += totals?.isIgst ? 1 : 2; // IGST or CGST+SGST
        }
        return cols;
    })();

    /* ── Pad items table to minimum 5 visible rows ── */
    const displayItems = [...(Array.isArray(items) ? items : [])];
    while (displayItems.length < 5) displayItems.push({ _isEmpty: true });

    /* ─────────────────────────────────────────────────────── */

    return (
        <div className="pdf-root">

            <img
                src={watermarkSrc}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => (e.target.style.display = "none")}
            />

            {/* CANCELLED stamp */}
            {isCancelled && (
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%) rotate(-35deg)",
                    fontSize: "72px", fontWeight: 900,
                    color: "rgba(220,38,38,0.14)",
                    letterSpacing: "0.1em", whiteSpace: "nowrap",
                    pointerEvents: "none", zIndex: 10, userSelect: "none",
                }}>CANCELLED</div>
            )}

            <div className="pdf-container">

                {/* ═══════════════════ HEADER ═══════════════════ */}
                <div className="pdf-header">
                    <div className="pdf-top-strip-right" />
                    <div className="pdf-top-strip-left" />

                    <div className="pdf-title">
                        {isOrderReceipt ? "ORDER RECEIPT" : docType.includes("INVOICE") ? "INVOICE" : "ESTIMATE"}
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

                {/* ═══════════════════ CUSTOMER + META ═══════════════════ */}
                <div className="pdf-top-row">
                    <div className="pdf-customer" style={hideCustomerDetails ? { visibility: "hidden" } : {}}>
                        <div className="label">ISSUED TO:</div>
                        <div>{customer?.name || "Walk-in Customer"}</div>
                        {customer?.address && <div>{customer.address}</div>}
                        {customer?.phone && <div>{customer.phone}</div>}
                    </div>

                    <div className="pdf-meta">
                        {meta?.number && <div className="bold">#{meta.number}</div>}
                        {meta?.date && <div>Date: {meta.date}</div>}
                    </div>
                </div>

                {/* ═══════════════════ RATE PILL ═══════════════════ */}
                {has(rates?.rate10gm) && (
                    <div className="pdf-rate-pill">
                        <span>RATE OF {rateLabel}: ₹ {ratePerGm.toLocaleString("en-IN")}/g</span>
                        <span>PER 10GM: ₹ {safe(rates.rate10gm).toLocaleString("en-IN")}</span>
                        {has(rates?.makingRate || rates?.makingPerGm) && (
                            <span>MAKING RATE: ₹ {safe(rates.makingRate || rates.makingPerGm).toLocaleString("en-IN")}</span>
                        )}
                    </div>
                )}

                {/* ═══════════════════ ITEMS TABLE ═══════════════════ */}
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
                                <td colSpan={3 + (hasHuid ? 1 : 0) + (hasMetalVal ? 1 : 0) + (hasMaking ? 1 : 0)}
                                    style={{ textAlign: "center", padding: 20, color: "#999" }}>
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
                                            <td style={{ textAlign: "left" }}>{item.name || "—"}</td>
                                            {hasHuid && <td>{item.huid || "—"}</td>}
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

                {/* ═══════════════════ OLD METAL BREAKDOWN ═══════════════════ */}

                {hasOldMetal &&
                    (oldMetal.mode === "weight" ||
                        (oldMetal.mode === "voucher" && oldMetal.rateUsed === "current")) &&
                    safe(oldMetal.weight) > 0 &&
                    (() => {
                        const oldW = safe(oldMetal.weight);
                        const newW = safe(totals?.weightTotal);
                        const rateG = safe(rates?.rate10gm) / 10;
                        const isOldHeavier = oldW > newW;
                        const diffWeight = Math.abs(oldW - newW);
                        const diffMetalValue = isOldHeavier
                            ? safe(oldMetal.value)
                            : diffWeight * rateG;

                        return (
                            <div className="old-calc-breakdown-row">
                                <span style={{ fontWeight: 700 }}>
                                    {isOldHeavier
                                        ? `Old Metal: ${oldW.toFixed(3)} - New Metal: ${newW.toFixed(3)} `
                                        : `New Metal: ${newW.toFixed(3)} - Old Metal: ${oldW.toFixed(3)} `}
                                    = {diffWeight.toFixed(2)}g
                                </span>
                                <span style={{ color: "#64748b", margin: "0 8px" }}>|</span>
                                <span>{fmt(diffMetalValue)}</span>
                                <span style={{ color: "#64748b", margin: "0 4px" }}>
                                    {isOldHeavier ? "−" : "+"}
                                </span>
                                <span>Making: {fmt(totals?.makingTotal)}</span>
                                <span style={{ fontWeight: 700 }}> = {fmt(totals?.subtotal)}</span>
                            </div>
                        );
                    })()}

                {hasOldMetal && oldMetal.mode === "value" && (
                    <div className="old-calc-breakdown-row">
                        <span style={{ fontWeight: 700 }}>Old Metal (Direct Value)</span>
                        <span style={{ color: "#64748b", margin: "0 8px" }}>|</span>
                        <span>Credit Value: −{fmt(oldMetal.value)}</span>
                    </div>
                )}

                {/* ═══════════════════ SUMMARY BANNER ═══════════════════ */}
                <div style={{ width: "100%", fontFamily: "Arial, sans-serif", padding: "0 25px" }}>

                    {/*
                        Summary grid columns (in order):
                          GRAND TOTAL | ROUND OFF | [PV ADJUSTED] | [LESS DISCOUNT] | HALLMARK | OTHER CHARGES | [CGST + SGST | IGST] | TOTAL
                        NOTE: "LESS ADVANCE" is removed from the grid — it is shown
                              in the advance-history section below for proper itemisation.
                    */}
                    <div
                        className="pdf-summary-head"
                        style={{ gridTemplateColumns: `repeat(${summaryColCount}, 1fr)` }}
                    >
                        <div>GRAND TOTAL</div>
                        <div>ROUND OFF</div>
                        {hasVoucher && <div>PV ADJUSTED</div>}
                        {hasDiscount && <div>LESS DISCOUNT</div>}
                        <div>HALLMARK</div>
                        <div>OTHER CHARGES</div>
                        {isInvoice && (
                            totals?.isIgst
                                ? <div>IGST</div>
                                : <><div>CGST</div><div>SGST</div></>
                        )}
                        <div>TOTAL</div>
                    </div>

                    <div
                        className="pdf-summary-values"
                        style={{
                            gridTemplateColumns: `repeat(${summaryColCount}, 1fr)`,
                            borderBottomLeftRadius: "15px",
                            borderBottomRightRadius: "15px",
                        }}
                    >
                        <div className="bold">{fmt(totals?.finalAmount)}</div>

                        <div className="red">
                            {has(totals?.roundOff) ? Number(safe(totals.roundOff)).toFixed(2) : "₹ 0.00"}
                        </div>

                        {/* Purchase Voucher adjustment — shown dynamically when voucher applied */}
                        {hasVoucher && (
                            <div style={{ fontWeight: 700 }}>
                                {fmt(oldMetal.value)}
                            </div>
                        )}

                        {/* Discount — shown only when has a value */}
                        {hasDiscount && (
                            <div style={{ fontWeight: 700 }}>
                                {fmt(discountAmt)}
                            </div>
                        )}

                        <div>{has(totals?.hallmark) ? fmt(totals.hallmark) : "₹ 0.00"}</div>
                        <div>{has(totals?.otherCharges) ? fmt(totals.otherCharges) : "₹ 0.00"}</div>

                        {isInvoice && (
                            totals?.isIgst
                                ? <div>{has(totals?.igst) ? fmt(totals.igst) : "₹ 0.00"}</div>
                                : <><div>{fmt(totals?.cgst)}</div><div>{fmt(totals?.sgst)}</div></>
                        )}

                        <div className="bold">{hasVoucher && totals ? fmt(totals.subtotal + oldMetal.value) : fmt(totals.subtotal)}</div>
                    </div>
                </div>

                {/* ═══════════════════ AMOUNT IN WORDS ═══════════════════ */}
                <div className="pdf-amount-strip">
                    {totals?.amountInWords && String(totals.amountInWords).trim()
                        ? String(totals.amountInWords).toUpperCase()
                        : "—"}
                </div>

                {/* ═══════════════════ PAYMENT METHOD ═══════════════════ */}
                {transactionType === "payable" && !hasCreditNotes ? (
                    payment?.amounts?.filter((p) => has(p.amount)).length > 0 && (
                        <div className="pdf-payment">
                            <div className="label">PAYMENT METHOD</div>
                            {payment.amounts
                                .filter((p) => has(p.amount))
                                .map((p, i) => (
                                    <div key={i}>
                                        {String(p.mode || "").toUpperCase()} : {fmt(p.amount)}
                                    </div>
                                ))}
                        </div>
                    )
                ) : hasCreditNotes ? (
                    <div className="pdf-payment">
                        <div className="label">PAYMENT METHOD</div>
                    </div>
                ) : (
                    <div className="pdf-payment">
                        <div className="label">TRANSACTION TYPE</div>
                        <div>RETURN AMOUNT TO CUSTOMER : {fmt(totals?.finalAmount)}</div>
                    </div>
                )}

                {/* ═══════════════════ LESS ADVANCE + CREDIT NOTES SECTION ═══════════════════

                    Layout:
                      • Heading row "LESS ADVANCE" with total deducted amount
                      • Each advance payment receipt on its own line
                      • Each applied credit note on its own line
                      • If a purchase voucher was applied: "OLD PURCHASE: #PV-2026-007  ₹ X"
                ═══════════════════════════════════════════════════════════════════════════ */}

                {(hasAdvances || hasCreditNotes || hasVoucher || has(totals?.advance)) && (
                    <div style={{ fontSize: "10px", padding: "0 0 0 30px", marginTop: 8 }}>

                        {/* ── Section label ── */}
                        <div style={{
                            display: "flex",
                            // justifyContent: "space-between",
                            alignItems: "center",
                            fontWeight: 700,
                            fontSize: "10px",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            borderBottom: "1px solid #e0e0e0",
                            paddingBottom: 3,
                            marginBottom: 4,
                            paddingRight: 30,
                        }}>
                        </div>

                        {/* ── Advance payment receipts ── */}
                        {hasAdvances && (
                            <>
                                <span>Less Advance: </span>
                                {has(totals?.advance) && (
                                    <span style={{ fontWeight: 700 }}>{fmt(totals.advance)}</span>
                                )}
                                {/* Payment status badge */}
                                {paymentStatus && (
                                    <div style={{ marginBottom: 3 }}>
                                        <span style={{
                                            fontSize: "8px", fontWeight: 700, borderRadius: 3,
                                            padding: "1px 5px",
                                            border: "1px solid #ccc",
                                            textTransform: "uppercase", letterSpacing: "0.04em",
                                        }}>
                                            {String(paymentStatus).replace(/_/g, " ")}
                                        </span>
                                    </div>
                                )}

                                {advanceHistory.map((adv, idx) => {
                                    if (!adv) return null;
                                    const isCancelled = adv.status === "cancelled";
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                display: "flex",
                                                // justifyContent: "space-between",
                                                alignItems: "baseline",
                                                borderBottom: idx < advanceHistory.length - 1 ? "1px dashed #e8e8e8" : "none",
                                                opacity: isCancelled ? 0.5 : 1,
                                                paddingRight: 30,
                                                paddingTop: 1,
                                                paddingBottom: 1,
                                            }}
                                        >
                                            <span style={{ textDecoration: isCancelled ? "line-through" : "none" }}>
                                                {adv.receiptNo || "—"}&nbsp;
                                                ({adv.date || "—"})&nbsp;
                                                <span style={{ textTransform: "uppercase" }}>{adv.paymentMode || ""}</span>
                                                {isCancelled && " [CANCELLED]"}
                                                {adv.isRefund && " [REFUND]"}
                                            </span>
                                            <span style={{ fontWeight: 600 }}>
                                                {adv.isRefund ? "−" : ""}{fmt(adv.amount)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </>
                        )}

                        {/* ── Applied Credit Notes ── */}
                        {hasCreditNotes && appliedCreditNotes.map((cn, idx) => {
                            if (!cn.creditNoteNo) return null;
                            return (
                                <div
                                    key={`cn-${idx}`}
                                    style={{
                                        display: "flex",
                                        // justifyContent: "space-between",
                                        alignItems: "baseline",
                                        borderBottom: "1px dashed #e8e8e8",
                                        paddingRight: 30,
                                        paddingTop: 1,
                                        paddingBottom: 1,
                                    }}
                                >
                                    <span>
                                        Credit Note #{cn.creditNoteNo}
                                        {cn.date ? <span>&nbsp;({fmtDate(cn.date)})</span> : ""}
                                        {cn.reason ? (
                                            <span style={{ color: "#555", fontStyle: "italic" }}>
                                                &nbsp;— {cn.reason}
                                            </span>
                                        ) : ""}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>
                                        −{fmt(cn.amount)}
                                    </span>
                                </div>
                            );
                        })}

                        {/* ── Purchase Voucher (inline reference) ── */}
                        {hasVoucher && (
                            <div style={{
                                display: "flex",
                                // justifyContent: "space-between",
                                alignItems: "baseline",
                                paddingRight: 30,
                                paddingTop: 2,
                                borderTop: (hasAdvances || hasCreditNotes) ? "1px dashed #e8e8e8" : "none",
                                marginTop: (hasAdvances || hasCreditNotes) ? 2 : 0,
                            }}>
                                <span style={{ fontWeight: 600 }}>
                                    Old Purchase: #{oldMetal.voucherNo}
                                </span>
                                <span style={{ fontWeight: 600 }}>
                                    −{fmt(oldMetal.value)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ DESIGN NOTES (Order Receipts only) ═══════════════════ */}
                {isOrderReceipt && designNotes && String(designNotes).trim() && (
                    <div style={{
                        padding: "6px 14px", background: "#fafafa",
                        borderRadius: 4, fontSize: "10px", lineHeight: 1.6,
                        margin: "6px 0", border: "1px solid #eee",
                    }}>
                        <strong style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#888" }}>
                            Design Notes:
                        </strong><br />
                        {designNotes}
                    </div>
                )}

                {isOrderReceipt && Array.isArray(designImages) && designImages.length > 0 && (
                    <div style={{ padding: "6px 14px", margin: "4px 0" }}>
                        <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", marginBottom: 6 }}>
                            Design References
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {designImages.slice(0, 4).map((src, i) => (
                                <img
                                    key={i} src={src} alt={`Design ${i + 1}`}
                                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }}
                                    onError={(e) => { e.target.style.display = "none"; }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══════════════════ FOOTER ═══════════════════ */}
                <div className="pdf-footer">

                    <div className="signature">Customer Signature</div>

                    <div className="thank-text">THANK YOU | VISIT US AGAIN</div>

                    {/* ── Right: always Authorized Signature ── */}
                    <div>
                        <div className="signature">Authorized Signature</div>
                    </div>
                </div>

            </div>
        </div>
    );
}