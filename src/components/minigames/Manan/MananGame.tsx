import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';

type Phase = 'BUILD' | 'FORCE' | 'RESULT';

type DragState = {
  stoneId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const PIECE_COUNT = 10;
const BRIDGE_IMG = '/assets/images/relic_bridge.jpeg';

// 퍼즐 캔버스(아치 이미지 표시 영역) - 800x450 안에서 보기 좋게
const ARCH_W = 560;
const ARCH_H = 260;
const PIECE_W = 76;
const PIECE_H = 64;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildClipPolygons() {
  // 가운데는 더 뾰족/윗부분이 높고, 양끝으로 갈수록 윗부분이 내려오는 형태로 살짝 곡선감 부여
  const mid = (PIECE_COUNT - 1) / 2;
  return Array.from({ length: PIECE_COUNT }).map((_, i) => {
    const d = Math.abs(i - mid) / mid; // 0(중앙) ~ 1(끝)
    const topY = Math.round(6 + d * 16); // 6~22
    const topInset = Math.round(16 + d * 10); // 16~26
    const bottomInset = Math.round(6 + d * 4); // 6~10
    const tipY = Math.max(0, topY - 8);
    return `polygon(${bottomInset}% 100%, ${100 - bottomInset}% 100%, ${100 - topInset}% ${topY}%, 50% ${tipY}%, ${topInset}% ${topY}%)`;
  });
}

const CLIPS = buildClipPolygons();

function buildSlots() {
  // ARCH_W x ARCH_H 안에서, 위로 볼록한 반원 형태로 10개 위치
  const cx = ARCH_W / 2;
  const cy = ARCH_H * 0.96; // 아치의 중심은 아래쪽에 위치
  const r = 175;
  const start = 200; // deg (좌하단)
  const end = -20; // deg (우하단)
  return Array.from({ length: PIECE_COUNT }).map((_, i) => {
    const t = i / (PIECE_COUNT - 1);
    const deg = start + (end - start) * t;
    const rad = (deg * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r;
    // IMPORTANT: y 반전(브라우저 좌표계)
    const y = cy - Math.sin(rad) * r;
    const rectX = x - PIECE_W / 2;
    const rectY = y - PIECE_H / 2;
    return {
      idx: i,
      deg,
      x,
      y,
      rectX,
      rectY,
    };
  });
}

const SLOTS = buildSlots();

function BridgePiece({
  idx,
  variant = 'normal',
}: {
  idx: number;
  variant?: 'normal' | 'ghost';
}) {
  const slot = SLOTS[idx];
  return (
    <div
      className={[
        'rounded-2xl border shadow-md',
        variant === 'ghost' ? 'border-ink/35 bg-paper2/95 opacity-95' : 'border-ink/25 bg-paper2/90',
      ].join(' ')}
      style={{
        width: `${PIECE_W}px`,
        height: `${PIECE_H}px`,
        clipPath: CLIPS[idx],
        backgroundImage: `url('${BRIDGE_IMG}')`,
        backgroundRepeat: 'no-repeat',
        // 모든 조각이 동일한 원본을 쓰되, 같은 기준(ARCH_W/ARCH_H)에 맞춰 정렬
        backgroundSize: `${ARCH_W}px ${ARCH_H}px`,
        backgroundPosition: `${-slot.rectX}px ${-slot.rectY}px`,
        filter: variant === 'ghost' ? 'drop-shadow(0 14px 22px rgba(74,55,40,0.25))' : 'none',
      }}
    />
  );
}

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

  // 배치 상태: slotIdx -> stoneId
  const [slotStones, setSlotStones] = useState<(number | null)[]>(() => Array.from({ length: PIECE_COUNT }, () => null));
  // NOTE: stoneId는 0~8까지 가능하므로 Boolean 필터를 쓰면 0이 누락됨(= 9개 꽂아도 8개로 계산되는 버그)
  const placedCount = slotStones.filter((v) => v !== null).length;
  const allPlaced = placedCount >= PIECE_COUNT;

  // 인벤토리(퍼즐 조각 10개)
  const [inventory] = useState(() => shuffle(Array.from({ length: PIECE_COUNT }, (_, i) => i)));

  // drag
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragThreshold = 3;

  const boardRef = useRef<HTMLDivElement | null>(null);

  const startDrag = (e: React.PointerEvent, stoneId: number) => {
    startIfNeeded();
    if (phase !== 'BUILD') return;
    if (slotStones.includes(stoneId)) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    setDrag({
      stoneId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - centerX,
      offsetY: e.clientY - centerY,
      moved: false,
    });
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

  const placeToSlot = (slotIdx: number, stoneId: number) => {
    setSlotStones((prev) => {
      if (prev[slotIdx] != null) return prev;
      const next = prev.slice();
      next[slotIdx] = stoneId;
      return next;
    });
    audio.playSfx('correct', 0.7);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const ended = drag;
    setDrag(null);
    if (phase !== 'BUILD') return;

    // 클릭으로도 넣기: 첫 번째 빈 슬롯에 자동 배치(아이들용)
    if (!ended.moved) {
      // 이미지 퍼즐 조각은 "정답 슬롯"에만 들어가도록 유지
      const targetIdx = ended.stoneId;
      if (slotStones[targetIdx] == null) {
        placeToSlot(targetIdx, ended.stoneId);
      } else {
        setAttempts((a) => a + 1);
        audio.playSfx('wrong', 0.8);
      }
      return;
    }

    const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const slotAttr = elUnder?.closest?.('[data-slot]')?.getAttribute('data-slot');
    if (!slotAttr) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      return;
    }
    const idx = Number(slotAttr);
    if (Number.isNaN(idx) || idx < 0 || idx >= PIECE_COUNT) return;

    if (slotStones[idx] != null) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      return;
    }
    // 퍼즐 조각은 인덱스 매칭(맞는 위치에만 들어감)
    if (idx !== ended.stoneId) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.8);
      return;
    }
    placeToSlot(idx, ended.stoneId);
  };

  // Phase 1 완료 → Phase 2(힘의 분산)
  const [showInfo, setShowInfo] = useState(false);
  const [forceStep, setForceStep] = useState<'DOWN' | 'SPREAD' | 'DONE'>('DOWN');

  useEffect(() => {
    if (phase !== 'BUILD') return;
    if (!allPlaced) return;
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    const t = window.setTimeout(() => {
      setPhase('FORCE');
      setShowInfo(true);
      setForceStep('DOWN');
      audio.playUrl('/assets/sounds/sfx_rock_impact.mp3', 0.85);
      window.setTimeout(() => setForceStep('SPREAD'), 650);
      window.setTimeout(() => setForceStep('DONE'), 1700);
      window.setTimeout(() => setPhase('RESULT'), 2400);
    }, 600);
    return () => window.clearTimeout(t);
  }, [phase, allPlaced]);

  const [resultModal, setResultModal] = useState(false);
  useEffect(() => {
    if (phase !== 'RESULT') return;
    setShowInfo(false);
    setResultModal(true);
  }, [phase]);

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
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

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'BUILD' ? 'Phase 1' : 'Phase 2'}</div>
      </div>

      <div ref={boardRef} className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {/* 배경 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(244,235,217,0.18), rgba(244,235,217,0.38)), url('${mainBg || '/assets/images/map_main.png'}')`,
          }}
        />

        {/* 다리 본체(중앙) */}
        <div className="absolute inset-0 p-3">
          <div className="h-full grid grid-rows-[1fr_auto] gap-3">
            {/* 아치 영역 */}
            <div className="relative rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden">
              {/* 아치 원본 이미지(가이드) */}
              <div className="absolute inset-0 grid place-items-center">
                <div className="relative" style={{ width: `${ARCH_W}px`, height: `${ARCH_H}px` }}>
                  <img
                    src={BRIDGE_IMG}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                    draggable={false}
                  />

                  {/* 슬롯(반원) - clip-path 실루엣 */}
                  {SLOTS.map((s) => {
                    const has = slotStones[s.idx] != null;
                    const placedId = slotStones[s.idx];
                    return (
                      <div
                        key={s.idx}
                        data-slot={s.idx}
                        className={[
                          'absolute',
                          phase !== 'BUILD' ? 'pointer-events-none' : '',
                        ].join(' ')}
                        style={{
                          left: `${s.rectX}px`,
                          top: `${s.rectY}px`,
                          width: `${PIECE_W}px`,
                          height: `${PIECE_H}px`,
                        }}
                        title="여기에 돌을 끼워보자!"
                      >
                        {!has ? (
                          <div
                            className="w-full h-full border-2 border-dashed border-ink/25 bg-paper/25 animate-pulse"
                            style={{ clipPath: CLIPS[s.idx] }}
                          />
                        ) : (
                          <BridgePiece idx={placedId as number} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

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

            {/* 인벤토리 */}
            <div className="rounded-3xl border border-ink/20 bg-paper/70 px-3 py-2 relative z-10 overflow-visible">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold opacity-90">퍼즐 조각을 아치 슬롯에 끼워보자! ({placedCount}/{PIECE_COUNT})</div>
                {phase === 'BUILD' ? <div className="text-[11px] opacity-80">드래그 또는 클릭</div> : null}
              </div>
              {/* 화면 폭이 좁으면 자동으로 2줄(5+4 등)로 래핑되어 9번째가 절대 잘리지 않게 */}
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {inventory.map((stoneId, i) => {
                  const used = slotStones.includes(stoneId);
                  return (
                    <div
                      key={stoneId}
                      className={[
                        'w-[76px] h-[64px] rounded-2xl border border-ink/20 bg-paper2/90 shadow-md grid place-items-center touch-none select-none overflow-hidden',
                        used || phase !== 'BUILD' ? 'opacity-45' : 'cursor-grab active:cursor-grabbing hover:bg-paper2',
                      ].join(' ')}
                      onPointerDown={(e) => startDrag(e, stoneId)}
                      onPointerMove={updateDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      title="드래그해서 슬롯에 끼워보자!"
                    >
                      <BridgePiece idx={stoneId} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
            <BridgePiece idx={drag.stoneId} variant="ghost" />
          </div>
        )}
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
