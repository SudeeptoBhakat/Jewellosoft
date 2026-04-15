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
    } = data;

    const watermarkSrc = shop.watermark_logo_url || FallbackWatermarkSVG;

    // ── Derive which item columns have data (respecting hide flags) ──
    const hasHuid     = items.some((i) => i.huid && i.huid.trim() && i.huid !== "—");
    const hasMetalVal = !hideMetalValue && items.some((i) => has(i.metalValue));
    const hasMaking   = !hideMaking && items.some((i) => has(i.making));

    // ── Derive rate display values ──
    const ratePerGm = has(rates.rate10gm) ? Number(rates.rate10gm) / 10 : 0;
    const rateLabel = theme?.toLowerCase() === "silver" ? "SILVER" : "GOLD";

    // ── Build summary rows: only include non-zero values ──
    const summaryRows = [];
    if (has(totals.subtotal))     summaryRows.push({ label: "SUBTOTAL",       value: fmt(totals.subtotal) });
    if (has(totals.hallmark))     summaryRows.push({ label: "HALLMARK",       value: fmt(totals.hallmark) });
    if (has(totals.cgst))         summaryRows.push({ label: "CGST 1.5%",     value: fmt(totals.cgst) });
    if (has(totals.sgst))         summaryRows.push({ label: "SGST 1.5%",     value: fmt(totals.sgst) });
    if (has(totals.otherCharges)) summaryRows.push({ label: "OTHER CHARGES", value: fmt(totals.otherCharges) });
    if (oldMetal && has(oldMetal.value))
        summaryRows.push({
            label: oldMetal.mode === "value" ? "OLD METAL (DIRECT)" : `OLD METAL (${Number(oldMetal.weight || 0).toFixed(2)}g)`,
            value: `- ${fmt(oldMetal.value)}`,
            isDeduct: true,
        });
    if (has(totals.advance))      summaryRows.push({ label: "LESS ADVANCE",  value: `- ${fmt(totals.advance)}`,  isDeduct: true });
    if (has(totals.discount))     summaryRows.push({ label: "DISCOUNT",      value: `- ${fmt(totals.discount)}`, isDeduct: true });
    if (has(totals.roundOff))     summaryRows.push({ label: "ROUND OFF",     value: Number(totals.roundOff).toFixed(2) });
    // Final amount is always shown
    summaryRows.push({ label: "NET TOTAL", value: fmt(totals.finalAmount), isFinal: true });

    // Dynamic grid columns based on summary items count
    const gridCols = summaryRows.length;

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
                    <div className="pdf-top-strip"></div>

                    <div className="pdf-title">
                        {docType.includes("INVOICE") ? "INVOICE" : "ESTIMATE"}
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
                    <div className="pdf-customer">
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
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={3 + (hasHuid ? 1 : 0) + (hasMetalVal ? 1 : 0) + (hasMaking ? 1 : 0)} style={{ textAlign: "center", padding: 20, color: "#999" }}>
                                    No items
                                </td>
                            </tr>
                        ) : (
                            items.map((item, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td style={{ textAlign: "left" }}>{item.name}</td>
                                    {hasHuid && <td>{item.huid || "-"}</td>}
                                    <td>{Number(item.weight || 0).toFixed(3)} g</td>
                                    {hasMetalVal && <td>{fmt(item.metalValue)}</td>}
                                    {hasMaking && <td>{fmt(item.making)}</td>}
                                    <td>{fmt(item.total)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* SUMMARY — dynamic grid, only columns with data */}
                {summaryRows.length > 0 && (
                    <>
                        <div className="pdf-summary-head" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                            {summaryRows.map((r, i) => (
                                <div key={i} style={r.isFinal ? { fontWeight: 900 } : undefined}>{r.label}</div>
                            ))}
                        </div>
                        <div className="pdf-summary-values" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                            {summaryRows.map((r, i) => (
                                <div key={i} className={r.isDeduct ? "red" : r.isFinal ? "bold" : ""}>
                                    {r.value}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* AMOUNT IN WORDS — only if valid string */}
                {totals.amountInWords && totals.amountInWords.trim() && (
                    <div className="pdf-amount-strip">
                        {totals.amountInWords.toUpperCase()}
                    </div>
                )}

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

                {/* FOOTER */}
                <div className="pdf-footer">
                    <div className="signature">Customer Signature</div>
                    <div className="thank-text">THANK YOU | VISIT US AGAIN</div>
                    <div className="signature">
                        {shop.name ? `For ${shop.name}` : "Authorized Signature"}
                    </div>
                </div>

            </div>
        </div>
    );
}