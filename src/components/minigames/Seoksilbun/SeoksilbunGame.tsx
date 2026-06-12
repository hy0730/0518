import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import { useToast } from '../common/useToast';
import { useGameTuning } from '../../common/GameTuningContext';

type Phase = 'INTRO' | 'TUTORIAL' | 'MAIN' | 'QUIZ';

type IntroStep = 1 | 2 | 3;

type PlacedItem = {
  id: string;
  name: string;
  img: string;
  xPct: number; // 0~100
  yPct: number; // 0~100
};

type ArtifactDef = {
  id: string;
  name: string;
  img: string;
  desc: string;
};

const ASSETS = {
  tombTop: '/assets/images/relic_seoksu_top.png',
  tomb1: '/assets/images/relic_seoksu_tomb_1.png',
  tomb2: '/assets/images/relic_seoksu_tomb_2.png',
  muddoll: '/assets/images/items/item_seoksu_muddoll.png', // 요청의 muddool.png에 대응(실제 파일명)
};

const ARTIFACTS: ArtifactDef[] = [
  {
    id: 'sword',
    name: '철검',
    img: '/assets/images/items/item_seoksu_sword.png',
    desc: '철로 만든 칼이에요. 무덤 주인의 신분이나 무장(전사/경호)과 관련이 있을 수 있어요.',
  },
  {
    id: 'jar',
    name: '토기 항아리',
    img: '/assets/images/items/item_seoksu_jar.png',
    desc: '음식이나 물을 담던 그릇이에요. 사후 세계에서도 생활이 이어진다고 믿었을 수 있어요.',
  },
  {
    id: 'dish',
    name: '토기 접시',
    img: '/assets/images/items/item_seoksu_dish.png',
    desc: '음식을 올리거나 제사/의례에 사용되었을 수 있는 그릇이에요.',
  },
  {
    id: 'jade',
    name: '구슬(옥)',
    img: '/assets/images/items/item_seoksu_jade.png',
    desc: '반짝이는 구슬은 장식품이자 지위의 상징일 수 있어요.',
  },
  {
    id: 'armor',
    name: '갑옷',
    img: '/assets/images/items/item_seoksu_armor.png',
    desc: '몸을 보호하는 장비예요. 무덤 주인이 전사/귀족 계층과 관련이 있을 수 있어요.',
  },
];

const WORD_CARDS = ['고구려', '백제', '신라', '농부', '상인', '귀족'] as const;
type WordCard = (typeof WORD_CARDS)[number];

const NATION_CARDS = new Set<WordCard>(['고구려', '백제', '신라']);
const CLASS_CARDS = new Set<WordCard>(['농부', '상인', '귀족']);

function wordType(w: WordCard) {
  return NATION_CARDS.has(w) ? 'NATION' : 'CLASS';
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function getRelativePct(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  const x = clamp01((clientX - rect.left) / rect.width);
  const y = clamp01((clientY - rect.top) / rect.height);
  return { xPct: x * 100, yPct: y * 100 };
}

export default function SeoksilbunGame({ stageId, onComplete }: MinigameProps) {
  const stageTitle = useMemo(() => storyDataByStageId[stageId]?.title ?? '석수동 석실분', [stageId]);
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);
  const mainImg = useMemo(() => getRelicMainImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('INTRO');
  const [introStep, setIntroStep] = useState<IntroStep>(1);

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // tutorial
  const [muddollPlaced, setMuddollPlaced] = useState(false);
  const [muddollPos, setMuddollPos] = useState<{ xPct: number; yPct: number } | null>(null);

  // main
  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [placedIds, setPlacedIds] = useState<Record<string, boolean>>({});
  const [artifactModal, setArtifactModal] = useState<{ artifact: ArtifactDef; mode: 'ADD' | 'REMOVE' } | null>(null);

  // quiz
  const [blank1, setBlank1] = useState<WordCard | null>(null);
  const [blank2, setBlank2] = useState<WordCard | null>(null);
  const [resultModal, setResultModal] = useState(false);

  // drag (pointer 기반: 모바일에서도 안정)
  const boardRef = useRef<HTMLDivElement | null>(null);
  const tombRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{
    kind: 'muddoll' | 'artifact' | 'placed' | 'word';
    id: string;
    label: string;
    img?: string;
    startX: number;
    startY: number;
    offsetX: number; // 커서(포인터)와 오브젝트 중심의 차이
    offsetY: number;
    moved: boolean;
    x: number;
    y: number;
  } | null>(null);

  const [dragHint, setDragHint] = useState<string | null>(null);

  // 피드백(툭 튕기기/잘못된 드롭 등)
  const { toast, showToast } = useToast(900);
  const [shakeSlot, setShakeSlot] = useState<1 | 2 | null>(null);
  const dragThreshold = 3; // 모바일 드래그 인식 개선(너무 높으면 클릭으로 오인)
  const tuning = useGameTuning();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const ui = useMemo(() => {
    const get = (k: string, fallback: number) => tuning?.getNumber(k, fallback) ?? fallback;
    return {
      headerX: get('headerX', 0),
      headerY: get('headerY', 0),
      boardX: get('boardX', 0),
      boardY: get('boardY', 0),
      boardScale: get('boardScale', 1),
      leftInvX: get('leftInvX', 0),
      leftInvY: get('leftInvY', 0),
      rightInvX: get('rightInvX', 0),
      rightInvY: get('rightInvY', 0),
      actionY: get('actionY', 0),
    };
  }, [tuning]);
  const layoutDragRef = useRef<null | {
    target: 'header' | 'board' | 'leftInv' | 'rightInv' | 'action';
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
      if (drag.target === 'header') {
        tuning.setNumber('headerX', drag.baseX + dx);
        tuning.setNumber('headerY', drag.baseY + dy);
      } else if (drag.target === 'board') {
        tuning.setNumber('boardX', drag.baseX + dx);
        tuning.setNumber('boardY', drag.baseY + dy);
      } else if (drag.target === 'leftInv') {
        tuning.setNumber('leftInvX', drag.baseX + dx);
        tuning.setNumber('leftInvY', drag.baseY + dy);
      } else if (drag.target === 'rightInv') {
        tuning.setNumber('rightInvX', drag.baseX + dx);
        tuning.setNumber('rightInvY', drag.baseY + dy);
      } else {
        tuning.setNumber('actionY', drag.baseY + dy);
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

  const bg = useMemo(() => {
    if (phase === 'INTRO') {
      if (introStep === 1) return ASSETS.tombTop;
      if (introStep === 2) return ASSETS.tomb1;
      return ASSETS.tomb2;
    }
    return ASSETS.tomb2;
  }, [phase, introStep]);

  // 배경 페이드 전환(phase1 사진 전환이 훅훅 바뀌지 않게)
  const [bgA, setBgA] = useState(bg);
  const [bgB, setBgB] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (bg === bgA) return;
    setBgB(bg);
    // 다음 tick에서 opacity transition 시작
    const t1 = window.setTimeout(() => setFadeIn(true), 10);
    const t2 = window.setTimeout(() => {
      setBgA(bg);
      setBgB(null);
      setFadeIn(false);
    }, 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [bg, bgA]);

  const introText = useMemo(() => {
    if (introStep === 1) {
      return '석수동 관악산 기슭에 오래된 무덤이 하나 있습니다. 덮개돌을 열어볼까요?';
    }
    if (introStep === 2) {
      return '우와! 돌방무덤이네요. 이 근처에서는 신라 시대의 마을 터(취락)도 발견되었답니다.';
    }
    return '본격적인 내부 탐사를 시작해봅시다. (아무 곳이나 눌러 진행)';
  }, [introStep]);

  const showIntroOverlay = phase === 'INTRO';
  const showTutorialOverlay = phase === 'TUTORIAL';

  const canGoQuiz = placed.length >= 3;
  const canSubmit = !!blank1 && !!blank2;
  const inventorySplitIndex = Math.ceil(ARTIFACTS.length / 2);
  const leftArtifacts = ARTIFACTS.slice(0, inventorySplitIndex);
  const rightArtifacts = ARTIFACTS.slice(inventorySplitIndex);

  const openArtifact = (a: ArtifactDef) => {
    setArtifactModal({ artifact: a, mode: 'ADD' });
  };

  const openPlacedArtifact = (id: string) => {
    const a = ARTIFACTS.find((x) => x.id === id);
    if (!a) return;
    setArtifactModal({ artifact: a, mode: 'REMOVE' });
  };

  const removePlaced = (id: string) => {
    setPlaced((prev) => prev.filter((p) => p.id !== id));
    setPlacedIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addPlaced = (def: { id: string; name: string; img: string }, xPct: number, yPct: number) => {
    if (placedIds[def.id]) return;
    setPlaced((prev) => [...prev, { id: def.id, name: def.name, img: def.img, xPct, yPct }]);
    setPlacedIds((prev) => ({ ...prev, [def.id]: true }));
  };

  const addPlacedCenter = (def: { id: string; name: string; img: string }) => {
    // 중앙 근처에 순서대로 살짝 흩뿌리기
    const offsets = [
      { x: 48, y: 58 },
      { x: 55, y: 52 },
      { x: 43, y: 52 },
      { x: 58, y: 60 },
      { x: 40, y: 60 },
    ];
    const p = offsets[Math.min(placed.length, offsets.length - 1)];
    addPlaced(def, p.x, p.y);
  };

  const advanceIntro = () => {
    if (phase !== 'INTRO') return;
    startIfNeeded();
    if (introStep === 1) {
      setIntroStep(2);
      return;
    }
    if (introStep === 2) {
      setIntroStep(3);
      // Step3부터는 곧바로 튜토리얼로
      setPhase('TUTORIAL');
      return;
    }
  };

  const startDrag = (e: React.PointerEvent, payload: typeof drag extends any ? any : never) => {
    startIfNeeded();
    if (artifactModal || resultModal) return;
    e.preventDefault();
    e.stopPropagation();
    // pointer 캡처로 드래그 안정화
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    setDrag({
      ...payload,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - centerX,
      offsetY: e.clientY - centerY,
      moved: false,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const getTombRect = () => {
    const tomb = tombRef.current;
    if (!tomb) return null;
    const rect = tomb.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    };
  };

  const getTombPct = (clientX: number, clientY: number) => {
    const tr = getTombRect();
    if (!tr) return null;
    const x = clamp01((clientX - tr.left) / tr.width);
    const y = clamp01((clientY - tr.top) / tr.height);
    return { xPct: x * 100, yPct: y * 100 };
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

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const board = boardRef.current;
    const ended = drag;
    setDrag(null);

    // moved=false면 클릭으로 처리(모바일 대체)
    if (!ended.moved) {
      if (ended.kind === 'artifact') {
        const a = ARTIFACTS.find((x) => x.id === ended.id);
        if (a) openArtifact(a);
      } else if (ended.kind === 'placed') {
        // 배치된 부장품: 클릭 시 설명(그리고 다시 꺼내기)
        openPlacedArtifact(ended.id);
      } else if (ended.kind === 'word') {
        const w = ended.label as WordCard;
        if (!blank1) {
          if (wordType(w) !== 'NATION') {
            showToast('첫 번째 빈칸에는 나라 카드만 넣을 수 있어요!');
            setShakeSlot(1);
            window.setTimeout(() => setShakeSlot(null), 420);
          } else {
            setBlank1(w);
          }
        } else if (!blank2) {
          if (wordType(w) !== 'CLASS') {
            showToast('두 번째 빈칸에는 계급 카드만 넣을 수 있어요!');
            setShakeSlot(2);
            window.setTimeout(() => setShakeSlot(null), 420);
          } else {
            setBlank2(w);
          }
        } else {
          showToast('이미 빈칸이 모두 채워졌어요. (클릭해서 비울 수 있어요)');
        }
      } else if (ended.kind === 'muddoll') {
        // 튜토리얼: 클릭 시 중앙 배치
        setMuddollPlaced(true);
        setMuddollPos({ xPct: 50, yPct: 58 });
        setDragHint('좋아요! 이제 부장품을 조사해볼까요?');
      }
      return;
    }

    if (!board) return;
    // pointer capture 상태에서도 "실제 포인터 아래 요소"를 얻기 위해 elementFromPoint 사용
    const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;

    // 오브젝트의 "중심"이 놓일 좌표(드래그 시작 시 잡은 위치 보정)
    const dropX = e.clientX - (ended.offsetX ?? 0);
    const dropY = e.clientY - (ended.offsetY ?? 0);

    const rect = board.getBoundingClientRect();
    const insideBoard = dropX >= rect.left && dropX <= rect.right && dropY >= rect.top && dropY <= rect.bottom;
    const tombRect = getTombRect();
    const insideTomb =
      !!tombRect &&
      dropX >= tombRect.left &&
      dropX <= tombRect.right &&
      dropY >= tombRect.top &&
      dropY <= tombRect.bottom;

    if (ended.kind === 'muddoll') {
      if (!insideTomb) return;
      const pos = getTombPct(dropX, dropY);
      if (!pos) return;
      setMuddollPlaced(true);
      setMuddollPos(pos);
      setDragHint('좋아요! 이제 부장품을 조사해볼까요?');
      return;
    }

    if (ended.kind === 'artifact') {
      if (phase !== 'MAIN') return;
      if (!insideTomb) return;
      const a = ARTIFACTS.find((x) => x.id === ended.id);
      if (!a) return;
      if (placedIds[a.id]) return;
      const pos = getTombPct(dropX, dropY);
      if (!pos) return;
      addPlaced(a, pos.xPct, pos.yPct);
      return;
    }

    if (ended.kind === 'placed') {
      if (phase !== 'MAIN') return;
      const droppedOnInventory = !!elUnder?.closest?.('[data-inventory="true"]');

      // 회수 조건: 보드 밖 / 인벤토리 영역 / 회수함
      // (UX) “원래 있던 곳으로 되돌리기”가 직관적이므로 별도 회수함 UI는 제거.
      // 회수는 보드 밖 또는 좌/우 인벤토리 위로 드롭했을 때만 동작.
      if (!insideBoard || droppedOnInventory || !insideTomb) {
        removePlaced(ended.id);
        return;
      }

      const pos = getTombPct(dropX, dropY);
      if (!pos) return;
      setPlaced((prev) => prev.map((p) => (p.id === ended.id ? { ...p, xPct: pos.xPct, yPct: pos.yPct } : p)));
      return;
    }

    if (ended.kind === 'word') {
      if (phase !== 'QUIZ') return;
      // 드롭: 빈칸 위에 놓았는지 판단
      const slot = elUnder?.closest?.('[data-slot]')?.getAttribute('data-slot');
      const w = ended.label as WordCard;
      if (slot === '1') {
        if (wordType(w) !== 'NATION') {
          showToast('첫 번째 빈칸에는 나라 카드만!');
          setShakeSlot(1);
          window.setTimeout(() => setShakeSlot(null), 420);
          return;
        }
        setBlank1(w);
      } else if (slot === '2') {
        if (wordType(w) !== 'CLASS') {
          showToast('두 번째 빈칸에는 계급 카드만!');
          setShakeSlot(2);
          window.setTimeout(() => setShakeSlot(null), 420);
          return;
        }
        setBlank2(w);
      } else {
        // 빈칸이 아닌 곳에 떨어뜨린 경우는 무시
      }
    }
  };

  const interactiveGuard = (target: EventTarget | null) => {
    const t = target as HTMLElement | null;
    return !!t?.closest?.('button, a, input, textarea, select, [role="button"], [data-interactive="true"]');
  };

  return (
    <div ref={rootRef} className="w-full h-full relative text-ink select-none">
      <style>{`
        @keyframes slotShake {
          0% { transform: translateY(0); }
          20% { transform: translateY(-2px); }
          40% { transform: translateY(2px); }
          60% { transform: translateY(-2px); }
          80% { transform: translateY(2px); }
          100% { transform: translateY(0); }
        }
        .slotShake { animation: slotShake 420ms ease-in-out; }
      `}</style>

      {/* 배경 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(244,235,217,0.06), rgba(244,235,217,0.18)), url('${bgA}')` }}
      />
      {bgB && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `linear-gradient(rgba(244,235,217,0.06), rgba(244,235,217,0.18)), url('${bgB}')` }}
        />
      )}

      {/* 상단 바 */}
      <div
        className={[
          'absolute left-0 right-0 top-0 z-10 px-3 py-2 flex items-center justify-between',
          tuning?.innerTunerOpen && !tuning.locked ? 'cursor-move ring-2 ring-sky-300/60 rounded-xl bg-sky-100/10' : '',
        ].join(' ')}
        style={{ transform: `translate(${ui.headerX}px, ${ui.headerY}px)` }}
        onPointerDown={(e) => {
          if (!tuning?.innerTunerOpen || tuning.locked) return;
          e.stopPropagation();
          layoutDragRef.current = { target: 'header', startX: e.clientX, startY: e.clientY, baseX: ui.headerX, baseY: ui.headerY };
        }}
      >
        <div className="text-sm font-black">
          스테이지 {stageId} · {stageTitle}
        </div>
        <div className="text-xs font-bold opacity-80">{phase}</div>
      </div>

      {/* 보드(드롭 영역) */}
      <div
        className="absolute inset-x-0 top-[38px] bottom-[64px] z-10 mx-3"
        style={{ transform: `translate(${ui.boardX}px, ${ui.boardY}px) scale(${ui.boardScale})`, transformOrigin: 'center' }}
      >
      <div
        ref={boardRef}
        className="absolute inset-0 rounded-3xl border border-ink/25 overflow-hidden shadow-paper touch-none"
        onPointerDown={(e) => {
          if (showIntroOverlay && !interactiveGuard(e.target)) {
            advanceIntro();
          }
        }}
      >
        {tuning?.innerTunerOpen && !tuning.locked && (
          <div
            className="absolute inset-0 z-20 rounded-3xl ring-2 ring-sky-300/60 bg-sky-100/10 cursor-move"
            onPointerDown={(e) => {
              e.stopPropagation();
              layoutDragRef.current = { target: 'board', startX: e.clientX, startY: e.clientY, baseX: ui.boardX, baseY: ui.boardY };
            }}
          />
        )}
        {/* 중앙 "무덤" 영역 (좌/우 인벤토리를 제외한 자유 배치 영역)
            주의: Tailwind에서 `relative`/`absolute`를 같이 쓰면 뒤의 class가 position을 덮어써서
            높이/너비가 0이 되어 배치 좌표가 한 곳에 몰릴 수 있음. */}
        <div ref={tombRef} className="absolute left-[156px] right-[156px] top-0 bottom-0">
          {/* 튜토리얼 드롭존(빛나는 영역) */}
          {phase === 'TUTORIAL' && (
            <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[140px] h-[110px] rounded-2xl border-2 border-amber-300/70 bg-amber-300/10 shadow-[0_0_30px_rgba(251,191,36,0.35)] animate-pulse" />
          )}

          {/* 토우 배치 */}
          {(phase === 'TUTORIAL' || phase === 'MAIN' || phase === 'QUIZ') && muddollPlaced && muddollPos && (
            <img
              src={ASSETS.muddoll}
              alt="토우"
              className="absolute w-16 h-16 object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.55)]"
              style={{ left: `${muddollPos.xPct}%`, top: `${muddollPos.yPct}%`, transform: 'translate(-50%, -50%)' }}
              draggable={false}
            />
          )}

          {/* 부장품 배치 결과 */}
          {phase !== 'INTRO' &&
            placed.map((p) => (
              <div
                key={p.id}
                data-interactive="true"
                className="absolute cursor-move touch-none"
                style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, transform: 'translate(-50%, -50%)' }}
                onPointerDown={(e) => {
                  if (phase !== 'MAIN') return;
                  startDrag(e, { kind: 'placed', id: p.id, label: p.name, img: p.img });
                }}
                onPointerMove={updateDrag}
                onPointerUp={endDrag}
                title="드래그해서 위치 수정 / 클릭해서 설명"
              >
                <img
                  src={p.img}
                  alt={p.name}
                  className="w-16 h-16 object-contain drop-shadow-[0_12px_26px_rgba(0,0,0,0.55)]"
                  draggable={false}
                />
              </div>
            ))}
        </div>

        {/* Phase3 좌우 인벤토리 (보드 안에 배치) */}
        {phase === 'MAIN' && (
          <>
            <div className="absolute left-3 top-3 bottom-3 w-[132px] flex flex-col gap-2" data-inventory="true">
              {tuning?.innerTunerOpen && !tuning.locked && (
                <div
                  className="absolute inset-0 z-20 rounded-2xl ring-2 ring-sky-300/60 bg-sky-100/10 cursor-move"
                  style={{ transform: `translate(${ui.leftInvX}px, ${ui.leftInvY}px)` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    layoutDragRef.current = { target: 'leftInv', startX: e.clientX, startY: e.clientY, baseX: ui.leftInvX, baseY: ui.leftInvY };
                  }}
                />
              )}
              <div style={{ transform: `translate(${ui.leftInvX}px, ${ui.leftInvY}px)` }}>
              {leftArtifacts.map((a) => (
                <div
                  key={a.id}
                  data-interactive="true"
                  className={[
                    'rounded-xl border border-ink/25 bg-paper/78 p-2 flex items-center gap-2 shadow-md touch-none min-h-[58px]',
                    placedIds[a.id] ? 'opacity-35' : 'hover:bg-paper/90',
                  ].join(' ')}
                  onPointerDown={(e) => {
                    if (placedIds[a.id]) return;
                    startDrag(e, { kind: 'artifact', id: a.id, label: a.name, img: a.img });
                  }}
                  onPointerMove={updateDrag}
                  onPointerUp={endDrag}
                  title="드래그해서 무덤 안에 놓기 (또는 눌러서 설명 보기)"
                >
                  <img src={a.img} alt="" className="w-9 h-9 object-contain" draggable={false} />
                  <div className="text-[11px] font-black leading-tight">{a.name}</div>
                </div>
              ))}
              </div>
            </div>

            <div className="absolute right-3 top-3 bottom-3 w-[132px] flex flex-col gap-2 justify-start" data-inventory="true">
              {tuning?.innerTunerOpen && !tuning.locked && (
                <div
                  className="absolute inset-0 z-20 rounded-2xl ring-2 ring-sky-300/60 bg-sky-100/10 cursor-move"
                  style={{ transform: `translate(${ui.rightInvX}px, ${ui.rightInvY}px)` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    layoutDragRef.current = { target: 'rightInv', startX: e.clientX, startY: e.clientY, baseX: ui.rightInvX, baseY: ui.rightInvY };
                  }}
                />
              )}
              <div style={{ transform: `translate(${ui.rightInvX}px, ${ui.rightInvY}px)` }}>
              {rightArtifacts.map((a) => (
                <div
                  key={a.id}
                  data-interactive="true"
                  className={[
                    'rounded-xl border border-ink/25 bg-paper/78 p-2 flex items-center gap-2 shadow-md touch-none min-h-[58px]',
                    placedIds[a.id] ? 'opacity-35' : 'hover:bg-paper/90',
                  ].join(' ')}
                  onPointerDown={(e) => {
                    if (placedIds[a.id]) return;
                    startDrag(e, { kind: 'artifact', id: a.id, label: a.name, img: a.img });
                  }}
                  onPointerMove={updateDrag}
                  onPointerUp={endDrag}
                  title="드래그해서 무덤 안에 놓기 (또는 눌러서 설명 보기)"
                >
                  <img src={a.img} alt="" className="w-9 h-9 object-contain" draggable={false} />
                  <div className="text-[11px] font-black leading-tight">{a.name}</div>
                </div>
              ))}
              </div>
            </div>
          </>
        )}

        {/* Phase4 퀴즈 오버레이 */}
        {phase === 'QUIZ' && (
          <div className="absolute left-1/2 top-3 -translate-x-1/2 w-[560px] max-w-[94%]">
            <div className="rounded-3xl border border-ink/25 bg-paper2/90 p-3 shadow-paper">
              <div className="text-sm font-black">이 무덤의 주인은</div>
              <div className="mt-2 text-sm font-black leading-relaxed">
                <span
                  data-slot="1"
                  data-interactive="true"
                  className={`inline-flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-xl border-2 border-dashed border-sky-400/80 bg-sky-100/70 text-sky-900 ${
                    shakeSlot === 1 ? 'slotShake' : ''
                  }`}
                  onClick={() => setBlank1(null)}
                  title="클릭하면 비울 수 있어요"
                >
                  {blank1 ?? '빈칸 1 · 나라'}
                </span>{' '}
                시대의{' '}
                <span
                  data-slot="2"
                  data-interactive="true"
                  className={`inline-flex items-center justify-center min-w-[120px] px-3 py-1.5 rounded-xl border-2 border-dashed border-violet-400/80 bg-violet-100/70 text-violet-900 ${
                    shakeSlot === 2 ? 'slotShake' : ''
                  }`}
                  onClick={() => setBlank2(null)}
                  title="클릭하면 비울 수 있어요"
                >
                  {blank2 ?? '빈칸 2 · 계급'}
                </span>
                (이)었을 것이다.
              </div>
              <div className="mt-2 text-[11px] opacity-80">가운데 카드 더미에서 골라 드래그(또는 클릭)해서 빈칸을 채워보자.</div>

              <div className="mt-3 rounded-2xl border border-ink/15 bg-paper/55 p-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {WORD_CARDS.map((w) => {
                    const isNation = wordType(w) === 'NATION';
                    return (
                      <div
                        key={w}
                        data-interactive="true"
                        className={[
                          'px-3 py-2 rounded-xl border text-[12px] font-black cursor-grab active:cursor-grabbing shadow-md touch-none min-w-[74px] text-center',
                          isNation
                            ? 'border-sky-300/80 bg-sky-50/90 text-sky-900 hover:bg-sky-100'
                            : 'border-violet-300/80 bg-violet-50/90 text-violet-900 hover:bg-violet-100',
                        ].join(' ')}
                        onPointerDown={(e) => startDrag(e, { kind: 'word', id: w, label: w })}
                        onPointerMove={updateDrag}
                        onPointerUp={endDrag}
                        title="드래그 또는 클릭"
                      >
                        {w}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* 하단 액션 바 */}
      <div
        className={[
          'absolute left-0 right-0 bottom-0 z-10 px-3 py-2 flex items-center justify-between gap-2 bg-paper2/95 border-t-2 border-ink/20',
          tuning?.innerTunerOpen && !tuning.locked ? 'cursor-move ring-2 ring-sky-300/60' : '',
        ].join(' ')}
        style={{ transform: `translateY(${ui.actionY}px)` }}
        onPointerDown={(e) => {
          if (!tuning?.innerTunerOpen || tuning.locked) return;
          e.stopPropagation();
          layoutDragRef.current = { target: 'action', startX: e.clientX, startY: e.clientY, baseX: 0, baseY: ui.actionY };
        }}
      >
        <div className="text-[12px] font-bold opacity-95 leading-relaxed">
          {phase === 'INTRO' && introText}
          {phase === 'TUTORIAL' && (dragHint ?? '토우를 무덤 안으로 드래그(또는 클릭)해서 배치해 보세요!')}
          {phase === 'MAIN' && `부장품 5개 중 마음에 드는 것들을 골라 무덤 안에 배치해보세요. (현재 ${placed.length}개 배치, 3개 이상이면 다음 단계)`}
          {phase === 'QUIZ' && '정답은 없어요! 선택한 이유를 친구들(또는 선생님)에게 말해보아요.'}
        </div>

        <div className="flex items-center gap-2">
          {phase === 'TUTORIAL' && (
            <button
              type="button"
              disabled={!muddollPlaced}
              className={[
                'rounded-xl px-3 py-2 text-xs font-black',
                muddollPlaced ? 'bg-olive text-white border border-ink/25 shadow-md hover:opacity-95' : 'bg-paper/50 text-ink/40 cursor-not-allowed border border-ink/20',
              ].join(' ')}
              onClick={() => {
                startIfNeeded();
                setPhase('MAIN');
              }}
            >
              부장품 조사 시작
            </button>
          )}

          {phase === 'MAIN' && (
            <>
              <button
                type="button"
                disabled={!canGoQuiz}
                className={[
                  'rounded-xl px-3 py-2 text-xs font-black',
                canGoQuiz ? 'bg-stamp text-white border border-ink/25 shadow-md hover:opacity-95' : 'bg-paper/50 text-ink/40 cursor-not-allowed border border-ink/20',
                ].join(' ')}
                onClick={() => {
                  startIfNeeded();
                  setPhase('QUIZ');
                }}
              >
                배치 완료! 무덤 주인 추리하기
              </button>
            </>
          )}

          {phase === 'QUIZ' && (
            <>
              <button
                type="button"
                disabled={!canSubmit}
                className={[
                  'rounded-xl px-3 py-2 text-xs font-black',
                  canSubmit ? 'bg-olive text-white border border-ink/25 shadow-md hover:opacity-95' : 'bg-paper/50 text-ink/40 cursor-not-allowed border border-ink/20',
                ].join(' ')}
                onClick={() => {
                  startIfNeeded();
                  setResultModal(true);
                }}
              >
                제출하기
              </button>
            </>
          )}
        </div>
      </div>

      {/* 튜토리얼: 토우 아이템(하단) */}
      {phase === 'TUTORIAL' && (
        <div className="absolute left-1/2 bottom-[54px] -translate-x-1/2 z-20">
          <div
            data-interactive="true"
            className="rounded-3xl border border-ink/25 bg-paper2/90 p-2 flex items-center gap-2 hover:bg-paper/90 cursor-grab active:cursor-grabbing shadow-paper touch-none"
            onPointerDown={(e) => startDrag(e, { kind: 'muddoll', id: 'muddoll', label: '토우', img: ASSETS.muddoll })}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
            title="드래그 또는 클릭"
          >
            <img src={ASSETS.muddoll} alt="토우" className="w-10 h-10 object-contain" draggable={false} />
            <div className="text-xs font-black">토우</div>
          </div>
        </div>
      )}

      {/* 부장품 설명 모달 */}
      {artifactModal && (
        <div className="absolute inset-0 z-30 bg-ink/35 grid place-items-center p-4" data-interactive="true">
          <div className="w-full max-w-[520px] rounded-3xl border-2 border-ink/35 bg-paper2 p-4 shadow-paper">
            <div className="flex items-start gap-3">
              <img
                src={artifactModal.artifact.img}
                alt=""
                className="w-16 h-16 object-contain rounded-xl bg-paper/60 border border-ink/20"
              />
              <div className="min-w-0">
                <div className="text-sm font-black">{artifactModal.artifact.name}</div>
                <div className="mt-2 text-xs opacity-85 leading-relaxed">{artifactModal.artifact.desc}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-xs font-black bg-paper/70 border border-ink/25 shadow-md hover:bg-paper/90"
                onClick={() => setArtifactModal(null)}
              >
                닫기
              </button>
              {artifactModal.mode === 'ADD' ? (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-xs font-black bg-stamp text-white border border-ink/25 shadow-md hover:opacity-95"
                  onClick={() => {
                    startIfNeeded();
                    addPlacedCenter(artifactModal.artifact);
                    setArtifactModal(null);
                  }}
                >
                  무덤에 넣기
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-xs font-black bg-olive text-white border border-ink/25 shadow-md hover:opacity-95"
                  onClick={() => {
                    startIfNeeded();
                    removePlaced(artifactModal.artifact.id);
                    setArtifactModal(null);
                  }}
                >
                  다시 꺼내기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결과 모달 */}
      {resultModal && (
        <div className="fixed inset-0 z-[99999] bg-ink/35 p-0" data-interactive="true">
          <div className="w-full h-full bg-paper2 text-ink shadow-paper flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <img
                src={realImg}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (mainImg && img.src !== mainImg) img.src = mainImg;
                }}
              />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/70">
              <div className="text-lg font-black">아주 좋아요!</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                자신의 생각을 아주 잘 담았어요! 왜 그렇게 생각했는지 친구들(또는 선생님)에게 자유롭게 발표해 보세요!
              </div>
              <div className="mt-2 text-sm font-black">
                내 문장: <span className="text-amber-300">{blank1 ?? '___'}</span> 시대의{' '}
                <span className="text-amber-300">{blank2 ?? '___'}</span>
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-olive text-white border border-ink/25 font-black py-3 shadow-md hover:opacity-95"
                onClick={() => {
                  const now = Date.now();
                  const started = startedAt ?? now;
                  const clearTime = Math.max(0, Math.round(((now - started) / 1000) * 10) / 10);
                  onComplete({ attempts: 1, clearTime });
                }}
              >
                지도로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 드래그 고스트 */}
      {drag && (
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{
            left: drag.x - (drag.offsetX ?? 0),
            top: drag.y - (drag.offsetY ?? 0),
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">
            {drag.img ? <img src={drag.img} alt="" className="w-10 h-10 object-contain mx-auto mb-1" /> : null}
            {drag.label}
          </div>
        </div>
      )}

      {/* 토스트(잘못된 드롭 등) */}
      {toast && (
        <div className="absolute left-1/2 bottom-[74px] -translate-x-1/2 z-50 pointer-events-none">
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
        </div>
      )}
    </div>
  );
}
