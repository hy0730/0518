import React, { type PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import styles from './FitScaleWrapper.module.css';

type Props = PropsWithChildren<{
  baseWidth?: number; // 예: 800
  baseHeight?: number; // 예: 450
  className?: string;
}>;

export default function FitScaleWrapper({ baseWidth = 800, baseHeight = 450, className, children }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const scale = useMemo(() => {
    if (!size.w || !size.h) return 1;
    const s = Math.min(size.w / baseWidth, size.h / baseHeight);
    // 너무 작아져도 탭이 가능하도록 하한선
    return Math.max(0.35, s);
  }, [size.w, size.h, baseWidth, baseHeight]);

  return (
    <div ref={hostRef} className={`${styles.host} ${className ?? ''}`}>
      <div
        className={styles.stage}
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

