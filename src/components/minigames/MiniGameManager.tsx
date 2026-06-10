import React, { Suspense, lazy, useState } from 'react';
import FitScaleWrapper from '../common/FitScaleWrapper';
import { useGameStore } from '../../store/useGameStore';
import type { MinigameProps } from '../../types/game';

const BronzeAgeGame = lazy(() => import('./BronzeAge/BronzeAgeGame'));
const DolmenGame = lazy(() => import('./Dolmen/DolmenGame'));
const SeoksilbunGame = lazy(() => import('./Seoksilbun/SeoksilbunGame'));
const MananGame = lazy(() => import('./Manan/MananGame'));
const JungchosaGame = lazy(() => import('./Jungchosa/JungchosaGame'));
const AnyangsaGame = lazy(() => import('./Anyangsa/AnyangsaGame'));
const MaejongGame = lazy(() => import('./Maejong/MaejongGame'));
const BisanGame = lazy(() => import('./Bisan/BisanGame'));
const GuseoGame = lazy(() => import('./Guseo/GuseoGame'));

const MINIGAME_REGISTRY: Record<number, React.ComponentType<MinigameProps>> = {
  1: BronzeAgeGame,
  2: DolmenGame,
  3: SeoksilbunGame,
  4: JungchosaGame,
  // 기획 변경: 5↔6 스왑
  5: MaejongGame,
  6: AnyangsaGame,
  7: BisanGame,
  8: MananGame,
  9: GuseoGame,
};

export default function MiniGameManager() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const completeStage = useGameStore((s) => s.completeStage);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const regionData = useGameStore((s) => s.regionData);
  const [layoutTune, setLayoutTune] = useState({
    baseWidth: 450,
    baseHeight: 800,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

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
      ? { baseWidth: layoutTune.baseWidth, baseHeight: layoutTune.baseHeight }
      : { baseWidth: 800, baseHeight: 450 };

  const tune = (key: keyof typeof layoutTune, delta: number, min: number, max: number) => {
    setLayoutTune((prev) => ({
      ...prev,
      [key]: Math.max(min, Math.min(max, prev[key] + delta)),
    }));
  };

  return (
    <Suspense fallback={<div style={{ padding: 20 }}>게임 불러오는 중...</div>}>
      <div className="w-full h-full relative">
        {/* 뒤로 버튼: 문서 흐름을 타지 않도록 완전 오버레이 */}
        <button
          type="button"
          className="absolute top-4 left-4 z-50 px-3 py-2 rounded-2xl border border-ink/30 bg-paper2/90 text-ink font-black shadow-md"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAppPhase('STORY');
          }}
        >
          ← 뒤로
        </button>

        {currentStageId === 4 && (
          <div className="absolute right-4 top-16 z-50 rounded-2xl border border-ink/30 bg-paper2/92 px-2 py-2 shadow-md">
            <div className="text-[11px] font-black">바깥 레이아웃 조절</div>
            <div className="mt-1 flex flex-col gap-1 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-10">가로</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('baseWidth', -20, 300, 1200)}>-</button>
                <span className="w-10 text-center">{layoutTune.baseWidth}</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('baseWidth', 20, 300, 1200)}>+</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-10">세로</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('baseHeight', -20, 400, 1600)}>-</button>
                <span className="w-10 text-center">{layoutTune.baseHeight}</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('baseHeight', 20, 400, 1600)}>+</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-10">상단</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('top', -4, -80, 120)}>-</button>
                <span className="w-10 text-center">{layoutTune.top}</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('top', 4, -80, 120)}>+</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-10">하단</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('bottom', -4, -80, 120)}>-</button>
                <span className="w-10 text-center">{layoutTune.bottom}</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('bottom', 4, -80, 120)}>+</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-10">왼쪽</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('left', -4, -80, 120)}>-</button>
                <span className="w-10 text-center">{layoutTune.left}</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('left', 4, -80, 120)}>+</button>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-10">오른쪽</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('right', -4, -80, 120)}>-</button>
                <span className="w-10 text-center">{layoutTune.right}</span>
                <button type="button" className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper" onClick={() => tune('right', 4, -80, 120)}>+</button>
              </div>
              <button
                type="button"
                className="mt-1 px-2 py-1 rounded-lg border border-ink/20 bg-stamp text-white font-black"
                onClick={() =>
                  setLayoutTune({
                    baseWidth: 450,
                    baseHeight: 800,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  })
                }
              >
                초기화
              </button>
            </div>
          </div>
        )}

        <div
          className="absolute"
          style={{
            top: `${currentStageId === 4 ? layoutTune.top : 0}px`,
            right: `${currentStageId === 4 ? layoutTune.right : 0}px`,
            bottom: `${currentStageId === 4 ? layoutTune.bottom : 0}px`,
            left: `${currentStageId === 4 ? layoutTune.left : 0}px`,
          }}
        >
          <FitScaleWrapper baseWidth={fit.baseWidth} baseHeight={fit.baseHeight}>
            <CurrentMiniGame
              stageId={currentStageId}
              regionData={regionData}
              onComplete={() => completeStage(currentStageId)}
              onFail={() => setAppPhase('MAP')}
            />
          </FitScaleWrapper>
        </div>
      </div>
    </Suspense>
  );
}
