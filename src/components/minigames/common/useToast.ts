import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 미니게임 공용 토스트 훅
 * - 동작(타이머 기반 자동 닫힘)만 공통화하고, UI 렌더링은 각 게임에서 기존대로 유지한다.
 */
export function useToast(defaultMs = 1200) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (message: string, ms = defaultMs) => {
      setToast(message);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setToast(null), ms);
    },
    [defaultMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast, setToast };
}

