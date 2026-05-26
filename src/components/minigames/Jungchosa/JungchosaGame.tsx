import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';

type Phase = 'ASSEMBLE' | 'QUIZ';

type PartId = 'base' | 'pillar' | 'pole' | 'flag';
type QuizId = 'A' | 'B' | 'C' | 'D';

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function JungchosaGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );

  const title = `${stageTitle} · 당간지주`;

  const mainBg = useMemo(() => getRelicMainImage(stageId), [stageId]);
  const stoneBg = '/assets/images/relic_jungcho_stone.png';
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('ASSEMBLE');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // Phase 1: 조립(기단 -> 지주 -> 당간 -> 당)
  const partOrder: PartId[] = ['base', 'pillar', 'pole', 'flag'];
  const [assembled, setAssembled] = useState<Record<PartId, boolean>>({
    base: false,
    pillar: false,
    pole: false,
    flag: false,
  });
  const nextPart = useMemo(() => partOrder.find((p) => !assembled[p]) ?? null, [assembled]);

  const parts = useMemo(
    () =>
      shuffle([
        {
          id: 'base' as const,
          name: '기단(받침돌)',
          kind: 'shape' as const,
        },
        {
          id: 'pillar' as const,
          name: '지주(돌기둥)',
          imgA: '/assets/images/items/jungcho_left.png',
          imgB: '/assets/images/items/jungcho_right.png',
        },
        {
          id: 'pole' as const,
          name: '당간(장대)',
          img: '/assets/images/items/jungcho_pole.png',
        },
        {
          id: 'flag' as const,
          name: '당(깃발)',
          img: '/assets/images/items/jungcho_flag_line.png',
        },
      ]),
    []
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [shake, setShake] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const onClickPart = (id: PartId) => {
    startIfNeeded();
    if (phase !== 'ASSEMBLE') return;

    // 이미 조립된 부품은 무시
    if (assembled[id]) return;

    if (nextPart !== id) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      const hint =
        nextPart === 'base'
          ? '먼저 기단(받침돌)부터 조립해볼까?'
          : nextPart === 'pillar'
            ? '다음은 지주(돌기둥)를 세워보자!'
            : nextPart === 'pole'
              ? '이제 당간(장대)을 끼워보자!'
              : '마지막으로 당(깃발)을 달아보자!';
      showToast(`순서가 아니에요. ${hint}`);
      return;
    }

    audio.playSfx('correct', 0.65);
    setAssembled((prev) => ({ ...prev, [id]: true }));
  };

  // 4개 모두 조립되면 안내 후 Phase2
  useEffect(() => {
    if (phase !== 'ASSEMBLE') return;
    const done = partOrder.every((p) => assembled[p]);
    if (!done) return;

    audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.8);
    setInfoOpen(true);
    const t = window.setTimeout(() => {
      setInfoOpen(false);
      setPhase('QUIZ');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase, assembled]);

  // Phase2: 퀴즈(문장 블록 클릭 → 슬롯 채우기)
  const quizOrder: QuizId[] = ['A', 'B', 'C', 'D'];
  const quizTexts: Record<QuizId, string> = {
    A: '보력 2년(826년)',
    B: '승악(관악산)',
    C: '9월 1일',
    D: '정미년(827년)',
  };
  const [quizSlots, setQuizSlots] = useState<(QuizId | null)[]>([null, null, null, null]);
  const nextQuiz = useMemo(() => quizOrder[quizSlots.findIndex((x) => !x)] ?? null, [quizSlots]);
  const [quizChoices] = useState<QuizId[]>(() => shuffle(['A', 'B', 'C', 'D']));
  const [quizShake, setQuizShake] = useState(false);
  const [glow, setGlow] = useState(false);

  const handlePickChoice = (id: QuizId) => {
    startIfNeeded();
    if (phase !== 'QUIZ') return;
    if (!nextQuiz) return;
    // 이미 사용된 선택지면 무시
    if (quizSlots.includes(id)) return;

    if (id !== nextQuiz) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      setQuizShake(true);
      window.setTimeout(() => setQuizShake(false), 420);
      showToast('오답! 힌트: A → B → C → D 순서로 맞춰보자.');
      return;
    }

    audio.playSfx('correct', 0.7);
    setQuizSlots((prev) => {
      const i = prev.findIndex((x) => !x);
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = id;
      return next;
    });
  };

  // 다 맞추면 금빛 글로우 → 결과 모달
  const [resultModal, setResultModal] = useState(false);
  useEffect(() => {
    if (phase !== 'QUIZ') return;
    const done = quizSlots.every(Boolean);
    if (!done) return;
    setGlow(true);
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    const t = window.setTimeout(() => setResultModal(true), 550);
    return () => window.clearTimeout(t);
  }, [phase, quizSlots]);

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes shakeX {
          0% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
        .shakeFx { animation: shakeX 420ms ease-in-out; }
      `}</style>

      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'ASSEMBLE' ? '조립' : '명문 해독'}</div>
      </div>

      {/* 메인 */}
      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {/* 배경 레이어(페이드/줌) */}
        <div
          className={[
            'absolute inset-0 bg-cover bg-center transition-transform duration-700',
            phase === 'QUIZ' ? 'scale-[1.18]' : 'scale-100',
          ].join(' ')}
          style={{
            backgroundImage:
              phase === 'ASSEMBLE'
                ? `linear-gradient(rgba(244,235,217,0.10), rgba(244,235,217,0.40)), url('${mainBg}')`
                : `linear-gradient(rgba(244,235,217,0.08), rgba(244,235,217,0.22)), url('${stoneBg}')`,
          }}
        />

        {/* 공용 오버레이(보드) */}
        <div className="absolute inset-0 p-3">
          {phase === 'ASSEMBLE' ? (
            <>
              <div className="h-full grid grid-rows-[1fr_auto] gap-3">
                {/* 조립 보드 */}
                <div className="relative rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden">
                  {/* 실루엣 */}
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <img
                      src="/assets/images/items/jungcho_line.png"
                      alt=""
                      className="h-[92%] opacity-35 object-contain"
                      draggable={false}
                    />
                  </div>

                  {/* 4칸 drop zone (클릭 조립이지만 시각적 슬롯 제공) */}
                  <div className={['absolute inset-0', shake ? 'shakeFx' : ''].join(' ')}>
                    {/* base */}
                    <div className="absolute left-1/2 bottom-[8%] -translate-x-1/2 w-[240px] h-[64px] rounded-2xl border-2 border-dashed border-ink/25 bg-paper/50 grid place-items-center">
                      {assembled.base ? (
                        <div className="w-[220px] h-[42px] rounded-xl bg-ink/15 border border-ink/25" />
                      ) : (
                        <div className="text-xs font-black opacity-70">기단</div>
                      )}
                    </div>

                    {/* pillar */}
                    <div className="absolute left-1/2 bottom-[20%] -translate-x-1/2 w-[260px] h-[170px] rounded-2xl border-2 border-dashed border-ink/25 bg-paper/40 grid place-items-center">
                      {assembled.pillar ? (
                        <div className="flex items-end gap-3">
                          <img src="/assets/images/items/jungcho_left.png" alt="" className="h-[140px] object-contain" draggable={false} />
                          <img src="/assets/images/items/jungcho_right.png" alt="" className="h-[140px] object-contain" draggable={false} />
                        </div>
                      ) : (
                        <div className="text-xs font-black opacity-70">지주</div>
                      )}
                    </div>

                    {/* pole */}
                    <div className="absolute left-1/2 top-[8%] -translate-x-1/2 w-[120px] h-[260px] rounded-2xl border-2 border-dashed border-ink/25 bg-paper/35 grid place-items-center">
                      {assembled.pole ? (
                        <img src="/assets/images/items/jungcho_pole.png" alt="" className="h-[240px] object-contain" draggable={false} />
                      ) : (
                        <div className="text-xs font-black opacity-70">당간</div>
                      )}
                    </div>

                    {/* flag */}
                    <div className="absolute right-[8%] top-[10%] w-[200px] h-[120px] rounded-2xl border-2 border-dashed border-ink/25 bg-paper/35 grid place-items-center">
                      {assembled.flag ? (
                        <img src="/assets/images/items/jungcho_flag_line.png" alt="" className="w-[170px] object-contain" draggable={false} />
                      ) : (
                        <div className="text-xs font-black opacity-70">당(깃발)</div>
                      )}
                    </div>
                  </div>

                  {/* 완료 안내 */}
                  {infoOpen && (
                    <div className="absolute inset-0 grid place-items-center bg-ink/25">
                      <div className="note-panel px-5 py-4 max-w-[520px]">
                        <div className="text-sm font-black">띠링! 당간지주 완성</div>
                        <div className="mt-2 text-sm leading-relaxed opacity-95">
                          당간지주는 절에 행사가 있을 때 ‘당(깃발)’을 다는 ‘당간(장대)’을 지탱해 주는 돌기둥이에요!
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 하단 인벤토리 */}
                <div className="rounded-3xl border border-ink/20 bg-paper/70 px-3 py-2">
                  <div className="text-[12px] font-bold leading-relaxed min-h-[18px]">
                    {nextPart
                      ? `순서대로 조립해보자! 다음: ${
                          nextPart === 'base' ? '기단' : nextPart === 'pillar' ? '지주' : nextPart === 'pole' ? '당간' : '당(깃발)'
                        }`
                      : '완성!'}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {parts.map((p) => {
                      const disabled = assembled[p.id as PartId] || infoOpen;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => onClickPart(p.id)}
                          className={[
                            'h-[64px] rounded-2xl border border-ink/25 bg-paper2/90 shadow-md flex flex-col items-center justify-center gap-1',
                            disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-paper2 active:translate-y-[1px]',
                            nextPart === p.id ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                          ].join(' ')}
                        >
                          {'kind' in p ? (
                            <div className="w-7 h-5 rounded bg-ink/15 border border-ink/25" />
                          ) : 'imgA' in p ? (
                            <div className="flex items-end gap-1">
                              <img src={p.imgA} alt="" className="h-7 object-contain" draggable={false} />
                              <img src={p.imgB} alt="" className="h-7 object-contain" draggable={false} />
                            </div>
                          ) : (
                            <img src={p.img} alt="" className="w-8 h-8 object-contain" draggable={false} />
                          )}
                          <div className="text-[11px] font-black">{p.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-full grid grid-cols-[1fr_260px] gap-3">
                {/* 돌기둥 + 슬롯 */}
                <div className="relative rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden">
                  <div className="absolute inset-0" />

                  {/* 슬롯 오버레이 */}
                  <div className={['absolute inset-0', quizShake ? 'shakeFx' : ''].join(' ')}>
                    <div className="absolute left-1/2 top-[18%] -translate-x-1/2 w-[520px] max-w-[92%]">
                      <div className="note-panel px-4 py-3">
                        <div className="text-sm font-black">명문을 순서대로 해독해보자</div>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {quizSlots.map((q, i) => (
                            <div
                              key={i}
                              className={[
                                'rounded-2xl border-2 border-dashed px-2 py-2 text-center text-[12px] font-black',
                                'border-ink/25 bg-paper/70',
                                q ? (glow ? 'text-amber-600 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'text-ink') : 'text-ink/50',
                                glow ? 'shadow-[0_0_18px_rgba(245,158,11,0.25)]' : '',
                              ].join(' ')}
                            >
                              {q ? quizTexts[q] : `빈칸 ${i + 1}`}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] opacity-80">
                          블록을 A → B → C → D 순서로 눌러 넣어보자.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 글자 금빛 연출(오버레이) */}
                  {glow && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 bg-gradient-to-b from-amber-200/10 to-transparent animate-pulse" />
                    </div>
                  )}
                </div>

                {/* 선택지 */}
                <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-2">
                  <div className="text-sm font-black">문장 블록</div>
                  <div className="text-[11px] opacity-80">올바른 순서로 클릭해서 채워보자.</div>
                  <div className="mt-2 grid gap-2">
                    {quizChoices.map((id) => {
                      const used = quizSlots.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={used || glow}
                          onClick={() => handlePickChoice(id)}
                          className={[
                            'rounded-2xl border border-ink/25 bg-paper2/90 shadow-md px-3 py-3 text-left',
                            used || glow ? 'opacity-45 cursor-not-allowed' : 'hover:bg-paper2 active:translate-y-[1px]',
                            nextQuiz === id ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                          ].join(' ')}
                        >
                          <div className="text-xs font-black">
                            {id}: {quizTexts[id]}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
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
              <img
                src={realImg}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (mainBg && img.src !== mainBg) img.src = mainBg;
                }}
              />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/70">
              <div className="text-lg font-black">성공! 명문 해독 완료</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                성공! 돌에 새겨진 글자 덕분에 당간지주가 언제, 어떻게 만들어졌는지 정확히 알 수 있어서 보물로 지정되었어요!
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

