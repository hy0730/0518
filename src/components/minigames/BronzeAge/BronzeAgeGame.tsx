import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';

type IngredientId = 'clay' | 'fire' | 'stone' | 'wood' | 'straw' | 'copper' | 'tin' | 'rope';
type RelicId = 'pottery' | 'sickle' | 'mirror' | 'arrow' | 'hut';

type IngredientDef = {
  id: IngredientId;
  name: string;
  img: string;
  initial: number;
};

type RelicDef = {
  id: RelicId;
  name: string;
  img: string;
  recipe: IngredientId[]; // 2~3개
};

const INGREDIENTS: IngredientDef[] = [
  { id: 'clay', name: '흙', img: '/assets/images/items/item_clay.png', initial: 1 },
  { id: 'fire', name: '불', img: '/assets/images/items/item_fire.png', initial: 2 },
  { id: 'stone', name: '돌', img: '/assets/images/items/item_stone.png', initial: 3 },
  { id: 'wood', name: '나무', img: '/assets/images/items/item_wood.png', initial: 2 },
  { id: 'straw', name: '짚', img: '/assets/images/items/item_straw.png', initial: 1 },
  { id: 'rope', name: '밧줄', img: '/assets/images/items/item_rope.png', initial: 2 },
  { id: 'copper', name: '구리', img: '/assets/images/items/item_copper.png', initial: 1 },
  { id: 'tin', name: '주석', img: '/assets/images/items/item_tin.png', initial: 1 },
];

const RELICS: RelicDef[] = [
  { id: 'pottery', name: '민무늬 토기', img: '/assets/images/items/item_pottery.png', recipe: ['clay', 'fire'] },
  { id: 'sickle', name: '반달 돌칼', img: '/assets/images/items/item_knife.png', recipe: ['stone', 'stone'] },
  { id: 'mirror', name: '청동 거울', img: '/assets/images/items/item_mirror.png', recipe: ['copper', 'tin', 'fire'] },
  { id: 'arrow', name: '돌화살', img: '/assets/images/items/item_arrow.png', recipe: ['stone', 'wood', 'rope'] },
  { id: 'hut', name: '움집', img: '/assets/images/items/item_house.png', recipe: ['rope', 'wood', 'straw'] },
];

function normalizeRecipe(ids: IngredientId[]) {
  return ids.slice().sort().join('+');
}

const RECIPE_TO_RELIC: Record<string, RelicId> = Object.fromEntries(
  RELICS.map((r) => [normalizeRecipe(r.recipe), r.id])
) as Record<string, RelicId>;

export default function BronzeAgeGame({ stageId, onComplete, regionData }: MinigameProps) {
  const [counts, setCounts] = useState<Record<IngredientId, number>>(() => {
    const base: any = {};
    for (const ing of INGREDIENTS) base[ing.id] = ing.initial;
    return base;
  });
  const [hearth, setHearth] = useState<IngredientId[]>([]);
  const [collected, setCollected] = useState<RelicId[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [isOver, setIsOver] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<'success' | 'fail' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const flashTimer = useRef<number | null>(null);

  const totalRelics = RELICS.length;
  const title = useMemo(() => regionData?.map?.nodes?.[stageId - 1]?.title ?? '유물 조합', [regionData, stageId]);

  const setFlashSafe = (next: 'success' | 'fail' | null, msg?: string) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setFlash(next);
    if (typeof msg === 'string') setMessage(msg);
    flashTimer.current = window.setTimeout(() => {
      setFlash(null);
      setMessage(null);
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const canDrop = hearth.length < 3;
  const canCombine = hearth.length >= 2; // 최소 2개부터 조합 가능

  const takeFromInventory = (id: IngredientId) => {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  };
  const returnToInventory = (id: IngredientId) => {
    setCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const removeFromHearth = (index: number) => {
    setHearth((prev) => {
      const next = prev.slice();
      const [removed] = next.splice(index, 1);
      if (removed) returnToInventory(removed);
      return next;
    });
  };

  const clearHearth = (returnItems: boolean) => {
    setHearth((prev) => {
      if (returnItems) prev.forEach((id) => returnToInventory(id));
      return [];
    });
  };

  const handleDropIngredient = (id: IngredientId) => {
    if (!canDrop) {
      setFlashSafe('fail', '화덕에는 최대 3개까지만 넣을 수 있어요!');
      return;
    }
    if ((counts[id] ?? 0) <= 0) return;

    if (!startedAt) setStartedAt(Date.now());
    takeFromInventory(id);
    setHearth((prev) => [...prev, id]);
  };

  const combine = () => {
    if (!canCombine) return;

    const now = Date.now();
    const started = startedAt ?? now;
    if (!startedAt) setStartedAt(started);

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const key = normalizeRecipe(hearth);
    const relicId = RECIPE_TO_RELIC[key];

    if (!relicId) {
      // 오답: 재료 되돌리고 흔들기
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      setFlashSafe('fail', '펑! 조합에 실패했어… 다시 해보자!');
      clearHearth(true);
      return;
    }

    if (collected.includes(relicId)) {
      setFlashSafe('fail', '이미 완성한 유물이에요! 다른 조합을 해보자.');
      clearHearth(true);
      return;
    }

    // 정답: 유물 획득 (재료는 소비)
    const nextCollected = [...collected, relicId];
    setCollected(nextCollected);
    setFlashSafe('success', '성공! 유물이 도감에 추가됐어!');
    setHearth([]);

    if (nextCollected.length >= totalRelics) {
      const clearTime = Math.max(0, Math.round(((now - started) / 1000) * 10) / 10);
      window.setTimeout(() => onComplete({ attempts: nextAttempts, clearTime }), 900);
    }
  };

  return (
    <div className="w-full h-full p-3 text-white">
      {/* 커스텀 애니메이션(무거운 라이브러리 없이) */}
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
          100% { transform: translateX(0); }
        }
        .shake { animation: shake 420ms ease-in-out; }
        @keyframes pop {
          0% { transform: scale(0.98); opacity: 0.0; }
          30% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pop { animation: pop 220ms ease-out; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">
          스테이지 {stageId} · {title}
        </div>
        <div className="text-xs font-bold opacity-90">
          도감 {collected.length}/{totalRelics} · 시도 {attempts}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-12 gap-3 h-[calc(100%-32px)]">
        {/* 재료 */}
        <div className="col-span-4 rounded-2xl border border-white/10 bg-black/40 p-3">
          <div className="text-sm font-extrabold mb-2">재료</div>
          <div className="grid grid-cols-2 gap-2">
            {INGREDIENTS.map((ing) => {
              const left = counts[ing.id] ?? 0;
              const disabled = left <= 0;
              return (
                <div
                  key={ing.id}
                  draggable={!disabled}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', ing.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className={[
                    'select-none rounded-xl border p-2',
                    'bg-white/5 border-white/10',
                    disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-white/10',
                  ].join(' ')}
                  title={disabled ? '재료가 부족해요' : '드래그해서 화덕에 넣기'}
                >
                  <div className="flex items-center gap-2">
                    <img src={ing.img} alt={ing.name} className="w-10 h-10 object-contain" />
                    <div className="min-w-0">
                      <div className="text-xs font-black">{ing.name}</div>
                      <div className="text-[11px] opacity-80">남은 수량: {left}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-[11px] opacity-80 leading-relaxed">
            팁: 화덕에는 <b>최대 3개</b>까지 넣을 수 있어요. 넣은 재료는 클릭하면 다시 뺄 수 있어요.
          </div>
        </div>

        {/* 화덕(드롭존) */}
        <div className="col-span-4 rounded-2xl border border-white/10 bg-black/40 p-3 relative">
          <div className="text-sm font-extrabold mb-2">화덕</div>

          <div
            className={[
              'relative rounded-2xl border-2 border-dashed p-3 h-[55%] flex flex-col justify-between',
              isOver && canDrop ? 'border-amber-400 bg-amber-400/10' : 'border-white/20 bg-white/5',
              shake ? 'shake' : '',
            ].join(' ')}
            onDragOver={(e) => {
              e.preventDefault();
              setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsOver(false);
              const raw = e.dataTransfer.getData('text/plain') as IngredientId;
              if (!raw) return;
              handleDropIngredient(raw);
            }}
          >
            <div className="text-xs font-bold opacity-80">
              재료 슬롯 ({hearth.length}/3)
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => {
                const id = hearth[i];
                if (!id) {
                  return (
                    <div key={i} className="rounded-xl border border-white/10 bg-black/30 h-16 grid place-items-center text-xs opacity-60">
                      비어있음
                    </div>
                  );
                }
                const def = INGREDIENTS.find((x) => x.id === id)!;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => removeFromHearth(i)}
                    className="rounded-xl border border-white/10 bg-white/5 h-16 flex items-center justify-center hover:bg-white/10"
                    title="클릭해서 빼기"
                  >
                    <img src={def.img} alt={def.name} className="w-12 h-12 object-contain" />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 mt-3">
              <button
                type="button"
                onClick={() => clearHearth(true)}
                className="px-3 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-black"
              >
                비우기
              </button>
              <button
                type="button"
                disabled={!canCombine}
                onClick={combine}
                className={[
                  'px-3 py-2 rounded-xl text-xs font-black',
                  canCombine ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white/10 text-white/40 cursor-not-allowed',
                ].join(' ')}
              >
                조합하기
              </button>
            </div>

            {flash && (
              <div
                className={[
                  'absolute inset-0 rounded-2xl grid place-items-center text-center p-4 pointer-events-none',
                  flash === 'success' ? 'bg-emerald-500/20' : 'bg-rose-500/20',
                  'pop',
                ].join(' ')}
              >
                <div>
                  <div className="text-lg font-black">{flash === 'success' ? '성공!' : '실패!'}</div>
                  {message && <div className="mt-1 text-xs font-bold opacity-90">{message}</div>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-[11px] opacity-85">
            정답 레시피는 <b>2~3개 조합</b>이에요. 재료를 넣고 <b>조합하기</b>를 눌러보자!
          </div>
        </div>

        {/* 내 유물 도감 */}
        <div className="col-span-4 rounded-2xl border border-white/10 bg-black/40 p-3">
          <div className="text-sm font-extrabold mb-2">내 유물 도감</div>
          <div className="grid grid-cols-2 gap-2">
            {RELICS.map((r) => {
              const got = collected.includes(r.id);
              return (
                <div
                  key={r.id}
                  className={[
                    'rounded-xl border p-2',
                    got ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/5 opacity-70',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={r.img}
                      alt={r.name}
                      className={['w-10 h-10 object-contain', got ? '' : 'grayscale opacity-60'].join(' ')}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-black">{got ? r.name : '???'}</div>
                      <div className="text-[11px] opacity-80">{got ? '완성!' : '미완성'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2">
            <div className="text-[11px] font-black opacity-90 mb-1">레시피 힌트</div>
            <ul className="text-[11px] opacity-85 leading-relaxed list-disc pl-4">
              <li>흙 + 불 = 민무늬 토기</li>
              <li>돌 + 돌 = 반달 돌칼</li>
              <li>구리 + 주석 + 불 = 청동 거울</li>
              <li>돌 + 나무 + 밧줄 = 돌화살</li>
              <li>밧줄 + 나무 + 짚 = 움집</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
