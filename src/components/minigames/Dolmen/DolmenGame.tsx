import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { audio } from '../../../utils/audio';

type Phase = 'LOGS' | 'PULL' | 'DONE';

export default function DolmenGame({ stageId, onComplete, regionData }: MinigameProps) {
  const title = useMemo(() => regionData?.map?.nodes?.[stageId - 1]?.title ?? '고인돌 옮기기', [regionData, stageId]);

  const [phase, setPhase] = useState<Phase>('LOGS');
  const [slots, setSlots] = useState<(null | 'log')[]>([null, null, null]);
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Phase2
  const [pointer, setPointer] = useState(0); // 0~100
  const dirRef = useRef<1 | -1>(1);
  const rafRef = useRef<number | null>(null);

  const [progress, setProgress] = useState(0); // 0~100
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dust, setDust] = useState(false);
  const [shake, setShake] = useState(false);

  const allLogsPlaced = slots.every((s) => s === 'log');

  // pointer 애니메이션
  useEffect(() => {
    if (phase !== 'PULL') return;

    const started = startedAt ?? Date.now();
    if (!startedAt) setStartedAt(started);

    const speed = 0.18; // px-per-ms 느낌 (기기별 프레임에 안정적으로 동작)
    let last = performance.now();

    const tick = (t: number) => {
      const dt = t - last;
      last = t;

      setPointer((prev) => {
        let next = prev + dirRef.current * dt * speed;
        if (next >= 100) {
          next = 100;
          dirRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          dirRef.current = 1;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, startedAt]);

  // Phase1 완료 → Phase2로 자동 전환
  useEffect(() => {
    if (phase !== 'LOGS') return;
    if (!allLogsPlaced) return;

    setFeedback('통나무를 모두 깔았습니다! 이제 다 함께 돌을 당기세요!');
    audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.8);

    const t = window.setTimeout(() => {
      setFeedback(null);
      setPhase('PULL');
    }, 900);

    return () => window.clearTimeout(t);
  }, [phase, allLogsPlaced]);

  const dropToSlot = (index: number) => {
    setSlots((prev) => {
      if (prev[index]) return prev;
      const next = prev.slice();
      next[index] = 'log';
      return next;
    });
  };

  const isPerfect = pointer >= 45 && pointer <= 55;

  const pull = () => {
    if (phase !== 'PULL') return;
    setAttempts((a) => a + 1);

    if (!isPerfect) {
      setFeedback('타이밍이 안 맞아요!');
      setShake(true);
      window.setTimeout(() => setShake(false), 360);
      audio.playUrl('/assets/sounds/sfx_negative_beep.mp3', 0.75);
      window.setTimeout(() => setFeedback(null), 700);
      return;
    }

    // 성공
    setFeedback('영차! 잘 당겼어요!');
    setDust(true);
    window.setTimeout(() => setDust(false), 520);
    audio.playUrl('/assets/sounds/sfx_stone_move_2.mp3', 0.9);

    const started = startedAt ?? Date.now();
    if (!startedAt) setStartedAt(started);

    setProgress((p) => {
      const next = Math.min(100, p + 20);
      if (next >= 100) {
        // 클리어
        window.setTimeout(() => {
          setPhase('DONE');
          audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
          const clearTime = Math.max(0, Math.round(((Date.now() - started) / 1000) * 10) / 10);
          window.setTimeout(() => onComplete({ attempts: attempts + 1, clearTime }), 800);
        }, 550);
      }
      return next;
    });

    window.setTimeout(() => setFeedback(null), 700);
  };

  return (
    <div
      className="w-full h-full p-3 text-white flex flex-col"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.65)), url('/assets/images/relic_pyeongchon_main.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <style>{`
        @keyframes dust {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(-50%, -60%) scale(1.25); opacity: 0; }
        }
        .dustFx { animation: dust 520ms ease-out; }
        @keyframes shake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
          100% { transform: translateX(0); }
        }
        .shakeFx { animation: shake 360ms ease-in-out; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-90">진행 {progress}% · 시도 {attempts}</div>
      </div>

      <div className="mt-2 flex-1 overflow-auto">
        {/* 메인 스테이지 */}
        <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
          <div className="text-sm font-extrabold mb-2">
            {phase === 'LOGS' && 'Phase 1: 통나무 깔기'}
            {phase === 'PULL' && 'Phase 2: 협동해서 당기기'}
            {phase === 'DONE' && '완료!'}
          </div>

          {/* 돌/슬롯 영역 */}
          <div className="relative rounded-2xl border border-white/10 bg-black/30 p-3 overflow-hidden">
            {/* 돌 이동(transition-transform) */}
            <div className="relative h-[170px] md:h-[220px]">
              <div
                className={[
                  'absolute left-0 top-1/2 -translate-y-1/2 transition-transform duration-500 ease-out',
                  shake ? 'shakeFx' : '',
                ].join(' ')}
                style={{ transform: `translate(${progress * 2.1}px, -50%)` }}
              >
                <img
                  src="/assets/images/capstone_raw.png"
                  alt="고인돌 덮개돌"
                  className="w-[220px] md:w-[280px] drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] select-none"
                  draggable={false}
                />
              </div>

              {/* 목표 지점 표시 */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-24 h-16 rounded-xl border border-emerald-300/25 bg-emerald-400/10 grid place-items-center text-[11px] font-black">
                  목표
                </div>
              </div>

              {/* 먼지 이펙트 */}
              {dust && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 dustFx">
                  <img src="/assets/images/items/ink_splat_1.png" alt="" className="w-40 h-40 object-contain opacity-80" />
                </div>
              )}
            </div>

            {/* Phase1 통나무 슬롯 */}
            {phase === 'LOGS' && (
              <>
                <div className="text-xs font-bold opacity-85 mb-2">돌 앞에 통나무 3개를 깔아주세요 (드래그 앤 드롭)</div>
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-xl border-2 border-dashed border-white/25 bg-black/25 h-16 grid place-items-center"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData('text/plain');
                        if (raw !== 'log') return;
                        dropToSlot(i);
                        audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.7);
                      }}
                    >
                      {s ? <img src="/assets/images/log.png" alt="통나무" className="w-14 h-14 object-contain" /> : <span className="text-xs opacity-60">빈 슬롯</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Phase2 게이지 */}
            {phase === 'PULL' && (
              <div className="mt-3">
                <div className="text-xs font-bold opacity-85 mb-2">초록색 구간(Perfect)에 맞춰 “영차!” 버튼을 눌러요!</div>
                <div className="relative h-10 rounded-xl border border-white/15 bg-black/35 overflow-hidden">
                  {/* perfect zone */}
                  <div className="absolute inset-y-0 left-[45%] w-[10%] bg-emerald-400/35" />
                  {/* pointer */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-10 bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)]"
                    style={{ left: `calc(${pointer}% - 4px)` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={pull}
                  className="mt-3 w-full rounded-xl bg-amber-400 text-black font-black py-3 hover:bg-amber-300 active:translate-y-[1px]"
                >
                  영차! (당기기)
                </button>
              </div>
            )}
          </div>

          {/* Phase1 하단 통나무 */}
          {phase === 'LOGS' && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-xs font-black opacity-90 mb-2">통나무</div>
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', 'log');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-grab active:cursor-grabbing p-3 flex items-center gap-3"
                title="드래그해서 슬롯에 놓기"
              >
                <img src="/assets/images/log.png" alt="통나무" className="w-14 h-14 object-contain" />
                <div className="text-sm font-black">통나무를 슬롯에 배치하세요</div>
              </div>
            </div>
          )}

          {feedback && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-2 text-center text-sm font-black">
              {feedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

