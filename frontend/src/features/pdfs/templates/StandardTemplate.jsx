import React from "react";
import "../../../assets/styles/pdf-standard.css";
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

    /* ── Applied credit notes*/
    const appliedCreditNotes = (() => {
        const fromTotals = Array.isArray(totals?.appliedCreditNotes) ? totals.appliedCreditNotes : [];
        const fromUsages = Array.isArray(data?.creditNoteUsages) ? data.creditNoteUsages : [];

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

    /* ── Summary Row-1 columns: TOTAL | [LESS DISCOUNT] | OTHER CHARGES | HALLMARK | [TAX] | SUB TOTAL ── */
    const row1Cols = (() => {
        let cols = 4; // TOTAL | OTHER CHARGES | HALLMARK | SUB TOTAL
        if (hasDiscount) cols++;
        if (isInvoice) cols += totals?.isIgst ? 1 : 2;
        return cols;
    })();

    /* ── Summary Row-2 columns: [PV] | [CN] | [ADVANCE] | ROUND OFF | GRAND TOTAL ── */
    const row2Cols = (() => {
        let cols = 2; // ROUND OFF + GRAND TOTAL always
        if (hasVoucher) cols++;
        if (hasCreditNotes) cols++;
        if (hasAdvances || has(totals?.advance)) cols++;
        return cols;
    })();

    /* ── Pad items table to minimum 5 visible rows ── */
    const displayItems = [...(Array.isArray(items) ? items : [])];
    while (displayItems.length < 5) displayItems.push({ _isEmpty: true });

    /* ─────────────────────────────────────────────────────── */

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

            {/* <img
                src={watermarkSrc}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => (e.target.style.display = "none")}
            /> */}

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
                {/* <div className="pdf-header">
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
                </div> */}

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
                        {/* <span>RATE OF {rateLabel}: ₹ {ratePerGm.toLocaleString("en-IN")}/g</span> */}
                        <span>PER 10GM: ₹ {safe(rates.rate10gm).toLocaleString("en-IN")}</span> |
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

                {/* ═══════════════════ SUMMARY BANNER ROW 1 ═══════════════════
                    Columns: TOTAL | [LESS DISCOUNT] | OTHER CHARGES | HALLMARK | [CGST+SGST or IGST] | SUB TOTAL
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
                        {isInvoice && (
                            totals?.isIgst
                                ? <div>IGST</div>
                                : <><div>CGST</div><div>SGST</div></>
                        )}
                        <div>SUB TOTAL</div>
                    </div>
                    <div
                        className="pdf-summary-values"
                        style={{ gridTemplateColumns: `repeat(${row1Cols}, 1fr)` }}
                    >
                        {/* TOTAL = new product value (sum of all items: metalValue + making) */}
                        <div className="bold">{fmt(totals?.subtotal+(totals?.isIgst?totals?.igst?.totals.igst:totals?.cgst+totals?.sgst) + totals?.hallmark + totals?.otherCharges - discountAmt)}</div>
                        {/* LESS DISCOUNT */}
                        {hasDiscount && (
                            <div style={{ fontWeight: 700 }}>{fmt(discountAmt)}</div>
                        )}
                        {/* OTHER CHARGES */}
                        <div>{has(totals?.otherCharges) ? fmt(totals.otherCharges) : "₹ 0.00"}</div>
                        {/* HALLMARK */}
                        <div>{has(totals?.hallmark) ? fmt(totals.hallmark) : "₹ 0.00"}</div>
                        {/* TAX */}
                        {isInvoice && (
                            totals?.isIgst
                                ? <div>{has(totals?.igst) ? fmt(totals.igst) : "₹ 0.00"}</div>
                                : <><div>{fmt(totals?.cgst)}</div><div>{fmt(totals?.sgst)}</div></>
                        )}
                        {/* SUB TOTAL = items total + charges + tax − discount (before PV/CN/Advance) */}
                        <div className="bold">{fmt(totals?.subtotal)}</div>
                    </div>
                </div>

                {/* ═══════════════════ SUMMARY BANNER ROW 2 ═══════════════════
                    Columns: [PV ADJUSTED] | [CN ADJUSTED] | [LESS ADVANCE] | ROUND OFF | GRAND TOTAL
                ════════════════════════════════════════════════════════════════ */}
                <div style={{ width: "100%", fontFamily: "Arial, sans-serif", padding: "0 25px"}}>
                    <div
                        className="pdf-summary-head"
                        style={{ gridTemplateColumns: `repeat(${row2Cols}, 1fr)`, marginTop: 0 }}
                    >
                        {hasVoucher && <div>PV ADJUSTED</div>}
                        {hasCreditNotes && <div>CN ADJUSTED</div>}
                        {(hasAdvances || has(totals?.advance)) && <div>LESS ADVANCE</div>}
                        <div>ROUND OFF</div>
                        <div>GRAND TOTAL</div>
                    </div>
                    <div
                        className="pdf-summary-values"
                        style={{
                            gridTemplateColumns: `repeat(${row2Cols}, 1fr)`,
                            borderBottomLeftRadius: "12px",
                            borderBottomRightRadius: "12px",
                        }}
                    >
                        {/* PV ADJUSTED — old purchase voucher deduction */}
                        {hasVoucher && (
                            <div style={{ fontWeight: 700 }}>{fmt(oldMetal.value)}</div>
                        )}
                        {/* CN ADJUSTED — total credit notes applied */}
                        {hasCreditNotes && (
                            <div style={{ fontWeight: 700 }}>{fmt(totalCreditApplied)}</div>
                        )}
                        {/* LESS ADVANCE — total advance deducted */}
                        {(hasAdvances || has(totals?.advance)) && (
                            <div style={{ fontWeight: 700 }}>
                                {has(totals?.advance) ? fmt(totals.advance) : "₹ 0.00"}
                            </div>
                        )}
                        {/* ROUND OFF */}
                        <div style={{ color: "#64748b" }}>
                            {has(totals?.roundOff)
                                ? (safe(totals.roundOff) >= 0 ? "+" : "") + Number(safe(totals.roundOff)).toFixed(2)
                                : "₹ 0.00"}
                        </div>
                        {/* GRAND TOTAL — final payable / receivable */}
                        <div className="bold" style={{ fontSize: "13px" }}>{fmt(totals?.finalAmount)}</div>
                    </div>
                </div>

                {/* ═══════════════════ AMOUNT IN WORDS ═══════════════════ */}
                <div className="pdf-amount-strip" style={{ marginTop: 8 }}>
                    {totals?.amountInWords && String(totals.amountInWords).trim()
                        ? String(totals.amountInWords).toUpperCase()
                        : "—"}
                </div>

                {/* ═══════════════════ PAYMENT METHOD/RETURN SHOW ═══════════════════ */}
                {transactionType !== "payable" && (
                    <div style={{ padding: "4px 30px", fontSize: "11px", fontWeight: 600 }}>
                        <span>
                            <span style={{ textTransform: "uppercase", color: "#555", marginRight: 6 }}>
                                RETURN TO CUSTOMER:
                            </span>
                            <span>{fmt(totals?.finalAmount)}</span>
                        </span>
                    </div>
                )}


                <div className="bill-info">
                    <div className="order-additional">
                        {/* ═══════════════════ DESIGN NOTES + IMAGE COUNT (Order Receipts only) ═══════════════════ */}
                        {isOrderReceipt && (designNotes || (Array.isArray(designImages) && designImages.length > 0)) && (
                            <div style={{
                                padding: "4px 25px",
                                margin: "4px 0",
                                // display: "flex",
                                alignItems: "flex-start",
                                // gap: 10,
                            }}>
                                {/* Design Notes */}
                                {designNotes && String(designNotes).trim() && (
                                    <div style={{
                                        flex: 1,
                                        // background: "#fafafa",
                                        borderRadius: 4,
                                        fontWeight: 700,
                                        fontSize: "9.5px",
                                        lineHeight: 1.5,
                                        padding: "5px 10px",
                                        border: "1px solid #e8e8e8",
                                    }}>
                                        <div style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#888", marginBottom: 3 }}>
                                            Additional Notes
                                        </div>
                                        {designNotes}
                                    </div>
                                )}
                                {/* Image count badge */}
                                {Array.isArray(designImages) && designImages.length > 0 && (
                                    <div style={{
                                        // display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        minWidth: 54,
                                        // background: "#f0f4ff",
                                        // border: "1px solid #c7d4f0",
                                        borderRadius: 6,
                                        padding: "4px 9px",
                                        fontSize: "9px",
                                        fontWeight: 700,
                                        // color: "#1e3b8a",
                                        gap: 2,
                                    }}>
                                        {/* <span style={{ fontSize: "18px", lineHeight: 1 }}>🖼</span> */}
                                        {/* <span style={{ fontSize: "11px", fontWeight: 800 }}></span> */}
                                        <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                                            Ref. {designImages.length === 1 ? "Image" : "Images"}: {designImages.length}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="reference-details">
                        {/* ═══════════════════ REFERENCE DETAILS TABLE ═══════════════════
                    Shows: Purchase Voucher # | Credit Note # | Advance Receipts
                    All in a compact sequential table below the totals
                ═══════════════════════════════════════════════════════════════ */}
                        {(hasVoucher || hasCreditNotes || hasAdvances) && (
                            <div style={{ padding: "0 25px", marginTop: 4 }}>
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
                                    Reference Details
                                </div>
                                <table style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: "9px",
                                }}>
                                    <thead>
                                        <tr style={{ background: "linear-gradient(90deg,#1e3b8a22,#2564eb14)", color: "#1e3b8a" }}>
                                            {/* <th style={refTh}>#</th> */}
                                            {/* <th style={refTh}>TYPE</th> */}
                                            <th style={refTh}>REFERENCE NO.</th>
                                            <th style={refTh}>DATE</th>
                                            {/* <th style={refTh}>DETAILS</th> */}
                                            <th style={{ ...refTh, textAlign: "right" }}>AMOUNT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Purchase Voucher row */}
                                        {hasVoucher && (
                                            <tr style={refRowStyle}>
                                                {/* <td style={refTd}>1</td> */}
                                                {/* <td style={refTd}>
                                                    <span style={refBadge("#7c3aed")}>PURCHASE VOUCHER</span>
                                                </td> */}
                                                <td style={{ ...refTd, fontWeight: 700 }}>#{oldMetal.voucherNo}</td>
                                                <td style={{refTd, fontWeight: 500}}>—</td>
                                                {/* <td style={refTd}>
                                                    {oldMetal.weight ? `${Number(oldMetal.weight).toFixed(3)} g` : "—"}
                                                    {oldMetal.rateUsed ? ` @ ${oldMetal.rateUsed}` : ""}
                                                </td> */}
                                                <td style={{ ...refTd, textAlign: "right", fontWeight: 700 }}>
                                                    {fmt(oldMetal.value)}
                                                </td>
                                            </tr>
                                        )}
                                        {/* Credit Note rows */}
                                        {hasCreditNotes && appliedCreditNotes.map((cn, idx) => {
                                            if (!cn.creditNoteNo) return null;
                                            const rowNum = (hasVoucher ? 1 : 0) + idx + 1;
                                            return (
                                                <tr key={`cn-${idx}`} style={refRowStyle}>
                                                    {/* <td style={refTd}>{rowNum}</td> */}
                                                    {/* <td style={refTd}>
                                                        <span style={refBadge("#0891b2")}>CREDIT NOTE</span>
                                                    </td> */}
                                                    <td style={{ ...refTd, fontWeight: 700 }}>#{cn.creditNoteNo}</td>
                                                    <td style={{refTd, fontWeight: 500}}>{cn.date ? fmtDate(cn.date) : "—"}</td>
                                                    {/* <td style={{ ...refTd, fontStyle: "italic", color: "#555" }}>
                                                        {cn.reason || "—"}
                                                    </td> */}
                                                    <td style={{ ...refTd, textAlign: "right", fontWeight: 700 }}>
                                                        {fmt(cn.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Advance Receipt rows */}
                                        {hasAdvances && advanceHistory.map((adv, idx) => {
                                            if (!adv) return null;
                                            const rowNum = (hasVoucher ? 1 : 0) + (hasCreditNotes ? appliedCreditNotes.length : 0) + idx + 1;
                                            const advCancelled = adv.status === "cancelled";
                                            return (
                                                <tr key={`adv-${idx}`} style={{ ...refRowStyle, opacity: advCancelled ? 0.5 : 1 }}>
                                                    {/* <td style={refTd}>{rowNum}</td> */}
                                                    {/* <td style={refTd}>
                                                        <span style={refBadge(advCancelled ? "#9ca3af" : "#059669")}>
                                                            {adv.isRefund ? "REFUND" : "ADVANCE"}
                                                            {advCancelled ? " ✕" : ""}
                                                        </span>
                                                    </td> */}
                                                    <td style={{ ...refTd, fontWeight: 700, textDecoration: advCancelled ? "line-through" : "none" }}>
                                                        {adv.receiptNo || "—"}
                                                    </td>
                                                    <td style={{refTd, fontWeight: 500}}>{adv.date || "—"}</td>
                                                    {/* <td style={refTd}>
                                                        {adv.paymentMode ? String(adv.paymentMode).toUpperCase() : "—"}
                                                    </td> */}
                                                    <td style={{ ...refTd, textAlign: "right", fontWeight: 700 }}>
                                                        {adv.isRefund ? "+" : "−"}{fmt(adv.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
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