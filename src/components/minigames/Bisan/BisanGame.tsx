import React, { useEffect, useMemo, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicRealImage } from '../../../utils/relicImages';
import { useToast } from '../common/useToast';

type Phase = 'LOAD' | 'FIRE' | 'FINALE';
type PotteryId = 'p1' | 'p2' | 'p3';

type DragState = {
  id: PotteryId;
  label: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

type FurnaceState = {
  temp: number;
  fuel: number;
  air: number;
  holdMs: number;
  cooldownMs: number;
  started: boolean;
};

const KILN_BG = '/assets/images/relic_bisan_kiln_cutaway_empty.png';
const SAFE_MIN = 850;
const SAFE_MAX = 1300;
const TARGET_HOLD_MS = 3000;
const MAX_TEMP = 1450;
const HOLD_SECONDS = TARGET_HOLD_MS / 1000;

const POTTERIES: Array<{
  id: PotteryId;
  rawLabel: string;
  doneLabel: string;
  doneKind: 'white' | 'celadon';
}> = [
  { id: 'p1', rawLabel: '흙빛 매병', doneLabel: '백자음각연꽃무늬매병', doneKind: 'white' },
  { id: 'p2', rawLabel: '흙빛 병', doneLabel: '청자상감구름학무늬매병', doneKind: 'celadon' },
  { id: 'p3', rawLabel: '흙빛 항아리', doneLabel: '청자 병', doneKind: 'celadon' },
];

const FIRING_SLOTS = [
  { idx: 0, x: 41, y: 49 },
  { idx: 1, x: 53, y: 44 },
  { idx: 2, x: 64, y: 39 },
] as const;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function PotteryIcon({ kind, raw = false }: { kind: 'white' | 'celadon'; raw?: boolean }) {
  const fill = raw ? '#A8784D' : kind === 'celadon' ? '#7BB7AA' : '#F1E8DA';
  const stroke = raw ? '#6E4625' : kind === 'celadon' ? '#325D58' : '#A28E74';
  return (
    <svg width="66" height="66" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M24 10c0 2 2 4 8 4s8-2 8-4v2c0 2-2 4-8 4s-8-2-8-4v-2Z" fill={fill} stroke={stroke} strokeWidth="2" />
      <path
        d="M22 16c2 3 4 5 4 7 0 2-3 4-3 7 0 5 4 8 9 8s9-3 9-8c0-3-3-5-3-7 0-2 2-4 4-7"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M18 46c0-5 6-8 14-8s14 3 14 8c0 8-6 12-14 12s-14-4-14-12Z" fill={fill} stroke={stroke} strokeWidth="2" />
      {!raw && kind === 'white' ? (
        <path d="M22 48c3 2 6 3 10 3 3 0 6-1 10-3" stroke="#D3C7B5" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : null}
      {!raw && kind === 'celadon' ? (
        <path d="M22 48c3 2 6 3 10 3 3 0 6-1 10-3" stroke="#234944" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function CircularGauge({ temp }: { temp: number }) {
  const ratio = clamp(temp / MAX_TEMP, 0, 1);
  const deg = ratio * 360;
  return (
    <div className="relative w-[132px] h-[132px] rounded-full">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 180deg, #ef4444 0deg ${deg}deg, rgba(74,55,40,0.10) ${deg}deg 360deg)`,
        }}
      />
      <div className="absolute inset-[12px] rounded-full bg-paper2/95 border border-ink/15 grid place-items-center text-center shadow-inner">
        <div>
          <div className="text-[11px] font-black opacity-70">가마 온도</div>
          <div className="mt-1 text-xl font-black">{Math.round(temp)}℃</div>
          <div className="mt-1 text-[10px] font-black text-olive">적정 {SAFE_MIN}~{SAFE_MAX}℃</div>
        </div>
      </div>
    </div>
  );
}

export default function BisanGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = `${stageTitle} · 도요지`;
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('LOAD');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  const { toast, showToast } = useToast(1500);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [placed, setPlaced] = useState<Array<PotteryId | null>>([null, null, null]);
  const [slotGlow, setSlotGlow] = useState<Record<number, boolean>>({});
  const [successModal, setSuccessModal] = useState(false);

  const [furnace, setFurnace] = useState<FurnaceState>({
    temp: 20,
    fuel: 0,
    air: 0,
    holdMs: 0,
    cooldownMs: 0,
    started: false,
  });

  const placedCount = placed.filter(Boolean).length;
  const allLoaded = placed.every(Boolean);

  const unplacedIds = POTTERIES.filter((p) => !placed.includes(p.id)).map((p) => p.id);

  const startDrag = (e: React.PointerEvent, id: PotteryId) => {
    if (phase !== 'LOAD') return;
    if (placed.includes(id)) return;
    startIfNeeded();
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const label = POTTERIES.find((p) => p.id === id)?.rawLabel ?? id;
    setDrag({
      id,
      label,
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
            moved: prev.moved || dx + dy > 3,
          }
        : prev
    );
  };

  const placeInSlot = (id: PotteryId, slotIndex: number) => {
    if (placed.includes(id)) return false;
    if (placed[slotIndex]) return false;
    setPlaced((prev) => {
      const next = prev.slice();
      next[slotIndex] = id;
      return next;
    });
    setSlotGlow((prev) => ({ ...prev, [slotIndex]: true }));
    window.setTimeout(() => setSlotGlow((prev) => ({ ...prev, [slotIndex]: false })), 260);
    audio.playSfx('correct', 0.7);
    return true;
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const ended = drag;
    setDrag(null);
    if (phase !== 'LOAD') return;

    if (!ended.moved) {
      const firstEmpty = placed.findIndex((s) => !s);
      if (firstEmpty >= 0) {
        placeInSlot(ended.id, firstEmpty);
      }
      return;
    }

    const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const zone = elUnder?.closest?.('[data-zone]')?.getAttribute('data-zone') ?? null;
    if (zone === 'firebox') {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      showToast('여긴 불을 피우는 아궁이(연소실)야!', 1500);
      return;
    }
    if (zone?.startsWith('slot-')) {
      const slotIndex = Number(zone.replace('slot-', ''));
      const ok = placeInSlot(ended.id, slotIndex);
      if (!ok) {
        setAttempts((a) => a + 1);
        audio.playSfx('wrong', 0.72);
      }
    }
  };

  useEffect(() => {
    if (phase !== 'LOAD') return;
    if (!allLoaded) return;
    showToast('좋아! 이제 장작을 넣고 불을 피워보자.', 1300);
    const t = window.setTimeout(() => setPhase('FIRE'), 700);
    return () => window.clearTimeout(t);
  }, [phase, allLoaded, showToast]);

  useEffect(() => {
    if (phase !== 'FIRE') return;
    const t = window.setInterval(() => {
      setFurnace((prev) => {
        let { temp, fuel, air, holdMs, cooldownMs, started } = prev;

        if (cooldownMs > 0) {
          return {
            ...prev,
            temp: Math.max(20, temp - 22),
            fuel: Math.max(0, fuel - 1.8),
            air: 0,
            holdMs: 0,
            cooldownMs: Math.max(0, cooldownMs - 100),
            started: false,
          };
        }

        if (!started) {
          return {
            ...prev,
            temp: Math.max(20, temp - 5),
            fuel: Math.max(0, fuel - 0.4),
            air: Math.max(0, air - 0.8),
          };
        }

        fuel = Math.max(0, fuel - 1.1);
        air = Math.max(0, air - 2.2);

        const heatGain = 2 + fuel * 1.45 + air * 1.05;
        const coolLoss = temp >= 900 ? 8.5 : 5.8;
        temp = clamp(temp + heatGain - coolLoss, 20, MAX_TEMP);

        const inRange = temp >= SAFE_MIN && temp <= SAFE_MAX;
        holdMs = inRange ? Math.min(TARGET_HOLD_MS, holdMs + 100) : Math.max(0, holdMs - 160);

        return { temp, fuel, air, holdMs, cooldownMs, started };
      });
    }, 100);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'FIRE') return;
    if (furnace.cooldownMs > 0) return;
    if (!furnace.started) return;
    if (furnace.temp <= SAFE_MAX + 40) return;
    setAttempts((a) => a + 1);
    audio.playSfx('wrong', 0.8);
    showToast('앗, 너무 뜨거워! 조금 식힌 뒤 다시 맞춰보자.', 1500);
    setFurnace((prev) => ({ ...prev, cooldownMs: 1400, holdMs: 0, fuel: 0, air: 0, started: false }));
  }, [phase, furnace.temp, furnace.cooldownMs, furnace.started, showToast]);

  useEffect(() => {
    if (phase !== 'FIRE') return;
    if (furnace.holdMs < TARGET_HOLD_MS) return;
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    showToast('가마 문이 열리며 아름다운 도자기가 완성됐어요!', 1800);
    const t = window.setTimeout(() => {
      setPhase('FINALE');
      setSuccessModal(true);
    }, 900);
    return () => window.clearTimeout(t);
  }, [phase, furnace.holdMs, showToast]);

  const addWood = () => {
    startIfNeeded();
    if (phase !== 'FIRE') return;
    if (furnace.cooldownMs > 0) return;
    setFurnace((prev) => ({
      ...prev,
      started: true,
      temp: Math.max(prev.temp, 180),
      fuel: clamp(prev.fuel + 22, 0, 100),
    }));
    audio.playUrl('/assets/sounds/sfx_pop.mp3', 0.55);
  };

  const fanFire = () => {
    startIfNeeded();
    if (phase !== 'FIRE') return;
    if (furnace.cooldownMs > 0) return;
    if (!furnace.started) {
      showToast('먼저 장작을 넣어 불을 붙여보자!', 1200);
      return;
    }
    setFurnace((prev) => ({
      ...prev,
      air: clamp(prev.air + 18, 0, 100),
    }));
    audio.playUrl('/assets/sounds/sfx_brush.mp3', 0.32);
  };

  const convectionLevel = useMemo(() => clamp((furnace.temp - 200) / 900, 0, 1), [furnace.temp]);
  const holdRatio = clamp(furnace.holdMs / TARGET_HOLD_MS, 0, 1);

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes riseArrow {
          0% { transform: translateY(16px); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-90px); opacity: 0; }
        }
        .riseArrowFx { animation: riseArrow 1s ease-out infinite; }

        @keyframes kilnGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255,120,40,0.15)); }
          50% { filter: drop-shadow(0 0 16px rgba(255,120,40,0.45)); }
        }
        .kilnGlowFx { animation: kilnGlow 1.2s ease-in-out infinite; }

        @keyframes successPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        .successPulseFx { animation: successPulse 1.1s ease-in-out infinite; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">
          {phase === 'LOAD' ? 'Phase 1' : phase === 'FIRE' ? 'Phase 2' : 'Phase 3'}
        </div>
      </div>

      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(44,34,24,0.15),rgba(44,34,24,0.28))]" />

        <div className="relative z-10 h-full grid grid-cols-[1fr_220px] grid-rows-[1fr_130px] gap-3 p-3">
          {/* 중앙 가마 */}
          <div className="relative rounded-3xl border border-ink/20 bg-paper/35 overflow-hidden shadow-paper row-span-1">
            <img
              src={KILN_BG}
              alt="비산동 가마 단면도"
              className={[
                'absolute inset-0 w-full h-full object-cover select-none',
                phase === 'FINALE' ? 'kilnGlowFx' : '',
              ].join(' ')}
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />

            <div className="absolute left-3 top-3 note-panel px-4 py-3 max-w-[420px]">
              <div className="text-sm font-black">
                {phase === 'LOAD' && '도자기 가마 넣기'}
                {phase === 'FIRE' && '불 지피기와 온도 조절'}
                {phase === 'FINALE' && '완성된 도자기 감상'}
              </div>
              <div className="mt-1 text-[12px] leading-relaxed opacity-90">
                {phase === 'LOAD' && '오른쪽 흙빛 도자기를 소성실의 빈칸 3곳에 넣어보자. 아궁이에 넣으면 안 돼!'}
                {phase === 'FIRE' && `장작과 부채질로 온도를 ${SAFE_MIN}~${SAFE_MAX}℃ 구간에 ${HOLD_SECONDS}초 유지해보자.`}
                {phase === 'FINALE' && '비산동 가마에서 아름다운 도자기가 구워졌어요!'}
              </div>
            </div>

            {/* 연소실(아궁이) - 오답 판정용 */}
            {phase === 'LOAD' && (
              <div
                data-zone="firebox"
                className="absolute left-[3%] bottom-[4%] w-[15%] h-[22%] rounded-2xl border-2 border-dashed border-red-400/60 bg-red-200/10"
                title="연소실"
              >
                <div className="absolute inset-0 grid place-items-center text-[11px] font-black text-red-50/90">연소실</div>
              </div>
            )}

            {/* 소성실 슬롯 */}
            {FIRING_SLOTS.map((slot) => {
              const potteryId = placed[slot.idx];
              const pottery = POTTERIES.find((p) => p.id === potteryId);
              return (
                <div
                  key={slot.idx}
                  data-zone={`slot-${slot.idx}`}
                  className={[
                    'absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 shadow-md',
                    pottery ? 'border-transparent bg-transparent' : 'border-dashed border-amber-200/80 bg-amber-100/12',
                    slotGlow[slot.idx] ? 'ring-2 ring-amber-300/80' : '',
                  ].join(' ')}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: '108px', height: '108px' }}
                >
                  {!pottery ? (
                    <div className="absolute inset-0 grid place-items-center text-[11px] font-black text-amber-50/90">
                      소성실
                    </div>
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <div
                        className={[
                          'rounded-2xl px-2 py-1',
                          phase === 'FINALE' ? 'bg-paper2/82 successPulseFx' : 'bg-paper2/72',
                        ].join(' ')}
                      >
                        <PotteryIcon kind={pottery.doneKind} raw={phase !== 'FINALE'} />
                        <div className="mt-1 text-[10px] text-center font-black leading-tight">
                          {phase === 'FINALE' ? pottery.doneLabel : pottery.rawLabel}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 대류 화살표 */}
            {(phase === 'FIRE' || phase === 'FINALE') && (
              <div className="absolute left-[22%] bottom-[18%] w-[58%] h-[62%] pointer-events-none">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute riseArrowFx"
                    style={{
                      left: `${8 + i * 18}%`,
                      bottom: `${8 + (i % 2) * 4}%`,
                      animationDelay: `${i * 140}ms`,
                      opacity: 0.18 + convectionLevel * 0.8,
                    }}
                  >
                    <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[18px] border-b-red-500/75" />
                    <div className="mx-auto mt-1 w-[3px] h-10 bg-red-500/45 rounded-full" />
                  </div>
                ))}
              </div>
            )}

            {/* 내부 발광 */}
            {(phase === 'FIRE' || phase === 'FINALE') && (
              <div className="absolute inset-0 pointer-events-none">
                {FIRING_SLOTS.map((slot) => (
                  <div
                    key={`glow-${slot.idx}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y + 6}%`,
                      width: '96px',
                      height: '96px',
                      background: 'radial-gradient(circle, rgba(255,120,40,0.55) 0%, rgba(255,120,40,0.18) 45%, rgba(255,120,40,0) 74%)',
                      opacity: phase === 'FINALE' ? 0.9 : convectionLevel * 0.85,
                      filter: 'blur(6px)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 우측 인벤토리 */}
          <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col shadow-paper">
            <div className="text-sm font-black">도자기 인벤토리</div>
            <div className="mt-1 text-[11px] opacity-80 leading-relaxed">
              흙빛 도자기를 가마의 <span className="font-black">소성실</span>에 넣어보자.
            </div>
            <div className="mt-3 flex-1 flex flex-col gap-2">
              {POTTERIES.map((p) => {
                const placedAlready = !unplacedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={[
                      'rounded-2xl border border-ink/20 bg-paper2/90 px-3 py-3 text-left shadow-md touch-none',
                      placedAlready || phase !== 'LOAD' ? 'opacity-45 cursor-not-allowed' : 'hover:opacity-95 active:translate-y-[1px]',
                    ].join(' ')}
                    disabled={placedAlready || phase !== 'LOAD'}
                    onPointerDown={(e) => startDrag(e, p.id)}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={() => setDrag(null)}
                  >
                    <div className="flex items-center gap-3">
                      <PotteryIcon kind={p.doneKind} raw />
                      <div className="min-w-0">
                        <div className="text-[12px] font-black">{p.rawLabel}</div>
                        <div className="mt-1 text-[11px] opacity-80">가마에 넣기 전의 흙빛 도자기</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-2xl border border-ink/15 bg-paper2/70 px-3 py-2 text-[11px] font-black">
              배치 완료: {placedCount}/3
            </div>
          </div>

          {/* 하단 컨트롤러 */}
          <div className="col-span-2 rounded-3xl border border-ink/20 bg-paper/78 p-3 shadow-paper">
            <div className="grid grid-cols-[1fr_160px_1fr] items-center gap-3 h-full">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={[
                    'flex-1 rounded-2xl border border-ink/25 px-4 py-4 shadow-md font-black',
                    phase !== 'FIRE' || furnace.cooldownMs > 0
                      ? 'bg-paper2/70 text-ink/40 cursor-not-allowed'
                      : 'bg-stamp text-white hover:opacity-95 active:translate-y-[1px]',
                  ].join(' ')}
                  onClick={addWood}
                  disabled={phase !== 'FIRE' || furnace.cooldownMs > 0}
                >
                  장작 넣기
                </button>
                <button
                  type="button"
                  className={[
                    'flex-1 rounded-2xl border border-ink/25 px-4 py-4 shadow-md font-black',
                    phase !== 'FIRE' || furnace.cooldownMs > 0
                      ? 'bg-paper2/70 text-ink/40 cursor-not-allowed'
                      : 'bg-olive text-white hover:opacity-95 active:translate-y-[1px]',
                  ].join(' ')}
                  onClick={fanFire}
                  disabled={phase !== 'FIRE' || furnace.cooldownMs > 0}
                >
                  부채질
                </button>
              </div>

              <div className="grid place-items-center">
                <CircularGauge temp={furnace.temp} />
              </div>

              <div className="flex flex-col justify-center gap-2">
                <div className="rounded-2xl border border-ink/15 bg-paper2/75 px-3 py-2">
                  <div className="text-[11px] font-black opacity-75">적정 온도 유지</div>
                  <div className="mt-2 h-3 rounded-full bg-ink/10 overflow-hidden border border-ink/10">
                    <div className="h-full bg-olive transition-all duration-150" style={{ width: `${holdRatio * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] font-black">
                    {Math.min(HOLD_SECONDS, (furnace.holdMs / 1000)).toFixed(1)} / {HOLD_SECONDS.toFixed(1)}초
                  </div>
                </div>
                <div className="text-[11px] leading-relaxed opacity-80">
                  {phase === 'LOAD' && '먼저 도자기 3개를 소성실에 넣어야 불을 지필 수 있어.'}
                  {phase === 'FIRE' &&
                    (furnace.cooldownMs > 0
                      ? '가마가 너무 뜨거워졌어! 잠깐 식힌 뒤 다시 도전하자.'
                      : '장작으로 불을 지피고, 부채질로 대류를 살려 적정 온도를 유지하자.')}
                  {phase === 'FINALE' && '가마 문이 열리며 흙빛 도자기가 아름다운 청자와 백자로 변했어!'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {drag && (
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="rounded-2xl border border-ink/20 bg-paper2/95 px-3 py-2 shadow-paper">
            <PotteryIcon kind={POTTERIES.find((p) => p.id === drag.id)?.doneKind ?? 'celadon'} raw />
            <div className="mt-1 text-[11px] text-center font-black">{drag.label}</div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 z-[9000] pointer-events-none">
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
        </div>
      )}

      {successModal && (
        <div className="fixed inset-0 z-[99999] bg-ink/40 p-0">
          <div className="w-full h-full bg-paper2 text-ink shadow-paper flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <img src={realImg} alt="" className="w-full h-full object-cover" draggable={false} />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/78">
              <div className="text-lg font-black">비산동 가마에서 아름다운 도자기가 구워졌어요!</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                소성실에 도자기를 넣고, 장작과 부채질로 적정 온도를 유지해 고려 시대의 청자와 백자를 완성했어요.
              </div>
              <div className="mt-3 rounded-2xl border border-ink/15 bg-paper2/80 px-3 py-2 text-[12px] font-black">
                성공 스탬프 완료
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
