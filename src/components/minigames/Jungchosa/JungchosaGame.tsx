import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import { useToast } from '../common/useToast';

type Phase = 'QUIZ';
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

  const [phase] = useState<Phase>('QUIZ');
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
  const [introInfoOpen, setIntroInfoOpen] = useState(true);

  const { toast, showToast } = useToast(1200);

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
    if (introInfoOpen) return;
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
    <div className="w-full h-full p-0 text-ink flex flex-col relative">
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

      {/* 세로(450x800) 최적화 메인 - 상단까지 최대한 사용 */}
      <div className="flex-1 min-h-0 rounded-[22px] border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        <div className="absolute left-2 top-2 z-10 rounded-xl border border-ink/20 bg-paper2/88 px-2.5 py-1.5 pointer-events-none">
          <div className="text-[13px] font-black tracking-tight leading-tight">{title}</div>
          <div className="text-[10px] font-bold opacity-80">명문 해독</div>
        </div>

        <div className="h-full p-1.5 pt-12 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] gap-1.5">
            {/* 왼쪽: 명문 이미지 */}
            <div className="min-h-0 min-w-0 rounded-3xl border border-ink/20 bg-paper/88 overflow-hidden relative">
              <div className="h-full px-2 py-2 flex flex-col gap-2">
                <div className="text-sm font-black">명문 이미지</div>
                <div className="flex-1 min-h-0 rounded-2xl border border-ink/20 bg-paper2/78 overflow-hidden relative">
                  <img
                    src={stoneBg}
                    alt="당간지주 명문 이미지"
                    className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)] object-contain"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-paper/8 to-paper/16 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 가운데: 명문 빈칸 */}
            <div
              className={[
                'min-h-0 min-w-0 rounded-3xl border border-ink/20 bg-paper/88 overflow-hidden relative',
                quizShake ? 'shakeFx' : '',
              ].join(' ')}
            >
              {glow && <div className="absolute inset-0 bg-gradient-to-b from-amber-200/12 to-transparent animate-pulse pointer-events-none" />}

              <div className="h-full px-2 py-2 flex flex-col gap-2">
                <div className="text-sm font-black">명문 빈칸</div>
                <div className="flex-1 min-h-0 grid grid-rows-4 gap-1.5">
                  {quizSlots.map((q, i) => (
                    <div
                      key={i}
                      className={[
                        'rounded-2xl border-2 border-dashed px-2 py-2 text-center font-black flex items-center justify-center',
                        'border-ink/25 bg-paper/70',
                        q
                          ? glow
                            ? 'text-amber-700 drop-shadow-[0_0_10px_rgba(245,158,11,0.65)] animate-pulse'
                            : 'text-ink'
                          : 'text-ink/50',
                      ].join(' ')}
                    >
                      <span className="text-[13px] leading-tight">{q ? quizTexts[q] : `빈칸 ${i + 1}`}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] opacity-80">왼쪽 명문 이미지를 보고 가운데 빈칸을 채워보자.</div>
              </div>
            </div>

            {/* 오른쪽: 해독 */}
            <div className="min-h-0 min-w-0 rounded-3xl border border-ink/20 bg-paper/88 p-2 flex flex-col overflow-hidden">
              <div className="text-sm font-black">해독</div>
              <div className="mt-2 flex-1 min-h-0 grid grid-rows-4 gap-1.5">
                {quizChoices.map((id) => {
                  const used = quizSlots.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={used || glow || introInfoOpen}
                      onClick={() => handlePickChoice(id)}
                      className={[
                        'rounded-2xl border border-ink/25 bg-paper2/90 shadow-md px-3 py-2 text-left flex items-center',
                        used || glow || introInfoOpen ? 'opacity-45 cursor-not-allowed' : 'hover:bg-paper2 active:translate-y-[1px]',
                        nextQuiz === id ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                      ].join(' ')}
                    >
                      <div className="text-[13px] leading-tight font-black">
                        {id}: {quizTexts[id]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>
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

      {/* 도입 설명: 조합 단계 제거 후 바로 퀴즈 시작 */}
      {!opening && introInfoOpen && (
        <button
          type="button"
          className="absolute inset-0 z-[11000] grid place-items-center bg-ink/35 p-4 text-left"
          onClick={() => {
            startIfNeeded();
            setIntroInfoOpen(false);
          }}
        >
          <div className="note-panel w-[92%] max-w-[420px] px-5 py-4">
            <div className="text-sm font-black">당간지주 알아보기</div>
            <div className="mt-2 text-sm leading-relaxed opacity-95">
              당간지주는 절에 행사가 있을 때 깃발을 다는 긴 장대를 받쳐 주는 돌기둥이에요.
              <br />
              돌에 새겨진 명문을 순서대로 맞추면 언제 만들어졌는지 알 수 있어요!
            </div>
            <div className="mt-3 text-sm font-black text-stamp">화면을 탭하면 시작해요.</div>
          </div>
        </button>
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
