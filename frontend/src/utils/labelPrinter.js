import { generateBarcodeSvg } from './code128';

const SETTINGS_KEY = 'jewellosoft_barcode_printer_settings';
const BILL_SETTINGS_KEY = 'jewellosoft_bill_printer_settings';
const SETTINGS_MIGRATION_VERSION = 11;
const MIGRATION_KEY = 'jewellosoft_barcode_printer_migration_v';

export const DEFAULT_BILL_PRINTER_SETTINGS = {
  printerName: '',
  outputMode: 'direct', // 'direct' (instant print) | 'pdf' (save as PDF)
  paperSize: 'A4',      // 'A4' | 'A5' | '80mm'
  silent: true,
  copies: 1,
};

export const DEFAULT_PRINTER_SETTINGS = {
  printerName: '',
  tagType: 'dumbbell',
  labelWidthMm: 70,
  labelHeightMm: 11,
  bodyWidthMm: 50,
  leftMarginMm: 0,
  topMarginMm: 0.2,
  barcodeHeightMm: 8.5,
  moduleWidth: 2.4,
  fontSizePt: 5.5,
  copies: 1,
  autoPrintOnCreate: true,
};

export function getBillPrinterSettings() {
  try {
    const raw = localStorage.getItem(BILL_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_BILL_PRINTER_SETTINGS };
    return { ...DEFAULT_BILL_PRINTER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BILL_PRINTER_SETTINGS };
  }
}

export function saveBillPrinterSettings(settings) {
  try {
    localStorage.setItem(BILL_SETTINGS_KEY, JSON.stringify({ ...getBillPrinterSettings(), ...settings }));
  } catch {}
}

function migrateSettingsIfNeeded() {
  try {
    if (localStorage.getItem(MIGRATION_KEY + SETTINGS_MIGRATION_VERSION)) return;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        ...DEFAULT_PRINTER_SETTINGS,
        ...stored,
        tagType: stored.tagType || 'dumbbell',
        bodyWidthMm: 50,
        leftMarginMm: 0,
        topMarginMm: 0.2,
        barcodeHeightMm: 8.5,
        moduleWidth: 2.0,
        fontSizePt: stored.fontSizePt || 5.5,
      }));
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
  if (window.electronAPI?.listPrinters) return window.electronAPI.listPrinters();
  return [];
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function buildLabelHtml(product, shopName, settings = getPrinterSettings()) {
  const merged = { ...DEFAULT_PRINTER_SETTINGS, ...settings };
  const {
    labelWidthMm, labelHeightMm, bodyWidthMm,
    leftMarginMm, topMarginMm,
    barcodeHeightMm, moduleWidth, fontSizePt, tagType,
  } = merged;

  const bcText = String(product.barcode || '').trim() || '00000';

  const bcSvgH = Math.max(20, Math.round(barcodeHeightMm * 7));

  const bcSvg = generateBarcodeSvg(bcText, {
    symbology: 'code128',
    moduleWidth: parseFloat(moduleWidth) || 2.0,
    height: bcSvgH,
    showText: false,
    quietZone: 4,
  });

  const weight = product.net_weight ? `${Number(product.net_weight).toFixed(3)}g` : '';
  const meta = [
    product.purity,
    weight,
    product.huid ? `H:${product.huid}` : '',
  ].filter(Boolean).join(' | ');

  const isDumbbell = tagType === 'dumbbell';

  if (isDumbbell) {
    const sideAMm   = (bodyWidthMm * 0.52).toFixed(2);
    const sideBMm   = (bodyWidthMm * 0.48).toFixed(2);

    const hrtMaxChars = Math.floor(parseFloat(sideBMm) / (5 * 0.35 * 0.6));
    const hrtText = bcText.length > hrtMaxChars
      ? bcText.slice(0, hrtMaxChars - 1) + '…'
      : bcText;
    const hrtPt = Math.min(7, Math.max(4.5, parseFloat(sideBMm) * 0.28));

    const shopPt = (parseFloat(fontSizePt) + 0.5).toFixed(1);
    const namePt = parseFloat(fontSizePt).toFixed(1);
    const metaPt = Math.max(3.5, parseFloat(fontSizePt) - 0.8).toFixed(1);

    const bcBoxMm  = (barcodeHeightMm - hrtPt * 0.36).toFixed(2);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 0 !important; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html {
    width: ${labelWidthMm}mm; height: ${labelHeightMm}mm;
    margin: 0 !important; padding: 0 !important;
    margin-left: -3mm !important;
    overflow: hidden; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  body {
    width: ${labelWidthMm}mm; height: ${labelHeightMm}mm;
    margin: 0 !important; padding: 0 !important;
    overflow: hidden; background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .lc {
    width: ${labelWidthMm}mm; height: ${labelHeightMm}mm;
    display: flex; flex-direction: row; overflow: hidden;
  }

  .lb {
    width: ${bodyWidthMm}mm; min-width: ${bodyWidthMm}mm; max-width: ${bodyWidthMm}mm;
    height: ${labelHeightMm}mm; display: flex; flex-direction: row; overflow: hidden;
  }
  /* Side A */
  .la {
    width: ${sideAMm}mm; min-width: ${sideAMm}mm; max-width: ${sideAMm}mm;
    height: ${labelHeightMm}mm;
    display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
    padding-left: ${Math.max(0, parseFloat(leftMarginMm))}mm;
    padding-top: ${topMarginMm}mm; padding-right: 0.4mm; padding-bottom: 0.2mm;
    overflow: hidden;
  }
  .ls { font-size: ${shopPt}pt; font-weight: 800; line-height: 1.1;
        word-break: break-word; overflow-wrap: break-word;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden; max-width: 100%; color: #000; }
  .ln { font-size: ${namePt}pt; font-weight: 700; line-height: 1.1;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: 100%; margin-top: 0.1mm; color: #000; }
  .lm { font-size: ${metaPt}pt; font-weight: 500; line-height: 1.1;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: 100%; margin-top: 0.1mm; color: #000; }
  /* Side B */
  .lb2 {
    width: ${sideBMm}mm; min-width: ${sideBMm}mm; max-width: ${sideBMm}mm;
    height: ${labelHeightMm}mm;
    display: flex; flex-direction: column; align-items: stretch; justify-content: center;
    padding: ${topMarginMm}mm 0.2mm 0.1mm 0mm; overflow: hidden;
  }
  /* Barcode bars */
  .lbc {
    width: 100%; height: ${bcBoxMm}mm; max-height: ${bcBoxMm}mm;
    overflow: hidden; display: block; flex-shrink: 0;
  }
  .lbc svg {
    width: 100% !important; height: 100% !important; display: block;
    shape-rendering: crispEdges; image-rendering: pixelated;
  }

  .lhrt {
    width: 100%; font-family: 'Courier New', Courier, monospace;
    font-size: ${hrtPt.toFixed(1)}pt; font-weight: 700; line-height: 1;
    text-align: center; white-space: nowrap; overflow: hidden;
    color: #000; margin-top: 0.15mm; flex-shrink: 0;
  }
  /* Tail */
  .ltail { flex: 1; height: ${labelHeightMm}mm; background: #fff; }
</style>
</head>
<body>
<div class="lc">
  <div class="lb">
    <div class="la">
      ${shopName ? `<div class="ls">${escapeHtml(shopName)}</div>` : ''}
      <div class="ln">${escapeHtml(product.name || '')}</div>
      ${meta ? `<div class="lm">${escapeHtml(meta)}</div>` : ''}
    </div>
    <div class="lb2">
      <div class="lbc">${bcSvg}</div>
      <div class="lhrt">${escapeHtml(hrtText)}</div>
    </div>
  </div>
  <div class="ltail"></div>
</div>
</body>
</html>`;
  }

  const bcSvg2 = generateBarcodeSvg(bcText, {
    symbology: 'code128', moduleWidth: parseFloat(moduleWidth) || 2.0,
    height: 36, showText: false, quietZone: 4,
  });
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${labelWidthMm}mm ${labelHeightMm}mm; margin: 0 !important; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { width:${labelWidthMm}mm; height:${labelHeightMm}mm; margin-left:-3mm !important;
         overflow:hidden; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { width:${labelWidthMm}mm; height:${labelHeightMm}mm; display:flex; flex-direction:row;
         align-items:center; justify-content:space-between;
         padding-left:${Math.max(0,parseFloat(leftMarginMm))}mm;
         padding-top:${topMarginMm}mm; padding-right:0.5mm;
         overflow:hidden; background:#fff; font-family:Arial,Helvetica,sans-serif;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .ri { flex:1; display:flex; flex-direction:column; justify-content:center; overflow:hidden; padding-right:1mm; }
  .rs { font-size:${(parseFloat(fontSizePt)+0.5).toFixed(1)}pt; font-weight:800; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#000; }
  .rn { font-size:${parseFloat(fontSizePt).toFixed(1)}pt; font-weight:700; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:0.2mm; color:#000; }
  .rm { font-size:${Math.max(3.5,parseFloat(fontSizePt)-0.8).toFixed(1)}pt; font-weight:500; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:0.2mm; color:#000; }
  .rb { display:flex; flex-direction:column; align-items:center; flex-shrink:0; }
  .rbc { height:${barcodeHeightMm}mm; overflow:hidden; }
  .rbc svg { height:100%; display:block; shape-rendering:crispEdges; image-rendering:pixelated; }
  .rhrt { font-family:'Courier New',monospace; font-size:5pt; font-weight:700; text-align:center; color:#000; margin-top:0.2mm; white-space:nowrap; overflow:hidden; }
</style></head>
<body>
  <div class="ri">
    ${shopName ? `<div class="rs">${escapeHtml(shopName)}</div>` : ''}
    <div class="rn">${escapeHtml(product.name || '')}</div>
    ${meta ? `<div class="rm">${escapeHtml(meta)}</div>` : ''}
  </div>
  <div class="rb">
    <div class="rbc">${bcSvg2}</div>
    <div class="rhrt">${escapeHtml(bcText)}</div>
  </div>
</body></html>`;
}

export async function printBarcodeLabel(product, shopName, overrides = {}) {
  if (!product?.barcode) return { success: false, error: 'Product has no barcode.' };
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
    const w = window.open('', '_blank', 'width=600,height=350');
    if (!w) { resolve({ success: false, error: 'Pop-up blocked.' }); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => {
      try { w.print(); w.close(); resolve({ success: true }); }
      catch (e) { resolve({ success: false, error: e.message }); }
    }, 350);
  });
}
export async function printTestBill(shopName = 'JewelloSoft Jewellery', overrides = {}) {
  const settings = { ...getBillPrinterSettings(), ...overrides };
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Bill Print</title>
  <style>
    @page { size: ${settings.paperSize === 'A5' ? 'A5' : 'A4'}; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; padding: 20px; line-height: 1.5; }
    .header { border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 16px; text-align: center; }
    .title { font-size: 20px; font-weight: bold; color: #0f172a; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    .table th { background: #f8fafc; font-weight: 600; }
    .footer { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(shopName)}</div>
    <div class="subtitle">JewelloSoft Hardware Diagnostic & Test Invoice</div>
    <div class="badge">BILL PRINTER TEST SUCCESSFUL</div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th>Target Printer</th>
        <th>Paper Size</th>
        <th>Mode</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${escapeHtml(settings.printerName || 'System Default')}</strong></td>
        <td>${escapeHtml(settings.paperSize || 'A4')}</td>
        <td>${escapeHtml(settings.outputMode === 'pdf' ? 'PDF Export' : 'Direct Hardware Spool')}</td>
        <td>${new Date().toLocaleString()}</td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
    <strong>Hardware Alignment:</strong> If you are seeing this document printed clearly, your Bill & Document printer is properly configured and communicating with JewelloSoft.
  </div>
  <div class="footer">
    Generated by JewelloSoft POS & Inventory System
  </div>
</body>
</html>`;

  if (window.electronAPI?.printDocument) {
    return window.electronAPI.printDocument({
      html,
      deviceName: settings.printerName || undefined,
      pageSize: settings.paperSize || 'A4',
      silent: settings.silent !== false,
      copies: 1,
    });
  }

  return new Promise((resolve) => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) { resolve({ success: false, error: 'Pop-up blocked.' }); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => {
      try { w.print(); w.close(); resolve({ success: true }); }
      catch (e) { resolve({ success: false, error: e.message }); }
    }, 400);
  });
}

