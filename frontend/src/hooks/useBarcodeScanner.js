import { useEffect, useRef } from 'react';

const BURST_MAX_INTERVAL_MS = 50;
const MIN_SCAN_LENGTH = 3;

export default function useBarcodeScanner(onScan, { enabled = true, allowInputIds = [] } = {}) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const callbackRef = useRef(onScan);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const target = e.target;
      const isEditable = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
      const isAllowedInput = isEditable && allowInputIds.includes(target.id);
      if (isEditable && !isAllowedInput) {
        bufferRef.current = '';
        return;
      }

      const now = performance.now();
      if (now - lastKeyTimeRef.current > BURST_MAX_INTERVAL_MS) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= MIN_SCAN_LENGTH) {
          e.preventDefault();
          e.stopPropagation();
          callbackRef.current?.(code);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled, allowInputIds.join(',')]);
}
