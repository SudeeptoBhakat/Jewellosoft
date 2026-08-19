/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

const C128_PAT = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232',
];
const C128_STOP    = '2331112';
const C128_START_B = 104;
const C128_START_C = 105;
const C128_CODE_C  = 99;
const C128_CODE_B  = 100;

function encodeCode128(text) {
  const s = String(text || '').trim();

  if (/^\d+$/.test(s) && s.length >= 2) {
    const v = [C128_START_C];
    let i = 0;
    while (i < s.length) {
      if (i + 1 < s.length) { v.push(parseInt(s.slice(i, i + 2), 10)); i += 2; }
      else { v.push(C128_CODE_B); v.push(s.charCodeAt(i) - 32); i++; }
    }
    let chk = v[0];
    for (let j = 1; j < v.length; j++) chk += v[j] * j;
    v.push(chk % 103);
    return v;
  }

  const v = [C128_START_B];
  let mode = 'B', i = 0;
  while (i < s.length) {
    let dc = 0;
    while (i + dc < s.length && /\d/.test(s[i + dc])) dc++;
    const atEnd = i + dc === s.length;
    if (dc >= 4 || (dc >= 2 && atEnd && dc % 2 === 0)) {
      if (mode !== 'C') { v.push(C128_CODE_C); mode = 'C'; }
      const pairs = Math.floor(dc / 2) * 2;
      for (let k = 0; k < pairs; k += 2) v.push(parseInt(s.slice(i + k, i + k + 2), 10));
      i += pairs;
    } else {
      if (mode !== 'B') { v.push(C128_CODE_B); mode = 'B'; }
      const cc = s.charCodeAt(i);
      v.push((cc >= 32 && cc <= 126) ? cc - 32 : 31);
      i++;
    }
  }
  let chk = v[0];
  for (let j = 1; j < v.length; j++) chk += v[j] * j;
  v.push(chk % 103);
  return v;
}


export function code128Svg(text, opts = {}) {
  const {
    moduleWidth = 2.4,
    height      = 60,
    showText    = true,
    fontSize    = 10,
    quietZone   = 5,
  } = opts;

  const values  = encodeCode128(text || '10042');
  const pattern = values.map(v => C128_PAT[v]).join('') + C128_STOP;

  let totalMod = 0;
  for (const d of pattern) totalMod += Number(d);

  const qzPx     = quietZone * moduleWidth;
  const barArea   = totalMod * moduleWidth;
  const svgW      = barArea + qzPx * 2;
  const textH     = showText ? fontSize + 3 : 0;
  const svgH      = height + textH;

  let x = qzPx, isBar = true, bars = '';
  for (const d of pattern) {
    const w = Number(d) * moduleWidth;
    if (isBar) bars += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000"/>`;
    x += w; isBar = !isBar;
  }

  const hrt = showText
    ? `<text x="${(svgW / 2).toFixed(2)}" y="${(height + fontSize).toFixed(2)}"` +
      ` text-anchor="middle" font-family="'Courier New',monospace"` +
      ` font-weight="bold" font-size="${fontSize}" fill="#000">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}"` +
    ` viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" shape-rendering="crispEdges">` +
    `<rect width="${svgW}" height="${svgH}" fill="#fff"/>${bars}${hrt}</svg>`;
}


const C39_MAP = {
  /*  Char  B  s  B  s  B  s  B  s  B  */
  '0': [0, 0, 0, 1, 1, 0, 1, 0, 0],
  '1': [1, 0, 0, 0, 0, 1, 0, 0, 1],
  '2': [0, 0, 1, 0, 0, 1, 0, 0, 1],
  '3': [1, 0, 1, 0, 0, 1, 0, 0, 0],
  '4': [0, 0, 0, 0, 1, 1, 0, 0, 1],
  '5': [1, 0, 0, 0, 1, 1, 0, 0, 0],
  '6': [0, 0, 1, 0, 1, 1, 0, 0, 0],
  '7': [0, 0, 0, 0, 0, 1, 1, 0, 1],
  '8': [1, 0, 0, 0, 0, 1, 1, 0, 0],
  '9': [0, 0, 1, 0, 0, 1, 1, 0, 0],
  'A': [1, 1, 0, 0, 0, 0, 0, 0, 1],
  'B': [0, 1, 1, 0, 0, 0, 0, 0, 1],
  'C': [1, 1, 1, 0, 0, 0, 0, 0, 0],
  'D': [0, 1, 0, 0, 1, 0, 0, 0, 1],
  'E': [1, 1, 0, 0, 1, 0, 0, 0, 0],
  'F': [0, 1, 1, 0, 1, 0, 0, 0, 0],
  'G': [0, 1, 0, 0, 0, 0, 1, 0, 1],
  'H': [1, 1, 0, 0, 0, 0, 1, 0, 0],
  'I': [0, 1, 1, 0, 0, 0, 1, 0, 0],
  'J': [0, 1, 0, 0, 1, 0, 1, 0, 0],
  'K': [1, 0, 0, 1, 0, 0, 0, 0, 1],
  'L': [0, 0, 1, 1, 0, 0, 0, 0, 1],
  'M': [1, 0, 1, 1, 0, 0, 0, 0, 0],
  'N': [0, 0, 0, 1, 1, 0, 0, 0, 1],
  'O': [1, 0, 0, 1, 1, 0, 0, 0, 0],
  'P': [0, 0, 1, 1, 1, 0, 0, 0, 0],
  'Q': [0, 0, 0, 1, 0, 0, 1, 0, 1],
  'R': [1, 0, 0, 1, 0, 0, 1, 0, 0],
  'S': [0, 0, 1, 1, 0, 0, 1, 0, 0],
  'T': [0, 0, 0, 1, 1, 0, 1, 0, 0],
  'U': [1, 0, 0, 0, 0, 0, 0, 1, 1],
  'V': [0, 0, 1, 0, 0, 0, 0, 1, 1],
  'W': [1, 0, 1, 0, 0, 0, 0, 1, 0],
  'X': [0, 0, 0, 0, 1, 0, 0, 1, 1],
  'Y': [1, 0, 0, 0, 1, 0, 0, 1, 0],
  'Z': [0, 0, 1, 0, 1, 0, 0, 1, 0],
  '-': [0, 0, 0, 0, 0, 0, 1, 1, 1],
  '.': [1, 0, 0, 0, 0, 0, 1, 1, 0],
  ' ': [0, 0, 1, 0, 0, 0, 1, 1, 0],
  '$': [0, 1, 0, 1, 0, 1, 0, 0, 0],
  '/': [0, 1, 0, 1, 0, 0, 0, 1, 0],
  '+': [0, 1, 0, 0, 0, 1, 0, 1, 0],
  '%': [0, 0, 0, 1, 0, 1, 0, 1, 0],
  '*': [0, 1, 0, 0, 1, 0, 1, 0, 0], 
};

export function code39Svg(text, opts = {}) {
  const {
    moduleWidth = 2.0,
    height      = 60,
    showText    = true,
    fontSize    = 10,
    quietZone   = 10, 
  } = opts;

  const N = moduleWidth;
  const W = N * 2.5;
  const gap = N;

  const raw = String(text || '10042').toUpperCase().replace(/[^A-Z0-9\-\. \$\/\+%]/g, '');
  const encoded = '*' + (raw || '10042') + '*';

  let bars = '';
  let x = quietZone;

  for (let ci = 0; ci < encoded.length; ci++) {
    const pat = C39_MAP[encoded[ci]] || C39_MAP['*'];
    for (let j = 0; j < 9; j++) {
      const w = pat[j] === 1 ? W : N;
      if (j % 2 === 0) {
        bars += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000"/>`;
      }
      x += w;
    }
    if (ci < encoded.length - 1) x += gap;
  }

  const svgW  = x + quietZone;
  const textH = showText ? fontSize + 3 : 0;
  const svgH  = height + textH;

  const hrt = showText
    ? `<text x="${(svgW / 2).toFixed(2)}" y="${(height + fontSize).toFixed(2)}"` +
      ` text-anchor="middle" font-family="'Courier New',monospace"` +
      ` font-weight="bold" font-size="${fontSize}" fill="#000">${raw}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}"` +
    ` viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" shape-rendering="crispEdges">` +
    `<rect width="${svgW}" height="${svgH}" fill="#fff"/>${bars}${hrt}</svg>`;
}


export function generateBarcodeSvg(text, opts = {}) {
  const { symbology = 'code128', ...rest } = opts;
  return symbology === 'code39' ? code39Svg(text, rest) : code128Svg(text, rest);
}

export function isCode128Encodable(text) {
  return typeof text === 'string' && text.length > 0 &&
    [...text].every(ch => { const c = ch.charCodeAt(0); return c >= 32 && c <= 126; });
}