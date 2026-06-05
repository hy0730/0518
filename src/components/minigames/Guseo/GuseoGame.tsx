import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import { ANYANG_GRID_MAP, DEFAULT_TRAPS, GUSEO_ASSETS, QUIZ_POOL, START_POS, keyOf } from '../../../data/guseoMazeConfig';
import type { GuseoTile as Tile, Pos, Quiz } from '../../../data/guseoMazeConfig';

type Phase = 'MAZE' | 'FINALE';

type Dir = 'U' | 'D' | 'L' | 'R';

type Guard = {
  id: number;
  r: number;
  c: number;
  patrol: Pos[];
  patrolIdx: number;
  dirFacing: Dir;
  visionLen: number;
};

function cloneMap(m: Tile[][]) {
  return m.map((row) => row.slice()) as Tile[][];
}

function dirFromDelta(dr: number, dc: number): Dir {
  if (dr === -1 && dc === 0) return 'U';
  if (dr === 1 && dc === 0) return 'D';
  if (dr === 0 && dc === -1) return 'L';
  return 'R';
}

function computeVisibleDangerSet(map: Tile[][], guards: Guard[]) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const set = new Set<string>();

  const deltaByDir: Record<Dir, { dr: number; dc: number }> = {
    U: { dr: -1, dc: 0 },
    D: { dr: 1, dc: 0 },
    L: { dr: 0, dc: -1 },
    R: { dr: 0, dc: 1 },
  };

  for (const g of guards) {
    const d = deltaByDir[g.dirFacing];
    for (let i = 1; i <= g.visionLen; i += 1) {
      const rr = g.r + d.dr * i;
      const cc = g.c + d.dc * i;
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) break;
      // 벽(0)을 만나면 시야 차단
      if (map[rr][cc] === 0) break;
      set.add(keyOf(rr, cc));
    }
  }
  return set;
}

function RiceBagIcon() {
  return <img src={GUSEO_ASSETS.ricesack} alt="" className="w-7 h-7 object-contain" draggable={false} />;
}

function ExitIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M12 54V10c0-2 2-4 4-4h20c2 0 4 2 4 4v8"
        fill="none"
        stroke="#4A3728"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M24 32h26" stroke="#4A3728" strokeWidth="4" strokeLinecap="round" />
      <path d="M42 22l12 10-12 10" fill="none" stroke="#4A3728" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 54h28" stroke="#4A3728" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PoliceIcon() {
  // 간단한 순사 실루엣(에셋 없이)
  return (
    <svg width="160" height="160" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 20c4-6 12-10 18-10s14 4 18 10v6H14v-6Z" fill="#2b2b2b" />
      <path d="M18 18h28l-2-6H20l-2 6Z" fill="#1f1f1f" />
      <circle cx="32" cy="30" r="10" fill="#3a2b22" />
      <path d="M18 60c0-12 6-18 14-18s14 6 14 18" fill="#2b2b2b" />
      <path d="M26 42l6 6 6-6" fill="none" stroke="#D9534F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GuardMarker() {
  return <img src={GUSEO_ASSETS.policeman} alt="순사" className="w-7 h-7 object-contain drop-shadow" draggable={false} />;
}

export default function GuseoGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );

  const mainBg = useMemo(() => getRelicMainImage(stageId), [stageId]);
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('MAZE');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  const [map, setMap] = useState<Tile[][]>(() => cloneMap(ANYANG_GRID_MAP));
  const [pos, setPos] = useState(START_POS);
  const [lastSafePos, setLastSafePos] = useState(START_POS);
  const [hasRice, setHasRice] = useState(false);
  const [trapSet, setTrapSet] = useState<Set<string>>(() => new Set(DEFAULT_TRAPS.map((p) => keyOf(p.r, p.c))));

  const [guards, setGuards] = useState<Guard[]>(() => [
    {
      id: 1,
      r: 3,
      c: 9,
      patrol: [
        { r: 3, c: 9 },
        { r: 3, c: 10 },
        { r: 3, c: 11 },
        { r: 3, c: 10 }, // 왕복
      ],
      patrolIdx: 0,
      dirFacing: 'R',
      visionLen: 1,
    },
  ]);
  const [visibleDangerSet, setVisibleDangerSet] = useState<Set<string>>(() => computeVisibleDangerSet(ANYANG_GRID_MAP, [
    {
      id: 1,
      r: 3,
      c: 9,
      patrol: [
        { r: 3, c: 9 },
        { r: 3, c: 10 },
        { r: 3, c: 11 },
        { r: 3, c: 10 },
      ],
      patrolIdx: 0,
      dirFacing: 'R',
      visionLen: 1,
    },
  ]));
  const [lockInput, setLockInput] = useState(false);
  const [redFlash, setRedFlash] = useState(false);

  const rows = map.length;
  const cols = map[0]?.length ?? 0;

  // 10x15를 보기 좋게
  const cell = 30;
  const gridW = cols * cell;
  const gridH = rows * cell;

  // UI 상태
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string, ms = 1400) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  };
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const [shake, setShake] = useState(false);
  const [encounter, setEncounter] = useState<{
    active: boolean;
    tile: { r: number; c: number } | null;
    quizId: number;
    policeShow: boolean;
  }>({ active: false, tile: null, quizId: 0, policeShow: false });
  const [usedQuizIds, setUsedQuizIds] = useState<Set<number>>(() => new Set());

  const movingLocked = lockInput || encounter.active || phase !== 'MAZE';

  // 가드/맵 변경 시 시야 재계산
  useEffect(() => {
    setVisibleDangerSet(computeVisibleDangerSet(map, guards));
  }, [map, guards]);

  const tryMove = (dir: Dir) => {
    startIfNeeded();
    if (movingLocked) return;

    const delta = dir === 'U' ? { dr: -1, dc: 0 } : dir === 'D' ? { dr: 1, dc: 0 } : dir === 'L' ? { dr: 0, dc: -1 } : { dr: 0, dc: 1 };
    const nr = pos.r + delta.dr;
    const nc = pos.c + delta.dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;

    const nextTile = map[nr][nc];
    // 0: 벽/건물
    if (nextTile === 0) {
      audio.playUrl('/assets/sounds/sfx_negative_beep.mp3', 0.6);
      return;
    }

    setLockInput(true);
    const prev = pos;
    setLastSafePos(prev);

    // GOAL(3): 쌀 획득 전에는 탈출 불가
    if (nextTile === 3 && !hasRice) {
      showToast('서이면사무소에서 쌀을 먼저 찾아야 해!', 1200);
      audio.playSfx('wrong', 0.75);
      setLockInput(false);
      return;
    }

    // 이동 확정
    const nextPos = { r: nr, c: nc };
    setPos(nextPos);

    // 턴제: 플레이어 이동 성공 직후 가드 1칸 이동 → 시야 업데이트 → 발각 검사
    const nextGuards = guards.map((g) => {
      const nextIdx = (g.patrolIdx + 1) % g.patrol.length;
      const nextP = g.patrol[nextIdx];
      const dr = nextP.r - g.r;
      const dc = nextP.c - g.c;
      const facing = dr === 0 && dc === 0 ? g.dirFacing : dirFromDelta(dr, dc);
      return { ...g, r: nextP.r, c: nextP.c, patrolIdx: nextIdx, dirFacing: facing };
    });
    setGuards(nextGuards);
    const nextDanger = computeVisibleDangerSet(map, nextGuards);
    setVisibleDangerSet(nextDanger);

    if (nextDanger.has(keyOf(nextPos.r, nextPos.c))) {
      // 발각 연출
      setRedFlash(true);
      window.setTimeout(() => setRedFlash(false), 500);
      showToast('들켰다! 조심해!', 1100);
      audio.playSfx('wrong', 0.85);
      setPos(lastSafePos);
      setLockInput(false);
      return;
    }

    // 쌀가마니(4) 획득
    if (nextTile === 4) {
      if (!hasRice) {
        setHasRice(true);
        showToast('쌀가마니를 되찾았다!', 1200);
        audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.85);
      }
      // 이후 길(1)처럼 통과
      setMap((prevMap) => {
        const next = cloneMap(prevMap);
        if (next[nr][nc] === 4) next[nr][nc] = 1;
        return next;
      });
    }

    // 함정(퀴즈) 트리거: 길(1)처럼 보이되, 지정 좌표에서만 인카운터
    if (trapSet.has(keyOf(nr, nc))) {
      audio.playUrl('/assets/sounds/sfx_negative_beep.mp3', 0.85);
      audio.playUrl('/assets/sounds/sfx_pop.mp3', 0.7);
      // 1회 인카운터 = 1문항(반복 방지: 가능한 한 새 문제 선택)
      const pool = QUIZ_POOL.length ? QUIZ_POOL : [];
      const available = pool
        .map((_, idx) => idx)
        .filter((idx) => !usedQuizIds.has(idx));
      const candidates = available.length ? available : pool.map((_, idx) => idx);
      const quizId = candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
      if (!available.length) setUsedQuizIds(new Set()); // 풀을 다 썼으면 리셋
      setEncounter({ active: true, tile: { r: nr, c: nc }, quizId, policeShow: true });
      setLockInput(false);
      return;
    }

    // GOAL(3): 쌀 획득 후에만 클리어
    if (nextTile === 3 && hasRice) {
      audio.playUrl('/assets/sounds/sfx_fanfare.mp3', 0.85);
      setPhase('FINALE');
      setLockInput(false);
      return;
    }

    setLockInput(false);
  };

  // 키보드 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (movingLocked) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') tryMove('U');
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') tryMove('D');
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') tryMove('L');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') tryMove('R');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [movingLocked, pos, map]);

  const answerQuiz = (choiceIdx: number) => {
    if (!encounter.active) return;
    const quiz = QUIZ_POOL[encounter.quizId] ?? QUIZ_POOL[0];
    const isCorrect = choiceIdx === quiz?.answerIndex;

    if (isCorrect) {
      audio.playSfx('correct', 0.75);
      showToast('정답입니다!', 900);

      // 정답: 해당 함정 해제(영구 안전 길)
      const t = encounter.tile;
      if (t) {
        // 함정 해제: 해당 좌표를 안전 길로 만듦(좌표 Set에서 제거)
        setTrapSet((prevSet) => {
          const next = new Set(prevSet);
          next.delete(keyOf(t.r, t.c));
          return next;
        });
        setLastSafePos({ r: t.r, c: t.c });
      }
      setUsedQuizIds((prev) => {
        const next = new Set(prev);
        next.add(encounter.quizId);
        return next;
      });
      setEncounter({ active: false, tile: null, quizId: 0, policeShow: false });
      return;
    }

    // 오답: attempts 증가 + 흔들림 + 직전 안전지대로 튕김
    audio.playSfx('wrong', 0.85);
    setAttempts((a) => a + 1);
    setShake(true);
    showToast('오답! 다시 숨어서 이동해보자.', 1100);
    window.setTimeout(() => setShake(false), 420);
    setPos(lastSafePos);
    setEncounter({ active: false, tile: null, quizId: 0, policeShow: false });
  };

  // 피날레(흑백 → 컬러) + 만세 + 꽃잎
  const [finaleStep, setFinaleStep] = useState<'BW' | 'COLOR' | 'MODAL'>('BW');
  const [resultModal, setResultModal] = useState(false);

  useEffect(() => {
    if (phase !== 'FINALE') return;
    setFinaleStep('BW');
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.85);
    const t1 = window.setTimeout(() => setFinaleStep('COLOR'), 650);
    const t2 = window.setTimeout(() => setFinaleStep('MODAL'), 2200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase]);

  useEffect(() => {
    if (finaleStep !== 'MODAL') return;
    setResultModal(true);
  }, [finaleStep]);

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes popGuard {
          0% { transform: translateY(-30px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .guardFx { animation: popGuard 260ms ease-out both; }

        @keyframes shakeX {
          0% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        .shakeFx { animation: shakeX 420ms ease-in-out; }

        @keyframes petalFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(520px) rotate(260deg); opacity: 0; }
        }
        .petalFx { animation: petalFall 2.6s linear infinite; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {stageTitle}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'MAZE' ? 'Phase 1: 잠입 미로' : 'Phase 2: 피날레'}</div>
      </div>

      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {/* 발각 레드 플래시 */}
        {redFlash && <div className="absolute inset-0 z-[10500] bg-red-600/25 pointer-events-none" />}

        {/* 배경 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(244,235,217,0.14), rgba(244,235,217,0.34)), url('${mainBg}')`,
            filter: phase === 'FINALE' && finaleStep === 'BW' ? 'grayscale(1) contrast(1.05)' : 'none',
            transition: 'filter 650ms ease',
          }}
        />

        {/* 미로 */}
        <div className="absolute inset-0 p-3">
          <div className="h-full grid grid-cols-[1fr_220px] gap-3">
            <div className={['relative rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden', shake ? 'shakeFx' : ''].join(' ')}>
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 relative"
                style={{ width: `${gridW}px`, height: `${gridH}px` }}
              >
                {/* 타일 뒷배경(미로 전용 이미지) */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-90 pointer-events-none"
                  style={{ backgroundImage: `url('${GUSEO_ASSETS.mazeBg}')` }}
                />
                <div
                  className="relative z-10 grid"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
                    gridTemplateRows: `repeat(${rows}, ${cell}px)`,
                    gap: '0px',
                  }}
                >
                  {map.flatMap((row, r) =>
                    row.map((t, c) => {
                      const isPlayer = pos.r === r && pos.c === c;
                      const isGuard = guards.some((g) => g.r === r && g.c === c);
                      const isDanger = visibleDangerSet.has(keyOf(r, c));
                      // 배경 일러스트 위에서 길/벽 구분이 잘 되도록 길 타일에도 아주 옅은 바탕을 깔아줌
                      const base = t === 0 ? 'bg-ink/25 border-ink/35' : 'bg-paper/20 border-ink/10';
                      const isGoal = t === 3;
                      const isStart = t === 2;
                      const isRice = t === 4;
                      return (
                        <div
                          key={`${r}-${c}`}
                          className={[
                            'relative border',
                            base,
                            // 목표 타일은 더 눈에 띄게
                            isGoal ? 'bg-emerald-200/80 border-ink/25' : '',
                            isStart ? 'bg-sky-100/65 border-ink/20' : '',
                            // 쌀 타일은 더 눈에 띄게(획득 전)
                            isRice ? 'bg-amber-200/80 border-ink/25 animate-pulse' : '',
                            // 쌀을 찾은 뒤에는 탈출구를 유도
                            isGoal && hasRice ? 'ring-2 ring-emerald-500/80 animate-pulse' : '',
                          ].join(' ')}
                        >
                          {/* 붉은 시야 오버레이 */}
                          {isDanger && (
                            <div className="absolute inset-0 bg-red-600/45 ring-2 ring-red-500/70 animate-pulse" />
                          )}

                          {isRice ? (
                            <div className="absolute inset-0 grid place-items-center opacity-80">
                              <RiceBagIcon />
                            </div>
                          ) : null}

                          {isGoal ? (
                            <div className="absolute inset-0 grid place-items-center opacity-85">
                              <ExitIcon />
                            </div>
                          ) : null}

                          {isStart ? (
                            <div className="absolute left-1 top-1 text-[9px] font-black opacity-80">
                              START
                            </div>
                          ) : null}

                          {isPlayer ? (
                            <div className="absolute inset-0 grid place-items-center">
                              <img src={GUSEO_ASSETS.activist} alt="독립운동가" className="w-7 h-7 object-contain drop-shadow" draggable={false} />
                            </div>
                          ) : null}

                          {isGuard ? (
                            <div className="absolute inset-0 grid place-items-center">
                              <GuardMarker />
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 우측 UI */}
            <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-2">
              <div className="text-sm font-black">이동</div>
              <div className="text-[11px] opacity-80 leading-relaxed">
                먼저 서이면사무소에서 쌀가마니를 찾아야 해요. <br />
                쌀을 찾은 뒤 탈출구로 가면 클리어!
              </div>
              <div className="rounded-2xl border border-ink/20 bg-paper2/90 shadow-md px-3 py-2 text-[11px] font-black">
                쌀 획득: <span className={hasRice ? 'text-olive' : 'text-stamp'}>{hasRice ? '완료' : '미획득'}</span>
              </div>

              {/* 십자키 */}
              <div className="mt-2 grid place-items-center">
                <div className="grid grid-cols-3 grid-rows-3 gap-2">
                  <div />
                  <button
                    type="button"
                    className="note-btn"
                    onClick={() => tryMove('U')}
                    disabled={movingLocked}
                  >
                    ↑
                  </button>
                  <div />
                  <button type="button" className="note-btn" onClick={() => tryMove('L')} disabled={movingLocked}>
                    ←
                  </button>
                  <div className="rounded-2xl border border-ink/20 bg-paper2/90 shadow-md grid place-items-center text-[11px] font-black">
                    {attempts}
                    <div className="text-[10px] opacity-70">실수</div>
                  </div>
                  <button type="button" className="note-btn" onClick={() => tryMove('R')} disabled={movingLocked}>
                    →
                  </button>
                  <div />
                  <button type="button" className="note-btn" onClick={() => tryMove('D')} disabled={movingLocked}>
                    ↓
                  </button>
                  <div />
                </div>
              </div>

              <div className="mt-auto text-[11px] opacity-80">
                키보드: 방향키 / WASD
              </div>
            </div>
          </div>
        </div>

        {/* 함정 인카운터 오버레이 */}
        {encounter.active && (
          <div className="absolute inset-0 z-[11000] bg-ink/35 grid place-items-center p-4">
            <div className="w-full max-w-[520px] note-panel p-4">
              {/* 순사 튀어나오기 */}
              {encounter.policeShow && (
                <div className="grid place-items-center guardFx">
                  <div className="rounded-3xl border-2 border-ink/30 bg-paper/70 px-5 py-3 shadow-paper">
                    <div className="text-sm font-black text-stamp text-center">불심검문! 신분을 확인하겠다!</div>
                    <div className="mt-2 grid place-items-center">
                      <img src={GUSEO_ASSETS.policeman} alt="일본 순사" className="w-[160px] h-[160px] object-contain" draggable={false} />
                    </div>
                  </div>
                </div>
              )}

              {/* 퀴즈 */}
              <div className="mt-3">
                <div className="text-sm font-black">미니 퀴즈</div>
                <div className="mt-2 text-sm leading-relaxed">{(QUIZ_POOL[encounter.quizId] ?? QUIZ_POOL[0])?.question}</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(QUIZ_POOL[encounter.quizId] ?? QUIZ_POOL[0])?.options.map((op, idx) => (
                    <button
                      key={op}
                      type="button"
                      className="note-btn-primary"
                      onClick={() => answerQuiz(idx)}
                    >
                      {idx + 1}. {op}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11px] opacity-80">
                  맞추면 안전한 길이 돼요. 틀리면 뒤로 밀려나요!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 피날레 오버레이 */}
        {phase === 'FINALE' && (
          <div className="absolute inset-0 z-[10000] pointer-events-none">
            {finaleStep === 'COLOR' || finaleStep === 'MODAL' ? (
              <>
                {/* 만세 텍스트 */}
                <div className="absolute inset-0 grid place-items-center">
                  <div className="note-panel px-6 py-4">
                    <div className="text-3xl font-black text-stamp">대한 독립 만세!</div>
                  </div>
                </div>
                {/* 꽃잎 파티클(무궁화 느낌) */}
                {Array.from({ length: 18 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute petalFx"
                    style={{
                      left: `${(i * 37) % 100}%`,
                      top: `-10%`,
                      animationDelay: `${(i % 6) * 0.18}s`,
                    }}
                  >
                    <div
                      style={{
                        width: 10 + (i % 3) * 4,
                        height: 10 + (i % 3) * 4,
                        borderRadius: 999,
                        background: 'rgba(255, 120, 170, 0.55)',
                        boxShadow: '0 10px 20px rgba(74,55,40,0.12)',
                      }}
                    />
                  </div>
                ))}
              </>
            ) : null}
          </div>
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
              <div className="text-lg font-black">성공! 임무 완료</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                성공! 구서이면사무소의 이야기를 지나, 모두의 마음속에 ‘대한 독립 만세!’가 울려 퍼졌어요!
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
