/**
 * ─── Invoice PDF Template Router ────────────────────────────────
 * 
 * Single entry point for all PDF rendering. Determines which
 * template to use based on `data.template` and delegates rendering.
 * 
 * Supported templates:
 *   • "classic"  — Gold/silver themed (default, the original design)
 *   • "standard" — Clean B&W minimal layout
 * 
 * All consumers (Billing, BillsList, Orders, OrdersList) import
 * this router; they never import templates directly.
 * ────────────────────────────────────────────────────────────────
 */

import React from "react";
import ClassicTemplate from "./templates/ClassicTemplate";
import StandardTemplate from "./templates/StandardTemplate";

export default function InvoicePDF({ data }) {
    if (!data) return null;

    const template = data.template || "classic";

    switch (template) {
        case "standard":
            return <StandardTemplate data={data} />;
        case "classic":
        default:
            return <ClassicTemplate data={data} />;
    }
}