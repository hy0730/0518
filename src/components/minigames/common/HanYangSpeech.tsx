import React from 'react';

export default function HanYangSpeech({
  speaker,
  text,
}: {
  speaker: 'han' | 'yang';
  text: string;
}) {
  const isHan = speaker === 'han';
  const oneLine = (text ?? '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    <div className="flex items-center gap-2 h-10">
      <img
        src={isHan ? '/assets/images/han_2.png' : '/assets/images/yang_2.png'}
        alt={isHan ? '한' : '양'}
        className="w-9 h-9 object-contain shrink-0"
        draggable={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[12px] font-black opacity-85 shrink-0">{isHan ? '한' : '양'}</span>
          <span className="text-[12px] font-bold opacity-95 truncate">{oneLine}</span>
        </div>
      </div>
    </div>
  );
}
