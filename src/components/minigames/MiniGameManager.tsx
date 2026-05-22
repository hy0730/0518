import React, { Suspense, lazy } from 'react';
import FitScaleWrapper from '../common/FitScaleWrapper';
import { useGameStore } from '../../store/useGameStore';
import type { MinigameProps } from '../../types/game';

const BronzeAgeGame = lazy(() => import('./BronzeAge/BronzeAgeGame'));
const DolmenGame = lazy(() => import('./Dolmen/DolmenGame'));
const SeoksilbunGame = lazy(() => import('./Seoksilbun/SeoksilbunGame'));
const ManangyoGame = lazy(() => import('./Manangyo/ManangyoGame'));

const MINIGAME_REGISTRY: Record<number, React.ComponentType<MinigameProps>> = {
  1: BronzeAgeGame,
  2: DolmenGame,
  3: SeoksilbunGame,
  4: ManangyoGame,
};

export default function MiniGameManager() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const completeStage = useGameStore((s) => s.completeStage);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const regionData = useGameStore((s) => s.regionData);

  if (!currentStageId) return null;

  const CurrentMiniGame = MINIGAME_REGISTRY[currentStageId];
  if (!CurrentMiniGame) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 8 }}>해당 스테이지의 미니게임이 아직 연결되지 않았습니다.</div>
        <button type="button" onClick={() => setAppPhase('MAP')}>
          지도로 돌아가기
        </button>
      </div>
    );
  }

  if (!regionData) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 8 }}>지역 데이터를 불러오지 못했습니다.</div>
        <button type="button" onClick={() => setAppPhase('MAP')}>
          지도로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ padding: 20 }}>게임 불러오는 중...</div>}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* 미니게임에서도 뒤로가기 제공: 직전 상태(스토리)로 복귀 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAppPhase('STORY');
          }}
          style={{
            position: 'absolute',
            left: 10,
            top: 10,
            zIndex: 50,
            padding: '8px 10px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          ← 뒤로
        </button>

        <FitScaleWrapper baseWidth={800} baseHeight={450}>
          <CurrentMiniGame
            stageId={currentStageId}
            regionData={regionData}
            onComplete={() => completeStage(currentStageId)}
            onFail={() => setAppPhase('MAP')}
          />
        </FitScaleWrapper>
      </div>
    </Suspense>
  );
}
