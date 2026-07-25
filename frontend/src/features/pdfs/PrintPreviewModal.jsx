import React, { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import InvoicePDF from './pdf';
import { toast } from '../../utils/toast';

export default function PrintPreviewModal({ isOpen, onClose, data, CustomPDFTemplate, onConfirmPrint }) {
    const PDFComponent = CustomPDFTemplate || InvoicePDF;
    // console.log(data);
    const printRef = useRef(null);
    const [printing, setPrinting] = useState(false);

    /* ─── PDF Display Options ─── */
    const [hideMetalValue, setHideMetalValue] = useState(false);
    const [hideMaking, setHideMaking] = useState(false);
    const [hideCustomerDetails, setHideCustomerDetails] = useState(false);
    /* Voucher-only: rate is shown by default; user can hide it on demand. */
    const [hideRate, setHideRate] = useState(false);

    /*
     * When onConfirmPrint is provided (creation flows: new bill / order / voucher),
     * the record is NOT persisted until the user confirms print in this preview.
     * `confirmedData` holds the backend response (with the real document number)
     * after a successful save so the printout reflects the saved record. It also
     * acts as a guard so we never save the same form twice if the native save
     * dialog is canceled and the user retries.
     */
    const [confirmedData, setConfirmedData] = useState(null);

    /* Reset the one-time save guard whenever a fresh preview is opened. */
    React.useEffect(() => {
        if (isOpen) setConfirmedData(null);
    }, [isOpen, data]);

    /* ─── Inject hide flags into data for templates ─── */
    const pdfData = useMemo(() => {
        const base = confirmedData || data;
        if (!base) return null;
        // console.log(base);
        return {
            ...base,
            hideMetalValue,
            hideMaking,
            hideCustomerDetails,
            hideRate,
        };
    }, [data, confirmedData, hideMetalValue, hideMaking, hideCustomerDetails, hideRate]);

    /* Render/save/print the physical document (native PDF in desktop, window.print on web). */
    const doPhysicalPrint = async (activeData) => {
        if (window.electronAPI) {
            // Determine a nice filename based on the data
            const filename = `${activeData.docType?.replace(' ', '_') || 'Document'}_${activeData.meta?.number || 'TBD'}.pdf`;
            const res = await window.electronAPI.printToPDF(filename);
            if (res.success) {
                onClose(); // Close on success
            } else if (res.reason !== 'canceled') {
                toast.error(`Failed to save PDF: ${res.error}`);
            }
        } else {
            // Web browser fallback
            window.print();
        }
    };

    const handlePrint = async () => {
        setPrinting(true);
        try {
            let activeData = confirmedData || data;

            // Creation flow: persist to backend on confirm, only once.
            if (onConfirmPrint && !confirmedData) {
                const result = await onConfirmPrint();
                if (!result || result.success === false) {
                    // Save failed — keep the preview open so the user can retry.
                    return;
                }
                // Prefer the freshly-numbered data returned by the save handler.
                activeData = result.data || result || data;
                setConfirmedData(activeData);
            }

            await doPhysicalPrint(activeData);
        } catch (err) {
            toast.error(`Print Error: ${err.message}`);
        } finally {
            setPrinting(false);
        }
    };

    if (!isOpen || !data) return null;

    return (
        <>
            {/* Dark Overlay - Hidden when printing */}
            <div className="overlay no-print" onClick={onClose} style={{ zIndex: 10000 }}></div>

            {/* Modal Container - Hidden when printing */}
            <div className="modal no-print" style={{ maxWidth: '850px', width: '95%', zIndex: 10001, height: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal__header" style={{ flexShrink: 0 }}>
                    <h2 className="modal__title">
                        <i className="fa-solid fa-file-pdf" style={{ color: 'var(--color-danger)', marginRight: 10 }}></i>
                        Print Preview
                    </h2>
                    <div className="flex gap-2">
                        <button className="btn btn--primary btn--sm" onClick={handlePrint} disabled={printing}>
                            {printing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-print"></i>}
                            {printing ? (onConfirmPrint ? ' Saving...' : ' Saving PDF...') : ' Confirm Print'}
                        </button>
                        <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} disabled={printing}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                {/* ─── PDF Options Bar (invoices only) ─── */}
                {!data.isVoucher && !data.isCreditNote && (
                <div style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '10px 20px',
                    background: 'var(--bg-tertiary, #f1f5f9)',
                    borderBottom: '1px solid var(--border-primary, #e2e8f0)',
                    fontSize: 'var(--text-sm, 13px)',
                }}>
                    <span style={{ fontWeight: 700, opacity: 0.6, marginRight: 4, color: 'black' }}>
                        <i className="fa-solid fa-sliders" style={{ marginRight: 6, color: 'black' }}></i>
                        PDF Options:
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', color: 'black' }}>
                        <input
                            type="checkbox"
                            checked={hideMetalValue}
                            onChange={e => setHideMetalValue(e.target.checked)}
                            style={{ accentColor: 'var(--color-primary, #6366f1)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span>Hide Metal Value</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', color: 'black' }}>
                        <input
                            type="checkbox"
                            checked={hideMaking}
                            onChange={e => setHideMaking(e.target.checked)}
                            style={{ accentColor: 'var(--color-primary, #6366f1)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span>Hide Making Charge</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', color: 'black' }}>
                        <input
                            type="checkbox"
                            checked={hideCustomerDetails}
                            onChange={e => setHideCustomerDetails(e.target.checked)}
                            style={{ accentColor: 'var(--color-primary, #6366f1)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span>Hide Customer Details</span>
                    </label>
                </div>
                )}

                {/* ─── PDF Options Bar (vouchers only) ─── */}
                {data.isVoucher && (
                <div style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '10px 20px',
                    background: 'var(--bg-tertiary, #f1f5f9)',
                    borderBottom: '1px solid var(--border-primary, #e2e8f0)',
                    fontSize: 'var(--text-sm, 13px)',
                }}>
                    <span style={{ fontWeight: 700, opacity: 0.6, marginRight: 4, color: 'black' }}>
                        <i className="fa-solid fa-sliders" style={{ marginRight: 6, color: 'black' }}></i>
                        PDF Options:
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', color: 'black' }}>
                        <input
                            type="checkbox"
                            checked={hideRate}
                            onChange={e => setHideRate(e.target.checked)}
                            style={{ accentColor: 'var(--color-primary, #6366f1)', width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span>Hide Rate</span>
                    </label>
                </div>
                )}

                {/* Scrollable Preview Area */}
                <div style={{ flex: 1, overflowY: 'auto', background: '#e2e8f0', padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                        <PDFComponent data={pdfData} />
                    </div>
                </div>
            </div>

            {/* Print-Only Container visible only to browser print engine */}
            {createPortal(
                <div className="print-only-container">
                    <style>
                        {`
                            @media print {
                                body > *:not(.print-only-container) { display: none !important; }
                                .print-only-container { display: block !important; }
                                body { background-color: white !important; }
                                @page { margin: 0; size: A4; }
                            }
                            @media screen {
                                .print-only-container { display: none; }
                            }
                        `}
                    </style>
                    <div ref={printRef} style={{ width: '100%', height: '100%', backgroundColor: 'white' }}>
                        <PDFComponent data={pdfData} />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
