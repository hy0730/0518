import React from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';

export default function ManangyoGame({ stageId, onComplete }: MinigameProps) {
  const stageTitle = storyDataByStageId[stageId]?.title ?? `스테이지 ${stageId}`;
  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>{stageTitle} · 만안교 미니게임(준비 중)</h2>
      <div style={{ marginBottom: 12 }}>이 스테이지의 미니게임은 현재 준비 중입니다.</div>
      <button type="button" onClick={() => onComplete({ attempts: 1, clearTime: 10 })}>
        돌아가기
      </button>
    </div>
  );
}
