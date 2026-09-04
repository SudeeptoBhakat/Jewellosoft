import * as XLSX from 'xlsx';

function formatFilename(name) {
  const dateStr = new Date().toISOString().split('T')[0];
  const cleanName = (name || 'Export').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `JewelloSoft_${cleanName}_${dateStr}`;
}

export function exportToExcel(data = [], columns = [], baseFilename = 'Data', sheetName = 'Sheet1') {
  const headers = columns.map(c => c.label);
  const rows = (data.length > 0)
    ? data.map(item => {
        const row = {};
        columns.forEach(col => {
          const rawVal = col.key.includes('.')
            ? col.key.split('.').reduce((acc, part) => acc?.[part], item)
            : item[col.key];
          row[col.label] = col.transform ? col.transform(rawVal, item) : (rawVal ?? '');
        });
        return row;
      })
    : [];

  let ws;
  if (rows.length > 0) {
    ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  } else {
    ws = XLSX.utils.aoa_to_sheet([headers]);
  }

  const colWidths = columns.map(col => {
    let maxLen = col.label.length;
    rows.forEach(r => {
      const valStr = String(r[col.label] ?? '');
      if (valStr.length > maxLen) maxLen = Math.min(valStr.length, 45);
    });
    return { wch: Math.max(maxLen + 4, 14) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const fullFilename = `${formatFilename(baseFilename)}.xlsx`;
  XLSX.writeFile(wb, fullFilename);
}

export function exportToCSV(data = [], columns = [], baseFilename = 'Data') {
  const headers = columns.map(c => c.label);
  const rows = (data.length > 0)
    ? data.map(item => {
        return columns.map(col => {
          const rawVal = col.key.includes('.')
            ? col.key.split('.').reduce((acc, part) => acc?.[part], item)
            : item[col.key];
          const val = col.transform ? col.transform(rawVal, item) : (rawVal ?? '');
          return val;
        });
      })
    : [];

  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${formatFilename(baseFilename)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSampleTemplate(columns = [], sampleRows = [], baseFilename = 'Template', format = 'xlsx') {
  const filename = `${baseFilename}_Template`;
  if (format === 'csv') {
    exportToCSV(sampleRows, columns, filename);
  } else {
    exportToExcel(sampleRows, columns, filename, 'Template');
  }
}

export async function parseImportFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file contains no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  const rawHeaders = (rawRows[0] || []).map(h => String(h || '').trim());
  const dataRows = rawRows.slice(1).filter(row => row.some(cell => String(cell || '').trim() !== ''));

  return {
    headers: rawHeaders,
    rows: dataRows
  };
}
