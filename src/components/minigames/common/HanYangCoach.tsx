import React from 'react';

export default function HanYangCoach({
  title = '한·양 안내',
  text,
  onClose,
}: {
  title?: string;
  text: string;
  onClose?: () => void;
}) {
  return (
    <div className="note-panel px-4 py-3 max-w-[520px]">
      <div className="flex items-start gap-3">
        <div className="flex items-start gap-2 shrink-0">
          <img src="/assets/images/han_2.png" alt="한" className="w-10 h-10 object-contain" draggable={false} />
          <img src="/assets/images/yang_2.png" alt="양" className="w-10 h-10 object-contain" draggable={false} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black opacity-85">{title}</div>
          <div className="mt-1 text-[12px] leading-relaxed opacity-95 whitespace-pre-line">{text}</div>
        </div>
        {onClose ? (
          <button
            type="button"
            className="shrink-0 px-2 py-1 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="안내 닫기"
          >
            닫기
          </button>
        ) : null}
      </div>
    </div>
  );
}

