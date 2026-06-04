import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';

type Phase = 'BUILD' | 'FORCE' | 'RESULT';

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

function makeSlots() {
  // 스펙 기반: 800x450 기준 반원 궤도 자동 계산
  // Center: (400, 350), Radius: 200
  const cx = 400;
  const cy = 350;
  const r = 200;

  return Array.from({ length: SLOT_COUNT }).map((_, index) => {
    const theta = 180 - index * 15; // deg
    const radian = theta * (Math.PI / 180);
    const x = cx + r * Math.cos(radian);
    const y = cy - r * Math.sin(radian); // DOM 좌표계 y축 반전
    return { index, theta, x, y };
  });
}

const SLOTS = makeSlots();

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

// 튜토리얼: "각각의 1번(좌/우)"부터 안내
// - 아래(1번)부터 위로(6번) 채우고, 마지막에 종석(keystone)을 끼우는 흐름
const TUTORIAL_ORDER: number[] = [
  0, // left_1 (가장 아래)
  12, // right_1 (가장 아래)
  1, // left_2
  11, // right_2
  2, // left_3
  10, // right_3
  3, // left_4
  9, // right_4
  4, // left_5
  8, // right_5
  5, // left_6
  7, // right_6
  6, // keystone (마지막)
];

export default function MananGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = stageTitle;

  const mainBg = useMemo(() => getRelicMainImage(stageId), [stageId]);
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('BUILD');
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

  // 튜토리얼 UI/상태
  const requiredIndex = useMemo(() => {
    if (phase !== 'BUILD') return null;
    for (const idx of TUTORIAL_ORDER) {
      if (slotPieces[idx] == null) return idx;
    }
    return null;
  }, [phase, slotPieces]);
  const tutorialActive = phase === 'BUILD' && requiredIndex != null;

  const tutorialText = useMemo(() => {
    if (!tutorialActive || requiredIndex == null) return '';
    const piece = PUZZLE_PIECES.find((p) => p.index === requiredIndex);
    if (!piece) return '아래부터 순서대로 끼워보자!';
    if (piece.id === 'keystone') return '마지막! 중앙 종석(keystone)을 끼워 완성해보자!';
    if (piece.id.startsWith('left_')) return `왼쪽 ${piece.id.replace('left_', '')}번 주춧돌을 끼워보자!`;
    if (piece.id.startsWith('right_')) return `오른쪽 ${piece.id.replace('right_', '')}번 주춧돌을 끼워보자!`;
    return '아래부터 순서대로 끼워보자!';
  }, [tutorialActive, requiredIndex]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string, ms = 1300) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const beginDrag = (e: React.PointerEvent, pieceIndex: number, origin: DragState['origin'], originSlotIdx: number | null) => {
    startIfNeeded();
    if (phase !== 'BUILD') return;
    if (tutorialActive && requiredIndex !== pieceIndex) {
      showToast('튜토리얼 조각부터 끼워보자!');
      return;
    }
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
    if (tutorialActive && requiredIndex !== pieceIndex) {
      showToast('아래부터 순서대로 끼워보자!');
      return;
    }
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
    // 다음 튜토리얼 안내는 slotPieces 기반으로 자동 갱신됨
  };

  // Phase 1 완료 → Phase 2(힘의 분산)
  const [showInfo, setShowInfo] = useState(false);
  const [forceStep, setForceStep] = useState<'DOWN' | 'SPREAD' | 'DONE'>('DOWN');
  const forceTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (phase !== 'BUILD') return;
    if (!allPlaced) return;
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    // 이전 타이머가 남아있을 가능성 방지
    forceTimersRef.current.forEach((id) => window.clearTimeout(id));
    forceTimersRef.current = [];

    const t = window.setTimeout(() => {
      setPhase('FORCE');
      setShowInfo(true);
      setForceStep('DOWN');
      audio.playUrl('/assets/sounds/sfx_rock_impact.mp3', 0.85);
      const t1 = window.setTimeout(() => setForceStep('SPREAD'), 650);
      const t2 = window.setTimeout(() => setForceStep('DONE'), 1700);
      const t3 = window.setTimeout(() => setPhase('RESULT'), 2400);
      forceTimersRef.current = [t1, t2, t3];
    }, 600);
    return () => {
      window.clearTimeout(t);
      forceTimersRef.current.forEach((id) => window.clearTimeout(id));
      forceTimersRef.current = [];
    };
  }, [phase, allPlaced]);

  const [resultModal, setResultModal] = useState(false);
  useEffect(() => {
    if (phase !== 'RESULT') return;
    setShowInfo(false);
    setResultModal(true);
  }, [phase]);

  return (
    <div className="w-full h-full text-ink relative">
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

      <div className="absolute left-0 right-0 top-0 z-50 px-2 pt-2 flex items-center justify-between gap-2 pointer-events-none">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'BUILD' ? 'Phase 1' : 'Phase 2'}</div>
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
              transform: `translateY(${BOARD_SHIFT_Y}px) scale(${BOARD_SCALE})`,
              transformOrigin: 'center',
            }}
          >
            {/* 배경 레이어: front + blueprint(Phase1) / complete(완성) */}
            <div
              className="absolute inset-0 bg-center bg-no-repeat bg-contain pointer-events-none"
              style={{ backgroundImage: `url('${BG_FRONT}')` }}
            />
            {phase === 'BUILD' ? (
              <div
                className="absolute inset-0 bg-center bg-no-repeat bg-contain opacity-90 pointer-events-none"
                style={{ backgroundImage: `url('${BG_BLUEPRINT}')` }}
              />
            ) : (
              <div
                className="absolute inset-0 bg-center bg-no-repeat bg-contain pointer-events-none"
                style={{ backgroundImage: `url('${BG_COMPLETE}')` }}
              />
            )}

            {/* 다리 본체(중앙) */}
            <div className="absolute inset-0">
              {/* 슬롯(반원 궤도) + 배치된 퍼즐 */}
              {SLOTS.map((s) => {
                const pieceIndex = slotPieces[s.index];
                const piece = pieceIndex != null ? PUZZLE_PIECES.find((p) => p.index === pieceIndex) : null;
                const isBuild = phase === 'BUILD';
                const isTutorSlot = tutorialActive && requiredIndex === s.index && !piece;

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
              {phase !== 'BUILD' && (
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
              {showInfo && (
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
          <div className="absolute left-3 right-3 bottom-3 rounded-3xl border border-ink/20 bg-paper/70 px-3 py-2 z-40 overflow-visible">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold opacity-90">퍼즐 조각을 끼워보자! ({placedCount}/{SLOT_COUNT})</div>
              {phase === 'BUILD' ? <div className="text-[11px] opacity-80">드래그</div> : null}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2 justify-items-center">
              {inventoryOrder.map((pieceIndex) => {
                const piece = PUZZLE_PIECES.find((p) => p.index === pieceIndex)!;
                const placed = slotPieces.includes(pieceIndex);
                const isTutorPiece = tutorialActive && requiredIndex === pieceIndex;
                return (
                  <div
                    key={piece.id}
                    className={[
                      // 인벤토리 높이를 줄여 슬롯과 겹침을 추가로 완화
                      'w-[64px] h-[48px] rounded-2xl border border-ink/20 bg-paper2/90 shadow-md grid place-items-center touch-none select-none relative transition-all',
                      phase !== 'BUILD' ? 'opacity-45' : 'cursor-grab active:cursor-grabbing hover:bg-paper2',
                      placed ? 'opacity-45 cursor-not-allowed' : '',
                      isTutorPiece ? 'ring-2 ring-amber-300/80 animate-pulse' : '',
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

          {/* 튜토리얼 안내 */}
          {tutorialActive && (
            <div className="absolute left-1/2 top-14 -translate-x-1/2 z-50 pointer-events-none">
              <div className="note-panel px-4 py-3 max-w-[520px]">
                <div className="text-sm font-black">튜토리얼</div>
                <div className="mt-1 text-sm opacity-90">
                  {tutorialText}
                </div>
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
