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
  const title = `${stageTitle} · 안양사 귀부`;

  const [phase, setPhase] = useState<Phase>('FRAGMENTS');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // Phase1
  const [collected, setCollected] = useState<Record<FragmentId, boolean>>({ f1: false, f2: false, f3: false });
  const allCollected = collected.f1 && collected.f2 && collected.f3;
  const dropRef = useRef<HTMLDivElement | null>(null);

  // Drag
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragThreshold = 3;

  const startDrag = (e: React.PointerEvent, f: { id: FragmentId; label: string; img: string }) => {
    if (phase !== 'FRAGMENTS') return;
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
    const t = window.setTimeout(() => setPhase('ENGRAVE'), 600);
    return () => window.clearTimeout(t);
  }, [phase, allCollected]);

  // Phase2
  const [input, setInput] = useState('');
  const [engraved, setEngraved] = useState<string | null>(null);
  const [engraving, setEngraving] = useState(false);
  const [resultModal, setResultModal] = useState(false);

  const engrave = () => {
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

        {phase === 'FRAGMENTS' ? (
          <div className="absolute inset-0 p-3">
            {/* 말풍선 */}
            <div className="absolute left-1/2 top-3 -translate-x-1/2 w-[min(520px,92%)] popInFx">
              <div className="note-panel px-4 py-3">
                <div className="text-sm font-black">비희(거북이)의 소원</div>
                <div className="mt-1 text-sm opacity-90 leading-relaxed">
                  앗, 내 등에 있던 비석이 깨져버렸어! 나는 무거운 걸 짊어지는 걸 좋아하는데… 흩어진 비석 조각들을 찾아줘!
                </div>
              </div>
            </div>

            {/* 귀부(비석 없음) */}
            <div className="absolute left-1/2 bottom-2 -translate-x-1/2 w-[min(520px,88%)]">
              <img src={GUIBU_EMPTY} alt="귀부" className="w-full object-contain drop-shadow-[0_18px_40px_rgba(74,55,40,0.18)]" draggable={false} />
              {/* Drop Zone: 거북이 등 */}
              <div
                ref={dropRef}
                className={[
                  'absolute left-1/2 top-[10%] -translate-x-1/2 w-[58%] h-[34%] rounded-3xl border-2 border-dashed',
                  'border-ink/30 bg-paper/40',
                  allCollected ? 'ring-2 ring-amber-300/60' : '',
                ].join(' ')}
                title="여기로 비석 조각을 모아보자!"
              >
                <div className="absolute inset-0 grid place-items-center text-xs font-black opacity-80">
                  {allCollected ? '조각을 모두 모았어!' : `조각 모으기 ${Object.values(collected).filter(Boolean).length}/3`}
                </div>
              </div>
            </div>

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
          <div className="absolute inset-0 p-3 flex flex-col gap-3">
            <div className="note-panel px-4 py-3">
              <div className="text-sm font-black">천년의 비석 완성하기</div>
              <div className="mt-1 text-sm opacity-90 leading-relaxed">
                조상님들은 후대에 남기고 싶은 중요한 내용을 돌에 새겼어요. 여러분이 비석에 남기고 싶은 말을 적어보세요!
              </div>
            </div>

            <div className="flex-1 min-h-0 rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden relative">
              <img
                src={GUIBU_FULL}
                alt="완성된 귀부"
                className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_20px_45px_rgba(74,55,40,0.20)]"
                draggable={false}
              />

              {/* 새긴 글씨(음각 느낌) */}
              {engraved && (
                <div className="absolute left-1/2 top-[34%] -translate-x-1/2 w-[70%] text-center engraveFx">
                  <div
                    className="text-[22px] md:text-[26px] font-black tracking-tight"
                    style={{
                      color: 'rgba(74,55,40,0.55)',
                      textShadow:
                        '1px 1px 0 rgba(255,255,255,0.35), -1px -1px 0 rgba(0,0,0,0.08), 0 2px 6px rgba(74,55,40,0.15)',
                      filter: 'contrast(1.05)',
                    }}
                  >
                    {engraved}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="예: 수호대 파이팅!"
                  className="flex-1 rounded-2xl border-2 border-ink/25 bg-paper2 px-3 py-3 text-sm font-bold outline-none"
                  disabled={engraving || !!engraved}
                />
                <button
                  type="button"
                  onClick={engrave}
                  disabled={engraving || !!engraved}
                  className={[
                    'rounded-2xl px-4 py-3 font-black border shadow-md',
                    engraving || !!engraved ? 'bg-paper/50 text-ink/40 cursor-not-allowed border-ink/20' : 'bg-stamp text-white border-ink/25 hover:opacity-95',
                  ].join(' ')}
                >
                  {engraving ? '새기는 중…' : '비석에 새기기'}
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

