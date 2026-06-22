import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import FitScaleWrapper from '../common/FitScaleWrapper';
import { GameTuningProvider } from '../common/GameTuningContext';
import { useGameStore } from '../../store/useGameStore';
import type { MinigameProps } from '../../types/game';

// ──────────────────────────────────────────────────────────
// Fix #1: 별도 Input 셀 컴포넌트 (로컬 상태로 포커스 유지)
// ──────────────────────────────────────────────────────────
type InputCellProps = {
  label: string;
  initialValue: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
  w?: string;
  labelW?: string;
};
function InspectorInputCell({
  label,
  initialValue,
  min,
  max,
  step,
  onCommit,
  w = '52px',
  labelW = '28px',
}: InputCellProps) {
  const [localVal, setLocalVal] = useState<string>(String(initialValue));
  const committedRef = useRef(initialValue);

  // props.initialValue가 외부에서 바뀌었을 때, 로컬값이 아직 커밋되지 않은 상태면 동기화
  useEffect(() => {
    if (committedRef.current !== initialValue && Number(localVal) === committedRef.current) {
      setLocalVal(String(initialValue));
      committedRef.current = initialValue;
    }
  }, [initialValue, localVal]);

  const commit = useCallback(
    (raw: string) => {
      const v = Number(raw);
      if (isNaN(v)) {
        // 잘못된 입력 → 마지막 커밋값으로 롤백
        setLocalVal(String(committedRef.current));
        return;
      }
      const clamped = Math.max(min, Math.min(max, v));
      committedRef.current = clamped;
      setLocalVal(String(clamped));
      if (clamped !== initialValue) {
        onCommit(clamped);
      }
    },
    [min, max, initialValue, onCommit]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      commit(e.target.value);
    },
    [commit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit((e.target as HTMLInputElement).value);
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === 'Escape') {
        setLocalVal(String(committedRef.current));
        (e.target as HTMLInputElement).blur();
      }
    },
    [commit]
  );

  return (
    <div className="flex items-center gap-0.5">
      <span
        className="text-[9px] font-black text-ink/50 text-right shrink-0"
        style={{ width: labelW }}
      >
        {label}
      </span>
      <input
        type="number"
        className="rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink/90 text-center"
        style={{ width: w }}
        value={localVal}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

/** 플로팅 마스터 에디터 패널 - Inspector 스타일 수치 입력 + 드래그 이동 가능 */
function MasterEditorFloatingPanel({
  items,
  hoverId,
  onHoverChange,
  onCopyCoords,
  onClose,
  getNumber,
  setNumber,
  outerTune,
  setOuterTune,
  stageSchemaItems,
  isGameLocked,
  isOuterLocked,
}: {
  items: MasterEditorItem[];
  hoverId: string | null;
  onHoverChange: (id: string | null) => void;
  onCopyCoords: () => Promise<void>;
  onClose: () => void;
  getNumber: (key: string, fallback: number) => number;
  setNumber: (key: string, value: number) => void;
  outerTune: LayoutTune;
  setOuterTune: (key: keyof LayoutTune, value: number, min: number, max: number) => void;
  stageSchemaItems: TuneSchemaItem[];
  isGameLocked: boolean;
  isOuterLocked: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  // Fix #2: 패널 자체 드래그 위치
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });

  const handleCopy = useCallback(async () => {
    await onCopyCoords();
  }, [onCopyCoords]);

  const getSchema = useCallback(
    (key: string) => {
      return stageSchemaItems.find((s) => s.key === key);
    },
    [stageSchemaItems]
  );

  const getKeyType = (key: string): 'x' | 'y' | 'scale' | 'other' => {
    if (key.endsWith('X')) return 'x';
    if (key.endsWith('Y')) return 'y';
    if (key.endsWith('Scale') || key.endsWith('scale')) return 'scale';
    return 'other';
  };

  const getKeyLabel = (key: string): string => {
    const t = getKeyType(key);
    if (t === 'x') return 'X';
    if (t === 'y') return 'Y';
    if (t === 'scale') return 'Scale';
    if (key === 'top') return '상단';
    if (key === 'bottom') return '하단';
    if (key === 'left') return '왼쪽';
    if (key === 'right') return '오른쪽';
    return key;
  };

  if (minimized) {
    return (
      <motion.div
        className="absolute z-[65] m-3"
        drag
        dragMomentum={false}
        dragElastic={0}
        initial={false}
        animate={panelPos}
        onDragEnd={(_, info) => setPanelPos((p) => ({ x: p.x + info.offset.x, y: p.y + info.offset.y }))}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{ left: 0, top: 0, touchAction: 'none' }}
      >
        <button
          type="button"
          className="rounded-2xl border-2 border-amber-400/60 bg-white/90 px-4 py-3 text-[11px] font-black text-amber-700 shadow-2xl backdrop-blur-sm hover:bg-amber-50 transition-all"
          onClick={() => setMinimized(false)}
          title="에디터 패널 열기"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        >
          📋 Inspector 열기
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute z-[65] m-3 max-w-[380px] w-[90vw]"
      drag
      dragMomentum={false}
      dragElastic={0}
      initial={false}
      animate={panelPos}
      onDragEnd={(_, info) => setPanelPos((p) => ({ x: p.x + info.offset.x, y: p.y + info.offset.y }))}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ left: 0, top: 0, touchAction: 'none' }}
    >
      <div
        className="rounded-3xl border-2 border-amber-400/50 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-sm overflow-hidden transition-all"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        {/* 헤더 - 드래그 핸들 */}
        <div className="flex items-center justify-between gap-2 mb-2 cursor-grab active:cursor-grabbing select-none">
          <div className="text-[12px] font-black text-amber-800 flex items-center gap-1.5">
            <span>📐</span>
            <span>Inspector</span>
          </div>
          <div className="flex items-center gap-1 cursor-default" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rounded-lg border border-ink/20 bg-paper/80 px-2 py-0.5 text-[10px] font-black hover:bg-paper transition-colors"
              onClick={() => setMinimized(true)}
              title="최소화"
            >
              ➖
            </button>
            <button
              type="button"
              className="rounded-lg border border-ink/20 bg-paper/80 px-2 py-0.5 text-[10px] font-black hover:bg-red-50 transition-colors"
              onClick={onClose}
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 설명 */}
        <div className="text-[10px] font-bold text-ink/60 leading-snug mb-2">
          각 항목의 X, Y, Scale 값을 직접 입력하여 위치와 크기를 조절하세요.
        </div>

        {/* 항목 목록 */}
        <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-ink/10 bg-paper/50 p-1.5">
          {items.length === 0 ? (
            <div className="px-2 py-3 text-[10px] font-bold text-ink/40 text-center">
              이 스테이지에 조절 가능한 항목이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((item) => {
                const isOuter = item.id === 'outer-layout';

                return (
                  <div
                    key={item.id}
                    className={[
                      'rounded-xl border px-2.5 py-2 transition-colors',
                      hoverId === item.id
                        ? 'border-amber-400/70 bg-amber-50/80'
                        : 'border-ink/8 bg-white/60 hover:bg-paper/80',
                    ].join(' ')}
                    onMouseEnter={() => onHoverChange(item.id)}
                    onMouseLeave={() => onHoverChange(null)}
                  >
                    {/* 항목 레이블 + 배지 */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="text-[11px] font-black text-ink/85 truncate">{item.label}</div>
                      <span className={[
                        'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black',
                        item.panel === 'outer' ? 'bg-sky-100 text-sky-700' :
                        item.panel === 'object' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-100 text-emerald-700',
                      ].join(' ')}>
                        {item.panel === 'outer' ? '전체' : item.panel === 'object' ? '오브젝트' : '레이아웃'}
                      </span>
                    </div>

                    {/* 수치 입력 필드 - Fix #1: 별도 InputCell 컴포넌트 사용, 마스터 권한으로 항상 활성화 */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.keys.map((key) => {
                        const schema = getSchema(key);
                        const min = schema?.min ?? -9999;
                        const max = schema?.max ?? 9999;
                        const step = schema?.step ?? 1;
                        const label = getKeyLabel(key);

                        if (isOuter) {
                          const outerVal = outerTune[key as keyof LayoutTune] as number ?? 0;
                          return (
                            <InspectorInputCell
                              key={key}
                              label={label}
                              initialValue={outerVal}
                              min={-500}
                              max={500}
                              step={2}
                              onCommit={(v) => setOuterTune(key as keyof LayoutTune, v, -500, 500)}
                              w="52px"
                              labelW="18px"
                            />
                          );
                        }

                        const val = getNumber(key, 0);
                        return (
                          <InspectorInputCell
                            key={key}
                            label={label}
                            initialValue={val}
                            min={min}
                            max={max}
                            step={step}
                            onCommit={(v) => setNumber(key, v)}
                            w="52px"
                            labelW="28px"
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 복사 버튼 */}
        <div className="mt-2">
          <button
            type="button"
            className="w-full rounded-xl border-2 border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] font-black text-amber-800 shadow-sm hover:bg-amber-500/20 transition-colors"
            onClick={handleCopy}
            title="현재 스테이지 좌표 JSON 복사"
          >
            📋 현재 좌표 복사하기
          </button>
        </div>
      </div>
    </motion.div>
  );
}

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
  panel?: 'tuning' | 'object';
};

type StageTuneSchema = {
  title: string;
  defaults: Record<string, number>;
  items: TuneSchemaItem[];
};

type MasterEditorItem = {
  id: string;
  label: string;
  panel: 'outer' | 'tuning' | 'object';
  keys: string[];
};

const DEFAULT_LAYOUT_TUNES: Record<number, LayoutTune> = {
  1: { baseWidth: 800, baseHeight: 450, top: 12, right: 0, bottom: 12, left: 0 },
  2: { baseWidth: 800, baseHeight: 450, top: 12, right: 0, bottom: 12, left: 0 },
  3: { baseWidth: 800, baseHeight: 450, top: 12, right: 0, bottom: 12, left: 0 },
  4: { baseWidth: 1200, baseHeight: 600, top: 12, right: -80, bottom: 12, left: -80 },
  5: { baseWidth: 800, baseHeight: 450, top: 12, right: 0, bottom: 12, left: 0 },
  6: { baseWidth: 1000, baseHeight: 600, top: 12, right: 0, bottom: 12, left: 0 },
  7: { baseWidth: 1000, baseHeight: 550, top: 12, right: 0, bottom: 12, left: 0 },
  8: { baseWidth: 800, baseHeight: 450, top: 12, right: 0, bottom: 12, left: 0 },
  9: { baseWidth: 800, baseHeight: 450, top: 12, right: 0, bottom: 12, left: 0 },
};

// NOTE: 값 통일 반영을 위해 키를 올려 기존 로컬 저장값을 무시(초기화 효과)
const OUTER_TUNES_STORAGE_KEY = 'outerLayoutTunes_v2';
const OUTER_TUNES_LOCKED_KEY = 'outerLayoutTunes_locked_v2';

const GAME_TUNES_STORAGE_KEY = 'gameTunes_v1';
const GAME_TUNES_LOCKED_KEY = 'gameTunes_locked_v1';

function normalizeMovableLabel(label: string) {
  return label.replace(/\s*[XY]$/, '').trim();
}

function getMovableBaseKey(key: string) {
  if (key.endsWith('X') || key.endsWith('Y')) return key.slice(0, -1);
  return key;
}

function buildMasterEditorItems(stageSchema?: StageTuneSchema): MasterEditorItem[] {
  const items: MasterEditorItem[] = [
    { id: 'outer-layout', label: '전체 화면 프레임', panel: 'outer', keys: ['top', 'right', 'bottom', 'left'] },
  ];
  if (!stageSchema) return items;

  const grouped = new Map<string, MasterEditorItem>();
  // Track which keys we've already grouped to avoid duplicates
  const groupedKeys = new Set<string>();
  for (const it of stageSchema.items) {
    const isMovableKey = it.key.endsWith('X') || it.key.endsWith('Y') || it.key.endsWith('Scale') || it.key.endsWith('scale');
    if (!isMovableKey) {
      // Non-XYScale keys (like invW, invH) get their own standalone entry
      const id = `${it.panel ?? 'tuning'}:${it.key}`;
      items.push({
        id,
        label: it.label,
        panel: it.panel ?? 'tuning',
        keys: [it.key],
      });
      groupedKeys.add(it.key);
      continue;
    }
    const baseKey = getMovableBaseKey(it.key);
    const id = `${it.panel ?? 'tuning'}:${baseKey}`;
    const existing = grouped.get(id);
    if (existing) {
      existing.keys.push(it.key);
      groupedKeys.add(it.key);
      continue;
    }
    grouped.set(id, {
      id,
      label: normalizeMovableLabel(it.label),
      panel: it.panel ?? 'tuning',
      keys: [it.key],
    });
    groupedKeys.add(it.key);
  }

  return items.concat(Array.from(grouped.values()));
}

const STAGE_TUNING_SCHEMAS: Record<number, StageTuneSchema> = {
  2: {
    title: '평촌동 지석묘 레이아웃',
    defaults: {
      mountainX: 0,
      mountainY: -40,
      mountainScale: 0.85,
      workX: -73.05906946426572,
      workY: -11.291166428811403,
      workScale: 1.1,
      capstoneX: -22,
      capstoneY: -2,
      capstoneScale: 0.4,
      logsX: -56,
      logsY: -106,
      logsScale: 0.4,
      goalX: 6,
      goalY: -60,
      goalScale: 1,
      actionBarY: 0,
    },
    items: [
      { key: 'mountainX', label: '산 X', min: -400, max: 400, step: 2 },
      { key: 'mountainY', label: '산 Y', min: -300, max: 300, step: 2 },
      { key: 'mountainScale', label: '산 크기', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'workX', label: '작업 X', min: -400, max: 400, step: 2 },
      { key: 'workY', label: '작업 Y', min: -300, max: 300, step: 2 },
      { key: 'workScale', label: '작업 크기', min: 0.5, max: 2.5, step: 0.05 },
      { key: 'capstoneX', label: '덮개돌 X', min: -400, max: 400, step: 2 },
      { key: 'capstoneY', label: '덮개돌 Y', min: -300, max: 300, step: 2 },
      { key: 'capstoneScale', label: '덮개돌 크기', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'logsX', label: '통나무 X', min: -400, max: 400, step: 2 },
      { key: 'logsY', label: '통나무 Y', min: -300, max: 300, step: 2 },
      { key: 'logsScale', label: '통나무 크기', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'goalX', label: '목표 X', min: -400, max: 400, step: 2 },
      { key: 'goalY', label: '목표 Y', min: -300, max: 300, step: 2 },
      { key: 'goalScale', label: '목표 크기', min: 0.4, max: 2.5, step: 0.05 },
      { key: 'actionBarY', label: '하단 Y', min: -250, max: 250, step: 2 },
    ],
  },
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
      boardScale: 0.9,
    },
    items: [
      { key: 'headerX', label: '상단 X', min: -300, max: 300, step: 2 },
      { key: 'headerY', label: '상단 Y', min: -120, max: 120, step: 2 },
      { key: 'boardX', label: '보드 X', min: -300, max: 300, step: 2 },
      { key: 'boardY', label: '보드 Y', min: -120, max: 220, step: 2 },
      { key: 'boardScale', label: '보드 크기', min: 0.6, max: 1.8, step: 0.05 },
    ],
  },
  7: {
    title: '비산동 가마 레이아웃',
    defaults: {
      kilnX: -4,
      kilnY: 0,
      kilnScale: 1,
      infoX: 12,
      infoY: 12,
      infoScale: 1,
      fireboxX: 14,
      fireboxY: 4,
      fireboxW: 15,
      fireboxH: 22,
      slotGroupX: -2,
      slotGroupY: 0,
      slot1X: 44,
      slot1Y: 56,
      slot2X: 61,
      slot2Y: 48,
      slotSize: 108,
      potteryScale: 1,
      inventoryX: 0,
      inventoryY: 0,
      inventoryScale: 1,
      controlsY: -15,
      controlsScale: 0.9,
      introPopupY: 18,
      introPopupScale: 1,
      tutorialPopupY: 5,
      tutorialPopupScale: 1,
      rewardPopupY: 0,
      rewardPopupScale: 0.9,
      resultPopupY: 0,
      resultPopupScale: 1,
    },
    items: [
      { key: 'kilnX', label: '가마 X', min: -300, max: 300, step: 2 },
      { key: 'kilnY', label: '가마 Y', min: -220, max: 220, step: 2 },
      { key: 'kilnScale', label: '가마 크기', min: 0.6, max: 1.8, step: 0.05 },
      { key: 'infoX', label: '설명 X', min: -200, max: 500, step: 2 },
      { key: 'infoY', label: '설명 Y', min: -100, max: 250, step: 2 },
      { key: 'infoScale', label: '설명 크기', min: 0.6, max: 1.8, step: 0.05 },
      { key: 'fireboxX', label: '연소실 X', min: 0, max: 40, step: 1, panel: 'object' },
      { key: 'fireboxY', label: '연소실 Y', min: 0, max: 50, step: 1, panel: 'object' },
      { key: 'fireboxW', label: '연소실 폭', min: 8, max: 35, step: 1, panel: 'object' },
      { key: 'fireboxH', label: '연소실 높이', min: 8, max: 35, step: 1, panel: 'object' },
      { key: 'slotGroupX', label: '소성실 전체X', min: -30, max: 30, step: 1, panel: 'object' },
      { key: 'slotGroupY', label: '소성실 전체Y', min: -30, max: 30, step: 1, panel: 'object' },
      { key: 'slot1X', label: '소성1 X', min: 20, max: 80, step: 1, panel: 'object' },
      { key: 'slot1Y', label: '소성1 Y', min: 15, max: 75, step: 1, panel: 'object' },
      { key: 'slot2X', label: '소성2 X', min: 20, max: 85, step: 1, panel: 'object' },
      { key: 'slot2Y', label: '소성2 Y', min: 15, max: 75, step: 1, panel: 'object' },
      { key: 'slotSize', label: '소성실 크기', min: 56, max: 180, step: 2, panel: 'object' },
      { key: 'potteryScale', label: '도자기 크기', min: 0.5, max: 2, step: 0.05, panel: 'object' },
      { key: 'inventoryX', label: '인벤 X', min: -250, max: 250, step: 2 },
      { key: 'inventoryY', label: '인벤 Y', min: -200, max: 200, step: 2 },
      { key: 'inventoryScale', label: '인벤 크기', min: 0.6, max: 1.8, step: 0.05 },
      { key: 'controlsY', label: '하단 Y', min: -160, max: 180, step: 2 },
      { key: 'controlsScale', label: '하단 크기', min: 0.7, max: 1.5, step: 0.05 },
      { key: 'introPopupY', label: '구조팝업 Y', min: -120, max: 120, step: 2, panel: 'object' },
      { key: 'introPopupScale', label: '구조팝업 크기', min: 0.7, max: 1.3, step: 0.05, panel: 'object' },
      { key: 'tutorialPopupY', label: '튜토리얼 Y', min: -200, max: 120, step: 2, panel: 'object' },
      { key: 'tutorialPopupScale', label: '튜토리얼 크기', min: 0.7, max: 1.3, step: 0.05, panel: 'object' },
      { key: 'rewardPopupY', label: '도자기팝업 Y', min: -120, max: 120, step: 2, panel: 'object' },
      { key: 'rewardPopupScale', label: '도자기팝업 크기', min: 0.7, max: 1.3, step: 0.05, panel: 'object' },
      { key: 'resultPopupY', label: '결과창 Y', min: -120, max: 120, step: 2, panel: 'object' },
      { key: 'resultPopupScale', label: '결과창 크기', min: 0.7, max: 1.3, step: 0.05, panel: 'object' },
    ],
  },
  6: {
    title: '안양사 퍼즐 레이아웃',
    defaults: {
      headerX: 100,
      headerY: -40,
      headerScale: 1.5,
      boardX: -81,
      boardY: 83,
      boardScale: 1.5,
      invX: 449,
      invY: 79,
      inventoryScale: 1.5,
      slotW: 170,
      slotH: 70,
      pieceScale: 1,
      invW: 300,
      invH: 300,
      piece1X: 10,
      piece1Y: -3,
      piece2X: -111,
      piece2Y: 38,
      piece3X: -181,
      piece3Y: -14,
      piece4X: -90,
      piece4Y: -55,
      piece5X: -200,
      piece5Y: -8,
      completeImgDx: -20,
      completeImgDy: -2,
      completeImgScale: 1,
      completePopupDx: 0,
      completePopupDy: 0,
      completePopupScale: 1,
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
      { key: 'invW', label: '인벤 가로', min: 100, max: 800, step: 2 },
      { key: 'invH', label: '인벤 세로', min: 80, max: 500, step: 2 },
      { key: 'snapOffsetDx', label: '스냅 X보정', min: -40, max: 40, step: 1 },
      { key: 'snapOffsetDy', label: '스냅 Y보정', min: -40, max: 40, step: 1 },
      { key: 'piece1X', label: '파편1 X', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece1Y', label: '파편1 Y', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece2X', label: '파편2 X', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece2Y', label: '파편2 Y', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece3X', label: '파편3 X', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece3Y', label: '파편3 Y', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece4X', label: '파편4 X', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece4Y', label: '파편4 Y', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece5X', label: '파편5 X', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'piece5Y', label: '파편5 Y', min: -200, max: 200, step: 2, panel: 'object' },
      { key: 'completeImgDx', label: '완성비석 X', min: -300, max: 300, step: 2, panel: 'object' },
      { key: 'completeImgDy', label: '완성비석 Y', min: -300, max: 300, step: 2, panel: 'object' },
      { key: 'completeImgScale', label: '완성비석 크기', min: 0.6, max: 1.8, step: 0.05, panel: 'object' },
      { key: 'completePopupDx', label: '완성팝업 X', min: -300, max: 300, step: 2, panel: 'object' },
      { key: 'completePopupDy', label: '완성팝업 Y', min: -300, max: 300, step: 2, panel: 'object' },
      { key: 'completePopupScale', label: '완성팝업 크기', min: 0.6, max: 1.8, step: 0.05, panel: 'object' },
    ],
  },
  8: {
    title: '만안교 레이아웃',
    defaults: {
      boardX: 0,
      boardY: 0,
      boardScaleTune: 0.85,
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
  9: {
    title: '구서 잠입 미로(줌/표식)',
    defaults: {
      zoomBase: 1,
      zoomIn: 2,
      guardZoomDist: 4,
      citizenZoomDist: 3,
    },
    items: [
      { key: 'zoomBase', label: '줌 기본', min: 0.8, max: 1.4, step: 0.05 },
      { key: 'zoomIn', label: '줌 확대', min: 1.0, max: 2.0, step: 0.05 },
      { key: 'guardZoomDist', label: '순사 거리', min: 1, max: 10, step: 1 },
      { key: 'citizenZoomDist', label: '백성 거리', min: 1, max: 10, step: 1 },
    ],
  },
};

export default function MiniGameManager() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const completeStage = useGameStore((s) => s.completeStage);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const isDevMode = useGameStore((s) => s.isDevMode);
  const isRuntimeDev = import.meta.env.DEV;
  const regionData = useGameStore((s) => s.regionData);
  const stageIdSafe = currentStageId ?? 1;
  const [masterEditorOpen, setMasterEditorOpen] = useState(false);
  const [masterEditorHoverId, setMasterEditorHoverId] = useState<string | null>(null);
  const [layoutTunes, setLayoutTunes] = useState<Record<number, LayoutTune>>(() => {
    try {
      const raw = window.localStorage.getItem(OUTER_TUNES_STORAGE_KEY);
      if (!raw) return DEFAULT_LAYOUT_TUNES;
      const parsed = JSON.parse(raw) as Record<number, LayoutTune>;
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
  const [outerTunerOpen, setOuterTunerOpen] = useState(false);
  const [innerTunerOpen, setInnerTunerOpen] = useState(false);
  const [objectTunerOpen, setObjectTunerOpen] = useState(false);

  const [gameTunes, setGameTunes] = useState<Record<number, Record<string, number>>>(() => {
    try {
      const raw = window.localStorage.getItem(GAME_TUNES_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<number, Record<string, number>>;
    } catch {
      return {};
    }
  });
  const DEFAULT_GAME_TUNES_LOCKED: Record<number, boolean> = { 6: true };
  const [gameLocked, setGameLocked] = useState<Record<number, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(GAME_TUNES_LOCKED_KEY);
      if (!raw) return { ...DEFAULT_GAME_TUNES_LOCKED };
      return { ...DEFAULT_GAME_TUNES_LOCKED, ...JSON.parse(raw) as Record<number, boolean> };
    } catch {
      return { ...DEFAULT_GAME_TUNES_LOCKED };
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

  useEffect(() => {
    if (isDevMode) return;
    setOuterTunerOpen(false);
    setInnerTunerOpen(false);
    setObjectTunerOpen(false);
  }, [isDevMode]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
  const masterEditorItems = useMemo(() => buildMasterEditorItems(stageSchema), [stageSchema]);
  const isGameLocked = !!gameLocked[stageIdSafe];
  const tuningItems = (stageSchema?.items ?? []).filter((it) => (it.panel ?? 'tuning') === 'tuning');
  const objectItems = (stageSchema?.items ?? []).filter((it) => it.panel === 'object');
  const getGameNumber = useCallback((key: string, fallback: number) => {
    const base = stageSchema?.defaults?.[key] ?? fallback;
    return gameTunes[stageIdSafe]?.[key] ?? base;
  }, [stageSchema, gameTunes, stageIdSafe]);
  const setGameNumber = (key: string, value: number) => {
    if (!stageSchema) return;
    if (isGameLocked && !masterEditorOpen) return;
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

  const copyCurrentStageCoords = async () => {
    const outerForStage = layoutTunes[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[stageIdSafe] ?? DEFAULT_LAYOUT_TUNES[1];
    const outerLockedForStage = lockedTunes[stageIdSafe];
    const gameForStage = gameTunes[stageIdSafe] ?? {};
    const gameLockedForStage = gameLocked[stageIdSafe] ?? false;

    const outerPayload = { [stageIdSafe]: outerForStage };
    const outerLockedPayload = outerLockedForStage ? { [stageIdSafe]: outerLockedForStage } : {};
    const gamePayload = Object.keys(gameForStage).length > 0 ? { [stageIdSafe]: gameForStage } : {};
    const gameLockedPayload = { [stageIdSafe]: gameLockedForStage };

    try {
      window.localStorage.setItem(OUTER_TUNES_STORAGE_KEY, JSON.stringify({ ...layoutTunes, [stageIdSafe]: outerForStage }));
      window.localStorage.setItem(OUTER_TUNES_LOCKED_KEY, JSON.stringify(outerLockedForStage ? { ...lockedTunes, [stageIdSafe]: outerLockedForStage } : lockedTunes));
      window.localStorage.setItem(GAME_TUNES_STORAGE_KEY, JSON.stringify(Object.keys(gameForStage).length > 0 ? { ...gameTunes, [stageIdSafe]: gameForStage } : gameTunes));
      window.localStorage.setItem(GAME_TUNES_LOCKED_KEY, JSON.stringify({ ...gameLocked, [stageIdSafe]: gameLockedForStage }));
    } catch {
      // ignore
    }

    const payload = {
      stageId: stageIdSafe,
      outerLayoutTunes_v2: outerPayload,
      outerLayoutTunes_locked_v2: outerLockedPayload,
      gameTunes_v1: gamePayload,
      gameTunes_locked_v1: gameLockedPayload,
    };

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    window.alert('좌표가 클립보드에 복사되었습니다! 채팅창에 Ctrl+V 해주세요.');
  };

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
        {/* 뒤로 버튼 */}
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

        {/* 우측 상단 버튼 그룹 (완료하기 + 맵으로 돌아가기, 상시 표시) */}
        <div className="absolute top-4 right-32 flex gap-2 z-[9999]">
          <button
            type="button"
            className="px-3 py-2 rounded-2xl border border-transparent bg-emerald-600/90 text-white font-black shadow-sm hover:bg-emerald-700 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              completeStage(currentStageId);
            }}
          >
            완료하기
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-2xl border border-ink/30 bg-paper text-ink font-black shadow-sm hover:bg-stone-200 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAppPhase('MAP');
            }}
          >
            맵으로 돌아가기 ↩
          </button>
        </div>

        {/* 전체 레이아웃 조절 */}
        {isDevMode && (outerTunerOpen ? (
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
        ))}

        {/* 마스터 에디터 ON/OFF 버튼 */}
        {(isRuntimeDev || isDevMode) && (
          <button
            type="button"
            className={[
              'absolute right-4 top-[60px] z-[70] px-4 py-3 rounded-2xl border font-black shadow-md transition-all',
              masterEditorOpen
                ? 'border-sky-400/70 bg-sky-600 text-white'
                : 'border-ink/30 bg-paper2/95 text-ink',
            ].join(' ')}
            onClick={(e) => {
              e.stopPropagation();
              setMasterEditorOpen((prev) => !prev);
            }}
            title="Inspector 패널"
          >
            {masterEditorOpen ? 'Inspector ON' : 'Inspector OFF'}
          </button>
        )}

        {/* 마스터 에디터 목록 패널 */}
        {(isRuntimeDev || isDevMode) && masterEditorOpen && (
          <MasterEditorFloatingPanel
            items={masterEditorItems}
            hoverId={masterEditorHoverId}
            onHoverChange={setMasterEditorHoverId}
            onCopyCoords={copyCurrentStageCoords}
            onClose={() => setMasterEditorOpen(false)}
            getNumber={getGameNumber}
            setNumber={setGameNumber}
            outerTune={currentTune}
            setOuterTune={setTune}
            stageSchemaItems={stageSchema?.items ?? []}
            isGameLocked={isGameLocked}
            isOuterLocked={isLocked}
          />
        )}

        {/* 게임 내부 레이아웃 조절 */}
        {isDevMode && stageSchema && tuningItems.length > 0 &&
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
                {tuningItems.map((it) => {
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
              내부 레이아웃
            </button>
          ))}

        {/* 오브젝트 조절 */}
        {isDevMode && stageSchema && objectItems.length > 0 &&
          (objectTunerOpen ? (
            <div
              data-tuning-panel="true"
              className="absolute right-4 top-32 z-50 w-[320px] max-w-[calc(100vw-2rem)] max-h-[calc(50vh-2rem)] rounded-2xl border border-ink/30 bg-paper2/92 px-2 py-2 shadow-md overflow-y-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-black">오브젝트</div>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-lg border border-ink/20 bg-paper text-[10px] font-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    setObjectTunerOpen(false);
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
                {objectItems.map((it) => {
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
              className="absolute right-4 top-32 z-50 px-3 py-2 rounded-2xl border border-ink/30 bg-paper2/92 text-ink font-black shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setObjectTunerOpen(true);
              }}
              title="오브젝트 조절 열기"
            >
              오브젝트
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
            {/* Fix #3: outline으로 변경하여 레이아웃 시프트 제거 */}
            {isRuntimeDev && (outerTunerOpen || masterEditorOpen) && (
              <div
                className={[
                  'absolute inset-0 z-40 rounded-3xl pointer-events-none',
                  'outline outline-[3px] outline-offset-[-3px]',
                  masterEditorHoverId === 'outer-layout'
                    ? 'outline-amber-400/80 bg-amber-100/15'
                    : 'outline-sky-400/70 bg-sky-100/10',
                ].join(' ')}
                style={masterEditorHoverId !== 'outer-layout' ? { outlineStyle: 'dashed' } : undefined}
              >
                <div className="absolute left-3 top-3 rounded-xl border border-sky-400/60 bg-paper2/92 px-3 py-1 text-[11px] font-black text-sky-700 shadow-md">
                  전체 레이아웃 드래그 이동
                </div>
                <button
                  type="button"
                  className={[
                    'absolute right-3 top-3 pointer-events-auto rounded-xl border px-3 py-2 text-[11px] font-black shadow-md',
                    masterEditorHoverId === 'outer-layout'
                      ? 'border-amber-400/80 bg-amber-200/85 text-amber-900'
                      : 'border-sky-400/60 bg-paper2/92 text-sky-700',
                  ].join(' ')}
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('[data-tuning-panel="true"]')) return;
                    e.stopPropagation();
                    // outerDragRef logic removed - use Inspector panel instead
                  }}
                  title="전체 프레임 (Inspector에서 수치 입력)"
                >
                  프레임 (Inspector)
                </button>
              </div>
            )}

            <FitScaleWrapper baseWidth={fit.baseWidth} baseHeight={fit.baseHeight}>
              <GameTuningProvider
                value={{
                  stageId: currentStageId,
                  getNumber: getGameNumber,
                  setNumber: setGameNumber,
                  reset: resetGameTunes,
                  locked: masterEditorOpen ? false : isGameLocked,
                  setLocked: (locked) => setGameLocked((prev) => ({ ...prev, [currentStageId]: locked })),
                  innerTunerOpen: innerTunerOpen || masterEditorOpen,
                  masterEditorOpen,
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