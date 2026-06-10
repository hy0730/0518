import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
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

type LayoutTune = {
  baseWidth: number;
  baseHeight: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const DEFAULT_LAYOUT_TUNES: Record<number, LayoutTune> = {
  1: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  2: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  3: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  4: { baseWidth: 1200, baseHeight: 600, top: 0, right: -80, bottom: 0, left: -80 },
  5: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  6: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  7: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  8: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
  9: { baseWidth: 800, baseHeight: 450, top: 0, right: 0, bottom: 0, left: 0 },
};

const OUTER_TUNES_STORAGE_KEY = 'outerLayoutTunes_v1';

export default function MiniGameManager() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const completeStage = useGameStore((s) => s.completeStage);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const regionData = useGameStore((s) => s.regionData);
  const [layoutTunes, setLayoutTunes] = useState<Record<number, LayoutTune>>(() => {
    try {
      const raw = window.localStorage.getItem(OUTER_TUNES_STORAGE_KEY);
      if (!raw) return DEFAULT_LAYOUT_TUNES;
      const parsed = JSON.parse(raw) as Record<number, LayoutTune>;
      // 기본값 + 저장값 merge (키 누락 대비)
      return { ...DEFAULT_LAYOUT_TUNES, ...parsed };
    } catch {
      return DEFAULT_LAYOUT_TUNES;
    }
  });
  const [outerTunerOpen, setOuterTunerOpen] = useState(true);

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

  const currentTune = layoutTunes[currentStageId] ?? DEFAULT_LAYOUT_TUNES[currentStageId] ?? DEFAULT_LAYOUT_TUNES[1];
  const fit = { baseWidth: currentTune.baseWidth, baseHeight: currentTune.baseHeight };

  // dev에서 HMR/리렌더가 있어도 값이 유지되게 저장
  useEffect(() => {
    try {
      window.localStorage.setItem(OUTER_TUNES_STORAGE_KEY, JSON.stringify(layoutTunes));
    } catch {
      // ignore
    }
  }, [layoutTunes]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const tune = (key: keyof LayoutTune, delta: number, min: number, max: number) => {
    setLayoutTunes((prev) => {
      const base = prev[currentStageId] ?? DEFAULT_LAYOUT_TUNES[currentStageId] ?? DEFAULT_LAYOUT_TUNES[1];
      return {
        ...prev,
        [currentStageId]: {
          ...base,
          [key]: Math.max(min, Math.min(max, base[key] + delta)),
        },
      };
    });
  };

  const setTune = (key: keyof LayoutTune, value: number, min: number, max: number) => {
    setLayoutTunes((prev) => {
      const base = prev[currentStageId] ?? DEFAULT_LAYOUT_TUNES[currentStageId] ?? DEFAULT_LAYOUT_TUNES[1];
      return {
        ...prev,
        [currentStageId]: {
          ...base,
          [key]: clamp(value, min, max),
        },
      };
    });
  };

  const tuneText = useMemo(() => {
    return `가로 ${currentTune.baseWidth} / 세로 ${currentTune.baseHeight} / 상단 ${currentTune.top} / 하단 ${currentTune.bottom} / 왼쪽 ${currentTune.left} / 오른쪽 ${currentTune.right}`;
  }, [currentTune]);

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

        {/* 바깥 레이아웃 조절 패널(접기/펼치기)
            - 버튼 조작 시 아래 게임으로 클릭이 전달되지 않도록 이벤트 버블링만 차단
            - NOTE: preventDefault를 걸면 click 이벤트 자체가 막혀 버튼이 먹통이 될 수 있음 */}
        {outerTunerOpen ? (
          <div
            className="absolute right-4 top-16 z-50 rounded-2xl border border-ink/30 bg-paper2/92 px-2 py-2 shadow-md"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black">바깥 레이아웃 조절</div>
              <button
                type="button"
                className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
                onClick={(e) => {
                  e.stopPropagation();
                  setOuterTunerOpen(false);
                }}
                title="접기"
              >
                접기
              </button>
            </div>

            <div className="mt-2 text-[10px] font-bold opacity-80 max-w-[250px] leading-snug">{tuneText}</div>

            <div className="mt-2 flex flex-col gap-2 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-10 font-black">가로</span>
                <input
                  type="range"
                  min={300}
                  max={1600}
                  step={10}
                  value={currentTune.baseWidth}
                  onChange={(e) => setTune('baseWidth', Number(e.target.value), 300, 1600)}
                  className="w-[140px]"
                />
                <input
                  type="number"
                  className="w-[70px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.baseWidth}
                  onChange={(e) => setTune('baseWidth', Number(e.target.value || 0), 300, 1600)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">세로</span>
                <input
                  type="range"
                  min={300}
                  max={1600}
                  step={10}
                  value={currentTune.baseHeight}
                  onChange={(e) => setTune('baseHeight', Number(e.target.value), 300, 1600)}
                  className="w-[140px]"
                />
                <input
                  type="number"
                  className="w-[70px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.baseHeight}
                  onChange={(e) => setTune('baseHeight', Number(e.target.value || 0), 300, 1600)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">상단</span>
                <input
                  type="range"
                  min={-200}
                  max={200}
                  step={2}
                  value={currentTune.top}
                  onChange={(e) => setTune('top', Number(e.target.value), -200, 200)}
                  className="w-[140px]"
                />
                <input
                  type="number"
                  className="w-[70px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.top}
                  onChange={(e) => setTune('top', Number(e.target.value || 0), -200, 200)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">하단</span>
                <input
                  type="range"
                  min={-200}
                  max={200}
                  step={2}
                  value={currentTune.bottom}
                  onChange={(e) => setTune('bottom', Number(e.target.value), -200, 200)}
                  className="w-[140px]"
                />
                <input
                  type="number"
                  className="w-[70px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.bottom}
                  onChange={(e) => setTune('bottom', Number(e.target.value || 0), -200, 200)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">왼쪽</span>
                <input
                  type="range"
                  min={-200}
                  max={200}
                  step={2}
                  value={currentTune.left}
                  onChange={(e) => setTune('left', Number(e.target.value), -200, 200)}
                  className="w-[140px]"
                />
                <input
                  type="number"
                  className="w-[70px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.left}
                  onChange={(e) => setTune('left', Number(e.target.value || 0), -200, 200)}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">오른쪽</span>
                <input
                  type="range"
                  min={-200}
                  max={200}
                  step={2}
                  value={currentTune.right}
                  onChange={(e) => setTune('right', Number(e.target.value), -200, 200)}
                  className="w-[140px]"
                />
                <input
                  type="number"
                  className="w-[70px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.right}
                  onChange={(e) => setTune('right', Number(e.target.value || 0), -200, 200)}
                />
              </div>

              <button
                type="button"
                className="mt-1 px-2 py-1 rounded-lg border border-ink/20 bg-stamp text-white font-black"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayoutTunes((prev) => ({
                    ...prev,
                    [currentStageId]: DEFAULT_LAYOUT_TUNES[currentStageId] ?? DEFAULT_LAYOUT_TUNES[1],
                  }));
                }}
              >
                초기화
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="absolute right-4 top-16 z-50 px-3 py-2 rounded-2xl border border-ink/30 bg-paper2/92 text-ink font-black shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              setOuterTunerOpen(true);
            }}
            title="바깥 레이아웃 조절 열기"
          >
            레이아웃
          </button>
        )}

        <div
          className="absolute"
          style={{
            top: `${currentTune.top}px`,
            right: `${currentTune.right}px`,
            bottom: `${currentTune.bottom}px`,
            left: `${currentTune.left}px`,
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
