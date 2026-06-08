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