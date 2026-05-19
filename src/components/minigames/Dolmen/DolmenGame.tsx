import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { audio } from '../../../utils/audio';

type Phase = 'QUARRY' | 'BIND' | 'PREPARE' | 'MOVE';

const TARGET_PROGRESS = 85;
const QUARRY_SWELL_MS = 1500;
const QUARRY_SHAKE_MS = 650;

const WEDGE_POS = [
  { left: '58%', top: '38%' },
  { left: '44%', top: '54%' },
  { left: '62%', top: '64%' },
] as const;

export default function DolmenGame({ stageId, onComplete, regionData }: MinigameProps) {
  const title = useMemo(() => regionData?.map?.nodes?.[stageId - 1]?.title ?? '고인돌 옮기기', [regionData, stageId]);

  const [phase, setPhase] = useState<Phase>('QUARRY');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // QUARRY
  const [wedgeSlots, setWedgeSlots] = useState<(null | 'wedge')[]>([null, null, null]);
  const [mountainShake, setMountainShake] = useState(false);
  const [wedgeSwelling, setWedgeSwelling] = useState(false);
  const [rockFallen, setRockFallen] = useState(false);

  // BIND/PREPARE/MOVE
  const [ropeBound, setRopeBound] = useState(false);
  const [logSlots, setLogSlots] = useState<(null | 'log')[]>([null, null, null]);
  const [logsCount, setLogsCount] = useState(3);
  const [progress, setProgress] = useState(10);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState(false);

  const allWedgesPlaced = wedgeSlots.every((s) => s === 'wedge');
  const allLogsPlaced = logSlots.every((s) => s === 'log');

  const showHand = (phase === 'BIND' && rockFallen && !ropeBound) || (phase === 'MOVE' && allLogsPlaced);

  const placeWedgeToFirstEmpty = () => {
    setWedgeSlots((prev) => {
      const i = prev.findIndex((x) => !x);
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = 'wedge';
      return next;
    });
  };

  const placeLogToFirstEmpty = () => {
    if (logsCount <= 0) return;
    setLogSlots((prev) => {
      const i = prev.findIndex((x) => !x);
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = 'log';
      return next;
    });
    setLogsCount((c) => Math.max(0, c - 1));
    audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.75);
  };

  // PREPARE 완료 → MOVE로
  useEffect(() => {
    if (phase !== 'PREPARE') return;
    if (!allLogsPlaced) return;
    setFeedback('통나무를 모두 깔았어요! 이제 손 아이콘을 눌러 돌을 옮겨볼까요?');
    const t = window.setTimeout(() => setFeedback(null), 1200);
    setPhase('MOVE');
    return () => window.clearTimeout(t);
  }, [phase, allLogsPlaced]);

  const water = () => {
    if (phase !== 'QUARRY') return;
    if (!allWedgesPlaced) return;
    if (wedgeSwelling || mountainShake || rockFallen) return;

    startIfNeeded();
    setAttempts((a) => a + 1);
    audio.playUrl('/assets/sounds/sfx_scan.mp3', 0.6);

    // Step 1: 흡수/팽창 (1.5초)
    setFeedback('물을 머금은 쐐기가 천천히 팽창하고 있어요…');
    setWedgeSwelling(true);

    window.setTimeout(() => {
      setWedgeSwelling(false);

      // Step 2: 균열(강한 흔들림)
      setFeedback('바위에 균열이 생기고 있어요!');
      setMountainShake(true);
      audio.playUrl('/assets/sounds/sfx_rock_impact.mp3', 0.9);

      window.setTimeout(() => {
        setMountainShake(false);

        // Step 3: 채석 (떼돌 낙하)
        setRockFallen(true);
        audio.playUrl('/assets/sounds/sfx_stone_hit.mp3', 0.95);
        setFeedback('쿵! 떼돌이 떨어졌어요!');
        window.setTimeout(() => setFeedback(null), 1000);
        setPhase('BIND');
      }, QUARRY_SHAKE_MS);
    }, QUARRY_SWELL_MS);
  };

  const bindRope = () => {
    if (phase !== 'BIND') return;
    if (!rockFallen || ropeBound) return;
    startIfNeeded();
    setAttempts((a) => a + 1);
    setRopeBound(true);
    audio.playUrl('/assets/sounds/sfx_fix.mp3', 0.85);
    setFeedback('좋아요! 밧줄로 단단히 묶었어요.');
    window.setTimeout(() => setFeedback(null), 900);
    setPhase('PREPARE');
  };

  const moveOnce = () => {
    if (phase !== 'MOVE') return;
    if (!allLogsPlaced) return;
    if (resultModal) return;

    startIfNeeded();
    setAttempts((a) => a + 1);
    audio.playUrl('/assets/sounds/sfx_stone_move_1.mp3', 0.85);

    setProgress((p) => {
      const delta = 5 + Math.floor(Math.random() * 4); // 5~8
      const next = Math.min(100, p + delta);
      if (next >= TARGET_PROGRESS) {
        window.setTimeout(() => {
          setResultModal(true);
          audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
        }, 450);
      }
      return next;
    });
  };

  return (
    <div className="w-full h-full p-2 text-white flex flex-col">
      <style>{`
        @keyframes shake {
          0% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-10px, 2px) rotate(-1deg); }
          40% { transform: translate(10px, -2px) rotate(1deg); }
          60% { transform: translate(-8px, -2px) rotate(-0.7deg); }
          80% { transform: translate(8px, 2px) rotate(0.7deg); }
          100% { transform: translate(0,0) rotate(0); }
        }
        .shakeFx { animation: shake 520ms ease-in-out; }

        @keyframes shakeStrong {
          0% { transform: translate(0,0) rotate(0); }
          18% { transform: translate(-18px, 4px) rotate(-1.8deg); }
          36% { transform: translate(18px, -4px) rotate(1.8deg); }
          54% { transform: translate(-14px, -3px) rotate(-1.2deg); }
          72% { transform: translate(14px, 3px) rotate(1.2deg); }
          100% { transform: translate(0,0) rotate(0); }
        }
        .shakeStrongFx { animation: shakeStrong ${QUARRY_SHAKE_MS}ms ease-in-out; }

        /* 팽창은 Tailwind transition+scale로 처리 */

        @keyframes fall {
          0% { transform: translate(0, -120px) rotate(-8deg); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
        }
        .fallFx { animation: fall 620ms ease-out; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-90">
          {phase} · 진행 {Math.min(progress, TARGET_PROGRESS)}% · 시도 {attempts}
        </div>
      </div>

      {/* 스크롤 없이 화면 내에 맞추기: flex 레이아웃으로 높이를 분배 */}
      <div className="mt-2 flex-1 min-h-0">
        <div className="h-full rounded-2xl border border-white/10 bg-black/35 p-2 flex flex-col min-h-0">
          <div className="text-sm font-extrabold mb-2">
            {phase === 'QUARRY' && 'Phase 1: 채석 (나무쐐기 + 물의 팽창)'}
            {phase === 'BIND' && 'Phase 2: 밧줄 묶기'}
            {phase === 'PREPARE' && 'Phase 3: 통나무(굴림대) 깔기'}
            {phase === 'MOVE' && 'Phase 4: 이동'}
          </div>

          {/* 실제 플레이 영역(게임 보드) - 배경은 여기만 적용 */}
          <div
            className="relative flex-1 min-h-0 rounded-2xl border border-white/10 overflow-hidden bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "linear-gradient(rgba(0,0,0,0.25),rgba(0,0,0,0.65)), url('/assets/images/capstone_map.png')",
            }}
          >
            {/* 좌측 바위산 */}
            <div
              className={[
                'absolute left-2 top-2 bottom-2 w-[30%] max-w-[200px]',
                mountainShake ? 'shakeStrongFx' : '',
              ].join(' ')}
            >
              <img
                src="/assets/images/capstone_mountain.png"
                alt="바위산"
                className="w-full h-full object-cover select-none"
                draggable={false}
              />

              {/* 쐐기 슬롯 3개 */}
              <div className="absolute inset-0">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute w-12 h-12 rounded-xl border-2 border-dashed border-white/35 bg-black/35 grid place-items-center"
                    style={{
                      left: WEDGE_POS[i].left,
                      top: WEDGE_POS[i].top,
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (phase !== 'QUARRY') return;
                      const raw = e.dataTransfer.getData('text/plain');
                      if (raw !== 'wedge') return;
                      setWedgeSlots((prev) => {
                        if (prev[i]) return prev;
                        const next = prev.slice();
                        next[i] = 'wedge';
                        return next;
                      });
                      audio.playUrl('/assets/sounds/sfx_wood_door.mp3', 0.6);
                    }}
                    onClick={() => {
                      if (phase !== 'QUARRY') return;
                      if (wedgeSlots[i]) return;
                      startIfNeeded();
                      setWedgeSlots((prev) => {
                        const next = prev.slice();
                        next[i] = 'wedge';
                        return next;
                      });
                      audio.playUrl('/assets/sounds/sfx_wood_door.mp3', 0.6);
                    }}
                    title="쐐기를 꽂아보자"
                  >
                    {wedgeSlots[i] ? (
                      <img
                        src="/assets/images/wood_wedge.png"
                        alt="쐐기"
                        className={[
                          'w-9 h-9 object-contain transition-transform transition-[filter] duration-[1500ms] origin-center',
                          wedgeSwelling ? 'scale-150 brightness-75' : 'scale-100 brightness-100',
                        ].join(' ')}
                        draggable={false}
                      />
                    ) : (
                      <span className="text-xs opacity-70">틈</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 우측 작업 공간 */}
            <div className="absolute left-[34%] right-2 top-2 bottom-2">
              {/* 떨어진 돌/밧줄 돌/통나무/이동 그룹 */}
              <div className="absolute left-[6%] right-[6%] top-[12%]">
                <div
                  className="relative transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(${(progress / TARGET_PROGRESS) * 55}%)` }}
                >
                  {/* 돌 이미지 */}
                  {rockFallen && (
                    <img
                      src={ropeBound ? '/assets/images/capstone_rope.png' : '/assets/images/capstone_raw.png'}
                      alt="떼돌"
                      className={[
                        'w-[min(260px,42vw)] md:w-[280px] select-none drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]',
                        !ropeBound ? 'fallFx' : '',
                      ].join(
                        ' '
                      )}
                      draggable={false}
                    />
                  )}

                  {/* 통나무(돌 아래) */}
                  {(phase === 'PREPARE' || phase === 'MOVE') && ropeBound && (
                    <div className="mt-2 grid grid-cols-3 gap-2 w-[min(300px,46vw)] md:w-[300px]">
                      {logSlots.map((s, i) => (
                        <div
                          key={i}
                          className="rounded-xl border-2 border-dashed border-white/25 bg-black/25 h-12 md:h-14 grid place-items-center"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (phase !== 'PREPARE') return;
                            const raw = e.dataTransfer.getData('text/plain');
                            if (raw !== 'log') return;
                            if (logSlots[i]) return;
                            if (logsCount <= 0) return;
                            setLogSlots((prev) => {
                              const next = prev.slice();
                              next[i] = 'log';
                              return next;
                            });
                            setLogsCount((c) => Math.max(0, c - 1));
                            audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.75);
                          }}
                          onClick={() => {
                            if (phase !== 'PREPARE') return;
                            if (logSlots[i]) return;
                            if (logsCount <= 0) return;
                            startIfNeeded();
                            setLogSlots((prev) => {
                              const next = prev.slice();
                              next[i] = 'log';
                              return next;
                            });
                            setLogsCount((c) => Math.max(0, c - 1));
                            audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.75);
                          }}
                        >
                          {s ? <img src="/assets/images/log.png" alt="통나무" className="w-12 h-12 object-contain" /> : <span className="text-xs opacity-60">빈 틈</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 목표 지점 (85%) */}
                <div className="absolute right-2 top-[28%]">
                  <div className="w-20 h-12 rounded-xl border border-emerald-300/25 bg-emerald-400/10 grid place-items-center text-[11px] font-black">
                    굴(85%)
                  </div>
                </div>
              </div>
            </div>

            {/* hand 힌트 (잘리지 않도록 위치 픽스 + z-50) */}
            {showHand && (
              <button
                type="button"
                onClick={() => {
                  if (phase === 'BIND') bindRope();
                  if (phase === 'MOVE') moveOnce();
                }}
                className="absolute right-3 bottom-[15%] z-50 animate-pulse"
                title={phase === 'BIND' ? '밧줄 묶기' : '눌러서 옮기기'}
              >
                <img src="/assets/images/hand.png" alt="손" className="w-14 h-14 object-contain" draggable={false} />
              </button>
            )}
          </div>

          {/* 인벤토리(배경 밖) */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* 쐐기 + 물 */}
            <div className="rounded-xl border border-white/10 bg-black/25 p-2">
              <div className="text-[11px] font-black opacity-90 mb-1">도구</div>
              <div className="flex items-center gap-2">
                <div
                  draggable={phase === 'QUARRY'}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', 'wedge');
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => {
                    if (phase !== 'QUARRY') return;
                    startIfNeeded();
                    placeWedgeToFirstEmpty();
                  }}
                  className={[
                    'rounded-lg border border-white/10 bg-white/5 p-2 flex items-center gap-2',
                    phase === 'QUARRY' ? 'cursor-grab active:cursor-grabbing hover:bg-white/10' : 'opacity-50 cursor-not-allowed',
                  ].join(' ')}
                  title="드래그 또는 클릭해서 틈에 꽂기"
                >
                  <img src="/assets/images/wood_wedge.png" alt="나무쐐기" className="w-10 h-10 object-contain" />
                  <div className="text-[11px] font-black">나무쐐기</div>
                </div>

                <button
                  type="button"
                  disabled={!allWedgesPlaced || phase !== 'QUARRY' || wedgeSwelling || mountainShake}
                  onClick={water}
                  className={[
                    'ml-auto rounded-lg px-2 py-2 font-black text-[11px] flex items-center gap-1.5',
                    allWedgesPlaced && phase === 'QUARRY' && !wedgeSwelling && !mountainShake
                      ? 'bg-sky-400 text-black hover:bg-sky-300 active:translate-y-[1px]'
                      : 'bg-white/10 text-white/40 cursor-not-allowed',
                  ].join(' ')}
                >
                  <img src="/assets/images/icon_water.png" alt="" className="w-5 h-5 object-contain" />
                  물
                </button>
              </div>
            </div>

            {/* 통나무 */}
            <div className="rounded-xl border border-white/10 bg-black/25 p-2">
              <div className="text-[11px] font-black opacity-90 mb-1">통나무</div>
              <div className="flex items-center gap-2">
                <div
                  draggable={phase === 'PREPARE'}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', 'log');
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => {
                    if (phase !== 'PREPARE') return;
                    startIfNeeded();
                    placeLogToFirstEmpty();
                  }}
                  className={[
                    'rounded-lg border border-white/10 bg-white/5 p-2 flex items-center gap-2',
                    phase === 'PREPARE' && logsCount > 0 ? 'cursor-grab active:cursor-grabbing hover:bg-white/10' : 'opacity-50 cursor-not-allowed',
                  ].join(' ')}
                  title="드래그 또는 클릭해서 통나무 배치"
                >
                  <img src="/assets/images/log.png" alt="통나무" className="w-10 h-10 object-contain" />
                  <div className="text-[11px] font-black">남은: {logsCount}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 안내 메시지(배경 밖) */}
          <div className="mt-2 rounded-xl border border-white/10 bg-black/35 p-2 text-[12px] leading-relaxed">
            {phase === 'QUARRY' && '나무쐐기 3개를 바위 틈에 꽂고, 물을 뿌려 바위를 쪼개보자! (드래그 또는 클릭)'}
            {phase === 'BIND' && '떼돌 옆의 손 아이콘을 눌러 밧줄로 묶어보자!'}
            {phase === 'PREPARE' && '통나무 3개를 돌 아래에 깔아주세요. (드래그 또는 클릭)'}
            {phase === 'MOVE' && `손 아이콘을 연타해서 돌을 옮기자! 목표: ${TARGET_PROGRESS}%`}
          </div>

          {feedback && (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/35 p-2 text-center text-sm font-black">
              {feedback}
            </div>
          )}
        </div>
      </div>

      {/* 결과창(수동 복귀) */}
      {resultModal && (
        <div className="fixed inset-0 z-[10010] grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl">
            <div className="p-5">
              <div className="text-xl font-black">성공! 고인돌 완성</div>
              <div className="mt-2 text-sm opacity-85 leading-relaxed">
                성공! 나무의 팽창하는 힘으로 바위를 쪼개고, 굴림대로 무거운 지석묘를 옮겨 무덤을 완성했어요!
              </div>
            </div>
            <div className="p-5 pt-0">
              <button
                type="button"
                className="w-full rounded-xl bg-emerald-400 text-black font-black py-3 hover:bg-emerald-300"
                onClick={() => {
                  const now = Date.now();
                  const started = startedAt ?? now;
                  const clearTime = Math.max(0, Math.round(((now - started) / 1000) * 10) / 10);
                  onComplete({ attempts, clearTime });
                }}
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
