import { useState, useRef } from 'react';
import { parseImportFile, downloadSampleTemplate } from '../../utils/exportUtils';
import { toast } from '../../utils/toast';

export default function DataImportModal({
  isOpen,
  onClose,
  title = 'Import Data',
  moduleName = 'Data',
  columns = [],
  sampleRows = [],
  onImport,
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [headerError, setHeaderError] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const normalizeStr = (str) =>
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setHeaderError(null);
    setParsedData(null);
    setParsing(true);

    try {
      const { headers, rows } = await parseImportFile(selectedFile);

      const headerMap = {};
      const missingRequired = [];
      const normalizedHeaders = headers.map(normalizeStr);

      columns.forEach((col) => {
        const matchAliases = [col.label, col.key, ...(col.aliases || [])].map(normalizeStr);
        let foundIdx = -1;

        for (let i = 0; i < normalizedHeaders.length; i++) {
          if (matchAliases.includes(normalizedHeaders[i])) {
            foundIdx = i;
            break;
          }
        }

        if (foundIdx !== -1) {
          headerMap[col.key] = foundIdx;
        } else if (col.required) {
          missingRequired.push(col.label);
        }
      });

      if (missingRequired.length > 0) {
        setHeaderError({
          missing: missingRequired,
          found: headers.filter(Boolean),
        });
        setParsing(false);
        return;
      }

      const validRows = [];
      const invalidRows = [];

      rows.forEach((rawRow, idx) => {
        const rowNum = idx + 2;
        const rowObj = {};
        const errors = [];

        columns.forEach((col) => {
          const colIdx = headerMap[col.key];
          const rawCell = colIdx !== undefined ? rawRow[colIdx] : '';
          const cellVal = String(rawCell !== undefined && rawCell !== null ? rawCell : '').trim();

          if (col.required && !cellVal) {
            errors.push(`${col.label} is required`);
          }

          if (col.validate && cellVal) {
            const err = col.validate(cellVal, rawRow);
            if (err) errors.push(err);
          }

          rowObj[col.key] = col.transform ? col.transform(cellVal, rawRow) : cellVal;
        });

        if (errors.length > 0) {
          invalidRows.push({ rowNum, data: rowObj, errors });
        } else {
          validRows.push({ rowNum, data: rowObj });
        }
      });

      setParsedData({
        totalRows: rows.length,
        validRows,
        invalidRows,
      });
    } catch (err) {
      setHeaderError({
        general: err.message || 'Failed to read the file. Please ensure it is a valid Excel or CSV file.',
      });
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleReset = () => {
    setFile(null);
    setHeaderError(null);
    setParsedData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async () => {
    if (!parsedData || parsedData.validRows.length === 0) return;
    setImporting(true);

    try {
      const itemsToImport = parsedData.validRows.map((r) => r.data);
      const res = await onImport(itemsToImport);

      if (res && res.success === false) {
        toast.error(res.error || 'Failed to import data.');
      } else {
        const count = res?.count ?? itemsToImport.length;
        toast.success(`Successfully imported ${count} record(s)!`);
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Import failed.';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal__header" style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--border-color)' }}>
          <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-file-import" style={{ color: 'var(--color-primary)' }}></i>
            <span>{title}</span>
          </h2>
          <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style={{ padding: 'var(--space-6)', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-4)',
              padding: '12px 16px',
              background: 'var(--bg-surface-secondary, rgba(0,0,0,0.03))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>Official Format Template</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Download a clean sample file with the exact required headings.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => downloadSampleTemplate(columns, sampleRows, moduleName, 'xlsx')}
              >
                <i className="fa-solid fa-file-excel" style={{ color: '#16a34a' }}></i> Excel Template
              </button>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => downloadSampleTemplate(columns, sampleRows, moduleName, 'csv')}
              >
                <i className="fa-solid fa-file-csv" style={{ color: '#0284c7' }}></i> CSV Template
              </button>
            </div>
          </div>

          {!parsedData && !headerError && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color-focus, #3b82f6)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8)',
                textAlign: 'center',
                background: 'var(--bg-surface)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '2.5rem', color: 'var(--color-primary)', marginBottom: 12 }}></i>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>
                {parsing ? 'Parsing file...' : 'Choose a file or drag & drop here'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supports Excel (.xlsx, .xls) and CSV (.csv)</div>
            </div>
          )}

          {headerError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 600, marginBottom: 8 }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>File Header Mismatch</span>
              </div>
              {headerError.missing && (
                <>
                  <p style={{ fontSize: '0.85rem', marginBottom: 8 }}>
                    The uploaded file is missing the following required column heading(s):
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: '#dc2626', marginBottom: 12 }}>
                    {headerError.missing.map((col, i) => (
                      <li key={i}><strong>{col}</strong></li>
                    ))}
                  </ul>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Columns found in your file: {headerError.found?.length > 0 ? headerError.found.join(', ') : 'None'}
                  </p>
                </>
              )}
              {headerError.general && (
                <p style={{ fontSize: '0.85rem', color: '#dc2626' }}>{headerError.general}</p>
              )}
              <div style={{ marginTop: 14 }}>
                <button type="button" className="btn btn--outline btn--sm" onClick={handleReset}>
                  <i className="fa-solid fa-arrow-rotate-left"></i> Select Another File
                </button>
              </div>
            </div>
          )}

          {parsedData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(22, 163, 74, 0.12)',
                      color: '#16a34a',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    ✓ {parsedData.validRows.length} Valid Record(s)
                  </span>
                  {parsedData.invalidRows.length > 0 && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#dc2626',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      ⚠ {parsedData.invalidRows.length} Skipped / Error(s)
                    </span>
                  )}
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleReset}>
                  <i className="fa-solid fa-arrow-rotate-left"></i> Change File
                </button>
              </div>

              {parsedData.invalidRows.length > 0 && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', marginBottom: 6 }}>
                    Validation Issues Found in {parsedData.invalidRows.length} Row(s):
                  </div>
                  {parsedData.invalidRows.map((inv, idx) => (
                    <div key={idx} style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                      <strong>Row {inv.rowNum}:</strong> {inv.errors.join('; ')}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>
                  Preview of Valid Records ({Math.min(parsedData.validRows.length, 5)} of {parsedData.validRows.length}):
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <table className="data-table" style={{ margin: 0, fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '45px' }}>#</th>
                        {columns.map((c) => (
                          <th key={c.key}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.validRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.rowNum}</td>
                          {columns.map((c) => (
                            <td key={c.key}>{String(row.data[c.key] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'var(--bg-surface)',
          }}
        >
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={executeImport}
            disabled={!parsedData || parsedData.validRows.length === 0 || importing}
          >
            {importing ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, marginRight: 6 }}></div>
                Importing...
              </>
            ) : (
              <>
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span>Import {parsedData?.validRows?.length || 0} Record(s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
