import React from 'react';
import HanYangSpeech from './HanYangSpeech';

export type HanYangDialogueLine = {
  speaker: 'han' | 'yang';
  text: string;
};

export default function HanYangDialogue({ lines }: { lines: HanYangDialogueLine[] }) {
  return (
    <div className="grid gap-1.5">
      {lines.map((l, idx) => (
        <HanYangSpeech key={`${l.speaker}-${idx}`} speaker={l.speaker} text={l.text} />
      ))}
    </div>
  );
}

