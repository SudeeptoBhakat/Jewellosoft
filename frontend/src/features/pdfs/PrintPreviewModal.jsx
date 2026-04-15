import React, { useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import InvoicePDF from './pdf';

export default function PrintPreviewModal({ isOpen, onClose, data }) {
    const printRef = useRef(null);
    const [printing, setPrinting] = useState(false);

    /* ─── PDF Display Options ─── */
    const [hideMetalValue, setHideMetalValue] = useState(false);
    const [hideMaking, setHideMaking] = useState(false);

    /* ─── Inject hide flags into data for templates ─── */
    const pdfData = useMemo(() => {
        if (!data) return null;
        return {
            ...data,
            hideMetalValue,
            hideMaking,
        };
    }, [data, hideMetalValue, hideMaking]);

    const handlePrint = async () => {
        if (window.electronAPI) {
            setPrinting(true);
            try {
                // Determine a nice filename based on the data
                const filename = `${data.docType?.replace(' ', '_') || 'Document'}_${data.meta?.number || 'TBD'}.pdf`;
                const res = await window.electronAPI.printToPDF(filename);
                if (res.success) {
                    onClose(); // Close on success
                } else if (res.reason !== 'canceled') {
                    alert(`Failed to save PDF: ${res.error}`);
                }
            } catch (err) {
                alert(`Print Error: ${err.message}`);
            } finally {
                setPrinting(false);
            }
        } else {
            // Web browser fallback
            window.print();
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
                            {printing ? ' Saving PDF...' : ' Confirm Print'}
                        </button>
                        <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} disabled={printing}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                {/* ─── PDF Options Bar ─── */}
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
                </div>

                {/* Scrollable Preview Area */}
                <div style={{ flex: 1, overflowY: 'auto', background: '#e2e8f0', padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                        <InvoicePDF data={pdfData} />
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
                        <InvoicePDF data={pdfData} />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
