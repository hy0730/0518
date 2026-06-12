import React from 'react';

export default function HanYangSpeech({
  speaker,
  text,
}: {
  speaker: 'han' | 'yang';
  text: string;
}) {
  const isHan = speaker === 'han';
  return (
    <div className="flex items-start gap-2">
      <img
        src={isHan ? '/assets/images/han_2.png' : '/assets/images/yang_2.png'}
        alt={isHan ? '한' : '양'}
        className="w-9 h-9 object-contain shrink-0"
        draggable={false}
      />
      <div className="min-w-0">
        <div className="text-[11px] font-black opacity-85">{isHan ? '한' : '양'}</div>
        <div className="mt-0.5 text-[12px] font-bold opacity-95 leading-relaxed whitespace-pre-line">{text}</div>
      </div>
    </div>
  );
}

