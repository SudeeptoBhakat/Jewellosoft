export function shortNo(no) {
  if (!no) return '—';
  const s = String(no);
  const last = s.split('-').pop();
  return last ? `#${last}` : `#${s}`;
}
