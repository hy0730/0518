import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import { useToast } from '../common/useToast';
import HanYangCoach from '../common/HanYangCoach';

type Phase = 'RUBBING' | 'LABEL';

type TagId = 'yongnyu' | 'dangjwa' | 'dangmok' | 'monk';

type DragState = {
  id: TagId;
  label: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const RUBBING_IMG = '/assets/images/relic_bell_rubbing.png';

const TAGS: { id: TagId; label: string }[] = [
  { id: 'yongnyu', label: '용뉴' },
  { id: 'dangjwa', label: '당좌' },
  { id: 'dangmok', label: '당목' },
  { id: 'monk', label: '스님' },
];

const ZONES: { id: TagId; label: string; xPct: number; yPct: number }[] = [
  { id: 'yongnyu', label: '용뉴', xPct: 55, yPct: 33 },
  { id: 'dangjwa', label: '당좌', xPct: 57, yPct: 65 },
  { id: 'dangmok', label: '당목', xPct: 10, yPct: 75 },
  { id: 'monk', label: '스님', xPct: 27, yPct: 55 },
];

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MaejongGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = stageTitle;

  const mainBg = useMemo(() => getRelicMainImage(stageId), [stageId]);
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('RUBBING');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // 공통 토스트(기존 1400ms 유지)
  const { toast, showToast } = useToast(1400);
  const [coachOpen, setCoachOpen] = useState(true);
  const coachText = useMemo(() => {
    if (phase === 'RUBBING') return '한: 화면을 문질러 탁본을 완성해보자!\n양: 종 모양이 충분히 드러나면 다음 단계로 넘어갈 수 있어.';
    return '한: 라벨을 끌어서 그림의 올바른 위치에 붙여보자!\n양: 4개를 모두 맞추면 성공이야!';
  }, [phase]);

  // Phase 1: 탁본(스크래치)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rubbingDone, setRubbingDone] = useState(false);
  const [scratching, setScratching] = useState(false);
  const [scratchRatio, setScratchRatio] = useState(0);
  const brushRadius = 36; // 30~40px
  const dpr = window.devicePixelRatio || 1;
  const W = 800;
  const H = 450;

  const scratchAt = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
  };

  const computeClearedRatio = () => {
    const c = canvasRef.current;
    if (!c) return 0;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    // sampling to reduce cost
    const step = 8;
    let total = 0;
    let cleared = 0;
    for (let y = 0; y < c.height; y += step) {
      for (let x = 0; x < c.width; x += step) {
        const idx = (y * c.width + x) * 4 + 3; // alpha
        total += 1;
        if (img[idx] < 20) cleared += 1; // almost transparent
      }
    }
    return total ? cleared / total : 0;
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#e5e7eb'; // 화선지 느낌 덮개
    ctx.fillRect(0, 0, W, H);
  }, [dpr]);

  const toCanvasXY = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    return { x, y };
  };

  const onScratchDown = (e: React.PointerEvent) => {
    if (phase !== 'RUBBING' || rubbingDone) return;
    startIfNeeded();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setScratching(true);
    audio.playUrl('/assets/sounds/sfx_brush.mp3', 0.4);
    const { x, y } = toCanvasXY(e);
    scratchAt(x, y);
  };
  const onScratchMove = (e: React.PointerEvent) => {
    if (!scratching) return;
    const { x, y } = toCanvasXY(e);
    scratchAt(x, y);
  };
  const onScratchUp = () => {
    if (!scratching) return;
    setScratching(false);
    const ratio = computeClearedRatio();
    setScratchRatio(ratio);
    if (ratio >= 0.75) {
      setRubbingDone(true);
      showToast('탁본 완성!');
      audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.9);
      // 덮개 완전 제거 → Phase2
      window.setTimeout(() => setPhase('LABEL'), 700);
    }
  };

  // Phase 2: 라벨 드래그 앤 드롭
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [placed, setPlaced] = useState<Record<TagId, boolean>>({
    yongnyu: false,
    dangjwa: false,
    dangmok: false,
    monk: false,
  });
  const allPlaced = placed.yongnyu && placed.dangjwa && placed.dangmok && placed.monk;
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragThreshold = 3;

  const [choices] = useState(() => shuffle(TAGS.map((t) => t.id)));
  const [shake, setShake] = useState(false);
  const [glow, setGlow] = useState(false);
  const [resultModal, setResultModal] = useState(false);

  const startDrag = (e: React.PointerEvent, id: TagId) => {
    if (phase !== 'LABEL') return;
    if (placed[id]) return;
    startIfNeeded();
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const label = TAGS.find((t) => t.id === id)?.label ?? id;
    setDrag({
      id,
      label,
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

  const placeIfCorrect = (tagId: TagId, zoneId: string | null) => {
    if (!zoneId) return false;
    if (zoneId !== tagId) return false;
    setPlaced((prev) => ({ ...prev, [tagId]: true }));
    audio.playSfx('correct', 0.75);
    return true;
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const ended = drag;
    setDrag(null);
    if (phase !== 'LABEL') return;

    // 클릭으로도 시도 가능: 가장 가까운 zone에 자동 투입(사용성 개선)
    if (!ended.moved) {
      // 가장 앞 빈 zone을 찾고, 정답이면 채움
      const firstEmpty = ZONES.find((z) => !placed[z.id]);
      if (firstEmpty && firstEmpty.id === ended.id) {
        placeIfCorrect(ended.id, firstEmpty.id);
        return;
      }
      setAttempts((a) => a + 1);
      setShake(true);
      audio.playSfx('wrong', 0.75);
      window.setTimeout(() => setShake(false), 420);
      return;
    }

    const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const zoneId = elUnder?.closest?.('[data-zone]')?.getAttribute('data-zone') ?? null;
    const ok = placeIfCorrect(ended.id, zoneId);
    if (!ok) {
      setAttempts((a) => a + 1);
      setShake(true);
      audio.playSfx('wrong', 0.75);
      window.setTimeout(() => setShake(false), 420);
    }
  };

  useEffect(() => {
    if (phase !== 'LABEL') return;
    if (!allPlaced) return;
    setGlow(true);
    audio.playUrl('/assets/sounds/sfx_gong.mp3', 0.95); // "댕~" 느낌
    const t = window.setTimeout(() => setResultModal(true), 650);
    return () => window.clearTimeout(t);
  }, [phase, allPlaced]);

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
        <div className="text-xs font-bold opacity-80">{phase === 'RUBBING' ? 'Phase 1' : 'Phase 2'}</div>
      </div>

      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        {/* 배경(종/탁본) */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(244,235,217,0.10), rgba(244,235,217,0.30)), url('${mainBg || RUBBING_IMG}')`,
          }}
        />

        {coachOpen && (
          <div className="absolute left-3 top-14 z-[9000]">
            <HanYangCoach title="한·양 설명" text={coachText} onClose={() => setCoachOpen(false)} />
          </div>
        )}

        {phase === 'RUBBING' ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative w-[800px] h-[450px] bg-paper/40">
              {/* 탁본 이미지가 너무 확대(cover)되어 보이지 않도록 contain으로 전체를 보여줌 */}
              <img src={RUBBING_IMG} alt="탁본 이미지" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
              {/* 덮개 캔버스 */}
              {!rubbingDone && (
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 touch-none"
                  onPointerDown={onScratchDown}
                  onPointerMove={onScratchMove}
                  onPointerUp={onScratchUp}
                  onPointerCancel={onScratchUp}
                />
              )}
              {/* 안내 */}
              <div className="absolute left-3 top-3 note-panel px-3 py-2">
                <div className="text-xs font-black">탁본 뜨기</div>
                <div className="mt-1 text-xs opacity-85">문질러서 종 모양을 드러내보자! (약 {Math.round(scratchRatio * 100)}%)</div>
              </div>
            </div>
          </div>
        ) : (
          <div ref={boardRef} className="absolute inset-0 p-3">
            <div className="h-full grid grid-cols-[1fr_260px] gap-3">
              {/* 종 이미지 + 드롭존 */}
              <div className={['relative rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden', shake ? 'shakeFx' : ''].join(' ')}>
                <img src={RUBBING_IMG} alt="마애종" className="absolute inset-0 w-full h-full object-cover" draggable={false} />

                {/* 황금빛 글로우 */}
                {glow && <div className="absolute inset-0 bg-gradient-to-b from-amber-200/14 to-transparent animate-pulse pointer-events-none" />}

                {ZONES.map((z) => (
                  <div
                    key={z.id}
                    data-zone={z.id}
                    className={[
                      'absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-dashed',
                      // 정답을 넣어야 하는 외곽선이 배경에 묻히지 않도록 대비/두께/광택 강화
                      placed[z.id]
                        ? 'border-olive/80 bg-olive/18 ring-2 ring-olive/35'
                        : 'border-white/90 bg-paper/30 ring-2 ring-ink/25 shadow-[0_0_0_2px_rgba(0,0,0,0.18),0_8px_18px_rgba(0,0,0,0.18)]',
                      !placed[z.id] ? 'animate-pulse' : '',
                    ].join(' ')}
                    style={{ left: `${z.xPct}%`, top: `${z.yPct}%` }}
                  >
                    <div className="absolute inset-0 grid place-items-center text-[11px] font-black">
                      {placed[z.id] ? z.label : ''}
                    </div>
                  </div>
                ))}
              </div>

              {/* 태그 영역 */}
              <div className="rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-2">
                <div className="text-sm font-black">구조 맞추기</div>
                <div className="text-[11px] opacity-80">태그를 끌어다 알맞은 위치에 놓아보자.</div>
                <div className="mt-2 grid gap-2">
                  {choices.map((id) => {
                    const label = TAGS.find((t) => t.id === id)?.label ?? id;
                    const disabled = placed[id] || glow;
                    return (
                      <div
                        key={id}
                        className={[
                          'rounded-2xl border border-ink/25 bg-paper2/90 shadow-md px-3 py-3 font-black cursor-grab active:cursor-grabbing touch-none select-none',
                          disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-paper2',
                        ].join(' ')}
                        onPointerDown={(e) => startDrag(e, id)}
                        onPointerMove={updateDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        title="드래그 또는 클릭"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 z-[9000] pointer-events-none">
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
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
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{drag.label}</div>
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
              <div className="text-lg font-black">성공! 마애종 구조 완성</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                성공! 탁본을 뜨고 구조를 분석하면서 석수동 마애종의 특징을 더 자세히 알게 되었어요!
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
