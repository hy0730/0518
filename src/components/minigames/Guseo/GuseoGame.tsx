import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import {
  ANYANG_GRID_MAP,
  DEFAULT_TRAPS,
  DELIVERY_SPOT_BY_KEY,
  DELIVERY_SPOTS,
  DELIVERY_TILES,
  GUSEO_ASSETS,
  QUIZ_POOL,
  RICE_SOURCE_TILES,
  START_POS,
  keyOf,
} from '../../../data/guseoMazeConfig';
import type { GuseoTile as Tile, Pos, Quiz } from '../../../data/guseoMazeConfig';
import { useToast } from '../common/useToast';
import { useGameTuning } from '../../common/GameTuningContext';

type Phase = 'INTRO' | 'MAZE' | 'FINALE';

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

function manhattan(a: Pos, b: Pos) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function isWalkable(t: Tile) {
  // 0만 벽/건물
  return t !== 0;
}

function bfsNextStep(map: Tile[][], start: Pos, goal: Pos, blocked: Set<string>) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const q: Pos[] = [];
  const prev = new Map<string, string | null>();

  const startKey = keyOf(start.r, start.c);
  q.push(start);
  prev.set(startKey, null);

  const dirs: Array<{ dr: number; dc: number }> = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  while (q.length) {
    const cur = q.shift()!;
    if (cur.r === goal.r && cur.c === goal.c) break;
    for (const d of dirs) {
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (!isWalkable(map[nr][nc])) continue;
      const k = keyOf(nr, nc);
      if (blocked.has(k) && !(nr === goal.r && nc === goal.c)) continue;
      if (prev.has(k)) continue;
      prev.set(k, keyOf(cur.r, cur.c));
      q.push({ r: nr, c: nc });
    }
  }

  const goalKey = keyOf(goal.r, goal.c);
  if (!prev.has(goalKey)) return null;

  // start -> ... -> goal 경로에서 "다음 한 칸"을 역추적
  let curKey: string | null = goalKey;
  let parent: string | null = prev.get(curKey) ?? null;
  while (parent && parent !== startKey) {
    curKey = parent;
    parent = prev.get(curKey) ?? null;
  }

  if (!curKey) return null;
  const [rStr, cStr] = curKey.split(',');
  return { r: Number(rStr), c: Number(cStr) };
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
  return (
    <div className="w-8 h-8 rounded-full bg-white/85 border-2 border-ink/50 shadow-md grid place-items-center">
      <img src={GUSEO_ASSETS.ricesack} alt="" className="w-7 h-7 object-contain" draggable={false} />
    </div>
  );
}

function CitizenIcon({ done }: { done: boolean }) {
  return (
    <div
      className={[
        'w-8 h-8 rounded-full border-2 shadow-md grid place-items-center',
        done ? 'bg-emerald-200/85 border-emerald-700/50' : 'bg-white/85 border-ink/50',
      ].join(' ')}
    >
      {done ? (
        <div className="text-[12px] font-black text-emerald-900">✔</div>
      ) : (
        <img src={GUSEO_ASSETS.citizen} alt="백성" className="w-7 h-7 object-contain" draggable={false} />
      )}
    </div>
  );
}

function HideIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-white/85 border-2 border-ink/50 shadow-md grid place-items-center">
      <div className="text-[11px] font-black text-ink/80">숨기</div>
    </div>
  );
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
  return (
    <div className="w-8 h-8 rounded-full bg-white/85 border-2 border-ink/50 shadow-md grid place-items-center">
      <img src={GUSEO_ASSETS.policeman} alt="순사" className="w-7 h-7 object-contain" draggable={false} />
    </div>
  );
}

export default function GuseoGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );

  const mainBg = useMemo(() => getRelicMainImage(stageId), [stageId]);
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('INTRO');
  const [introStatus, setIntroStatus] = useState<'SHOW' | 'FADE' | 'DONE'>('SHOW');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  const [map, setMap] = useState<Tile[][]>(() => cloneMap(ANYANG_GRID_MAP));
  const [pos, setPos] = useState(START_POS);
  const [lastSafePos, setLastSafePos] = useState(START_POS);
  const [carryingRice, setCarryingRice] = useState(0);
  // 전달 완료는 "스팟 id" 단위로 기록 (각 스팟은 2칸)
  const [deliveredSet, setDeliveredSet] = useState<Set<string>>(() => new Set());
  const [trapSet, setTrapSet] = useState<Set<string>>(() => new Set(DEFAULT_TRAPS.map((p) => keyOf(p.r, p.c))));

  const [guards, setGuards] = useState<Guard[]>(() => [
    {
      id: 1,
      // 서이면사무소 주변 순찰(중앙부)
      r: 8,
      c: 8,
      patrol: [
        { r: 8, c: 8 },
        { r: 8, c: 9 },
        { r: 8, c: 10 },
        { r: 8, c: 11 },
        { r: 8, c: 12 },
        { r: 8, c: 11 },
        { r: 8, c: 10 },
        { r: 8, c: 9 },
      ],
      patrolIdx: 0,
      dirFacing: 'R',
      visionLen: 1,
    },
    {
      id: 2,
      // 플레이어 추격(거리 6칸 이내면 BFS로 1칸 추격, 멀면 순찰)
      r: 17,
      c: 10,
      patrol: [
        { r: 17, c: 10 },
        { r: 17, c: 12 },
        { r: 17, c: 14 },
        { r: 17, c: 12 },
      ],
      patrolIdx: 0,
      dirFacing: 'R',
      visionLen: 1,
    },
  ]);
  const [visibleDangerSet, setVisibleDangerSet] = useState<Set<string>>(() => computeVisibleDangerSet(ANYANG_GRID_MAP, [
    { id: 1, r: 8, c: 8, patrol: [], patrolIdx: 0, dirFacing: 'R', visionLen: 1 },
    { id: 2, r: 17, c: 10, patrol: [], patrolIdx: 0, dirFacing: 'R', visionLen: 1 },
  ]));
  const [lockInput, setLockInput] = useState(false);
  const [redFlash, setRedFlash] = useState(false);

  const rows = map.length;
  const cols = map[0]?.length ?? 0;

  // 20x20 표시를 위해 셀 크기 축소
  const cell = 22;
  const gridW = cols * cell;
  const gridH = rows * cell;

  // UI 상태
  const { toast, showToast } = useToast(1400);

  const [shake, setShake] = useState(false);
  const [encounter, setEncounter] = useState<{
    active: boolean;
    tile: { r: number; c: number } | null;
    quizId: number;
    policeShow: boolean;
  }>({ active: false, tile: null, quizId: 0, policeShow: false });
  const [usedQuizIds, setUsedQuizIds] = useState<Set<number>>(() => new Set());

  const movingLocked = lockInput || encounter.active || phase !== 'MAZE';
  const turnRef = useRef(0);

  // 튜닝(줌인 파라미터)
  const tuning = useGameTuning();
  const zoomBase = tuning?.getNumber('zoomBase', 1) ?? 1;
  const zoomIn = tuning?.getNumber('zoomIn', 1.35) ?? 1.35;
  const guardZoomDist = tuning?.getNumber('guardZoomDist', 4) ?? 4;
  const citizenZoomDist = tuning?.getNumber('citizenZoomDist', 3) ?? 3;

  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = mapViewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setViewSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setViewSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  const nearestGuardDist = useMemo(() => {
    if (phase !== 'MAZE') return 999;
    let m = 999;
    for (const g of guards) {
      m = Math.min(m, manhattan({ r: g.r, c: g.c }, pos));
    }
    return m;
  }, [guards, pos, phase]);

  const nearestCitizenDist = useMemo(() => {
    if (phase !== 'MAZE') return 999;
    let m = 999;
    for (const p of DELIVERY_TILES) {
      const spotId = DELIVERY_SPOT_BY_KEY[keyOf(p.r, p.c)];
      if (!spotId) continue;
      if (deliveredSet.has(spotId)) continue;
      m = Math.min(m, manhattan({ r: p.r, c: p.c }, pos));
    }
    return m;
  }, [deliveredSet, pos, phase]);

  const zoomTarget = useMemo(() => {
    const shouldZoom = nearestGuardDist <= guardZoomDist || nearestCitizenDist <= citizenZoomDist;
    return shouldZoom ? zoomIn : zoomBase;
  }, [nearestGuardDist, guardZoomDist, nearestCitizenDist, citizenZoomDist, zoomIn, zoomBase]);

  const cameraTransform = useMemo(() => {
    const vw = viewSize.w;
    const vh = viewSize.h;
    const z = zoomTarget;
    if (!vw || !vh) return { tx: 0, ty: 0, z };
    const px = pos.c * cell + cell / 2;
    const py = pos.r * cell + cell / 2;
    const mapW = gridW * z;
    const mapH = gridH * z;

    const centeredX = vw / 2 - px * z;
    const centeredY = vh / 2 - py * z;

    const minX = vw - mapW;
    const minY = vh - mapH;

    const clampAxis = (centered: number, min: number) => {
      if (min > 0) return min / 2; // 맵이 더 작으면 가운데 정렬
      return Math.max(min, Math.min(0, centered));
    };

    return { tx: clampAxis(centeredX, minX), ty: clampAxis(centeredY, minY), z };
  }, [viewSize, zoomTarget, pos, cell, gridW, gridH]);

  // 가드 상태 참조(추격 로직 안정화)
  const guardsRef = useRef<Guard[]>(guards);
  useEffect(() => {
    guardsRef.current = guards;
  }, [guards]);

  // 미로 시작 시 턴 카운터 초기화
  useEffect(() => {
    if (phase !== 'MAZE') return;
    turnRef.current = 0;
  }, [phase]);

  // 가드/맵 변경 시 시야 재계산
  useEffect(() => {
    setVisibleDangerSet(computeVisibleDangerSet(map, guards));
  }, [map, guards]);

  const computeNextGuards = (guardsNow: Guard[], playerPos: Pos) => {
    const next: Guard[] = [];
    // 1) 순찰 가드(서이면사무소 주변)
    {
      const g = guardsNow[0];
      const nextIdx = (g.patrolIdx + 1) % g.patrol.length;
      const nextP = g.patrol[nextIdx];
      const dr = nextP.r - g.r;
      const dc = nextP.c - g.c;
      const facing = dr === 0 && dc === 0 ? g.dirFacing : dirFromDelta(dr, dc);
      next.push({ ...g, r: nextP.r, c: nextP.c, patrolIdx: nextIdx, dirFacing: facing });
    }
    // 2) 추격 가드(거리 6 이내면 BFS로 한 칸 추격)
    {
      const g = guardsNow[1];
      const dist = manhattan({ r: g.r, c: g.c }, playerPos);
      const blocked = new Set<string>([keyOf(next[0].r, next[0].c)]);
      let nextP: Pos | null = null;
      if (dist <= 6) {
        nextP = bfsNextStep(map, { r: g.r, c: g.c }, playerPos, blocked);
      }
      if (!nextP) {
        const nextIdx = (g.patrolIdx + 1) % g.patrol.length;
        nextP = g.patrol[nextIdx];
        const dr = nextP.r - g.r;
        const dc = nextP.c - g.c;
        const facing = dr === 0 && dc === 0 ? g.dirFacing : dirFromDelta(dr, dc);
        next.push({ ...g, r: nextP.r, c: nextP.c, patrolIdx: nextIdx, dirFacing: facing });
      } else {
        const dr = nextP.r - g.r;
        const dc = nextP.c - g.c;
        const facing = dr === 0 && dc === 0 ? g.dirFacing : dirFromDelta(dr, dc);
        next.push({ ...g, r: nextP.r, c: nextP.c, dirFacing: facing });
      }
    }
    return next;
  };

  const processGuardTurnAndDetect = (playerPos: Pos, rollbackPos: Pos) => {
    // (요청) 순사가 너무 빠르므로 2턴마다 1번은 "제자리 대기"
    // turn 1: 이동, turn 2: 대기, turn 3: 이동, turn 4: 대기 ...
    const nextTurn = turnRef.current + 1;
    turnRef.current = nextTurn;
    const guardShouldMove = nextTurn % 2 === 1;

    const currentGuards = guardsRef.current;
    const nextGuards = guardShouldMove ? computeNextGuards(currentGuards, playerPos) : currentGuards;
    if (guardShouldMove) {
      setGuards(nextGuards);
      guardsRef.current = nextGuards;
    }

    const nextDanger = computeVisibleDangerSet(map, nextGuards);
    setVisibleDangerSet(nextDanger);

    const onGuard = nextGuards.some((g) => g.r === playerPos.r && g.c === playerPos.c);
    const playerTile = map[playerPos.r]?.[playerPos.c];
    // 은신처(6) 위에서는 시야에 들어와도 발각되지 않음
    const inSight = playerTile === 6 ? false : nextDanger.has(keyOf(playerPos.r, playerPos.c));
    if (onGuard || inSight) {
      setRedFlash(true);
      window.setTimeout(() => setRedFlash(false), 500);
      showToast('들켰다! 조심해!', 1100);
      audio.playSfx('wrong', 0.85);
      setPos(rollbackPos);
      return true;
    }
    return false;
  };

  const waitTurn = () => {
    startIfNeeded();
    if (movingLocked) return;
    setLockInput(true);
    const detected = processGuardTurnAndDetect(pos, lastSafePos);
    if (!detected) {
      // 대기 턴은 안전지대 갱신 없음
    }
    setLockInput(false);
  };

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

    const deliveredCount = deliveredSet.size;
    const targetDeliveryCount = DELIVERY_SPOTS.length;

    // 이동 확정
    const nextPos = { r: nr, c: nc };
    setPos(nextPos);

    // 턴제: 이동 성공 직후 가드 턴 + 발각 검사
    const detected = processGuardTurnAndDetect(nextPos, lastSafePos);
    if (detected) {
      setLockInput(false);
      return;
    }

    // 쌀(4) 획득: 들고 있지 않을 때만 1개 집기(서이면사무소에 3개)
    if (nextTile === 4) {
      if (carryingRice >= 1) {
        showToast('지금은 쌀가마니를 하나만 들 수 있어!', 1200);
      } else {
        setCarryingRice(1);
        showToast('수탈된 쌀을 되찾았다! 백성에게 전달하러 가자!', 1200);
        audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.85);
        // 해당 쌀은 가져가서 빈 자리(길)로 변경
        setMap((prevMap) => {
          const next = cloneMap(prevMap);
          if (next[nr][nc] === 4) next[nr][nc] = 1;
          return next;
        });
      }
    }

    // 백성(5): 쌀을 들고 있으면 전달(각 지점 1회)
    if (nextTile === 5) {
      const k = keyOf(nr, nc);
      const spotId = DELIVERY_SPOT_BY_KEY[k];
      if (!spotId) {
        // 안전장치: 잘못된 설정이면 그냥 통과
      } else if (deliveredSet.has(spotId)) {
        showToast('여긴 이미 전달했어!', 1100);
      } else if (carryingRice <= 0) {
        showToast('쌀가마니를 먼저 챙겨야 해!', 1100);
      } else {
        setCarryingRice(0);
        setDeliveredSet((prevSet) => {
          const next = new Set(prevSet);
          next.add(spotId);
          return next;
        });
        showToast(`전달 성공! (${deliveredCount + 1}/${targetDeliveryCount})`, 1200);
        audio.playSfx('correct', 0.8);
      }
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

    // GOAL(3): 전달 3곳 완료 후에만 클리어
    if (nextTile === 3) {
      const nextDeliveredCount = deliveredSet.size;
      if (nextDeliveredCount < targetDeliveryCount) {
        showToast(`아직 전달이 남았어! (${targetDeliveryCount}곳 모두 전달)`, 1200);
        audio.playSfx('wrong', 0.75);
        setLockInput(false);
        return;
      }
      audio.playUrl('/assets/sounds/sfx_fanfare.mp3', 0.85);
      setPhase('FINALE');
      setLockInput(false);
      return;
    }

    // 발각/함정/클리어가 아니면 현재 위치를 안전지대로 갱신
    setLastSafePos(nextPos);
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
      if (e.code === 'Space' || e.key === ' ') waitTurn();
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
        <div className="text-xs font-bold opacity-80">{phase === 'FINALE' ? 'Phase 2: 피날레' : 'Phase 1: 잠입 미로'}</div>
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

        {/* INTRO 오버레이: maze 이미지를 전면에 보여주고 스토리텔링 */}
        {introStatus !== 'DONE' && (
          <button
            type="button"
            className={[
              'absolute inset-0 z-[12000] p-4 text-left',
              'transition-opacity duration-700',
              introStatus === 'FADE' ? 'opacity-0 pointer-events-none' : 'opacity-100',
            ].join(' ')}
            onClick={() => {
              if (introStatus !== 'SHOW') return;
              setIntroStatus('FADE');
              // 맵이 서서히 나타나는 동안 입력을 막고, 페이드 완료 후 정리
              setPhase('MAZE');
              window.setTimeout(() => setIntroStatus('DONE'), 720);
            }}
            onTouchStart={() => {
              if (introStatus !== 'SHOW') return;
              setIntroStatus('FADE');
              setPhase('MAZE');
              window.setTimeout(() => setIntroStatus('DONE'), 720);
            }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${GUSEO_ASSETS.mazeBg}')` }}
            />
            <div className="absolute inset-0 bg-ink/45" />
            <div className="relative z-10 h-full grid place-items-center">
              <div className="note-panel max-w-[620px] px-5 py-4">
                <div className="text-lg font-black">구서이면사무소 잠입 작전</div>
                <div className="mt-2 text-sm leading-relaxed opacity-95">
                  구서이면사무소 한가운데에 수탈된 쌀가마니가 숨겨져 있어요.
                  <br />
                  순사의 눈을 피해 쌀을 되찾고, 마을 3곳의 수탈당한 백성에게 전달해 돌려주세요!
                </div>
                <div className="mt-3 text-sm font-black text-stamp">화면을 터치하면 작전을 시작합니다.</div>
              </div>
            </div>
          </button>
        )}

        {/* 미로 */}
        <div className="absolute inset-0 p-3">
          <div
            className="h-full grid grid-cols-[1fr_220px] gap-3"
            style={{
              opacity: introStatus === 'SHOW' ? 0 : 1,
              transition: 'opacity 800ms ease',
            }}
          >
            <div
              ref={mapViewportRef}
              className={['relative rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden', shake ? 'shakeFx' : ''].join(' ')}
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-0">
                <div
                  className="absolute left-0 top-0 will-change-transform"
                  style={{
                    width: `${gridW}px`,
                    height: `${gridH}px`,
                    transformOrigin: 'top left',
                    transform: `translate(${cameraTransform.tx}px, ${cameraTransform.ty}px) scale(${cameraTransform.z})`,
                    transition: 'transform 180ms ease',
                  }}
                >
                  {/* 타일 뒷배경(미로 전용 이미지) */}
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-60 pointer-events-none"
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
                      // 배경 위에서 "길/벽/목표/위험"이 확실히 구분되도록 고대비 팔레트 적용
                      const base = t === 0 ? 'bg-ink/55 border-ink/70' : 'bg-paper/70 border-ink/20';
                      const isGoal = t === 3;
                      const isStart = t === 2;
                      const isRice = t === 4;
                      const isDelivery = t === 5;
                      const isHide = t === 6;
                      const deliveryDone = isDelivery ? deliveredSet.has(DELIVERY_SPOT_BY_KEY[keyOf(r, c)] ?? '') : false;
                      return (
                        <div
                          key={`${r}-${c}`}
                          className={[
                            'relative border',
                            base,
                            // 목표 타일은 더 눈에 띄게
                            isGoal ? 'bg-emerald-300/85 border-ink/35' : '',
                            isStart ? 'bg-sky-100/65 border-ink/20' : '',
                            // 쌀 타일은 더 눈에 띄게(획득 전)
                            isRice ? 'bg-amber-300/85 border-ink/35 animate-pulse' : '',
                            // 백성(전달 지점)은 보라색으로 표시
                            isDelivery ? 'bg-violet-200/80 border-ink/30' : '',
                            // 전달 완료 후에는 더 초록으로
                            deliveryDone ? 'bg-emerald-200/80' : '',
                            // 3곳 전달 완료 후 탈출구를 유도
                            isGoal && deliveredSet.size >= DELIVERY_SPOTS.length ? 'ring-2 ring-emerald-500/80 animate-pulse' : '',
                            // 은신처는 청록색으로 표시
                            isHide ? 'bg-teal-200/80 border-ink/25' : '',
                          ].join(' ')}
                        >
                          {/* 붉은 시야 오버레이 */}
                          {isDanger && !isHide && (
                            <div className="absolute inset-0 bg-red-600/50 ring-2 ring-red-500/90 animate-pulse" />
                          )}

                          {/* 은신처 위에서는 시야가 와도 안전함을 표시 */}
                          {isDanger && isHide && <div className="absolute inset-0 ring-2 ring-teal-500/90" />}

                          {isRice ? (
                            <div className="absolute inset-0 grid place-items-center opacity-80">
                              <RiceBagIcon />
                            </div>
                          ) : null}

                          {isDelivery ? (
                            <div className="absolute inset-0 grid place-items-center opacity-90">
                              <CitizenIcon done={deliveryDone} />
                            </div>
                          ) : null}

                          {isHide ? (
                            <div className="absolute inset-0 grid place-items-center opacity-90">
                              <HideIcon />
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
                              <div className="w-8 h-8 rounded-full bg-white/85 border-2 border-ink/50 shadow-md grid place-items-center">
                                <img src={GUSEO_ASSETS.activist} alt="독립운동가" className="w-7 h-7 object-contain" draggable={false} />
                              </div>
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
            </div>

            {/* 우측 UI */}
            <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-2">
              <div className="text-sm font-black">이동</div>
              <div className="text-[11px] opacity-80 leading-relaxed">
                서이면사무소에서 쌀 {RICE_SOURCE_TILES.length}개를 챙겨서 <br />
                마을 {DELIVERY_SPOTS.length}곳의 백성에게 전달한 뒤 탈출구로 가요!
              </div>
              <div className="rounded-2xl border border-ink/20 bg-paper2/90 shadow-md px-3 py-2 text-[11px] font-black">
                들고있는 쌀: <span className={carryingRice ? 'text-amber-700' : 'text-stamp'}>{carryingRice ? '1개' : '0개'}</span>
                <span className="mx-2 opacity-60">|</span>
                전달:{' '}
                <span className={deliveredSet.size >= DELIVERY_SPOTS.length ? 'text-olive' : 'text-stamp'}>
                  {deliveredSet.size}/{DELIVERY_SPOTS.length}
                </span>
              </div>

              {/* 십자키 */}
              <div className="mt-2 grid place-items-center">
                {/* 모바일에서 아래 버튼이 잘리는 문제 방지: ↓를 가운데로 올려 2줄로 배치 */}
                <div className="grid grid-cols-3 grid-rows-2 gap-3">
                  <div />
                  <button
                    type="button"
                    className="note-btn w-14 h-14 text-2xl rounded-2xl"
                    onClick={() => tryMove('U')}
                    disabled={movingLocked}
                  >
                    ↑
                  </button>
                  <div />
                  <button
                    type="button"
                    className="note-btn w-14 h-14 text-2xl rounded-2xl"
                    onClick={() => tryMove('L')}
                    disabled={movingLocked}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="note-btn w-14 h-14 text-2xl rounded-2xl"
                    onClick={() => tryMove('D')}
                    disabled={movingLocked}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="note-btn w-14 h-14 text-2xl rounded-2xl"
                    onClick={() => tryMove('R')}
                    disabled={movingLocked}
                  >
                    →
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="mt-2 w-full note-btn-primary"
                onClick={waitTurn}
                disabled={movingLocked}
              >
                대기(턴 넘기기)
              </button>

              <div className="mt-auto text-[11px] opacity-80">
                키보드: 방향키 / WASD · 대기: Space
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
