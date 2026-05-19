import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { audio } from '../../../utils/audio';

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

const RELIC_DESC: Record<RelicId, string> = {
  pottery: '무늬가 없는 청동기 시대의 대표적인 토기로, 곡식을 보관하거나 요리할 때 사용했어요.',
  sickle:
    '곡식의 이삭을 자를 때 사용하던 청동기 시대의 농기구예요. 가운뎃구멍에 끈을 꿰어 손에 걸고 사용했답니다.',
  mirror: '청동기 시대 지배층(족장)이 사용하던 귀중한 물건으로, 햇빛을 반사시켜 권력을 상징했어요.',
  arrow: '돌촉을 끼워 만든 화살이에요. 사냥이나 전투에 사용되며, 당시 생활과 기술을 보여줘요.',
  hut: '땅을 파서 바닥을 낮추고 나무 기둥과 짚 지붕으로 만든 집이에요. 바람을 막고 따뜻하게 지냈답니다.',
};

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
  const [workbench, setWorkbench] = useState<IngredientId[]>([]);
  const [collected, setCollected] = useState<RelicId[]>([]);
  const [relicModal, setRelicModal] = useState<RelicId | null>(null);
  const [resultModal, setResultModal] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [isOver, setIsOver] = useState(false);
  const [shake, setShake] = useState(false);
  const [smoke, setSmoke] = useState(false);
  const [flash, setFlash] = useState<'success' | 'fail' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sparkle, setSparkle] = useState(false);

  const flashTimer = useRef<number | null>(null);

  // MVP: 3개 유물만 모으면 클리어(기획 반영)
  const targetRelics = 3;
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

  const canDrop = workbench.length < 3;
  const canCombine = workbench.length >= 2; // 최소 2개부터 조합 가능

  const takeFromInventory = (id: IngredientId) => {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  };
  const returnToInventory = (id: IngredientId) => {
    setCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  };

  const removeFromWorkbench = (index: number) => {
    setWorkbench((prev) => {
      const next = prev.slice();
      const [removed] = next.splice(index, 1);
      if (removed) returnToInventory(removed);
      return next;
    });
  };

  const clearWorkbench = (returnItems: boolean) => {
    setWorkbench((prev) => {
      if (returnItems) prev.forEach((id) => returnToInventory(id));
      return [];
    });
  };

  const handleDropIngredient = (id: IngredientId) => {
    if (relicModal || resultModal) return;
    if (!canDrop) {
      setFlashSafe('fail', '작업대에는 최대 3개까지만 넣을 수 있어요!');
      return;
    }
    if ((counts[id] ?? 0) <= 0) return;

    if (!startedAt) setStartedAt(Date.now());
    takeFromInventory(id);
    setWorkbench((prev) => [...prev, id]);
  };

  const combine = () => {
    if (!canCombine) return;
    if (relicModal || resultModal) return;

    const now = Date.now();
    const started = startedAt ?? now;
    if (!startedAt) setStartedAt(started);

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);

    const key = normalizeRecipe(workbench);
    const relicId = RECIPE_TO_RELIC[key];

    if (!relicId) {
      // 오답: 재료 되돌리고 흔들기
      setShake(true);
      window.setTimeout(() => setShake(false), 520);
      setSmoke(true);
      window.setTimeout(() => setSmoke(false), 620);
      audio.playSfx('wrong', 0.8);
      audio.playUrl('/assets/sounds/sfx_negative_beep.mp3', 0.7);
      setFlashSafe('fail', '펑! 조합에 실패했어… 다시 해보자!');
      clearWorkbench(true);
      return;
    }

    if (collected.includes(relicId)) {
      setFlashSafe('fail', '이미 완성한 유물이에요! 다른 조합을 해보자.');
      clearWorkbench(true);
      return;
    }

    // 정답: 재료는 소비 + "유물 획득 팝업"을 띄운 뒤, 확인 버튼에서 도감에 추가
    setFlashSafe('success', '성공! 유물을 획득했어!');
    setWorkbench([]);
    setRelicModal(relicId);
    setSparkle(true);
    window.setTimeout(() => setSparkle(false), 900);
    audio.playSfx('correct', 0.85);
    audio.playUrl('/assets/sounds/sfx_fanfare.mp3', 0.8);
  };

  return (
    <div className="w-full h-full text-white flex flex-col relative p-2">
      {/* 커스텀 애니메이션(무거운 라이브러리 없이) */}
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          18% { transform: translateX(-14px) rotate(-1.5deg); }
          36% { transform: translateX(14px) rotate(1.5deg); }
          54% { transform: translateX(-10px) rotate(-1deg); }
          72% { transform: translateX(10px) rotate(1deg); }
          100% { transform: translateX(0); }
        }
        .shake { animation: shake 520ms ease-in-out; }
        @keyframes pop {
          0% { transform: scale(0.98); opacity: 0.0; }
          30% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pop { animation: pop 220ms ease-out; }

        @keyframes smoke {
          0% { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(-50%, -55%) scale(1.25); opacity: 0; }
        }
        .smokeFx { animation: smoke 620ms ease-out; }

        @keyframes sparkle {
          0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.15); opacity: 0; }
        }
        .sparkleFx { animation: sparkle 900ms ease-out; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">
          스테이지 {stageId} · {title}
        </div>
        <div className="text-xs font-bold opacity-90">
          도감 {Math.min(collected.length, targetRelics)}/{targetRelics} · 시도 {attempts}
        </div>
      </div>

      {/* Fit-to-screen(800x450) 기준: 3패널 고정 레이아웃(스크롤 없이 설계) */}
      <div className="mt-2 flex-1 min-h-0">
        <div className="grid grid-cols-12 gap-2 h-full">
        {/* 재료 */}
        <div className="col-span-4 rounded-2xl border border-white/10 bg-black/40 p-2 flex flex-col min-h-0">
          <div className="text-sm font-extrabold mb-2">재료</div>
          <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
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
                  onClick={() => {
                    // 클릭만 해도 작업대에 자동으로 들어가게(빈 슬롯이 있을 때)
                    if (disabled) return;
                    handleDropIngredient(ing.id);
                  }}
                  className={[
                    'select-none rounded-xl border p-1.5',
                    'bg-white/5 border-white/10',
                    disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-white/10',
                  ].join(' ')}
                  title={disabled ? '재료가 부족해요' : '드래그해서 작업대에 넣기'}
                >
                  <div className="flex items-center gap-2">
                    <img src={ing.img} alt={ing.name} className="w-8 h-8 object-contain" />
                    <div className="min-w-0">
                      <div className="text-xs font-black">{ing.name}</div>
                      <div className="text-[10px] opacity-80">x {left}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 text-[10px] opacity-80 leading-relaxed">
            팁: 작업대에는 <b>최대 3개</b>까지 넣을 수 있어요. 넣은 재료는 클릭하면 다시 뺄 수 있어요.
          </div>
        </div>

        {/* 작업대(드롭존) */}
        <div className="col-span-4 rounded-2xl border border-white/10 bg-black/40 p-2 relative flex flex-col min-h-0">
          <div className="text-sm font-extrabold mb-2">작업대</div>

          <div
            className={[
              'relative rounded-2xl border-2 border-dashed p-2 flex-1 min-h-0 flex flex-col justify-between bg-cover bg-center',
              isOver && canDrop ? 'border-amber-400' : 'border-white/20',
              shake ? 'shake' : '',
            ].join(' ')}
            style={{ backgroundImage: "url('/assets/images/craft_table.png')" }}
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
            {/* 배경 위에 살짝 어둡게(가독성) */}
            <div className="absolute inset-0 rounded-2xl bg-black/35 pointer-events-none" />

            {/* 오답 연기(펑!) */}
            {smoke && (
              <img
                src="/assets/images/items/ink_splat_2.png"
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 w-40 h-40 object-contain smokeFx"
              />
            )}

            <div className="relative text-xs font-bold opacity-90">
              재료 슬롯 ({workbench.length}/3)
            </div>

            <div className="relative mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => {
                const id = workbench[i];
                if (!id) {
                  return (
                    <div key={i} className="rounded-xl border border-white/10 bg-black/30 h-14 grid place-items-center text-xs opacity-60">
                      비어있음
                    </div>
                  );
                }
                const def = INGREDIENTS.find((x) => x.id === id)!;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => removeFromWorkbench(i)}
                    className="rounded-xl border border-white/10 bg-white/5 h-14 flex items-center justify-center hover:bg-white/10"
                    title="클릭해서 빼기"
                  >
                    <img src={def.img} alt={def.name} className="w-10 h-10 object-contain" />
                  </button>
                );
              })}
            </div>

            <div className="relative flex items-center justify-between gap-2 mt-3">
              <button
                type="button"
                onClick={() => clearWorkbench(true)}
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

          <div className="mt-2 text-[10px] opacity-85">
            정답 레시피는 <b>2~3개 조합</b>이에요. 재료를 넣고 <b>조합하기</b>를 눌러보자!
          </div>
        </div>

        {/* 내 유물 도감 */}
        <div className="col-span-4 rounded-2xl border border-white/10 bg-black/40 p-2 flex flex-col min-h-0">
          <div className="text-sm font-extrabold mb-2">내 유물 도감</div>
          <div className="grid grid-cols-2 gap-1">
            {RELICS.map((r) => {
              const got = collected.includes(r.id);
              return (
                <div
                  key={r.id}
                  className={[
                    'rounded-xl border p-1.5',
                    got ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/5 opacity-70',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={r.img}
                      alt={r.name}
                      className={['w-8 h-8 object-contain', got ? '' : 'grayscale opacity-60'].join(' ')}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-black">{got ? r.name : '???'}</div>
                      <div className="text-[10px] opacity-80">{got ? '완성!' : '미완성'}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2">
            <div className="text-[10px] font-black opacity-90 mb-1">레시피 힌트</div>
            <div className="text-[10px] opacity-85 leading-relaxed">
              흙+불 / 돌+돌 / 구리+주석+불 / 돌+나무+밧줄 / 밧줄+나무+짚
            </div>
          </div>
        </div>
        </div>
      </div>
      {/* 유물 획득 팝업(정답 조합 시) */}
      {relicModal && (
        <div className="absolute inset-0 z-[10000] grid place-items-center bg-black/60 p-4">
          <div className="relative overflow-hidden w-full max-w-[440px] rounded-2xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl">
            {/* 반짝 이펙트 */}
            {sparkle && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 w-[520px] h-[520px] sparkleFx">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute block w-2 h-2 rounded-full bg-amber-200/90 shadow-[0_0_18px_rgba(251,191,36,0.9)]"
                      style={{
                        left: `${10 + ((i * 73) % 80)}%`,
                        top: `${10 + ((i * 41) % 80)}%`,
                        transform: `scale(${0.8 + (i % 3) * 0.25})`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="p-4">
              <div className="text-lg font-black">유물 획득!</div>
              <div className="mt-1 text-xs opacity-80">완성된 유물을 확인하고 도감에 추가해보자.</div>

              <div className="mt-4 flex items-start gap-3">
                <img
                  src={RELICS.find((r) => r.id === relicModal)?.img}
                  alt=""
                  className="w-20 h-20 object-contain rounded-xl bg-white/5 border border-white/10"
                />
                <div className="min-w-0">
                  <div className="text-sm font-black">{RELICS.find((r) => r.id === relicModal)?.name}</div>
                  <div className="mt-2 text-xs leading-relaxed opacity-85">{RELIC_DESC[relicModal]}</div>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0">
              <button
                type="button"
                className="w-full rounded-xl bg-amber-400 text-black font-black py-3 hover:bg-amber-300"
                onClick={() => {
                  audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.8);
                  const now = Date.now();
                  const started = startedAt ?? now;
                  if (!startedAt) setStartedAt(started);

                  setCollected((prev) => {
                    const next = prev.includes(relicModal) ? prev : [...prev, relicModal];
                    // 자동 화면 전환 금지: 목표 개수 달성 시 최종 결과창을 띄우고,
                    // 사용자가 직접 "지도" 버튼을 눌렀을 때만 onComplete 호출
                    if (next.length >= targetRelics) setResultModal(true);
                    return next;
                  });

                  setRelicModal(null);
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 최종 결과 감상창 (자동 전환 없이, 유저 클릭으로만 맵 복귀) */}
      {resultModal && (
        <div className="absolute inset-0 z-[10010] grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-[520px] rounded-2xl border border-white/15 bg-zinc-950/95 text-white shadow-2xl">
            <div className="p-5">
              <div className="text-xl font-black">축하해요! 유물 복원 완료</div>
              <div className="mt-2 text-sm opacity-85 leading-relaxed">
                {targetRelics}개의 유물을 완성해 문화유산 기록을 되살렸어요.
                <br />
                아래에서 방금 만든 유물을 감상해보자!
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {collected.slice(0, targetRelics).map((id) => {
                  const r = RELICS.find((x) => x.id === id);
                  return (
                    <div key={id} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                      <img src={r?.img} alt="" className="mx-auto w-16 h-16 object-contain" />
                      <div className="mt-2 text-xs font-black">{r?.name}</div>
                    </div>
                  );
                })}
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
                수호대 지도로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
