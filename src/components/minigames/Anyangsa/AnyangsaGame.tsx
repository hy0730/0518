import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';

type Phase = 'FRAGMENTS' | 'ENGRAVE';

type FragmentId = 'f1' | 'f2' | 'f3';

type DragState = {
  id: FragmentId;
  label: string;
  img: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const BG = '/assets/images/relic_turtle_main.png'; // 안양사 야외(픽셀) 배경
const REAL = '/assets/images/relic_turtle_real.png'; // 실제 문화유산 사진

const GUIBU_EMPTY = '/assets/images/relic_gwibu_base_front.png';
const GUIBU_FULL = '/assets/images/relic_gwibu_complete.png';
const STELE_BODY = '/assets/images/relic_gwibu_body.png';

const FRAGMENTS: { id: FragmentId; label: string; img: string; x: number; y: number }[] = [
  { id: 'f1', label: '비석 조각', img: '/assets/images/relic_gwibu_head.png', x: 14, y: 18 },
  { id: 'f2', label: '비석 조각', img: '/assets/images/relic_gwibu_body.png', x: 78, y: 22 },
  { id: 'f3', label: '비석 조각', img: '/assets/images/relic_gwibu_base_top.png', x: 22, y: 56 },
];

export default function AnyangsaGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = stageTitle;

  const [phase, setPhase] = useState<Phase>('FRAGMENTS');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // 게임 시작 팝업(비희의 소원) - 1회 클릭으로 시작
  const [introStatus, setIntroStatus] = useState<'SHOW' | 'FADE' | 'DONE'>('SHOW');
  const introTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (introTimerRef.current) window.clearTimeout(introTimerRef.current);
    };
  }, []);

  // Phase1
  const [collected, setCollected] = useState<Record<FragmentId, boolean>>({ f1: false, f2: false, f3: false });
  const allCollected = collected.f1 && collected.f2 && collected.f3;
  const dropRef = useRef<HTMLDivElement | null>(null);
  const completedFxPlayedRef = useRef(false);

  // Drag
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragThreshold = 3;

  const startDrag = (e: React.PointerEvent, f: { id: FragmentId; label: string; img: string }) => {
    if (phase !== 'FRAGMENTS') return;
    if (introStatus !== 'DONE') return;
    if (collected[f.id]) return;
    startIfNeeded();
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    setDrag({
      id: f.id,
      label: f.label,
      img: f.img,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - centerX,
      offsetY: e.clientY - centerY,
      moved: false,
    });
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

  const collectOne = (id: FragmentId) => {
    if (collected[id]) return;
    audio.playSfx('correct', 0.7);
    setCollected((prev) => ({ ...prev, [id]: true }));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    if (introStatus !== 'DONE') {
      setDrag(null);
      return;
    }
    const ended = drag;
    setDrag(null);

    // 클릭(움직임 거의 없음)일 때도 조각을 모으도록 허용
    if (!ended.moved) {
      collectOne(ended.id);
      return;
    }

    const zone = dropRef.current;
    if (!zone) return;
    const z = zone.getBoundingClientRect();
    // 드래그 프리뷰를 실제로 따라다니게 렌더링하지 않는 구조라,
    // 포인터 위치 기준으로 Drop Zone 내부 판정하는 것이 가장 직관적이고 안정적이다.
    const dropX = e.clientX;
    const dropY = e.clientY;
    const inside = dropX >= z.left && dropX <= z.right && dropY >= z.top && dropY <= z.bottom;
    if (inside) {
      collectOne(ended.id);
    } else {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
    }
  };

  // Phase1 완료 연출(자동 전환 X, 탭해서 다음 단계)
  useEffect(() => {
    if (phase !== 'FRAGMENTS') return;
    if (!allCollected) return;
    if (completedFxPlayedRef.current) return;
    completedFxPlayedRef.current = true;
    audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.85);
  }, [phase, allCollected]);

  // Phase2 (세로 모드 UI + 실시간 타이핑, 엔터 줄 허용)
  const [input, setInput] = useState('');
  const [engraved, setEngraved] = useState<string | null>(null);
  const [engraving, setEngraving] = useState(false);
  const [resultModal, setResultModal] = useState(false);
  // 글씨창(요청): 폭 30%, 높이 40% 고정 + 위치(top/right)만 조절 가능
  const INSCRIBE_BOX_SIZE = { widthPct: 30, heightPct: 40 };
  // 최종 고정 위치(요청)
  const INSCRIBE_BOX_POS = { topPct: 30, rightPct: 34 };
  // 세로쓰기에서 "줄"은 개행 기준으로 계산(5줄 초과 시 자동 축소)
  const lineCount = useMemo(() => (engraved ?? input).split('\n').length, [engraved, input]);
  const fontScale = useMemo(() => (lineCount > 5 ? 5 / lineCount : 1), [lineCount]);
  const inscribeFontPx = useMemo(() => Math.max(12, Math.round(22 * fontScale)), [fontScale]);

  const finishEngrave = () => {
    startIfNeeded();
    if (phase !== 'ENGRAVE') return;
    const text = input.trim();
    if (!text) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.7);
      return;
    }
    setEngraving(true);
    audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.9);
    setTimeout(() => audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.8), 260);
    setTimeout(() => audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.75), 520);

    setTimeout(() => {
      setEngraved(text);
      setEngraving(false);
      audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
      setTimeout(() => setResultModal(true), 520);
    }, 900);
  };

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes popIn {
          0% { transform: translateY(6px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .popInFx { animation: popIn 280ms ease-out both; }

        @keyframes engraveIn {
          0% { transform: translateY(6px) scale(0.98); opacity: 0; filter: blur(1px); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
        }
        .engraveFx { animation: engraveIn 520ms ease-out both; }
      `}</style>

      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'FRAGMENTS' ? 'Phase 1' : 'Phase 2'}</div>
      </div>

      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {/* 배경 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(244,235,217,0.12), rgba(244,235,217,0.30)), url('${BG}')`,
          }}
        />

        {/* 시작 팝업: 비희의 소원 (클릭하면 시작) */}
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
              startIfNeeded();
              audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75);
              setIntroStatus('FADE');
              introTimerRef.current = window.setTimeout(() => setIntroStatus('DONE'), 720);
            }}
            onTouchStart={() => {
              if (introStatus !== 'SHOW') return;
              startIfNeeded();
              audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75);
              setIntroStatus('FADE');
              introTimerRef.current = window.setTimeout(() => setIntroStatus('DONE'), 720);
            }}
          >
            <div className="absolute inset-0 bg-ink/45" />
            <div className="relative z-10 h-full grid place-items-center">
              <div className="note-panel max-w-[620px] px-5 py-4">
                <div className="text-lg font-black">비희(거북이)의 소원</div>
                <div className="mt-2 text-sm opacity-90 leading-relaxed">
                  앗, 내 등에 있던 비석이 깨져버렸어!
                  <br />
                  흩어진 비석 조각들을 찾아서 내 등에 다시 올려줘!
                </div>
                <div className="mt-3 text-sm font-black text-stamp">화면을 터치하면 시작해요.</div>
              </div>
            </div>
          </button>
        )}

        {phase === 'FRAGMENTS' ? (
          <div className="absolute inset-0 p-3">
            {/* 귀부(비석 없음) */}
            <div className="absolute left-1/2 bottom-2 -translate-x-1/2 w-[min(520px,88%)]">
              <img
                src={allCollected ? GUIBU_FULL : GUIBU_EMPTY}
                alt="귀부"
                className="w-full object-contain drop-shadow-[0_18px_40px_rgba(74,55,40,0.18)]"
                draggable={false}
              />
              {/* Drop Zone: 거북이 등 */}
              {!allCollected && (
                <div
                  ref={dropRef}
                  className={[
                    'absolute left-1/2 top-[10%] -translate-x-1/2 w-[58%] h-[34%] rounded-3xl border-2 border-dashed',
                    'border-ink/30 bg-paper/40',
                  ].join(' ')}
                  title="여기로 비석 조각을 모아보자!"
                >
                  <div className="absolute inset-0 grid place-items-center text-xs font-black opacity-80">
                    {`조각 모으기 ${Object.values(collected).filter(Boolean).length}/3`}
                  </div>
                </div>
              )}
            </div>

            {/* 완성 축하 안내 + 탭해서 다음 단계 */}
            {allCollected && (
              <button
                type="button"
                className="absolute inset-0 grid place-items-center bg-ink/18 z-10"
                onClick={() => setPhase('ENGRAVE')}
                onTouchStart={() => setPhase('ENGRAVE')}
              >
                <div className="note-panel px-5 py-4 max-w-[420px]">
                  <div className="text-sm font-black">완성!</div>
                  <div className="mt-1 text-sm opacity-90">비희의 등에 비석을 다시 올려줬어.</div>
                  <div className="mt-3 text-sm font-black text-stamp">화면을 탭하면 다음 단계로 넘어가요.</div>
                </div>
              </button>
            )}

            {/* 흩어진 조각들 */}
            {FRAGMENTS.map((f) => {
              const done = collected[f.id];
              if (done) return null;
              return (
                <div
                  key={f.id}
                  className="absolute touch-none"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div
                    className="rounded-2xl border border-ink/20 bg-paper2/85 p-2 shadow-md cursor-grab active:cursor-grabbing touch-none"
                    onPointerDown={(e) => startDrag(e, f)}
                    onPointerMove={updateDrag}
                    onPointerUp={endDrag}
                    title="드래그해서 거북이 등에 놓기 (또는 눌러서 획득)"
                  >
                    <img src={f.img} alt={f.label} className="w-14 h-14 object-contain" draggable={false} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="absolute inset-0 p-3 grid place-items-center">
            {/* 좌우 분할 스테이지: 왼쪽 비석 몸통 / 오른쪽 입력 */}
            <div className="w-full h-full grid grid-cols-2 gap-3">
              <div className="min-h-0 rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden relative">
                <div className="absolute inset-0 p-2 md:p-3">
                  {/* 몸통만 표시: 가능한 한 크게 보여 태블릿에서도 잘 보이게 */}
                  <img
                    src={STELE_BODY}
                    alt="비석 몸통"
                    className="absolute inset-1 md:inset-2 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] md:w-[calc(100%-1rem)] md:h-[calc(100%-1rem)] object-contain drop-shadow-[0_18px_40px_rgba(74,55,40,0.18)]"
                    draggable={false}
                  />

                  {/* 실시간 타이핑: 오른쪽 위부터 세로쓰기 */}
                  <div
                    className="absolute"
                    style={{
                      right: `${INSCRIBE_BOX_POS.rightPct}%`,
                      top: `${INSCRIBE_BOX_POS.topPct}%`,
                      width: `${INSCRIBE_BOX_SIZE.widthPct}%`,
                      height: `${INSCRIBE_BOX_SIZE.heightPct}%`,
                    }}
                  >
                    <div
                      className="h-full w-full font-black"
                      style={{
                        // 음각 글씨 대비 강화(더 또렷하게)
                        color: 'rgba(35, 25, 18, 0.86)',
                        textShadow:
                          '0.6px 0.6px 0 rgba(255,255,255,0.18), -0.8px -0.8px 0 rgba(20,14,10,0.28), 0 1px 2px rgba(20,14,10,0.20), 0 4px 10px rgba(20,14,10,0.12)',
                        filter: 'contrast(1.12) saturate(0.88)',
                        fontSize: `${inscribeFontPx}px`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        lineHeight: 1.72,
                        letterSpacing: '0.08em',
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        // 위에서 아래로(요청): 방향 뒤집기 금지
                        direction: 'ltr',
                        textAlign: 'left',
                        WebkitTextStroke: '0.55px rgba(18, 12, 9, 0.22)',
                      }}
                    >
                      {engraved ?? input}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-3">
                <div className="note-panel px-4 py-3">
                  <div className="text-sm font-black">비석 글씨 새기기</div>
                  <div className="mt-1 text-sm opacity-90 leading-relaxed">
                    남기고 싶은 말을 적어보자. 적은 글은 왼쪽 비석에 오른쪽 위부터 세로로 새겨져요.
                  </div>
                </div>

                <div className="text-sm font-black">글씨 쓰는 칸</div>
                <div className="text-xs opacity-80 leading-relaxed">
                  엔터로 줄을 바꿀 수 있어요. 4줄을 넘기면 더 이상 입력되지 않아요.
                </div>

                <textarea
                  onChange={(e) => {
                    const next = e.target.value;
                    const lines = next.split('\n');
                    // 4줄 초과 입력은 차단(요청)
                    if (lines.length > 4) return;
                    setInput(next);
                  }}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={'예:\n안양의 문화유산을\n오래오래 지켜요\n우리 모두 함께해요'}
                  className="flex-1 min-h-[240px] rounded-2xl border-2 border-ink/25 bg-paper2 px-3 py-3 text-sm font-bold outline-none resize-none"
                  disabled={engraving || !!engraved}
                <button
                  type="button"
                  onClick={finishEngrave}
                  disabled={engraving || !!engraved}
                  className={[
                    'rounded-2xl px-4 py-3 font-black border shadow-md',
                    engraving || !!engraved
                      ? 'bg-paper/50 text-ink/40 cursor-not-allowed border-ink/20'
                      : 'bg-stamp text-white border-ink/25 hover:opacity-95',
                  ].join(' ')}
                >
                  {engraving ? '새기는 중…' : '완료'}
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
              left: drag.x - drag.offsetX,
              top: drag.y - drag.offsetY,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">
              <img src={drag.img} alt="" className="w-10 h-10 object-contain mx-auto mb-1" draggable={false} />
              {drag.label}
            </div>
          </div>
        )}
      </div>

      {/* 결과 모달 */}
      {resultModal && (
        <div className="fixed inset-0 z-[99999] bg-ink/35 p-0">
          <div className="w-full h-full bg-paper2 text-ink shadow-paper flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <img src={REAL} alt="" className="w-full h-full object-cover" draggable={false} />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/70">
              <div className="text-lg font-black">성공! 복원 완료</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">성공! 여러분의 멋진 다짐이 안양사 귀부에 영원히 새겨졌어요!</div>
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
