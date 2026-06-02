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

const SLOT_COUNT = 9;

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

function makeSlots() {
  // 800x450 기준에서 아치 중심/반지름을 잡고, 반원(좌하단→우하단)으로 슬롯 배치
  const W = 800;
  const H = 450;
  // NOTE: 브라우저 좌표계(y+ 아래) 때문에 sin을 반전해서 "위로 볼록한" 홍예가 되도록 함
  // 배경(다리 구멍)과 최대한 맞추기 위해 cx/cy/r 미세 조정
  const cx = 400;
  const cy = 325;
  const r = 155;
  const start = 200; // deg
  const end = -20; // deg
  const slots = Array.from({ length: SLOT_COUNT }).map((_, i) => {
    const t = i / (SLOT_COUNT - 1);
    const deg = start + (end - start) * t;
    const rad = (deg * Math.PI) / 180;
    const x = cx + Math.cos(rad) * r;
    const y = cy - Math.sin(rad) * r;
    return {
      idx: i,
      xPct: (x / W) * 100,
      yPct: (y / H) * 100,
      deg,
    };
  });
  return slots;
}

const SLOTS = makeSlots();

function StoneWedge({ rotateDeg, active }: { rotateDeg: number; active?: boolean }) {
  return (
    <div
      className={[
        'w-14 h-10 rounded-xl border shadow-md',
        active ? 'border-ink/35 bg-paper2/95' : 'border-ink/25 bg-paper2/85',
      ].join(' ')}
      style={{
        clipPath: 'polygon(10% 100%, 90% 100%, 72% 0%, 28% 0%)',
        transform: `rotate(${rotateDeg}deg)`,
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
  const [slotStones, setSlotStones] = useState<(number | null)[]>(() => Array.from({ length: SLOT_COUNT }, () => null));
  const placedCount = slotStones.filter(Boolean).length;
  const allPlaced = placedCount >= SLOT_COUNT;

  // 인벤토리(돌 블록 9개)
  const [inventory] = useState(() => shuffle(Array.from({ length: SLOT_COUNT }, (_, i) => i)));

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
      const idx = slotStones.findIndex((s) => s == null);
      if (idx >= 0) placeToSlot(idx, ended.stoneId);
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
    if (Number.isNaN(idx) || idx < 0 || idx >= SLOT_COUNT) return;

    if (slotStones[idx] != null) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
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
              {/* 미완성 다리 베이스 */}
              <div className="absolute inset-0">
                <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[82%] h-[78%]">
                  {/* 기둥 */}
                  <div className="absolute left-0 bottom-0 w-[14%] h-[85%] rounded-3xl bg-ink/15 border border-ink/25" />
                  <div className="absolute right-0 bottom-0 w-[14%] h-[85%] rounded-3xl bg-ink/15 border border-ink/25" />
                  {/* 다리 상판 */}
                  <div className="absolute left-[12%] right-[12%] bottom-[68%] h-[20%] rounded-3xl bg-ink/10 border border-ink/25" />
                  {/* 반원 구멍 */}
                  <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[60%] h-[68%] rounded-t-[999px] bg-paper/75 border-2 border-dashed border-ink/20" />
                </div>
              </div>

              {/* 슬롯(반원) */}
              <div className="absolute inset-0">
                {SLOTS.map((s) => {
                  const has = slotStones[s.idx] != null;
                  return (
                    <div
                      key={s.idx}
                      data-slot={s.idx}
                      className={[
                        'absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-dashed grid place-items-center',
                        has ? 'border-olive/60 bg-olive/12' : 'border-ink/25 bg-paper/35 animate-pulse',
                        phase !== 'BUILD' ? 'pointer-events-none' : '',
                      ].join(' ')}
                      style={{ left: `${s.xPct}%`, top: `${s.yPct}%` }}
                      title="여기에 돌을 끼워보자!"
                    >
                      {has ? <StoneWedge rotateDeg={s.deg + 90} active /> : null}
                    </div>
                  );
                })}
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
                <div className="text-[12px] font-bold opacity-90">돌 블록을 아치 슬롯에 끼워보자! ({placedCount}/{SLOT_COUNT})</div>
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
                        'w-[60px] h-[56px] rounded-2xl border border-ink/20 bg-paper2/90 shadow-md grid place-items-center touch-none select-none',
                        used || phase !== 'BUILD' ? 'opacity-45' : 'cursor-grab active:cursor-grabbing hover:bg-paper2',
                      ].join(' ')}
                      onPointerDown={(e) => startDrag(e, stoneId)}
                      onPointerMove={updateDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      title="드래그해서 슬롯에 끼워보자!"
                    >
                      <StoneWedge rotateDeg={-20 + i * 5} />
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
            <StoneWedge rotateDeg={0} active />
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
