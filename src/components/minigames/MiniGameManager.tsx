import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import FitScaleWrapper from '../common/FitScaleWrapper';
import { GameTuningProvider } from '../common/GameTuningContext';
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

type TuneSchemaItem = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

type StageTuneSchema = {
  title: string;
  defaults: Record<string, number>;
  items: TuneSchemaItem[];
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
const OUTER_TUNES_LOCKED_KEY = 'outerLayoutTunes_locked_v1';

const GAME_TUNES_STORAGE_KEY = 'gameTunes_v1';
const GAME_TUNES_LOCKED_KEY = 'gameTunes_locked_v1';

const STAGE_TUNING_SCHEMAS: Record<number, StageTuneSchema> = {
  3: {
    title: '석실분 레이아웃',
    defaults: {
      headerX: 0,
      headerY: 0,
      boardX: 0,
      boardY: 0,
      boardScale: 1,
      leftInvX: 0,
      leftInvY: 0,
      rightInvX: 0,
      rightInvY: 0,
      actionY: 0,
    },
    items: [
      { key: 'headerX', label: '상단 X', min: -400, max: 400, step: 2 },
      { key: 'headerY', label: '상단 Y', min: -200, max: 200, step: 2 },
      { key: 'boardX', label: '보드 X', min: -400, max: 400, step: 2 },
      { key: 'boardY', label: '보드 Y', min: -250, max: 250, step: 2 },
      { key: 'boardScale', label: '보드 크기', min: 0.5, max: 1.8, step: 0.05 },
      { key: 'leftInvX', label: '좌인벤 X', min: -300, max: 300, step: 2 },
      { key: 'leftInvY', label: '좌인벤 Y', min: -250, max: 250, step: 2 },
      { key: 'rightInvX', label: '우인벤 X', min: -300, max: 300, step: 2 },
      { key: 'rightInvY', label: '우인벤 Y', min: -250, max: 250, step: 2 },
      { key: 'actionY', label: '하단 Y', min: -200, max: 200, step: 2 },
    ],
  },
  4: {
    title: '당간지주 레이아웃',
    defaults: {
      headerX: 0,
      headerY: 0,
      boardX: 0,
      boardY: 30,
      boardScale: 1,
    },
    items: [
      { key: 'headerX', label: '상단 X', min: -300, max: 300, step: 2 },
      { key: 'headerY', label: '상단 Y', min: -120, max: 120, step: 2 },
      { key: 'boardX', label: '보드 X', min: -300, max: 300, step: 2 },
      { key: 'boardY', label: '보드 Y', min: -120, max: 220, step: 2 },
      { key: 'boardScale', label: '보드 크기', min: 0.6, max: 1.8, step: 0.05 },
    ],
  },
  6: {
    title: '안양사 퍼즐 레이아웃',
    defaults: {
      headerX: 16,
      headerY: 12,
      headerScale: 1,
      boardX: 26,
      boardY: 122, // 800x450 기준에서 3x2 보드 세로 중앙값(기본 SLOT_H=100, GAP=6 기준)
      boardScale: 1,
      invX: 402,
      invY: 84,
      inventoryScale: 1,
      slotW: 120,
      slotH: 100,
      pieceScale: 1,
    },
    items: [
      { key: 'headerX', label: '상단 X', min: -400, max: 900, step: 2 },
      { key: 'headerY', label: '상단 Y', min: -200, max: 400, step: 2 },
      { key: 'headerScale', label: '상단 크기', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'boardX', label: '보드 X', min: -400, max: 900, step: 2 },
      { key: 'boardY', label: '보드 Y', min: -200, max: 600, step: 2 },
      { key: 'boardScale', label: '보드 크기', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'invX', label: '인벤 X', min: -400, max: 1100, step: 2 },
      { key: 'invY', label: '인벤 Y', min: -200, max: 700, step: 2 },
      { key: 'inventoryScale', label: '인벤 크기', min: 0.5, max: 2.5, step: 0.05 },
      { key: 'slotW', label: '조각 폭', min: 40, max: 320, step: 2 },
      { key: 'slotH', label: '조각 높이', min: 40, max: 260, step: 2 },
      { key: 'pieceScale', label: '조각 크기', min: 0.4, max: 2.5, step: 0.05 },
    ],
  },
  8: {
    title: '만안교 레이아웃',
    defaults: {
      boardX: 0,
      boardY: 0,
      boardScaleTune: 1,
      inventoryX: 0,
      inventoryY: 0,
      inventoryScale: 1,
    },
    items: [
      { key: 'boardX', label: '보드 X', min: -350, max: 350, step: 2 },
      { key: 'boardY', label: '보드 Y', min: -250, max: 250, step: 2 },
      { key: 'boardScaleTune', label: '보드 크기', min: 0.5, max: 1.8, step: 0.05 },
      { key: 'inventoryX', label: '인벤 X', min: -350, max: 350, step: 2 },
      { key: 'inventoryY', label: '인벤 Y', min: -250, max: 250, step: 2 },
      { key: 'inventoryScale', label: '인벤 크기', min: 0.5, max: 1.8, step: 0.05 },
    ],
  },
};

export default function MiniGameManager() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const completeStage = useGameStore((s) => s.completeStage);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const regionData = useGameStore((s) => s.regionData);
  const stageIdSafe = currentStageId ?? 1;
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
  const [lockedTunes, setLockedTunes] = useState<Record<number, LayoutTune>>(() => {
    try {
      const raw = window.localStorage.getItem(OUTER_TUNES_LOCKED_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<number, LayoutTune>;
    } catch {
      return {};
    }
  });
  const [outerTunerOpen, setOuterTunerOpen] = useState(true);
  const [innerTunerOpen, setInnerTunerOpen] = useState(true);

  // 게임별 튜닝(미니게임 내부 레이아웃) - 공통 HUD에서 제어
  const [gameTunes, setGameTunes] = useState<Record<number, Record<string, number>>>(() => {
    try {
      const raw = window.localStorage.getItem(GAME_TUNES_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<number, Record<string, number>>;
    } catch {
      return {};
    }
  });
  const [gameLocked, setGameLocked] = useState<Record<number, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(GAME_TUNES_LOCKED_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<number, boolean>;
    } catch {
      return {};
    }
  });

  const CurrentMiniGame = MINIGAME_REGISTRY[stageIdSafe];

  const currentTune =
    lockedTunes[stageIdSafe] ??
    layoutTunes[stageIdSafe] ??
    DEFAULT_LAYOUT_TUNES[stageIdSafe] ??
    DEFAULT_LAYOUT_TUNES[1];
  const fit = { baseWidth: currentTune.baseWidth, baseHeight: currentTune.baseHeight };
  const isLocked = !!lockedTunes[stageIdSafe];

  // dev에서 HMR/리렌더가 있어도 값이 유지되게 저장
  useEffect(() => {
    try {
      window.localStorage.setItem(OUTER_TUNES_STORAGE_KEY, JSON.stringify(layoutTunes));
    } catch {
      // ignore
    }
  }, [layoutTunes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OUTER_TUNES_LOCKED_KEY, JSON.stringify(lockedTunes));
    } catch {
      // ignore
    }
  }, [lockedTunes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(GAME_TUNES_STORAGE_KEY, JSON.stringify(gameTunes));
    } catch {
      // ignore
    }
  }, [gameTunes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(GAME_TUNES_LOCKED_KEY, JSON.stringify(gameLocked));
    } catch {
      // ignore
    }
  }, [gameLocked]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const tune = (key: keyof LayoutTune, delta: number, min: number, max: number) => {
    setLayoutTunes((prev) => {
      const base = prev[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[1];
      return {
        ...prev,
        [stageIdSafe]: {
          ...base,
          [key]: Math.max(min, Math.min(max, base[key] + delta)),
        },
      };
    });
  };

  const setTune = (key: keyof LayoutTune, value: number, min: number, max: number) => {
    if (isLocked) return;
    setLayoutTunes((prev) => {
      const base = prev[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[1];
      return {
        ...prev,
        [stageIdSafe]: {
          ...base,
          [key]: clamp(value, min, max),
        },
      };
    });
  };

  const tuneText = useMemo(() => {
    return `가로 ${currentTune.baseWidth} / 세로 ${currentTune.baseHeight} / 상단 ${currentTune.top} / 하단 ${currentTune.bottom} / 왼쪽 ${currentTune.left} / 오른쪽 ${currentTune.right}`;
  }, [currentTune]);

  const stageSchema = STAGE_TUNING_SCHEMAS[stageIdSafe];
  const isGameLocked = !!gameLocked[stageIdSafe];
  const getGameNumber = (key: string, fallback: number) => {
    const base = stageSchema?.defaults?.[key] ?? fallback;
    return gameTunes[stageIdSafe]?.[key] ?? base;
  };
  const setGameNumber = (key: string, value: number) => {
    if (!stageSchema) return;
    if (isGameLocked) return;
    const item = stageSchema.items.find((x) => x.key === key);
    const min = item?.min ?? -99999;
    const max = item?.max ?? 99999;
    setGameTunes((prev) => {
      const cur = prev[stageIdSafe] ?? {};
      return {
        ...prev,
        [stageIdSafe]: {
          ...cur,
          [key]: clamp(value, min, max),
        },
      };
    });
  };
  const resetGameTunes = () => {
    setGameLocked((prev) => ({ ...prev, [stageIdSafe]: false }));
    setGameTunes((prev) => {
      const next = { ...prev };
      delete next[stageIdSafe];
      return next;
    });
  };

  // 전체 레이아웃 드래그 이동(튜닝 창이 열려 있을 때)
  const outerDragRef = useRef<null | {
    pointerId: number;
    startX: number;
    startY: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = outerDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setLayoutTunes((prev) => {
        const base = prev[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[1];
        return {
          ...prev,
          [stageIdSafe]: {
            ...base,
            left: clamp(drag.left + dx, -500, 500),
            right: clamp(drag.right - dx, -500, 500),
            top: clamp(drag.top + dy, -500, 500),
            bottom: clamp(drag.bottom - dy, -500, 500),
          },
        };
      });
    };
    const up = () => {
      outerDragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [stageIdSafe]);

  if (!currentStageId) return null;

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

        {/* 전체 레이아웃 조절 */}
        {outerTunerOpen ? (
          <div
            data-tuning-panel="true"
            className="absolute right-4 top-16 z-50 w-[320px] max-w-[calc(100vw-2rem)] max-h-[calc(50vh-5rem)] rounded-2xl border border-ink/30 bg-paper2/92 px-2 py-2 shadow-md overflow-y-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black">튜닝</div>
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

            <div className="mt-2 text-[10px] font-bold opacity-80 leading-snug break-words">{tuneText}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className={['text-[10px] font-black', isLocked ? 'text-stamp' : 'text-ink/70'].join(' ')}>
                {isLocked ? '확정됨(잠금)' : '조절 중'}
              </div>
              {isLocked ? (
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLockedTunes((prev) => {
                      const next = { ...prev };
                      delete next[currentStageId];
                      return next;
                    });
                  }}
                >
                  확정 해제
                </button>
              ) : (
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg border border-ink/20 bg-stamp text-white text-[10px] font-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    // 현재 화면(stage)의 값을 "확정"으로 저장 (이후 슬라이더/입력 비활성화)
                    setLockedTunes((prev) => ({
                      ...prev,
                      [currentStageId]: { ...currentTune },
                    }));
                  }}
                >
                  이 값 확정
                </button>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-2 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-10 font-black">가로</span>
                <input
                  type="range"
                  min={200}
                  max={2400}
                  step={10}
                  value={currentTune.baseWidth}
                  onChange={(e) => setTune('baseWidth', Number(e.target.value), 200, 2400)}
                  className="flex-1 min-w-0"
                  disabled={isLocked}
                />
                <input
                  type="number"
                  className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.baseWidth}
                  onChange={(e) => setTune('baseWidth', Number(e.target.value || 0), 200, 2400)}
                  disabled={isLocked}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">세로</span>
                <input
                  type="range"
                  min={200}
                  max={2400}
                  step={10}
                  value={currentTune.baseHeight}
                  onChange={(e) => setTune('baseHeight', Number(e.target.value), 200, 2400)}
                  className="flex-1 min-w-0"
                  disabled={isLocked}
                />
                <input
                  type="number"
                  className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.baseHeight}
                  onChange={(e) => setTune('baseHeight', Number(e.target.value || 0), 200, 2400)}
                  disabled={isLocked}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">상단</span>
                <input
                  type="range"
                  min={-500}
                  max={500}
                  step={2}
                  value={currentTune.top}
                  onChange={(e) => setTune('top', Number(e.target.value), -500, 500)}
                  className="flex-1 min-w-0"
                  disabled={isLocked}
                />
                <input
                  type="number"
                  className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.top}
                  onChange={(e) => setTune('top', Number(e.target.value || 0), -500, 500)}
                  disabled={isLocked}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">하단</span>
                <input
                  type="range"
                  min={-500}
                  max={500}
                  step={2}
                  value={currentTune.bottom}
                  onChange={(e) => setTune('bottom', Number(e.target.value), -500, 500)}
                  className="flex-1 min-w-0"
                  disabled={isLocked}
                />
                <input
                  type="number"
                  className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.bottom}
                  onChange={(e) => setTune('bottom', Number(e.target.value || 0), -500, 500)}
                  disabled={isLocked}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">왼쪽</span>
                <input
                  type="range"
                  min={-500}
                  max={500}
                  step={2}
                  value={currentTune.left}
                  onChange={(e) => setTune('left', Number(e.target.value), -500, 500)}
                  className="flex-1 min-w-0"
                  disabled={isLocked}
                />
                <input
                  type="number"
                  className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.left}
                  onChange={(e) => setTune('left', Number(e.target.value || 0), -500, 500)}
                  disabled={isLocked}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="w-10 font-black">오른쪽</span>
                <input
                  type="range"
                  min={-500}
                  max={500}
                  step={2}
                  value={currentTune.right}
                  onChange={(e) => setTune('right', Number(e.target.value), -500, 500)}
                  className="flex-1 min-w-0"
                  disabled={isLocked}
                />
                <input
                  type="number"
                  className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                  value={currentTune.right}
                  onChange={(e) => setTune('right', Number(e.target.value || 0), -500, 500)}
                  disabled={isLocked}
                />
              </div>

              <button
                type="button"
                className="mt-1 px-2 py-1 rounded-lg border border-ink/20 bg-stamp text-white font-black"
                onClick={(e) => {
                  e.stopPropagation();
                  setLockedTunes((prev) => {
                    const next = { ...prev };
                    delete next[currentStageId];
                    return next;
                  });
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
            튜닝
          </button>
        )}

        {/* 게임 내부 레이아웃 조절(스테이지별 스키마) */}
        {stageSchema &&
          (innerTunerOpen ? (
            <div
              data-tuning-panel="true"
              className="absolute right-4 bottom-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] max-h-[calc(50vh-2rem)] rounded-2xl border border-ink/30 bg-paper2/92 px-2 py-2 shadow-md overflow-y-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-black">{stageSchema.title}</div>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInnerTunerOpen(false);
                  }}
                  title="접기"
                >
                  접기
                </button>
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <div className={['text-[10px] font-black', isGameLocked ? 'text-stamp' : 'text-ink/70'].join(' ')}>
                  {isGameLocked ? '확정됨(잠금)' : '조절 중'}
                </div>
                {isGameLocked ? (
                  <button
                    type="button"
                    className="px-2 py-1 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameLocked((prev) => ({ ...prev, [currentStageId]: false }));
                    }}
                  >
                    확정 해제
                  </button>
                ) : (
                  <button
                    type="button"
                    className="px-2 py-1 rounded-lg border border-ink/20 bg-stamp text-white text-[10px] font-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameLocked((prev) => ({ ...prev, [currentStageId]: true }));
                    }}
                  >
                    이 값 확정
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-2 text-[10px]">
                {stageSchema.items.map((it) => {
                  const v = getGameNumber(it.key, 0);
                  return (
                    <div key={it.key} className="flex items-center gap-2">
                      <span className="w-12 font-black">{it.label}</span>
                      <input
                        type="range"
                        min={it.min}
                        max={it.max}
                        step={it.step}
                        value={v}
                        onChange={(e) => setGameNumber(it.key, Number(e.target.value))}
                        className="flex-1 min-w-0"
                        disabled={isGameLocked}
                      />
                      <input
                        type="number"
                        className="w-[64px] rounded-lg border border-ink/20 bg-paper px-2 py-1 font-black"
                        value={v}
                        onChange={(e) => setGameNumber(it.key, Number(e.target.value || 0))}
                        disabled={isGameLocked}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                className="mt-2 px-2 py-1 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
                onClick={(e) => {
                  e.stopPropagation();
                  resetGameTunes();
                }}
              >
                초기화
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="absolute right-4 bottom-4 z-50 px-3 py-2 rounded-2xl border border-ink/30 bg-paper2/92 text-ink font-black shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setInnerTunerOpen(true);
              }}
              title="게임 내부 레이아웃 조절 열기"
            >
              퍼즐 레이아웃
            </button>
          ))}

        <div
          className="absolute"
          style={{
            top: `${currentTune.top}px`,
            right: `${currentTune.right}px`,
            bottom: `${currentTune.bottom}px`,
            left: `${currentTune.left}px`,
          }}
        >
          <div className="relative w-full h-full">
            {outerTunerOpen && !isLocked && (
              <div
                className="absolute inset-0 z-40 rounded-3xl border-2 border-dashed border-sky-400/70 bg-sky-100/10 cursor-move"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  // 패널/버튼이 아닌 게임 프레임 자체를 드래그하면 전체 레이아웃 이동
                  if ((e.target as HTMLElement).closest('[data-tuning-panel="true"]')) return;
                  e.stopPropagation();
                  outerDragRef.current = {
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    left: currentTune.left,
                    right: currentTune.right,
                    top: currentTune.top,
                    bottom: currentTune.bottom,
                  };
                }}
              >
                <div className="absolute left-3 top-3 rounded-xl border border-sky-400/60 bg-paper2/92 px-3 py-1 text-[11px] font-black text-sky-700 shadow-md">
                  전체 레이아웃 드래그 이동
                </div>
              </div>
            )}

            <FitScaleWrapper baseWidth={fit.baseWidth} baseHeight={fit.baseHeight}>
              <GameTuningProvider
                value={{
                  stageId: currentStageId,
                  getNumber: getGameNumber,
                  setNumber: setGameNumber,
                  reset: resetGameTunes,
                  locked: isGameLocked,
                  setLocked: (locked) => setGameLocked((prev) => ({ ...prev, [currentStageId]: locked })),
                  innerTunerOpen,
                }}
              >
                <CurrentMiniGame
                  stageId={currentStageId}
                  regionData={regionData}
                  onComplete={() => completeStage(currentStageId)}
                  onFail={() => setAppPhase('MAP')}
                />
              </GameTuningProvider>
            </FitScaleWrapper>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
