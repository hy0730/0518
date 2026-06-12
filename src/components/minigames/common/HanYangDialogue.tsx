import React, { useEffect, useMemo, useState } from 'react';
import HanYangSpeech from './HanYangSpeech';

export type HanYangDialogueLine = {
  speaker: 'han' | 'yang';
  text: string;
};

export default function HanYangDialogue({
  lines,
  resetKey,
}: {
  lines: HanYangDialogueLine[];
  resetKey?: string | number;
}) {
  const derivedKey = useMemo(() => lines.map((l) => `${l.speaker}:${l.text}`).join('|'), [lines]);
  const key = resetKey ?? derivedKey;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [key]);

  if (!lines.length) return null;
  const cur = lines[Math.min(idx, lines.length - 1)];

  return (
    <button
      type="button"
      className="text-left w-full rounded-xl hover:bg-ink/5 active:bg-ink/10 transition-colors px-2 py-2 -mx-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIdx((v) => (lines.length ? (v + 1) % lines.length : 0));
      }}
      title="탭해서 다음 대사"
    >
      <HanYangSpeech speaker={cur.speaker} text={cur.text} />
    </button>
  );
}
