import React from 'react';
import type { MinigameProps } from '../../../types/game';

export default function ManangyoGame({ stageId, onComplete }: MinigameProps) {
  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>미니게임 #{stageId} (Manangyo) - 샘플</h2>
      <div style={{ marginBottom: 12 }}>여기에 만안교 아치 조립 미니게임을 구현하면 됩니다.</div>
      <button type="button" onClick={() => onComplete({ attempts: 1, clearTime: 10 })}>
        클리어 처리(테스트)
      </button>
    </div>
  );
}

