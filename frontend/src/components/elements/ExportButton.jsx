import { useState, useRef, useEffect } from 'react';
import { exportToExcel, exportToCSV } from '../../utils/exportUtils';

export default function ExportButton({
  data = [],
  columns = [],
  filename = 'Export',
  sheetName = 'Data',
  className = 'btn btn--ghost btn--sm',
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleExportExcel = () => {
    exportToExcel(data, columns, filename, sheetName);
    setOpen(false);
  };

  const handleExportCSV = () => {
    exportToCSV(data, columns, filename);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={dropdownRef}>
      <button
        type="button"
        className={className}
        onClick={() => setOpen((prev) => !prev)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <i className="fa-solid fa-download"></i>
        <span>Export</span>
        <i className="fa-solid fa-chevron-down" style={{ fontSize: '0.7rem', opacity: 0.7 }}></i>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 1000,
            minWidth: '170px',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05))',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary, #1e293b)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm, 4px)',
              textAlign: 'left',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover, rgba(0,0,0,0.05))')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="fa-solid fa-file-excel" style={{ color: '#16a34a', width: '16px' }}></i>
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary, #1e293b)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm, 4px)',
              textAlign: 'left',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover, rgba(0,0,0,0.05))')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <i className="fa-solid fa-file-csv" style={{ color: '#0284c7', width: '16px' }}></i>
            <span>Export CSV (.csv)</span>
          </button>
        </div>
      )}
    </div>
  );
}
