import { code128Svg } from './code128';

const SETTINGS_KEY = 'jewellosoft_barcode_printer_settings';
const SETTINGS_MIGRATION_VERSION = 5;
const MIGRATION_KEY = 'jewellosoft_barcode_printer_migration_v';

export const DEFAULT_PRINTER_SETTINGS = {
  printerName: '',
  labelWidthMm: 70,
  labelHeightMm: 11,
  copies: 1,
  autoPrintOnCreate: true,
};

function migrateSettingsIfNeeded() {
  try {
    if (localStorage.getItem(MIGRATION_KEY + SETTINGS_MIGRATION_VERSION)) return;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.labelWidthMm !== 70 || stored.labelHeightMm !== 11) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          ...stored,
          labelWidthMm: 70,
          labelHeightMm: 11,
        }));
      }
    }
    localStorage.setItem(MIGRATION_KEY + SETTINGS_MIGRATION_VERSION, '1');
  } catch {}
}
migrateSettingsIfNeeded();

export function getPrinterSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_SETTINGS };
    return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

export function savePrinterSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getPrinterSettings(), ...settings }));
  } catch {}
}

export async function listSystemPrinters() {
  if (window.electronAPI?.listPrinters) {
    return window.electronAPI.listPrinters();
  }
  return [];
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function buildLabelHtml(product, shopName, settings = getPrinterSettings()) {
  const { labelWidthMm, labelHeightMm } = settings;

  const svg = code128Svg(product.barcode, {
    moduleWidth: 1.5,
    height: 24,
    showText: true,
    fontSize: 7,
    quietZone: 2,
  });

  const weight = product.net_weight ? `${Number(product.net_weight).toFixed(3)}g` : '';
  const meta = [product.purity, weight, product.huid].filter(Boolean).join(' | ');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: ${labelWidthMm}mm ${labelHeightMm}mm;
    margin: 0;
  }
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html, body {
    width: ${labelWidthMm}mm;
    height: ${labelHeightMm}mm;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
  }
  body {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 0.4mm 0.8mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .lbl-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    padding-right: 0.8mm;
  }
  .lbl-shop {
    font-size: 6pt;
    font-weight: bold;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #000000;
  }
  .lbl-name {
    font-size: 5.5pt;
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.2mm;
    color: #000000;
  }
  .lbl-meta {
    font-size: 4.8pt;
    font-weight: normal;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #000000;
    margin-top: 0.2mm;
  }
  .lbl-bc {
    width: 17mm;
    min-width: 17mm;
    max-width: 17mm;
    height: 6.3mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .lbl-bc svg {
    width: 100%;
    height: 6.3mm;
    display: block;
    image-rendering: pixelated;
    shape-rendering: crispEdges;
  }
</style>
</head>
<body>
  <div class="lbl-info">
    ${shopName ? `<div class="lbl-shop">${escapeHtml(shopName)}</div>` : ''}
    <div class="lbl-name">${escapeHtml(product.name || '')}</div>
    ${meta ? `<div class="lbl-meta">${escapeHtml(meta)}</div>` : ''}
  </div>
  <div class="lbl-bc">${svg}</div>
</body>
</html>`;
}

export async function printBarcodeLabel(product, shopName, overrides = {}) {
  if (!product?.barcode) {
    return { success: false, error: 'Product has no barcode.' };
  }

  const settings = { ...getPrinterSettings(), ...overrides };
  const html = buildLabelHtml(product, shopName, settings);

  if (window.electronAPI?.printBarcodeLabel) {
    return window.electronAPI.printBarcodeLabel({
      html,
      printerName: settings.printerName || undefined,
      widthMicrons: Math.round(settings.labelWidthMm * 1000),
      heightMicrons: Math.round(settings.labelHeightMm * 1000),
      copies: settings.copies,
    });
  }

  return new Promise((resolve) => {
    const printWin = window.open('', '_blank', 'width=500,height=300');
    if (!printWin) {
      resolve({ success: false, error: 'Pop-up blocked. Please allow popups to print.' });
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try {
        printWin.print();
        printWin.close();
        resolve({ success: true });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    }, 250);
  });
}
