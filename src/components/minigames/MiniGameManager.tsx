import React, { Suspense, lazy } from 'react';
import FitScaleWrapper from '../common/FitScaleWrapper';
import { useGameStore } from '../../store/useGameStore';
import type { MinigameProps } from '../../types/game';

const BronzeAgeGame = lazy(() => import('./BronzeAge/BronzeAgeGame'));
const DolmenGame = lazy(() => import('./Dolmen/DolmenGame'));
const SeoksilbunGame = lazy(() => import('./Seoksilbun/SeoksilbunGame'));
const ManangyoGame = lazy(() => import('./Manangyo/ManangyoGame'));
const JungchosaGame = lazy(() => import('./Jungchosa/JungchosaGame'));
const AnyangsaGame = lazy(() => import('./Anyangsa/AnyangsaGame'));

const MINIGAME_REGISTRY: Record<number, React.ComponentType<MinigameProps>> = {
  1: BronzeAgeGame,
  2: DolmenGame,
  3: SeoksilbunGame,
  4: JungchosaGame,
  5: AnyangsaGame,
  8: ManangyoGame,
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

  const fit =
    currentStageId === 4
      ? { baseWidth: 450, baseHeight: 800 } // 세로(중초사지 당간지주)
      : { baseWidth: 800, baseHeight: 450 }; // 기본 가로

  return (
    <Suspense fallback={<div style={{ padding: 20 }}>게임 불러오는 중...</div>}>
      <div className="w-full h-full relative">
        {/* 뒤로 버튼: 문서 흐름을 타지 않도록 완전 오버레이 */}
        <button
          type="button"
          className="absolute top-4 left-4 z-50 px-3 py-2 rounded-xl border border-white/20 bg-black/50 text-white font-black"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAppPhase('STORY');
          }}
        >
          ← 뒤로
        </button>

        <FitScaleWrapper baseWidth={fit.baseWidth} baseHeight={fit.baseHeight}>
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
