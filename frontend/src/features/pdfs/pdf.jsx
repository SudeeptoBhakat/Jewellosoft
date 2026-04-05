import React from "react";
import "../../assets/styles/pdf.css";
import WatermarkSVG from "../../assets/media/svg.svg";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InvoicePDF({ data }) {
    if (!data) return null;

    const {
        docType = "TAX INVOICE", // TAX INVOICE | ESTIMATE | ORDER RECEIPT
        theme = "gold", // gold | silver
        customer = {},
        meta = {},
        rates = {},
        items = [],
        oldMetal = null,
        totals = {},
        payment = null,
    } = data;

    const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
    const totalMaking = items.reduce((sum, item) => sum + (Number(item.making) || 0), 0);
    const totalMetalValue = items.reduce((sum, item) => sum + (Number(item.metalValue) || 0), 0);

    const isInvoice = docType.includes("INVOICE");

    return (
        <div className={`pdf-print-wrapper theme-${theme.toLowerCase()}`}>

            {/* SVG Watermark */}
            <img
                src={WatermarkSVG}
                alt="watermark"
                className="pdf-watermark"
                onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div className="pdf-content-layer">

                {/* Header */}
                <div className="pdf-header">
                    <div className="pdf-header-left">
                        <h1 className="pdf-shop-name">MAA SARBAMANGALA JEWELLERS</h1>
                        <div className="pdf-shop-details">
                            Main Road, Raniganj, West Bengal - 713347<br />
                            Phone: +91 9876543210 | Email: contact@maasarbamangala.com<br />
                            GSTIN: 19ABAFM4530A1ZS
                        </div>
                    </div>
                    <div className="pdf-header-right">
                        <h2 className="pdf-document-title">{docType}</h2>
                        <div className="pdf-meta-box">
                            <div><strong>No:</strong> {meta.number || "—"}</div>
                            <div><strong>Date:</strong> {meta.date || "—"}</div>
                        </div>
                    </div>
                </div>

                {/* Info Row: Customer & Rates */}
                <div className="pdf-info-row">
                    <div className="pdf-customer-box">
                        <h4>Billed To</h4>
                        <p>{customer.name || "Walk-in Customer"}</p>
                        <span>{customer.phone || ""}</span>
                        <span>{customer.address || ""}</span>
                    </div>

                    <div className="pdf-rate-box">
                        <div className="pdf-rate-item">
                            <span>Metal:</span>
                            <span>{theme.toUpperCase()}</span>
                        </div>
                        {rates.rate10gm && (
                            <div className="pdf-rate-item">
                                <span>Rate / 10g:</span>
                                <span>{fmt(rates.rate10gm)}</span>
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

                {/* Items Table */}
                <table className="pdf-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            {isInvoice && <th>HUID</th>}
                            <th className="txt-right">Weight (g)</th>
                            <th className="txt-right">Metal Val</th>
                            <th className="txt-right">Making</th>
                            <th className="txt-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr><td colSpan={isInvoice ? 7 : 6} className="txt-center">No items</td></tr>
                        ) : (
                            items.map((item, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>{item.name}</td>
                                    {isInvoice && <td>{item.huid || "—"}</td>}
                                    <td className="txt-right">{Number(item.weight).toFixed(3)}</td>
                                    <td className="txt-right">{fmt(item.metalValue)}</td>
                                    <td className="txt-right">{fmt(item.making)}</td>
                                    <td className="txt-right">{fmt(item.total)}</td>
                                </tr>
                            ))
                        )}
                        <tr className="pdf-table-total-row">
                            <td colSpan={isInvoice ? 3 : 2} className="txt-right">TOTAL ITEMS</td>
                            <td className="txt-right">{totalWeight.toFixed(3)}g</td>
                            <td className="txt-right">{fmt(totalMetalValue)}</td>
                            <td className="txt-right">{fmt(totalMaking)}</td>
                            <td className="txt-right">{fmt(totalMetalValue + totalMaking)}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Old Settlement Box */}
                {oldMetal && oldMetal.weight > 0 && (
                    <div className="pdf-settlement-box">
                        <div className="pdf-settlement-title">Old Metal Exchange Details</div>
                        <div className="pdf-s-row">
                            <span>Old Metal Weight Exchanged</span>
                            <span>{Number(oldMetal.weight).toFixed(3)} g</span>
                        </div>
                        <div className="pdf-s-row negative">
                            <span>Net Value of Old Metal (−)</span>
                            <span>{fmt(oldMetal.value)}</span>
                        </div>
                    </div>
                )}

                {/* Bottom Summary Grid */}
                <div className="pdf-summary-grid">

                    {/* Left: T&C + Words */}
                    <div className="pdf-sg-left">
                        {totals.amountInWords && (
                            <div className="pdf-amount-words">
                                Amount in Words: {totals.amountInWords}
                            </div>
                        )}
                        {payment && payment.amounts && payment.amounts.length > 0 && (
                            <div className="pdf-payment-info">
                                <strong>Payment Received:</strong><br />
                                {payment.amounts.map(p => (
                                    <span key={p.mode} style={{ marginRight: 15 }}>
                                        {p.mode.toUpperCase()}: {fmt(p.amount)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Calculations */}
                    <div className="pdf-sg-right">
                        <table className="pdf-summary-table">
                            <tbody>
                                <tr>
                                    <td>Subtotal (Metal + Making)</td>
                                    <td>{fmt(totals.subtotal)}</td>
                                </tr>
                                {Number(totals.otherCharges) > 0 && (
                                    <tr>
                                        <td>Other Charges (+)</td>
                                        <td>{fmt(totals.otherCharges)}</td>
                                    </tr>
                                )}
                                {Number(totals.hallmark) > 0 && (
                                    <tr>
                                        <td>Hallmark Charges (+)</td>
                                        <td>{fmt(totals.hallmark)}</td>
                                    </tr>
                                )}
                                {Number(totals.cgst) > 0 && (
                                    <tr>
                                        <td>CGST (1.5%) (+)</td>
                                        <td>{fmt(totals.cgst)}</td>
                                    </tr>
                                )}
                                {Number(totals.sgst) > 0 && (
                                    <tr>
                                        <td>SGST (1.5%) (+)</td>
                                        <td>{fmt(totals.sgst)}</td>
                                    </tr>
                                )}
                                {oldMetal && oldMetal.value > 0 && (
                                    <tr>
                                        <td>Old Metal Value (−)</td>
                                        <td style={{ color: '#e53935' }}>{fmt(oldMetal.value)}</td>
                                    </tr>
                                )}
                                {Number(totals.advance) > 0 && (
                                    <tr>
                                        <td>Advance Deducted (−)</td>
                                        <td style={{ color: '#e53935' }}>{fmt(totals.advance)}</td>
                                    </tr>
                                )}
                                {Number(totals.discount) > 0 && (
                                    <tr>
                                        <td>Discount (−)</td>
                                        <td style={{ color: '#e53935' }}>{fmt(totals.discount)}</td>
                                    </tr>
                                )}
                                {Number(totals.roundOff) !== 0 && (
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
                        <div className="pdf-signature">Authorized Signatory</div>
                    </div>
                </div>

            </div>
        </div>
    );
}