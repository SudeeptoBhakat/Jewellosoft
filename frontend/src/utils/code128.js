/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 *
 * Pure Code 128-B encoder → SVG. No external dependencies.
 */

const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232',
];
const STOP_PATTERN = '2331112';
const START_B = 104;

function encodeCode128B(text) {
  const values = [START_B];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new Error(`Character '${ch}' is not encodable in Code 128-B.`);
    }
    values.push(code - 32);
  }
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  values.push(checksum % 103);
  return values;
}

/**
 * Renders barcode text as an SVG string.
 * @param {string} text - value to encode (Code 128-B charset)
 * @param {object} opts - { moduleWidth, height, showText, fontSize, quietZone }
 */
export function code128Svg(text, opts = {}) {
  const {
    moduleWidth = 2,
    height = 60,
    showText = true,
    fontSize = 12,
    quietZone = 10,
  } = opts;

  const values = encodeCode128B(text);
  const patterns = values.map(v => PATTERNS[v]).join('') + STOP_PATTERN;

  let totalModules = 0;
  for (const d of patterns) totalModules += Number(d);

  const width = totalModules * moduleWidth + quietZone * 2;
  const textHeight = showText ? fontSize + 6 : 0;
  const svgHeight = height + textHeight;

  let x = quietZone;
  let bars = '';
  let isBar = true;
  for (const d of patterns) {
    const w = Number(d) * moduleWidth;
    if (isBar) bars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`;
    x += w;
    isBar = !isBar;
  }

  const label = showText
    ? `<text x="${width / 2}" y="${height + fontSize + 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000" letter-spacing="0.5">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" shape-rendering="crispEdges">` +
    `<rect width="${width}" height="${svgHeight}" fill="#fff"/>${bars}${label}</svg>`;
}

export function isCode128Encodable(text) {
  return typeof text === 'string' && text.length > 0 && [...text].every(ch => {
    const c = ch.charCodeAt(0);
    return c >= 32 && c <= 126;
  });
}
