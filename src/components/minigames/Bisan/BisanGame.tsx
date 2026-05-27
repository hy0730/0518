import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicRealImage } from '../../../utils/relicImages';

type Phase = 'FIRE' | 'DIG';

type DigId = 'm1' | 'm2' | 'm3';

const KILN_SECTION_BG = '/assets/images/Kiln_structure_1.jpg'; // 가마 단면도(임시/대체)
const DIG_BG = '/assets/images/relic_bisan_main.png';

const MAX_TEMP = 1300;
const STEP = 100;

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

function JarIcon({ variant }: { variant: 'celadon' | 'white' }) {
  const fill = variant === 'celadon' ? '#6FB6A8' : '#F5F2EA';
  const stroke = variant === 'celadon' ? '#2F6B61' : '#8B7E6A';
  return (
    <svg width="62" height="62" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M24 10c0 2 2 4 8 4s8-2 8-4v2c0 2-2 4-8 4s-8-2-8-4v-2Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      <path
        d="M22 16c2 3 4 5 4 7 0 2-3 4-3 7 0 5 4 8 9 8s9-3 9-8c0-3-3-5-3-7 0-2 2-4 4-7"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M18 46c0-5 6-8 14-8s14 3 14 8c0 8-6 12-14 12s-14-4-14-12Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      {variant === 'white' ? (
        <path d="M24 48c3 2 6 3 8 3s5-1 8-3" stroke="#D7CDBA" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M24 48c3 2 6 3 8 3s5-1 8-3" stroke="#1F4F48" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function BisanGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = `${stageTitle} · 도요지`;

  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('FIRE');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // 공통 토스트
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string, ms = 1600) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Phase 1: 온도 올리기 + 대류 화살표 연출
  const [temp, setTemp] = useState(0);
  const [flame, setFlame] = useState(0); // 0~1
  const [flowPulse, setFlowPulse] = useState(0);
  const [phase1Lock, setPhase1Lock] = useState(false);

  const addWood = () => {
    startIfNeeded();
    if (phase !== 'FIRE') return;
    if (phase1Lock) return;

    setTemp((t) => {
      if (t >= MAX_TEMP) return t;
      return clamp(t + STEP, 0, MAX_TEMP);
    });
    setFlame((f) => clamp(f + 0.12, 0, 1));
    setFlowPulse((p) => p + 1);
    audio.playUrl('/assets/sounds/sfx_pop.mp3', 0.5);
  };

  useEffect(() => {
    if (phase !== 'FIRE') return;
    if (temp < MAX_TEMP) return;

    setPhase1Lock(true);
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.85);
    showToast('가마가 충분히 뜨거워졌어요! 어떤 도자기가 구워졌을까요?', 2200);
    const t = window.setTimeout(() => {
      setPhase('DIG');
      // 불 끄기
      setFlame(0);
    }, 2400);
    return () => window.clearTimeout(t);
  }, [phase, temp]);

  // Phase 2: 흙 털기(클릭/문지르기)
  const [digItems] = useState(() => {
    const types = shuffle(['celadon', 'celadon', 'white'] as const);
    const pos = [
      { id: 'm1' as const, x: 20, y: 54 },
      { id: 'm2' as const, x: 56, y: 42 },
      { id: 'm3' as const, x: 78, y: 68 },
    ];
    return pos.map((p, i) => ({ ...p, type: types[i], taps: 0, revealed: false }));
  });
  const [digState, setDigState] = useState(digItems);
  const [whiteFound, setWhiteFound] = useState(false);
  const [glow, setGlow] = useState(false);
  const [resultModal, setResultModal] = useState(false);

  const tapMound = (id: DigId) => {
    startIfNeeded();
    if (phase !== 'DIG' || resultModal) return;
    setDigState((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (m.revealed) {
          setAttempts((a) => a + 1);
          return m;
        }
        audio.playUrl('/assets/sounds/sfx_stone_hit.mp3', 0.35);
        const taps = m.taps + 1;
        const revealed = taps >= 5;
        if (revealed) {
          audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.7);
        }
        return { ...m, taps, revealed };
      })
    );
  };

  // 백자 발견 → 연출 → 모달
  useEffect(() => {
    if (phase !== 'DIG') return;
    const white = digState.find((m) => m.type === 'white');
    if (!white?.revealed) return;
    if (whiteFound) return;

    setWhiteFound(true);
    setGlow(true);
    audio.playUrl('/assets/sounds/sfx_fanfare.mp3', 0.85);
    showToast("우와! 아주 희귀한 '고려 백자'를 찾았어요!", 1800);
    const t = window.setTimeout(() => setResultModal(true), 900);
    return () => window.clearTimeout(t);
  }, [phase, digState, whiteFound]);

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes rise {
          0% { transform: translateY(12px); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-120px); opacity: 0; }
        }
        .riseFx { animation: rise 850ms ease-out both; }

        @keyframes shakeX {
          0% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        .shakeFx { animation: shakeX 420ms ease-in-out; }

        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          50% { filter: drop-shadow(0 0 18px rgba(255,255,255,0.75)); }
        }
        .glowFx { animation: glowPulse 1.2s ease-in-out infinite; }
      `}</style>

      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'FIRE' ? 'Phase 1' : 'Phase 2'}</div>
      </div>

      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {phase === 'FIRE' ? (
          <>
            {/* 가마 단면도 */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(rgba(244,235,217,0.55), rgba(244,235,217,0.70)), url('${KILN_SECTION_BG}')`,
              }}
            />

            {/* 열기(대류) 화살표 */}
            <div className="absolute left-[10%] bottom-[12%] w-[64%] h-[78%] pointer-events-none">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`${flowPulse}-${i}`}
                  className="absolute riseFx"
                  style={{
                    left: `${8 + i * 16}%`,
                    bottom: `${8 + (i % 2) * 6}%`,
                    animationDelay: `${i * 90}ms`,
                  }}
                >
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[18px] border-b-red-500/70" />
                  <div className="mx-auto mt-1 w-1 h-10 bg-red-500/35 rounded-full" />
                </div>
              ))}
            </div>

            {/* 아궁이 불꽃 */}
            <div className="absolute left-[6%] bottom-[8%] w-[120px] h-[90px] pointer-events-none">
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[88px] h-[70px] rounded-[999px]"
                style={{
                  background: 'radial-gradient(circle at 50% 65%, rgba(255,174,0,0.0) 0%, rgba(255,174,0,0.0) 35%, rgba(255,90,0,0.65) 70%, rgba(255,30,0,0.0) 78%)',
                  transform: `translateX(-50%) scale(${0.55 + flame * 0.85})`,
                  filter: `blur(${2 - flame * 1.2}px)`,
                  opacity: 0.25 + flame * 0.7,
                }}
              />
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[44px] h-[50px] rounded-[999px]"
                style={{
                  background: 'radial-gradient(circle at 50% 70%, rgba(255,255,255,0.0) 0%, rgba(255,210,120,0.0) 35%, rgba(255,180,0,0.75) 70%, rgba(255,40,0,0.0) 82%)',
                  transform: `translateX(-50%) scale(${0.65 + flame * 0.95})`,
                  opacity: 0.15 + flame * 0.75,
                }}
              />
            </div>

            {/* 온도계 */}
            <div className="absolute right-3 top-3 w-[170px] note-panel p-3">
              <div className="text-xs font-black">가마 온도계</div>
              <div className="mt-2 h-3 rounded-full bg-ink/10 border border-ink/20 overflow-hidden">
                <div
                  className="h-full bg-stamp transition-all duration-300"
                  style={{ width: `${(temp / MAX_TEMP) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-sm font-black">
                  {temp}℃ <span className="text-[11px] opacity-70">/ {MAX_TEMP}℃</span>
                </div>
                <div className="text-[11px] font-black opacity-75">+{STEP}℃</div>
              </div>
              <div className="mt-1 text-[11px] opacity-80 leading-relaxed">
                장작을 넣으면 열기가 위로 올라가요(대류)!
              </div>
            </div>

            {/* 버튼 */}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <button
                type="button"
                className={[
                  'w-full rounded-2xl border border-ink/30 shadow-md font-black py-4 text-lg',
                  temp >= MAX_TEMP ? 'bg-paper/60 text-ink/50 cursor-not-allowed' : 'bg-stamp text-white hover:opacity-95 active:translate-y-[1px]',
                ].join(' ')}
                onClick={addWood}
                disabled={temp >= MAX_TEMP}
              >
                장작 넣기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 발굴 현장 배경 */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(rgba(244,235,217,0.35), rgba(244,235,217,0.55)), url('${DIG_BG}')`,
              }}
            />

            <div className="absolute left-3 top-3 note-panel px-4 py-3 w-[min(420px,92%)]">
              <div className="text-sm font-black">흙 속의 보물, 고려 백자 찾기</div>
              <div className="mt-1 text-sm opacity-90 leading-relaxed">
                흙더미를 여러 번 눌러서(또는 문지르기) 도자기를 찾아보자!
              </div>
            </div>

            {/* 흙더미 */}
            {digState.map((m) => {
              const opacity = clamp(1 - m.taps * 0.18, 0, 1);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={[
                    'absolute -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-ink/25 shadow-md px-4 py-4 text-left touch-none select-none',
                    m.revealed ? 'bg-paper2/90' : 'bg-[#C7A98B]/90',
                    m.revealed ? '' : 'hover:opacity-95 active:translate-y-[1px]',
                    whiteFound && m.type === 'white' && m.revealed ? 'glowFx' : '',
                  ].join(' ')}
                  style={{ left: `${m.x}%`, top: `${m.y}%`, width: '160px' }}
                  onClick={() => tapMound(m.id)}
                  onTouchStart={() => tapMound(m.id)}
                >
                  {!m.revealed ? (
                    <div>
                      <div className="text-xs font-black text-white/95">흙더미</div>
                      <div className="mt-1 h-2 rounded-full bg-black/15 overflow-hidden">
                        <div className="h-full bg-paper2/80" style={{ width: `${clamp((m.taps / 5) * 100, 0, 100)}%` }} />
                      </div>
                      <div className="mt-2 text-[11px] text-white/90">흙 털기 {m.taps}/5</div>
                      <div
                        className="absolute inset-0 rounded-3xl pointer-events-none"
                        style={{ background: `rgba(74,55,40,${0.20 * opacity})` }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className={whiteFound && m.type === 'white' ? 'drop-shadow-[0_0_18px_rgba(255,255,255,0.7)]' : ''}>
                        <JarIcon variant={m.type} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black">{m.type === 'white' ? '고려 백자' : '청자'}</div>
                        <div className="mt-1 text-[11px] opacity-80">{m.type === 'white' ? '희귀!' : '흔한 도자기'}</div>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}

            {whiteFound && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-white/10 animate-pulse" />
              </div>
            )}
          </>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 z-[9000] pointer-events-none">
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
        </div>
      )}

      {/* 결과 모달 */}
      {resultModal && (
        <div className="fixed inset-0 z-[99999] bg-ink/35 p-0">
          <div className="w-full h-full bg-paper2 text-ink shadow-paper flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <img src={realImg} alt="" className="w-full h-full object-cover" draggable={false} />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/70">
              <div className="text-lg font-black">성공! 고려 백자 발견</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                성공! 뜨거운 열기가 위로 올라가는 가마에서 아주 희귀한 ‘고려 백자’를 발견했어요!
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

