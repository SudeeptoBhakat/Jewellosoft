/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import React from "react";
import "../../../assets/styles/pdf-standard.css";
import { amountWords } from "../../../utils/billingCalcEngine";
import FallbackWatermarkSVG from "../../../assets/icons/b503ee48-1ece-4256-8ef5-72c1d9f0a8de.png";


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

export default function CreditNoteTemplate({ data }) {
    if (!data) return null;

    const {
        customer = {},
        creditNote = {},
        rates = {},
        hideCustomerDetails = false,
        theme = "gold",
    } = data;

    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;
    const cnNo = creditNote.credit_note_no || "";
    const issueDate = creditNote.created_at ? fmtDate(creditNote.created_at) : fmtDate(new Date());
    const validUntil = creditNote.expires_at ? fmtDate(creditNote.expires_at) : "No Expiry";
    const status = creditNote.status || "open";
    const isCancelled = status === "cancelled" || data.isCancelled;

    const sourceInv = creditNote.source_invoice_detail || {};
    const sourceInvoiceNo = creditNote.source_invoice_no || sourceInv.invoice_no || "";

    const creditAmount = safe(creditNote.credit_amount);
    const usedAmount = safe(creditNote.used_amount);
    const remainingAmount = safe(creditNote.remaining_amount ?? (creditAmount - usedAmount));

    const rate10gm = safe(rates?.rate10gm || sourceInv.metal_rate);
    const makingRate = safe(rates?.makingRate || sourceInv.making_rate);
    const rateLabel = theme?.toLowerCase() === "silver" ? "SILVER" : "GOLD";

    // Products / Items extraction
    const rawItems = creditNote.items || sourceInv.items || data.items || [];
    const items = Array.isArray(rawItems) && rawItems.length > 0
        ? rawItems.map((item) => ({
            name: item.product_name || item.name || item.description || "—",
            huid: item.huid || item.huid_code || item.huidCode || "—",
            weight: safe(item.net_weight || item.weight || item.gross_weight),
            metalValue: safe(item.metal_value || item.metalValue),
            making: safe(item.making_charge || item.making),
            total: safe(item.total || item.amount),
        }))
        : [
            {
                name: creditNote.reason ? `Credit: ${creditNote.reason}` : "Store Credit Note",
                huid: "—",
                weight: 0,
                metalValue: creditAmount,
                making: 0,
                total: creditAmount,
            },
        ];

    const hasHuid = items.some((i) => i && i.huid && String(i.huid).trim() && i.huid !== "—");
    const hasMetalVal = items.some((i) => i && has(i.metalValue));
    const hasMaking = items.some((i) => i && has(i.making));

    /* ── Pad items table to minimum 5 visible rows ── */
    const displayItems = [...items];
    while (displayItems.length < 5) displayItems.push({ _isEmpty: true });

    /* ── Discount and charges ── */
    const discountAmt = safe(sourceInv.discount || data.totals?.discount);
    const hasDiscount = discountAmt > 0;
    const hallmarkAmt = safe(sourceInv.hallmark || data.totals?.hallmark);
    const otherChargesAmt = safe(sourceInv.others || data.totals?.otherCharges);
    const cgstAmt = safe(sourceInv.cgst || data.totals?.cgst);
    const sgstAmt = safe(sourceInv.sgst || data.totals?.sgst);
    const igstAmt = safe(sourceInv.igst || data.totals?.igst);
    const isTaxPresent = cgstAmt > 0 || sgstAmt > 0 || igstAmt > 0;
    const isIgst = igstAmt > 0 || data.totals?.isIgst;

    /* ── Summary Row-1 columns: TOTAL | [LESS DISCOUNT] | OTHER CHARGES | HALLMARK | [TAX] | SUB TOTAL ── */
    const row1Cols = (() => {
        let cols = 4; // TOTAL | OTHER CHARGES | HALLMARK | SUB TOTAL
        if (hasDiscount) cols++;
        if (isTaxPresent) cols += isIgst ? 1 : 2;
        return cols;
    })();

    /* ── Summary Row-2 columns: TOTAL CREDIT | USED CREDIT | ROUND OFF | REMAINING CREDIT ── */
    const row2Cols = (() => {
        let cols = 3; // TOTAL CREDIT | USED CREDIT | REMAINING CREDIT
        if (has(sourceInv.round_off || data.totals?.roundOff)) cols++;
        return cols;
    })();

    /* ── Usages & Consumption history ── */
    const usages = Array.isArray(creditNote.usages) ? creditNote.usages : [];
    const hasUsages = usages.length > 0;

    /* ── Reference table micro-style constants ── */
    const refTh = {
        padding: "4px 6px", fontWeight: 700, fontSize: "8px",
        textTransform: "uppercase", letterSpacing: "0.05em",
        textAlign: "left", borderBottom: "1px solid #1e3b8a33",
    };
    const refTd = {
        padding: "3px 6px", fontSize: "8.5px", borderBottom: "1px solid #f0f0f0",
        textAlign: "left", verticalAlign: "middle",
    };
    const refBadge = (color) => ({
        display: "inline-block",
        background: color + "22",
        color: color,
        border: `1px solid ${color}55`,
        borderRadius: 3,
        padding: "1px 4px",
        fontSize: "7.5px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
    });
    const refRowStyle = { background: "#fff" };

    const amountInWords = creditNote.amountInWords || amountWords(remainingAmount > 0 ? remainingAmount : creditAmount);

    return (
        <div className="pdf-root">
            {watermarkSrc && String(watermarkSrc).endsWith(".pdf") ? (
                <embed
                    src={`${watermarkSrc}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    type="application/pdf"
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                        border: "none",
                    }}
                />
            ) : (
                <img
                    src={watermarkSrc}
                    alt=""
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center top",
                        zIndex: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                    }}
                />
            )}

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

                {/* ═══════════════════ CUSTOMER + META ═══════════════════ */}
                <div className="pdf-top-row">
                    <div className="pdf-customer" style={hideCustomerDetails ? { visibility: "hidden" } : {}}>
                        <div className="label">ISSUED TO:</div>
                        <div>{customer?.name || "Walk-in Customer"}</div>
                        {customer?.address && <div>{customer.address}</div>}
                        {customer?.phone && <div>{customer.phone}</div>}
                    </div>

                    <div className="pdf-meta">
                        {cnNo && <div className="bold">#{cnNo}</div>}
                        <div>Date: {issueDate}</div>
                        {sourceInvoiceNo && <div>Ref Inv: #{sourceInvoiceNo}</div>}
                    </div>
                </div>

                {/* ═══════════════════ RATE / STATUS PILL ═══════════════════ */}
                <div className="pdf-rate-pill">
                    {rate10gm > 0 && <span>PER 10GM: ₹ {rate10gm.toLocaleString("en-IN")} | </span>}
                    <span> MAKING: ₹ {makingRate.toLocaleString("en-IN")}</span>
                </div>

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
                                            <td>{item.weight > 0 ? `${Number(item.weight).toFixed(3)} g` : "—"}</td>
                                            {hasMetalVal && <td>{item.metalValue > 0 ? fmt(item.metalValue) : "—"}</td>}
                                            {hasMaking && <td>{item.making > 0 ? fmt(item.making) : "—"}</td>}
                                            <td>{fmt(item.total)}</td>
                                        </>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* ═══════════════════ SUMMARY BANNER ROW 1 ═══════════════════
                    Columns: TOTAL | [LESS DISCOUNT] | OTHER CHARGES | HALLMARK | [TAX] | SUB TOTAL
                ════════════════════════════════════════════════════════════════ */}
                <div style={{ width: "100%", fontFamily: "Arial, sans-serif", padding: "0 25px", marginTop: 6 }}>
                    <div
                        className="pdf-summary-head"
                        style={{ gridTemplateColumns: `repeat(${row1Cols}, 1fr)`, marginTop: 0 }}
                    >
                        <div>TOTAL</div>
                        {hasDiscount && <div>LESS DISCOUNT</div>}
                        <div>OTHER CHARGES</div>
                        <div>HALLMARK</div>
                        {isTaxPresent && (
                            isIgst
                                ? <div>IGST</div>
                                : <><div>CGST</div><div>SGST</div></>
                        )}
                        <div>SUB TOTAL</div>
                    </div>
                    <div
                        className="pdf-summary-values"
                        style={{ gridTemplateColumns: `repeat(${row1Cols}, 1fr)` }}
                    >
                        <div className="bold">
                            {fmt(sourceInv.grand_total || creditAmount)}
                        </div>
                        {hasDiscount && (
                            <div style={{ fontWeight: 700 }}>−{fmt(discountAmt)}</div>
                        )}
                        <div>{otherChargesAmt > 0 ? fmt(otherChargesAmt) : "₹ 0.00"}</div>
                        <div>{hallmarkAmt > 0 ? fmt(hallmarkAmt) : "₹ 0.00"}</div>
                        {isTaxPresent && (
                            isIgst
                                ? <div>{igstAmt > 0 ? fmt(igstAmt) : "₹ 0.00"}</div>
                                : <><div>{fmt(cgstAmt)}</div><div>{fmt(sgstAmt)}</div></>
                        )}
                        <div className="bold">
                            {fmt(sourceInv.subtotal || creditAmount)}
                        </div>
                    </div>
                </div>

                {/* ═══════════════════ SUMMARY BANNER ROW 2 ═══════════════════
                    Columns: TOTAL CREDIT | USED CREDIT | [ROUND OFF] | REMAINING BALANCE
                ════════════════════════════════════════════════════════════════ */}
                <div style={{ width: "100%", fontFamily: "Arial, sans-serif", padding: "0 25px" }}>
                    <div
                        className="pdf-summary-head"
                        style={{ gridTemplateColumns: `repeat(${row2Cols}, 1fr)`, marginTop: 0 }}
                    >
                        <div>TOTAL CREDIT</div>
                        <div>USED CREDIT</div>
                        {has(sourceInv.round_off || data.totals?.roundOff) && <div>ROUND OFF</div>}
                        <div>REMAINING BALANCE</div>
                    </div>
                    <div
                        className="pdf-summary-values"
                        style={{
                            gridTemplateColumns: `repeat(${row2Cols}, 1fr)`,
                            borderBottomLeftRadius: "12px",
                            borderBottomRightRadius: "12px",
                        }}
                    >
                        <div className="bold">{fmt(creditAmount)}</div>
                        <div style={{ fontWeight: 700 }}>
                            {usedAmount > 0 ? `${fmt(usedAmount)}` : "₹ 0.00"}
                        </div>
                        {has(sourceInv.round_off || data.totals?.roundOff) && (
                            <div style={{ color: "#64748b" }}>
                                {fmt(sourceInv.round_off || data.totals?.roundOff)}
                            </div>
                        )}
                        <div className="bold" style={{ fontSize: "13px" }}>
                            {fmt(remainingAmount)}
                        </div>
                    </div>
                </div>

                {/* ═══════════════════ AMOUNT IN WORDS ═══════════════════ */}
                <div className="pdf-amount-strip" style={{ marginTop: 8 }}>
                    {amountInWords ? String(amountInWords).toUpperCase() : "—"}
                </div>

                {/* ═══════════════════ NOTES & CONSUMPTION / REFERENCE DETAILS ═══════════════════ */}
                <div className="bill-info">
                    <div className="order-additional">
                        {(creditNote.reason || creditNote.notes) && (
                            <div style={{
                                padding: "4px 25px",
                                margin: "4px 0",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                            }}>
                                <div style={{
                                    flex: 1,
                                    // background: "#fafafa",
                                    borderRadius: 4,
                                    fontSize: "9.5px",
                                    lineHeight: 1.5,
                                    fontWeight: 700,
                                    padding: "5px 10px",
                                    border: "1px solid #e8e8e8",
                                }}>
                                    <div style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                                        Credit Note Reason & Notes
                                    </div>
                                    {creditNote.reason && <div><strong>Reason:</strong> {creditNote.reason}</div>}
                                    {creditNote.notes && <div style={{ marginTop: 2, fontStyle: "italic", color: "#555" }}>{creditNote.notes}</div>}
                                </div>
                            </div>
                        )}

                        <span style={{padding: "0 35px", fontWeight: 700, fontSize: "12.5px"}}>STATUS: {status.toUpperCase()}</span>
                    </div>

                    <div className="reference-details">
                        {hasUsages && (
                            <div style={{ padding: "0 27px", marginTop: 4 }}>
                                <div style={{
                                    fontSize: "8.5px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.07em",
                                    color: "#1e3b8a",
                                    borderBottom: "1.5px solid #1e3b8a55",
                                    paddingBottom: 2,
                                    marginBottom: 3,
                                }}>
                                    Credit Consumption History
                                </div>
                                <table style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: "9px",
                                }}>
                                    <thead>
                                        <tr style={{ background: "linear-gradient(90deg,#1e3b8a22,#2564eb14)", color: "#1e3b8a" }}>
                                            {/* <th style={refTh}>#</th> */}
                                            <th style={refTh}>APPLIED TO</th>
                                            <th style={refTh}>DATE</th>
                                            <th style={refTh}>NOTES</th>
                                            <th style={{ ...refTh, textAlign: "right" }}>AMOUNT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usages.map((u, idx) => (
                                            <tr key={idx} style={refRowStyle}>
                                                {/* <td style={refTd}>{idx + 1}</td> */}
                                                <td style={{ ...refTd, fontWeight: 700 }}>
                                                    <span>
                                                        {u.invoice_no || u.estimate_no || "BILL"}
                                                    </span>
                                                </td>
                                                <td style={{ ...refTd, fontWeight: 500 }}>{fmtDate(u.created_at || u.date)}</td>
                                                <td style={{ ...refTd, fontStyle: "italic", fontWeight: 500 }}>
                                                    {u.note || u.reason || "—"}
                                                </td>
                                                <td style={{ ...refTd, fontWeight: 700 }}>
                                                    {fmt(u.amount_used || u.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════════ FOOTER ═══════════════════ */}
                <div className="pdf-footer">
                    <div className="signature">Customer Signature</div>
                    <div className="thank-text">THANK YOU | VISIT US AGAIN</div>
                    <div>
                        <div className="signature">Authorized Signature</div>
                    </div>
                </div>

            </div>
        </div>
    );
}

