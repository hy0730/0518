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

  // 도입부: 노트 펼침(페이지 넘김) 연출
  const [opening, setOpening] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOpening(false), 820);
    return () => window.clearTimeout(t);
  }, []);

  // Phase 1: 조립(기단 -> 지주 -> 당간 -> 당)
  const partOrder: PartId[] = ['base', 'pillar', 'pole', 'flag'];
  const [assembled, setAssembled] = useState<Record<PartId, boolean>>({
    base: false,
    pillar: false,
    pole: false,
    flag: false,
  });
  const nextPart = useMemo(() => partOrder.find((p) => !assembled[p]) ?? null, [assembled]);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
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

  const [shake, setShake] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const parts = useMemo(
    () =>
      shuffle([
        { id: 'base' as const, name: '기단(받침돌)', kind: 'shape' as const },
        { id: 'pillar' as const, name: '지주(돌기둥)', img: '/assets/images/items/jungcho_both.png' },
        { id: 'pole' as const, name: '당간(장대)', img: '/assets/images/items/jungcho_pole.png' },
        { id: 'flag' as const, name: '당(깃발)', img: '/assets/images/items/jungcho_flag_line.png' },
      ]),
    []
  );

  const onClickPart = (id: PartId) => {
    startIfNeeded();
    if (phase !== 'ASSEMBLE') return;
    if (infoOpen) return;
    if (assembled[id]) return;

    const next = nextPart;
    if (next !== id) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      const hint =
        next === 'base'
          ? '먼저 기단(받침돌)부터 조립해볼까?'
          : next === 'pillar'
            ? '다음은 지주(돌기둥)를 세워보자!'
            : next === 'pole'
              ? '이제 당간(장대)을 끼워보자!'
              : '마지막으로 당(깃발)을 달아보자!';
      showToast(`순서가 아니에요. ${hint}`);
      return;
    }

    audio.playSfx('correct', 0.7);
    setAssembled((prev) => ({ ...prev, [id]: true }));
  };

  // 4개 모두 조립되면 안내 후 Phase2
  useEffect(() => {
    if (phase !== 'ASSEMBLE') return;
    const done = partOrder.every((p) => assembled[p]);
    if (!done) return;
    audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.85);
    setInfoOpen(true);
    const t = window.setTimeout(() => {
      setInfoOpen(false);
      setPhase('QUIZ');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase, assembled]);

  // Phase 2: 명문 해독(클릭 퀴즈)
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
  const [resultModal, setResultModal] = useState(false);

  const handlePickChoice = (id: QuizId) => {
    startIfNeeded();
    if (phase !== 'QUIZ') return;
    if (!nextQuiz) return;
    if (glow) return;
    if (quizSlots.includes(id)) return;

    if (id !== nextQuiz) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
      setQuizShake(true);
      window.setTimeout(() => setQuizShake(false), 420);
      showToast('오답! 힌트: A → B → C → D 순서로 맞춰보자.');
      return;
    }

    audio.playSfx('correct', 0.75);
    setQuizSlots((prev) => {
      const i = prev.findIndex((x) => !x);
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = id;
      return next;
    });
  };

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
    <div className="w-full h-full p-3 text-ink flex flex-col relative">
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

        @keyframes noteOpen {
          0% { transform: perspective(900px) rotateY(-85deg) translateX(-40px) scale(0.78); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: perspective(900px) rotateY(0deg) translateX(0) scale(1); opacity: 1; }
        }
        .noteOpenFx { transform-origin: left center; animation: noteOpen 820ms cubic-bezier(.2,.9,.2,1) both; }
      `}</style>

      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'ASSEMBLE' ? 'Phase 1' : 'Phase 2'}</div>
      </div>

      {/* 세로(450x800) 최적화 메인 */}
      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {phase === 'ASSEMBLE' ? (
          <>
            {/* 배경: 야외 절터 느낌(임시 톤) */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.55)), url('${mainBg}')`,
              }}
            />

            <div className="absolute inset-0 p-3 flex flex-col gap-3">
              {/* 상단(약 60%): 조립 실루엣 */}
              <div
                className={[
                  'flex-[3] min-h-0 rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden relative',
                  shake ? 'shakeFx' : '',
                ].join(' ')}
              >
                <div className="absolute inset-0 grid place-items-center pointer-events-none opacity-45">
                  <img
                    src="/assets/images/items/jungcho_line.png"
                    alt=""
                    className="w-[92%] max-w-[360px] object-contain"
                    draggable={false}
                  />
                </div>

                {/* 세로 슬롯 4개 */}
                <div className="absolute inset-0 px-5 py-4 flex flex-col justify-between gap-3">
                  <div className="flex-1 rounded-3xl border-2 border-dashed border-paper/70 bg-paper/55 grid place-items-center">
                    {assembled.base ? (
                      <div className="w-[78%] h-[34px] rounded-2xl bg-ink/20 border border-ink/25" />
                    ) : (
                      <div className="text-sm font-black text-white/90">① 기단(받침돌)</div>
                    )}
                  </div>

                  <div className="flex-[2] rounded-3xl border-2 border-dashed border-paper/70 bg-paper/45 grid place-items-center">
                    {assembled.pillar ? (
                      <img
                        src="/assets/images/items/jungcho_both.png"
                        alt=""
                        className="h-[88%] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.25)]"
                        draggable={false}
                      />
                    ) : (
                      <div className="text-sm font-black text-white/90">② 지주(돌기둥)</div>
                    )}
                  </div>

                  <div className="flex-[2] rounded-3xl border-2 border-dashed border-paper/70 bg-paper/40 grid place-items-center">
                    {assembled.pole ? (
                      <img src="/assets/images/items/jungcho_pole.png" alt="" className="h-[92%] object-contain" draggable={false} />
                    ) : (
                      <div className="text-sm font-black text-white/90">③ 당간(장대)</div>
                    )}
                  </div>

                  <div className="flex-1 rounded-3xl border-2 border-dashed border-paper/70 bg-paper/45 grid place-items-center">
                    {assembled.flag ? (
                      <img
                        src="/assets/images/items/jungcho_flag_line.png"
                        alt=""
                        className="h-[90%] object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="text-sm font-black text-white/90">④ 당(깃발)</div>
                    )}
                  </div>
                </div>

                {infoOpen && (
                  <div className="absolute inset-0 grid place-items-center bg-ink/35">
                    <div className="note-panel px-5 py-4 max-w-[360px]">
                      <div className="text-sm font-black">띠링! 당간지주 완성</div>
                      <div className="mt-2 text-sm leading-relaxed opacity-95">
                        당간지주는 절에 행사가 있을 때 ‘당(깃발)’을 다는 ‘당간(장대)’을 지탱해 주는 돌기둥이에요!
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 하단(약 40%): 인벤토리(2x2) */}
              <div className="flex-[2] min-h-0 rounded-3xl border border-ink/20 bg-paper/70 px-3 py-3">
                <div className="text-[12px] font-bold leading-relaxed min-h-[18px] text-ink">
                  {nextPart
                    ? `순서대로 조립해보자! 다음: ${nextPart === 'base' ? '기단' : nextPart === 'pillar' ? '지주' : nextPart === 'pole' ? '당간' : '당(깃발)'}`
                    : '완성!'}
                </div>
                <div className="mt-2 grid grid-cols-2 grid-rows-2 gap-2 h-[calc(100%-24px)]">
                  {parts.map((p) => {
                    const disabled = assembled[p.id as PartId] || infoOpen;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onClickPart(p.id)}
                        className={[
                          'rounded-3xl border border-ink/25 bg-paper2/90 shadow-md flex flex-col items-center justify-center gap-2',
                          disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-paper2 active:translate-y-[1px]',
                          nextPart === p.id ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                        ].join(' ')}
                      >
                        {'kind' in p ? (
                          <div className="w-10 h-6 rounded-2xl bg-ink/15 border border-ink/25" />
                        ) : (
                          <img src={p.img} alt="" className="h-14 object-contain" draggable={false} />
                        )}
                        <div className="text-xs font-black">{p.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 배경: 돌기둥 클로즈업(Zoom-in 느낌) */}
            <div
              className="absolute inset-0 bg-cover bg-center scale-[1.12]"
              style={{
                backgroundImage: `linear-gradient(rgba(244,235,217,0.08), rgba(244,235,217,0.22)), url('${stoneBg}')`,
              }}
            />

            <div className="absolute inset-0 p-3 flex flex-col gap-3">
              {/* 상단~중단: 돌기둥 + 슬롯(세로) */}
              <div
                className={[
                  'flex-[3] min-h-0 rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden relative',
                  quizShake ? 'shakeFx' : '',
                ].join(' ')}
              >
                {glow && <div className="absolute inset-0 bg-gradient-to-b from-amber-200/12 to-transparent animate-pulse pointer-events-none" />}

                <div className="absolute inset-0 px-4 py-4 flex flex-col gap-3">
                  <div className="text-sm font-black">명문을 순서대로 해독해보자</div>
                  <div className="flex-1 grid grid-rows-4 gap-2">
                    {quizSlots.map((q, i) => (
                      <div
                        key={i}
                        className={[
                          'rounded-3xl border-2 border-dashed px-3 py-3 text-center font-black',
                          'border-ink/25 bg-paper/70',
                          q
                            ? glow
                              ? 'text-amber-700 drop-shadow-[0_0_10px_rgba(245,158,11,0.65)] animate-pulse'
                              : 'text-ink'
                            : 'text-ink/50',
                        ].join(' ')}
                      >
                        {q ? quizTexts[q] : `빈칸 ${i + 1}`}
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] opacity-80">A → B → C → D 순서로 눌러 넣어보자.</div>
                </div>
              </div>

              {/* 하단: 선택지(세로 리스트) */}
              <div className="flex-[2] min-h-0 rounded-3xl border border-ink/20 bg-paper/70 p-3">
                <div className="text-sm font-black">문장 블록</div>
                <div className="mt-2 grid grid-rows-4 gap-2 h-[calc(100%-22px)]">
                  {quizChoices.map((id) => {
                    const used = quizSlots.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={used || glow}
                        onClick={() => handlePickChoice(id)}
                        className={[
                          'rounded-3xl border border-ink/25 bg-paper2/90 shadow-md px-4 py-3 text-left',
                          used || glow ? 'opacity-45 cursor-not-allowed' : 'hover:bg-paper2 active:translate-y-[1px]',
                          nextQuiz === id ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                        ].join(' ')}
                      >
                        <div className="text-sm font-black">
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

      {/* 토스트 */}
      {toast && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 z-[9000] pointer-events-none">
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
        </div>
      )}

      {/* 도입부: 노트 페이지 넘김 */}
      {opening && (
        <div className="absolute inset-0 z-[12000] grid place-items-center bg-ink/20 pointer-events-none">
          <div className="note-panel w-[92%] max-w-[420px] px-6 py-10 noteOpenFx">
            <div className="text-center text-lg font-black">복원 노트 펼치는 중…</div>
            <div className="mt-2 text-center text-sm opacity-80">중초사지 당간지주 기록을 열어보자!</div>
          </div>
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
                성공! 돌에 새겨진 글자 덕분에 당간지주가 언제 만들어졌는지 알 수 있어서 보물로 지정되었어요!
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

