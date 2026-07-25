import { useEffect, useRef } from 'react';
import { useRefresh } from '../contexts/RefreshContext';

export default function useTabRefresh(onRefresh, isActive = true) {
  const { tick } = useRefresh();
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  const mounted = useRef(false);
  const prevActive = useRef(isActive);
  const prevTick = useRef(tick);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      prevActive.current = isActive;
      prevTick.current = tick;
      return;
    }
    const becameActive = isActive && !prevActive.current;
    const tickChanged = tick !== prevTick.current;
    prevActive.current = isActive;
    prevTick.current = tick;

    if (isActive && (becameActive || tickChanged)) {
      cbRef.current?.();
    }
  }, [isActive, tick]);
}
