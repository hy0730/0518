import { useEffect, useMemo, useRef, useState } from 'react';

type UseTypingTextOptions = {
  /** ms per character */
  speedMs?: number;
};

/**
 * 텍스트를 한 글자씩 출력하는 타이핑 효과 훅.
 * - text 변경 시 자동으로 다시 타이핑
 * - finish() 호출 시 즉시 전체 노출
 */
export function useTypingText(text: string, options: UseTypingTextOptions = {}) {
  const speedMs = options.speedMs ?? 18;

  const [index, setIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const displayText = useMemo(() => text.slice(0, index), [text, index]);

  const clear = () => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const finish = () => {
    clear();
    setIndex(text.length);
    setIsTyping(false);
  };

  useEffect(() => {
    // reset on text change
    clear();
    setIndex(0);

    if (!text) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    intervalRef.current = window.setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= text.length) {
          window.clearInterval(intervalRef.current ?? undefined);
          intervalRef.current = null;
          setIsTyping(false);
          return text.length;
        }
        return next;
      });
    }, speedMs);

    return () => {
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speedMs]);

  return {
    displayText,
    isTyping,
    finish,
  };
}

