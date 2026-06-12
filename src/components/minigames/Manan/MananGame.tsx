import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import { useToast } from '../common/useToast';
import { useGameTuning } from '../../common/GameTuningContext';
import HanYangCoach from '../common/HanYangCoach';

type Phase = 'INTRO' | 'BUILD' | 'MERGE' | 'BRIDGE_REVEAL' | 'FORCE' | 'RESULT';

type DragState = {
  pieceIndex: number;
  origin: 'inventory' | 'slot';
  originSlotIdx: number | null;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const SLOT_COUNT = 13;
const BASE_W = 800;
const BASE_H = 450;
const BOARD_SCALE = 0.92;
// 인벤토리(하단 2줄)와 겹치지 않도록 보드(blueprint+슬롯) 전체를 위로 이동
const BOARD_SHIFT_Y = -110;
const ARC_CX = 400;
const ARC_CY = 350;
const ARC_R_START = 225;
const ARC_R_END = 140;
const THETA_OFFSET_DEG = 0;

const BG_BLUEPRINT = '/assets/images/relic_bridge_blueprint.png';
const BG_FRONT = '/assets/images/relic_bridge_front.png';
const BG_COMPLETE = '/assets/images/relic_bridge.png';

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeSlots(cx: number, cy: number, r: number) {
  return Array.from({ length: SLOT_COUNT }).map((_, index) => {
    const theta = 180 - index * 15 + THETA_OFFSET_DEG; // deg
    const radian = theta * (Math.PI / 180);
    const x = cx + r * Math.cos(radian);
    const y = cy - r * Math.sin(radian); // DOM 좌표계 y축 반전
    return { index, theta, x, y };
  });
}

type PuzzlePiece = { index: number; id: string; src: string };

// NOTE:
// - 슬롯 index(0~12)와 조각 index가 일치할 때만 정답으로 스냅됨
// - naming 가정: left_1이 keystone에 가장 가까운 쪽, left_6이 가장 왼쪽 끝
const PUZZLE_PIECES: PuzzlePiece[] = [
  // 좌측은 "1번이 가장 아래" 기준으로 1 → 6 순서로 위로 올라가도록 매핑
  { index: 0, id: 'left_1', src: '/assets/images/left_1.png' },
  { index: 1, id: 'left_2', src: '/assets/images/left_2.png' },
  { index: 2, id: 'left_3', src: '/assets/images/left_3.png' },
  { index: 3, id: 'left_4', src: '/assets/images/left_4.png' },
  { index: 4, id: 'left_5', src: '/assets/images/left_5.png' },
  { index: 5, id: 'left_6', src: '/assets/images/left_6.png' },
  { index: 6, id: 'keystone', src: '/assets/images/keystone.png' },
  // 우측은 keystone에 가까운 쪽이 6, 바깥(아래)이 1이 되도록 역순 매핑
  { index: 7, id: 'right_6', src: '/assets/images/right_6.png' },
  { index: 8, id: 'right_5', src: '/assets/images/right_5.png' },
  { index: 9, id: 'right_4', src: '/assets/images/right_4.png' },
  { index: 10, id: 'right_3', src: '/assets/images/right_3.png' },
  { index: 11, id: 'right_2', src: '/assets/images/right_2.png' },
  { index: 12, id: 'right_1', src: '/assets/images/right_1.png' },
];

export default function MananGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = stageTitle;

  const mainBg = useMemo(() => getRelicMainImage(stageId), [stageId]);
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  // 1) relic_bridge_front로 원리 설명 → 2) 조립 시작(blueprint) → 3) r 축소로 "합체" → 4) relic_bridge 공개 → 5) 힘의 분산 확인
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // 배치 상태: slotIdx -> pieceIndex
  const [slotPieces, setSlotPieces] = useState<(number | null)[]>(() => Array.from({ length: SLOT_COUNT }, () => null));
  const placedCount = slotPieces.filter((v) => v !== null).length;
  const allPlaced = placedCount >= SLOT_COUNT;

  // 인벤토리(13개): 2줄(7+6)로 보여주되, 조각 자체는 모두 노출(재배치 허용)
  const [inventoryOrder] = useState(() => shuffle(PUZZLE_PIECES.map((p) => p.index)));

  // drag
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragThreshold = 3;

  const boardRef = useRef<HTMLDivElement | null>(null);

  // 합체 연출용 r 값
  const [arcR, setArcR] = useState<number>(ARC_R_START);
  const [flash, setFlash] = useState(false);

  const slots = useMemo(() => computeSlots(ARC_CX, ARC_CY, arcR), [arcR]);

  // (요청) 번호 없이: "다음 슬롯"만 하이라이트로 안내
  const requiredIndex = useMemo(() => {
    const order = [0, 12, 1, 11, 2, 10, 3, 9, 4, 8, 5, 7, 6];
    for (const idx of order) {
      if (slotPieces[idx] == null) return idx;
    }
    return null;
  }, [slotPieces]);
  const highlightActive = (phase === 'BUILD' || phase === 'MERGE') && requiredIndex != null;

  // (요청) 팝업은 left_1을 "끼울 때"만 1회 출력
  const [showFirstPopup, setShowFirstPopup] = useState(false);
  const { toast, showToast } = useToast(1300);
  const [coachOpen, setCoachOpen] = useState(true);
  const coachText = useMemo(() => {
    if (phase === 'INTRO') return '한: 만안교의 흔적을 찾아 다리의 길을 복원해보자.\n양: 안내에 따라 길을 연결하면 돼!';
    if (phase === 'PLAY') return '한: 표시된 경로를 따라 다리를 완성해보자.\n양: 실수하면 다시 시도할 수 있어!';
    return '한: 잘했어! 만안교 이야기가 다시 이어졌어.\n양: 계속 진행해보자!';
  }, [phase]);
  const tuning = useGameTuning();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ui = useMemo(() => {
    const get = (k: string, fallback: number) => tuning?.getNumber(k, fallback) ?? fallback;
    return {
      boardX: get('boardX', 0),
      boardY: get('boardY', 0),
      boardScaleTune: get('boardScaleTune', 1),
      inventoryX: get('inventoryX', 0),
      inventoryY: get('inventoryY', 0),
      inventoryScale: get('inventoryScale', 1),
    };
  }, [tuning]);
  const layoutDragRef = useRef<null | {
    target: 'board' | 'inventory';
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = layoutDragRef.current;
      if (!drag || !tuning || tuning.locked || !tuning.innerTunerOpen) return;
      const el = rootRef.current;
      const scale = el ? Math.max(el.getBoundingClientRect().width / Math.max(el.offsetWidth, 1), 0.0001) : 1;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      if (drag.target === 'board') {
        tuning.setNumber('boardX', drag.baseX + dx);
        tuning.setNumber('boardY', drag.baseY + dy);
      } else {
        tuning.setNumber('inventoryX', drag.baseX + dx);
        tuning.setNumber('inventoryY', drag.baseY + dy);
      }
    };
    const up = () => {
      layoutDragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [tuning]);

  const beginDrag = (e: React.PointerEvent, pieceIndex: number, origin: DragState['origin'], originSlotIdx: number | null) => {
    startIfNeeded();
    if (phase !== 'BUILD') return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    setDrag({
      pieceIndex,
      origin,
      originSlotIdx,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - centerX,
      offsetY: e.clientY - centerY,
      moved: false,
    });
  };

  const startDragFromInventory = (e: React.PointerEvent, pieceIndex: number) => {
    // 재배치 금지: 이미 맞춘 조각은 다시 집을 수 없음
    if (slotPieces.includes(pieceIndex)) {
      showToast('이미 끼운 조각이에요!');
      return;
    }
    beginDrag(e, pieceIndex, 'inventory', null);
  };

  const startDragFromSlot = (e: React.PointerEvent, slotIdx: number) => {
    // 재배치 금지: 슬롯에서 다시 빼는 기능은 사용하지 않음
    e.preventDefault();
  };

  const updateDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = Math.abs(e.clientX - drag.startX);
    const dy = Math.abs(e.clientY - drag.startY);
    setDrag((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX,
            y: e.clientY,
            moved: prev.moved || dx + dy > dragThreshold,
          }
        : prev
    );
  };

  const placeToSlot = (slotIdx: number, pieceIndex: number) => {
    setSlotPieces((prev) => {
      const next = prev.slice();
      // 재배치/덮어쓰기 금지: 슬롯이 비어있을 때만 채움
      if (next[slotIdx] != null) return prev;
      next[slotIdx] = pieceIndex;
      return next;
    });
    audio.playSfx('correct', 0.75);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const ended = drag;
    setDrag(null);
    if (phase !== 'BUILD') return;

    const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const slotAttr = elUnder?.closest?.('[data-slot]')?.getAttribute('data-slot');
    const revert = () => {
      if (ended.origin === 'slot' && ended.originSlotIdx != null) {
        setSlotPieces((prev) => {
          const next = prev.slice();
          next[ended.originSlotIdx as number] = ended.pieceIndex;
          return next;
        });
      }
    };

    if (!slotAttr) {
      if (ended.origin === 'slot') {
        setAttempts((a) => a + 1);
        audio.playSfx('wrong', 0.75);
      }
      revert();
      return;
    }

    const idx = Number(slotAttr);
    if (Number.isNaN(idx) || idx < 0 || idx >= SLOT_COUNT) {
      revert();
      return;
    }

    // 정답 판정: 조각 index와 슬롯 index가 일치해야만 스냅
    if (idx !== ended.pieceIndex) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      revert();
      return;
    }

    placeToSlot(idx, ended.pieceIndex);

    // left_1(=index 0)을 "처음 끼운 순간"에만 팝업 1회 노출
    if (ended.pieceIndex === 0 && slotPieces[0] == null) {
      setShowFirstPopup(true);
      window.setTimeout(() => setShowFirstPopup(false), 1400);
    }
  };

  // BUILD 진입 시 r 초기화
  useEffect(() => {
    if (phase !== 'BUILD') return;
    setArcR(ARC_R_START);
  }, [phase]);

  // 퍼즐 완성 시: r 225 -> 140로 천천히 줄어드는 "합체" 연출 시작
  useEffect(() => {
    if (phase !== 'BUILD') return;
    if (!allPlaced) return;
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    setPhase('MERGE');
  }, [phase, allPlaced]);

  useEffect(() => {
    if (phase !== 'MERGE') return;
    const from = ARC_R_START;
    const to = ARC_R_END;
    const durationMs = 1400;
    const t0 = performance.now();
    let raf = 0;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const v = from + (to - from) * easeOutCubic(p);
      setArcR(Number(v.toFixed(2)));
      if (p < 1) raf = window.requestAnimationFrame(tick);
      else {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 220);
        window.setTimeout(() => setPhase('BRIDGE_REVEAL'), 180);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [phase]);

  // relic_bridge 공개 후, front로 부드럽게 전환하며 힘의 분산 단계로 진행
  useEffect(() => {
    if (phase !== 'BRIDGE_REVEAL') return;
    const t = window.setTimeout(() => setPhase('FORCE'), 900);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Phase 2(힘의 분산) 시퀀스: COMPLETE 팝업에서 클릭으로 시작
  const [showInfo, setShowInfo] = useState(false);
  const [forceStep, setForceStep] = useState<'DOWN' | 'SPREAD' | 'DONE'>('DOWN');
  const forceTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (phase !== 'FORCE') return;
    setShowInfo(true);
    setForceStep('DOWN');
    audio.playUrl('/assets/sounds/sfx_rock_impact.mp3', 0.85);

    // 타이머 등록/클린업
    const t1 = window.setTimeout(() => setForceStep('SPREAD'), 650);
    const t2 = window.setTimeout(() => setForceStep('DONE'), 1700);
    const t3 = window.setTimeout(() => setPhase('RESULT'), 2400);
    forceTimersRef.current = [t1, t2, t3];

    return () => {
      forceTimersRef.current.forEach((id) => window.clearTimeout(id));
      forceTimersRef.current = [];
    };
  }, [phase]);

  const [resultModal, setResultModal] = useState(false);
  useEffect(() => {
    if (phase !== 'RESULT') return;
    setShowInfo(false);
    setResultModal(true);
  }, [phase]);

  return (
    <div ref={rootRef} className="w-full h-full text-ink relative">
      <style>{`
        @keyframes arrowDown {
          0% { transform: translate(-50%, -18px); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translate(-50%, 10px); opacity: 1; }
        }
        .arrowDownFx { animation: arrowDown 620ms cubic-bezier(.2,.9,.2,1) both; }

        @keyframes dash {
          from { stroke-dashoffset: 260; opacity: 0.1; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        .dashFx { stroke-dasharray: 260; stroke-dashoffset: 260; animation: dash 920ms ease-out both; }

        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(245,158,11,0)); }
          50% { filter: drop-shadow(0 0 16px rgba(245,158,11,0.55)); }
        }
        .glowFx { animation: glowPulse 1.2s ease-in-out infinite; }
      `}</style>

      {coachOpen && phase !== 'RESULT' && (
        <div className="absolute left-3 top-3 z-[9000]">
          <HanYangCoach title="한·양 설명" text={coachText} onClose={() => setCoachOpen(false)} />
        </div>
      )}

      <div className="absolute left-0 right-0 top-0 z-50 px-2 pt-2 flex items-center justify-between gap-2 pointer-events-none">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">
          {phase === 'INTRO' ? '설명' : phase === 'BUILD' ? '조립' : phase === 'MERGE' ? '합체' : phase === 'BRIDGE_REVEAL' ? '완성' : '원리'}
        </div>
      </div>

      <div ref={boardRef} className="absolute inset-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden">
        {/* 800x450 좌표계를 보장하는 스테이지 컨테이너 */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: `${BASE_W}px`, height: `${BASE_H}px` }}
        >
          {/* 배경 + 슬롯은 같이 축소(블루프린트가 "커 보이는" 문제 해결 + 좌표 정합 유지) */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${ui.boardX}px, ${BOARD_SHIFT_Y + ui.boardY}px) scale(${BOARD_SCALE * ui.boardScaleTune})`,
              transformOrigin: 'center',
            }}
          >
            {tuning?.innerTunerOpen && !tuning.locked && (
              <div
                className="absolute inset-0 z-30 rounded-3xl ring-2 ring-sky-300/60 bg-sky-100/10 cursor-move"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  layoutDragRef.current = { target: 'board', startX: e.clientX, startY: e.clientY, baseX: ui.boardX, baseY: ui.boardY };
                }}
              />
            )}
            {/* 배경 레이어 */}
            <div
              className="absolute inset-0 bg-center bg-no-repeat bg-contain pointer-events-none transition-opacity duration-500"
              style={{ backgroundImage: `url('${BG_FRONT}')`, opacity: phase === 'BRIDGE_REVEAL' ? 0 : 1 }}
            />
            {(phase === 'BUILD' || phase === 'MERGE') ? (
              <div
                className="absolute inset-0 bg-center bg-no-repeat bg-contain pointer-events-none"
                style={{ backgroundImage: `url('${BG_BLUEPRINT}')`, opacity: 1 }}
              />
            ) : null}
            <div
              className="absolute inset-0 bg-center bg-no-repeat bg-contain pointer-events-none transition-opacity duration-500"
              style={{ backgroundImage: `url('${BG_COMPLETE}')`, opacity: phase === 'BRIDGE_REVEAL' ? 1 : 0 }}
            />
            {flash ? <div className="absolute inset-0 bg-white/75 pointer-events-none" /> : null}

            {/* 다리 본체(중앙) */}
            <div className="absolute inset-0">
              {/* 슬롯(반원 궤도) + 배치된 퍼즐 */}
              {(phase === 'BUILD' || phase === 'MERGE') && slots.map((s) => {
                const pieceIndex = slotPieces[s.index];
                const piece = pieceIndex != null ? PUZZLE_PIECES.find((p) => p.index === pieceIndex) : null;
                const isBuild = phase === 'BUILD';
                const isTutorSlot = highlightActive && requiredIndex === s.index && !piece;

                return (
                  <div
                    key={s.index}
                    data-slot={s.index}
                    className={[
                      'absolute -translate-x-1/2 -translate-y-1/2',
                      isBuild ? 'cursor-pointer' : 'pointer-events-none',
                    ].join(' ')}
                    style={{ left: `${s.x}px`, top: `${s.y}px` }}
                    title={isBuild ? '여기에 조각을 끼워보자!' : ''}
                  >
                    {/* 빈 슬롯 표시(점선/테두리 숨김). 튜토리얼 슬롯만 링으로 안내 */}
                    <div
                      className={[
                        'w-[80px] h-[62px] rounded-2xl grid place-items-center transition-all',
                        isTutorSlot ? 'ring-2 ring-amber-300/80 shadow-[0_0_18px_rgba(245,158,11,0.25)]' : '',
                      ].join(' ')}
                    >
                      {piece ? (
                        <img
                          src={piece.src}
                          alt=""
                          className="w-full h-full object-contain select-none"
                          draggable={false}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {/* 힘의 분산 애니메이션 오버레이 */}
              {(phase === 'FORCE' || phase === 'RESULT') && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* 아래로 누르는 힘 */}
                  {forceStep === 'DOWN' || forceStep === 'SPREAD' || forceStep === 'DONE' ? (
                    <div className="absolute left-1/2 top-[10%] arrowDownFx">
                      <svg width="70" height="120" viewBox="0 0 70 120">
                        <path d="M35 10 V80" stroke="#D9534F" strokeWidth="10" strokeLinecap="round" />
                        <path d="M20 70 L35 105 L50 70" fill="none" stroke="#D9534F" strokeWidth="10" strokeLinecap="round" />
                      </svg>
                    </div>
                  ) : null}

                  {/* 좌우로 퍼지는 힘 */}
                  {forceStep === 'SPREAD' || forceStep === 'DONE' ? (
                    <div className="absolute inset-0">
                      <svg className="w-full h-full" viewBox="0 0 800 450">
                        {/* 좌 */}
                        <path
                          d="M400 120 C 340 160, 300 210, 260 270 C 220 330, 190 350, 150 360"
                          fill="none"
                          stroke="#D9534F"
                          strokeWidth="10"
                          strokeLinecap="round"
                          className="dashFx"
                        />
                        {/* 우 */}
                        <path
                          d="M400 120 C 460 160, 500 210, 540 270 C 580 330, 610 350, 650 360"
                          fill="none"
                          stroke="#D9534F"
                          strokeWidth="10"
                          strokeLinecap="round"
                          className="dashFx"
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>
              )}

              {/* 안내 팝업 */}
              {(phase === 'FORCE' || phase === 'RESULT') && showInfo && (
                <div className="absolute inset-0 grid place-items-center bg-ink/25">
                  <div className="note-panel px-5 py-4 max-w-[520px] glowFx">
                    <div className="text-sm font-black">힘의 분산 원리</div>
                    <div className="mt-2 text-sm leading-relaxed opacity-95">
                      위에서 누르는 힘이 양옆으로 분산되어 아주 튼튼해요!
                    </div>
                  </div>
                </div>
              )}
        </div>
          </div>

          {/* 인벤토리(하단 2줄: 7+6) */}
          {phase === 'BUILD' && (
          <div className="absolute left-3 right-3 bottom-3 rounded-3xl border border-ink/20 bg-paper/70 px-3 py-2 z-40 overflow-visible">
            <div
              className={tuning?.innerTunerOpen && !tuning.locked ? 'rounded-3xl ring-2 ring-sky-300/60 bg-sky-100/10 cursor-move' : ''}
              style={{ transform: `translate(${ui.inventoryX}px, ${ui.inventoryY}px) scale(${ui.inventoryScale})`, transformOrigin: 'bottom center' }}
              onPointerDown={(e) => {
                if (!tuning?.innerTunerOpen || tuning.locked) return;
                e.stopPropagation();
                layoutDragRef.current = { target: 'inventory', startX: e.clientX, startY: e.clientY, baseX: ui.inventoryX, baseY: ui.inventoryY };
              }}
            >
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold opacity-90">퍼즐 조각을 끼워보자! ({placedCount}/{SLOT_COUNT})</div>
              {phase === 'BUILD' ? <div className="text-[11px] opacity-80">드래그</div> : null}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2 justify-items-center">
              {inventoryOrder.map((pieceIndex) => {
                const piece = PUZZLE_PIECES.find((p) => p.index === pieceIndex)!;
                const placed = slotPieces.includes(pieceIndex);
                const isHintPiece = highlightActive && requiredIndex === pieceIndex && !placed;
                return (
                  <div
                    key={piece.id}
                    className={[
                      // 인벤토리 높이를 줄여 슬롯과 겹침을 추가로 완화
                      'w-[64px] h-[48px] rounded-2xl border border-ink/20 bg-paper2/90 shadow-md grid place-items-center touch-none select-none relative transition-all',
                      phase !== 'BUILD' ? 'opacity-45' : 'cursor-grab active:cursor-grabbing hover:bg-paper2',
                      placed ? 'opacity-45 cursor-not-allowed' : '',
                      // 슬롯 하이라이트 + 인벤토리에서도 같은 조각을 깜빡이며 유도
                      isHintPiece ? 'ring-2 ring-amber-300/80 animate-pulse' : '',
                    ].join(' ')}
                    onPointerDown={(e) => startDragFromInventory(e, pieceIndex)}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    title="드래그해서 슬롯에 끼워보자!"
                  >
                    <img src={piece.src} alt="" className="w-full h-full object-contain" draggable={false} />
                    {placed ? <div className="absolute right-1 top-1 w-2 h-2 rounded-full bg-olive/80" /> : null}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
          )}

          {/* 팝업은 left_1을 끼울 때만 출력 */}
          {showFirstPopup && (
            <div className="absolute left-1/2 top-14 -translate-x-1/2 z-50 pointer-events-none">
              <div className="note-panel px-4 py-3 max-w-[520px]">
                <div className="text-sm font-black">좋아!</div>
                <div className="mt-1 text-sm opacity-90">이제 하이라이트된 칸을 따라 아래에서 위로 끼워보자.</div>
              </div>
            </div>
          )}

          {/* 토스트 */}
          {toast && (
            <div className="absolute left-1/2 top-2 -translate-x-1/2 z-[9000] pointer-events-none">
              <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
            </div>
          )}
        </div>

        {/* 드래그 고스트 */}
        {drag && (
          <div
            className="fixed z-[99999] pointer-events-none"
            style={{
              left: drag.x - drag.offsetX,
              top: drag.y - drag.offsetY,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-[64px] h-[48px] rounded-2xl border border-ink/25 bg-paper2/95 shadow-paper grid place-items-center">
              <img
                src={PUZZLE_PIECES.find((p) => p.index === drag.pieceIndex)?.src ?? ''}
                alt=""
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>
          </div>
        )}
        {/* end stage container */}
      </div>

      {/* INTRO: 아치 구조 설명 후 조립 시작 */}
      {phase === 'INTRO' && (
        <div className="absolute inset-0 z-[12000] grid place-items-center p-4">
          <div className="note-panel px-5 py-4 max-w-[560px]">
            <div className="text-sm font-black">홍예(아치) 구조는 왜 튼튼할까요?</div>
            <div className="mt-2 text-sm opacity-90 leading-relaxed">
              둥근 아치는 위에서 누르는 힘을 양옆으로 분산시켜서 쉽게 무너지지 않아요.
              <br />
              이제 만안교의 홍예를 직접 조립해볼까요?
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl bg-stamp text-white border border-ink/25 font-black py-3 shadow-md hover:opacity-95"
              onClick={() => {
                startIfNeeded();
                audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75);
                setPhase('BUILD');
              }}
            >
              조립 시작하기
            </button>
          </div>
        </div>
      )}

      {/* MERGE/BRIDGE_REVEAL은 자동 연출로 처리(별도 클릭 팝업 없음) */}

      {/* 결과 모달 */}
      {resultModal && (
        <div className="fixed inset-0 z-[99999] bg-ink/35 p-0">
          <div className="w-full h-full bg-paper2 text-ink shadow-paper flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <img src={realImg} alt="" className="w-full h-full object-cover" draggable={false} />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/70">
              <div className="text-lg font-black">성공! 홍예 구조 완성</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                성공! 홍예 구조의 원리를 통해 정조대왕의 효심이 담긴 만안교가 튼튼하게 이어졌어요!
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-olive text-white border border-ink/25 font-black py-3 shadow-md hover:opacity-95"
                onClick={() => {
                  const now = Date.now();
                  const started = startedAt ?? now;
                  const clearTime = Math.max(0, Math.round(((now - started) / 1000) * 10) / 10);
                  onComplete({ attempts, clearTime });
                }}
              >
                지도로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
