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

// 세로모드(450x800) 기준 캔버스 + scale-to-fit
const BASE_W = 450;
const BASE_H = 800;

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

  // 세로모드 권장 표시 + scale-to-fit
  const stageHostRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [isPortrait, setIsPortrait] = useState(() => window.innerHeight >= window.innerWidth);

  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      const s = Math.min(rect.width / BASE_W, rect.height / BASE_H);
      setStageScale(Number.isFinite(s) && s > 0 ? s : 1);
      setIsPortrait(window.innerHeight >= window.innerWidth);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

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
    const dropX = e.clientX - (ended.offsetX ?? 0);
    const dropY = e.clientY - (ended.offsetY ?? 0);
    const inside = dropX >= z.left && dropX <= z.right && dropY >= z.top && dropY <= z.bottom;
    if (inside) {
      collectOne(ended.id);
    } else {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.75);
    }
  };

  // Phase1 완료 → Phase2
  useEffect(() => {
    if (phase !== 'FRAGMENTS') return;
    if (!allCollected) return;
    audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.85);
    // Phase1에서 "완성 모습"을 잠깐 보여준 뒤 Phase2로 전환
    const t = window.setTimeout(() => setPhase('ENGRAVE'), 1200);
    return () => window.clearTimeout(t);
  }, [phase, allCollected]);

  // Phase2 (세로 모드 UI + 실시간 타이핑, 엔터 줄 허용)
  const [input, setInput] = useState('');
  const [engraved, setEngraved] = useState<string | null>(null);
  const [engraving, setEngraving] = useState(false);
  const [resultModal, setResultModal] = useState(false);

  // 종이에 쓰고 → 비석에 덮는 애니메이션 → 돌 깎는 소리로 새기는 연출
  const paperRef = useRef<HTMLDivElement | null>(null);
  const stoneTargetRef = useRef<HTMLDivElement | null>(null);
  const [paperAnim, setPaperAnim] = useState<null | {
    text: string;
    from: DOMRect;
    to: DOMRect;
    animate: boolean;
    fadeOut: boolean;
  }>(null);

  const startEngrave = () => {
    startIfNeeded();
    if (phase !== 'ENGRAVE') return;
    const text = input.trim();
    if (!text) {
      setAttempts((a) => a + 1);
      audio.playSfx('wrong', 0.7);
      return;
    }
    if (!paperRef.current || !stoneTargetRef.current) {
      // fallback: 즉시 새김
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
      return;
    }

    setEngraving(true);
    const from = paperRef.current.getBoundingClientRect();
    const to = stoneTargetRef.current.getBoundingClientRect();
    setPaperAnim({ text, from, to, animate: false, fadeOut: false });
    // 다음 프레임에 애니메이션 시작
    window.setTimeout(() => setPaperAnim((p) => (p ? { ...p, animate: true } : p)), 20);

    // 이동(종이 덮기) 후 → 돌 깎는 소리로 "새김" → 종이 사라짐
    window.setTimeout(() => {
      audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.9);
      window.setTimeout(() => audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.8), 260);
      window.setTimeout(() => audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.75), 520);

      // 종이 배경은 사라지고 글씨만 돌에 남는 느낌
      setPaperAnim((p) => (p ? { ...p, fadeOut: true } : p));

      window.setTimeout(() => {
        setEngraved(text);
        setEngraving(false);
        setPaperAnim(null);
        audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
        window.setTimeout(() => setResultModal(true), 520);
      }, 720);
    }, 650);
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
        <div className="flex items-center gap-2">
          {!isPortrait ? (
            <span className="text-[11px] font-black rounded-xl border border-ink/20 bg-paper/70 px-2 py-1">
              세로모드 권장
            </span>
          ) : null}
          <div className="text-xs font-bold opacity-80">{phase === 'FRAGMENTS' ? 'Phase 1' : 'Phase 2'}</div>
        </div>
      </div>

      <div
        ref={stageHostRef}
        className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative"
      >
        {/* 배경 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(244,235,217,0.12), rgba(244,235,217,0.30)), url('${BG}')`,
          }}
        />

        {/* 종이 → 비석으로 덮는 연출(고정 레이어) */}
        {paperAnim && (
          <div
            className="fixed z-[99999] pointer-events-none"
            style={{
              left: paperAnim.from.left,
              top: paperAnim.from.top,
              width: paperAnim.from.width,
              height: paperAnim.from.height,
              transformOrigin: 'top left',
              transform: paperAnim.animate
                ? `translate(${paperAnim.to.left - paperAnim.from.left}px, ${paperAnim.to.top - paperAnim.from.top}px) scale(${paperAnim.to.width / paperAnim.from.width}, ${paperAnim.to.height / paperAnim.from.height})`
                : 'translate(0px, 0px) scale(1, 1)',
              transition: 'transform 650ms cubic-bezier(.2,.9,.2,1), opacity 420ms ease',
              opacity: paperAnim.fadeOut ? 0 : 1,
            }}
          >
            <div className="w-full h-full rounded-2xl bg-white border-2 border-ink/25 shadow-paper p-3 overflow-hidden">
              <div className="text-[14px] font-black text-ink/80" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.25 }}>
                {paperAnim.text}
              </div>
            </div>
          </div>
        )}

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

        {/* 세로모드 캔버스(450x800)를 화면에 contain 스케일로 맞춤 */}
        <div className="absolute inset-0 grid place-items-center">
          <div
            className="relative"
            style={{
              width: `${BASE_W}px`,
              height: `${BASE_H}px`,
              transform: `scale(${stageScale})`,
              transformOrigin: 'center',
            }}
          >
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

            {/* 완성 축하 안내 (Phase1에서만) */}
            {allCollected && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="note-panel px-5 py-4 max-w-[420px]">
                  <div className="text-sm font-black">완성!</div>
                  <div className="mt-1 text-sm opacity-90">비희의 등에 비석을 다시 올려줬어.</div>
                </div>
              </div>
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
            {/* 세로 모드 스테이지 */}
            <div className="w-[min(460px,92%)] h-full max-h-[820px] flex flex-col gap-3">
              <div className="note-panel px-4 py-3">
                <div className="text-sm font-black">비석 글씨 새기기</div>
                <div className="mt-1 text-sm opacity-90 leading-relaxed">
                  하얀 종이에 글씨를 쓰고, 버튼을 눌러 비석에 새겨보자! (엔터로 줄바꿈 가능)
                </div>
              </div>

              <div className="flex-1 min-h-0 rounded-3xl border border-ink/20 bg-white/80 overflow-hidden relative">
                {/* 몸통만 표시 */}
                <img
                  src={STELE_BODY}
                  alt="비석 몸통"
                  className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_18px_40px_rgba(74,55,40,0.18)]"
                  draggable={false}
                />

                {/* 종이가 덮이는 목표 영역 */}
                <div ref={stoneTargetRef} className="absolute left-1/2 top-[22%] -translate-x-1/2 w-[72%] h-[34%]" />

                {/* 새겨진 글씨(음각 느낌) */}
                {engraved && (
                  <div className="absolute left-1/2 top-[22%] -translate-x-1/2 w-[72%] text-center engraveFx">
                  <div
                    className="text-[18px] md:text-[22px] font-black tracking-tight"
                    style={{
                      color: 'rgba(74,55,40,0.55)',
                      textShadow:
                        '1px 1px 0 rgba(255,255,255,0.35), -1px -1px 0 rgba(0,0,0,0.08), 0 2px 6px rgba(74,55,40,0.15)',
                      filter: 'contrast(1.05)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'keep-all',
                      lineHeight: 1.25,
                    }}
                  >
                    {engraved}
                  </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-2">
                {/* 하얀 종이(사용자 작성 영역) */}
                <div ref={paperRef} className="rounded-2xl bg-white border-2 border-ink/25 shadow-md p-3">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="예:\n문화유산 수호대 파이팅!\n우리 동네 유산을 지켜요!"
                    className="w-full min-h-[96px] bg-transparent text-sm font-black outline-none resize-none"
                    disabled={engraving || !!engraved}
                  />
                </div>
                <button
                  type="button"
                  onClick={startEngrave}
                  disabled={engraving || !!engraved}
                  className={[
                    'rounded-2xl px-4 py-3 font-black border shadow-md',
                    engraving || !!engraved
                      ? 'bg-paper/50 text-ink/40 cursor-not-allowed border-ink/20'
                      : 'bg-stamp text-white border-ink/25 hover:opacity-95',
                  ].join(' ')}
                >
                  {engraving ? '새기는 중…' : '비석에 새기기'}
                </button>
              </div>
            </div>
              </div>
            )}
          </div>
        </div>

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
