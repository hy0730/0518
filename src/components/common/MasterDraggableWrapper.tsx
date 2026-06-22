import React, { useCallback, useEffect, useRef } from 'react';
import { motion, type PanInfo, useMotionValue } from 'framer-motion';

type MasterDraggableWrapperProps = {
  enabled: boolean;
  x: number;
  y: number;
  onPositionChange: (nextX: number, nextY: number) => void;
  dragScale?: number;
  allowX?: boolean;
  allowY?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  highlight?: boolean;
  scale?: number;
  onScaleChange?: (nextScale: number) => void;
  scaleRange?: { min: number; max: number; step?: number };
};

export default function MasterDraggableWrapper({
  enabled,
  x,
  y,
  onPositionChange,
  dragScale = 1,
  allowX = true,
  allowY = true,
  className,
  style,
  children,
  highlight = false,
  scale: scaleProp,
  onScaleChange,
  scaleRange,
}: MasterDraggableWrapperProps) {
  // Drag delta in local (unscaled) coordinate space
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  // Ref to track the "settled" position (x/y from props + accumulated drag delta onDragEnd)
  const settledRef = useRef({ x, y });
  // On each props change, sync settledRef
  settledRef.current = { x, y };

  // Drag callback: write final position to store ONLY on dragEnd (avoids mid-gesture re-render conflict)
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, _info: PanInfo) => {
      const start = settledRef.current;
      const s = Math.max(dragScale, 0.0001);
      const nextX = allowX ? start.x + dragX.get() / s : x;
      const nextY = allowY ? start.y + dragY.get() / s : y;
      onPositionChange(nextX, nextY);
      // Immediately clear drag delta to prevent "snap back" while React/store catches up.
      dragX.set(0);
      dragY.set(0);
    },
    [allowX, allowY, dragScale, dragX, dragY, x, y, onPositionChange]
  );

  // Scale 조절용 포인터 이벤트
  const scalePointerRef = useRef<{
    startPointerX: number;
    startPointerY: number;
    startScale: number;
  } | null>(null);

  const handleScalePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !onScaleChange) return;
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      scalePointerRef.current = {
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startScale: scaleProp ?? 1,
      };
    },
    [enabled, onScaleChange, scaleProp]
  );

  const handleScalePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ref = scalePointerRef.current;
      if (!ref || !enabled || !onScaleChange) return;
      const dx = e.clientX - ref.startPointerX;
      const dy = e.clientY - ref.startPointerY;
      const step = scaleRange?.step ?? 0.05;
      const min = scaleRange?.min ?? 0.4;
      const max = scaleRange?.max ?? 2.5;
      const raw = ref.startScale + (dx - dy) / 240;
      const snapped = Math.round(raw / step) * step;
      const next = Math.max(min, Math.min(max, Number(snapped.toFixed(3))));
      if (next !== scaleProp) {
        onScaleChange(next);
      }
    },
    [enabled, onScaleChange, scaleProp, scaleRange]
  );

  const handleScalePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const ref = scalePointerRef.current;
      if (!ref || !enabled || !onScaleChange) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      const dx = e.clientX - ref.startPointerX;
      const dy = e.clientY - ref.startPointerY;
      const step = scaleRange?.step ?? 0.05;
      const min = scaleRange?.min ?? 0.4;
      const max = scaleRange?.max ?? 2.5;
      const raw = ref.startScale + (dx - dy) / 240;
      const snapped = Math.round(raw / step) * step;
      const next = Math.max(min, Math.min(max, Number(snapped.toFixed(3))));
      onScaleChange(next);
      scalePointerRef.current = null;
    },
    [enabled, onScaleChange, scaleRange]
  );

  return (
    <motion.div
      drag={enabled}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      className={[
        'absolute',
        enabled ? 'cursor-grab active:cursor-grabbing pointer-events-auto' : '',
        highlight ? 'ring-2 ring-amber-400/80' : '',
        className ?? '',
      ].join(' ')}
      style={{
        left: x,
        top: y,
        x: dragX,
        y: dragY,
        touchAction: enabled ? 'none' : undefined,
        zIndex: enabled ? 50 : undefined,
        transformOrigin: 'top left',
        overflow: 'visible',
        ...(enabled
          ? {
              boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.35), 0 0 12px rgba(251, 191, 36, 0.12)',
              borderRadius: '12px',
            }
          : {}),
        ...style,
      }}
    >
      {children}

      {enabled && onScaleChange && typeof scaleProp === 'number' && (
        <div
          className="absolute -right-3 -bottom-3 z-[60] h-7 w-7 rounded-full border-2 border-amber-500/60 bg-white text-[11px] font-black text-amber-700 shadow-lg cursor-se-resize hover:bg-amber-50 select-none flex items-center justify-center"
          style={{ touchAction: 'none', lineHeight: 1 }}
          onPointerDown={handleScalePointerDown}
          onPointerMove={handleScalePointerMove}
          onPointerUp={handleScalePointerUp}
          onPointerCancel={(e) => {
            scalePointerRef.current = null;
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          }}
          title="크기 조절"
        >
          <span style={{ transform: 'rotate(-45deg)' }}>↔</span>
        </div>
      )}

      {enabled && (
        <div
          className="absolute -top-6 left-0 z-[61] whitespace-nowrap rounded-md bg-amber-500/80 px-2 py-0.5 text-[10px] font-black text-white shadow-sm pointer-events-none select-none"
          style={{ lineHeight: '1.2' }}
        >
          ✥ 드래그 이동 &nbsp;·&nbsp; ↘ 크기 조절
        </div>
      )}
    </motion.div>
  );
}
