/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import React from "react";

const fmt = (n) =>
  `${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtRupee = (n) => `\u20b9${fmt(n)}`;

/* Inline styles — no dependency on external CSS so printing is always correct */
const S = {
  wrapper: {
    width: "148mm",
    minHeight: "100mm",
    maxWidth: "148mm",
    margin: "0 auto",
    background: "#ffffff",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: "9pt",
    color: "#1a1a1a",
    boxSizing: "border-box",
    padding: "6mm 7mm 5mm",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #1a1a1a",
    paddingBottom: "3mm",
    marginBottom: "3mm",
  },
  shopName: {
    fontSize: "13pt",
    fontWeight: 700,
    letterSpacing: "0.02em",
    margin: 0,
    lineHeight: 1.2,
  },
  shopMeta: {
    fontSize: "7.5pt",
    color: "#555",
    marginTop: "2px",
    lineHeight: 1.6,
  },
  titleBlock: { textAlign: "right" },
  docTitle: {
    fontSize: "10pt",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: 0,
    marginBottom: "3px",
  },
  metaTable: { fontSize: "7.5pt", color: "#444", lineHeight: 1.7, borderCollapse: "collapse" },
  metaLabel: { fontWeight: 600, paddingRight: "6px", color: "#222", textAlign: "right" },
  infoRow: {
    display: "flex",
    gap: "4mm",
    marginBottom: "3mm",
  },
  box: {
    flex: 1,
    background: "#f8f8f8",
    border: "1px solid #e0e0e0",
    borderRadius: "2px",
    padding: "2mm 3mm",
  },
  boxLabel: {
    fontSize: "6.5pt",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    color: "#888",
    marginBottom: "2px",
  },
  boxValue: { fontSize: "8.5pt", fontWeight: 600, color: "#1a1a1a", lineHeight: 1.6 },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: "3mm", fontSize: "8pt" },
  th: {
    background: "#1a1a1a",
    color: "#fff",
    padding: "2px 5px",
    fontWeight: 600,
    fontSize: "7pt",
    textAlign: "left",
    letterSpacing: "0.04em",
  },
  thR: { textAlign: "right" },
  td: { padding: "3px 5px", borderBottom: "1px solid #eee", verticalAlign: "middle" },
  tdR: { textAlign: "right" },
  tfootTd: {
    padding: "3px 5px",
    borderTop: "2px solid #1a1a1a",
    fontWeight: 700,
    fontSize: "9.5pt",
  },
  notes: {
    fontSize: "7.5pt",
    color: "#555",
    background: "#f8f8f8",
    border: "1px solid #e0e0e0",
    borderRadius: "2px",
    padding: "2mm",
    marginBottom: "3mm",
  },
  adjustedBadge: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "7.5pt",
    background: "#fff8e6",
    border: "1px solid #f0d080",
    borderRadius: "2px",
    padding: "1.5mm 3mm",
    marginBottom: "3mm",
    fontWeight: 600,
    color: "#7a4a00",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTop: "1px dashed #aaa",
    paddingTop: "3mm",
    marginTop: "2mm",
  },
  sig: {
    display: "inline-block",
    borderTop: "1px solid #1a1a1a",
    minWidth: "32mm",
    paddingTop: "2px",
    fontSize: "7pt",
    textAlign: "center",
    color: "#555",
    marginTop: "7mm",
  },
  footerCenter: {
    fontSize: "7pt",
    color: "#888",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};

export default function OldPurchaseVoucherPDF({ data }) {
  if (!data) return null;
  const { shop = {}, customer = {}, voucher = {} } = data;

  const isAdjusted = voucher.status && voucher.status.startsWith("adjusted");
  const adjustedRef =
    voucher.status === "adjusted_invoice"
      ? `Invoice: ${voucher.adjusted_invoice_no || ""}`
      : voucher.status === "adjusted_estimate"
      ? `Estimate: ${voucher.adjusted_estimate_no || ""}`
      : null;

  const shopLines = [shop.address, shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean);
  const idLines = [shop.gst_number && `GSTIN: ${shop.gst_number}`, shop.pan_number && `PAN: ${shop.pan_number}`].filter(Boolean);

  return (
    <div style={S.wrapper}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.shopName}>{shop.name || "My Jewellery Shop"}</h1>
          <div style={S.shopMeta}>
            {shopLines.join(" | ")}
            {idLines.length > 0 && <><br />{idLines.join(" | ")}</>}
          </div>
        </div>
        <div style={S.titleBlock}>
          <p style={S.docTitle}>Purchase Voucher</p>
          <table style={S.metaTable}>
            <tbody>
              <tr>
                <td style={S.metaLabel}>Voucher No</td>
                <td>{voucher.voucher_no || "—"}</td>
              </tr>
              <tr>
                <td style={S.metaLabel}>Date</td>
                <td>{voucher.date || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Row */}
      <div style={S.infoRow}>
        <div style={S.box}>
          <div style={S.boxLabel}>Customer</div>
          <div style={S.boxValue}>
            {customer.name || "Walk-in Customer"}
            {customer.phone && <><br /><span style={{ fontWeight: 400, color: "#555" }}>{customer.phone}</span></>}
            {customer.address && <><br /><span style={{ fontWeight: 400, color: "#777", fontSize: "7pt" }}>{customer.address}</span></>}
          </div>
        </div>
        <div style={S.box}>
          <div style={S.boxLabel}>Metal Details</div>
          <div style={{ fontSize: "8pt", lineHeight: 1.9 }}>
            <div>
              <span style={{ color: "#888" }}>Type: </span>
              <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{voucher.metal_type || "Gold"}</span>
              <span style={{ color: "#888", marginLeft: 8 }}>Purity: </span>
              <span style={{ fontWeight: 600 }}>{voucher.purity || "—"}</span>
            </div>
            <div>
              <span style={{ color: "#888" }}>Articles: </span>
              <span style={{ fontWeight: 600 }}>{voucher.no_of_articles || 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Adjusted badge */}
      {isAdjusted && (
        <div style={S.adjustedBadge}>
          <span>Status</span>
          <span>Adjusted against {adjustedRef}</span>
        </div>
      )}

      {/* Items Table */}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Description</th>
            <th style={{ ...S.th, ...S.thR }}>Gross Wt (g)</th>
            <th style={{ ...S.th, ...S.thR }}>Net Wt (g)</th>
            <th style={{ ...S.th, ...S.thR }}>Rate/10g</th>
            <th style={{ ...S.th, ...S.thR }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={S.td}>{voucher.description || `${(voucher.metal_type || "Gold").toUpperCase()} Metal Purchase`}</td>
            <td style={{ ...S.td, ...S.tdR }}>{Number(voucher.gross_weight || 0).toFixed(3)}</td>
            <td style={{ ...S.td, ...S.tdR }}>{Number(voucher.net_weight || 0).toFixed(3)}</td>
            <td style={{ ...S.td, ...S.tdR }}>{fmtRupee(voucher.rate_per_10gm)}</td>
            <td style={{ ...S.td, ...S.tdR, fontWeight: 700 }}>{fmtRupee(voucher.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={S.tfootTd}>Total Purchase Amount</td>
            <td style={{ ...S.tfootTd, textAlign: "right" }}>{fmtRupee(voucher.amount)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {voucher.notes && (
        <div style={S.notes}>
          <strong>Notes:</strong> {voucher.notes}
        </div>
      )}

      {/* Footer / Signatures */}
      <div style={S.footer}>
        <div><div style={S.sig}>Customer Signature</div></div>
        <div style={S.footerCenter}>Original — Purchase Voucher</div>
        <div style={{ textAlign: "right" }}><div style={S.sig}>Authorised Signatory</div></div>
      </div>
    </div>
  );
}
