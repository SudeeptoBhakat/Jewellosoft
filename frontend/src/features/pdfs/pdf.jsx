import React from "react";
import ClassicTemplate from "./templates/ClassicTemplate";
import StandardTemplate from "./templates/StandardTemplate";
import CreditNoteTemplate from "./templates/CreditNoteTemplate";

export default function InvoicePDF({ data }) {
    if (!data) return null;

    if (data.isCreditNote) {
        return <CreditNoteTemplate data={data} />;
    }

    const template = data.template || "classic";

    switch (template) {
        case "standard":
            return <StandardTemplate data={data} />;
        case "classic":
        default:
            return <ClassicTemplate data={data} />;
    }
}