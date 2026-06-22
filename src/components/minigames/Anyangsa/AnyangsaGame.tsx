import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { useGameStore } from '../../../store/useGameStore';
import { audio } from '../../../utils/audio';
import { useToast } from '../common/useToast';
import { useGameTuning } from '../../common/GameTuningContext';
import HanYangCoach from '../common/HanYangCoach';
import MasterDraggableWrapper from '../../common/MasterDraggableWrapper';

type Phase = 'PUZZLE' | 'ENGRAVE';
type PieceId = number;
type Point = { x: number; y: number };

type PolygonBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

type AbsoluteRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PuzzlePieceShape = {
  id: PieceId;
  polygon: Point[];
  tray: { x: number; y: number; rotation: number };
};

type PuzzlePieceDef = PuzzlePieceShape & {
  box: PolygonBox;
  localPolygon: string;
};

const BG = '/assets/images/relic_turtle_main.png';
const REAL = '/assets/images/relic_turtle_real.png';

const GUIBU_EMPTY = '/assets/images/relic_gwibu_base_front.png';
const GUIBU_FULL = '/assets/images/relic_gwibu_complete.png';
const STELE_BODY = '/assets/images/relic_gwibu_body.png';
const MAX_INSCRIBE_CHARS = 32;

const PUZZLE_BASE_W = 800;
const PUZZLE_BASE_H = 450;
const SLOT_W = 120;
const SLOT_H = 100;
const SNAP_THRESHOLD = 42;
const ARTIFACT_W = 334;
const ARTIFACT_H = 312;
const BODY_TARGET = { x: 98, y: 8, w: 138, h: 248 };
const TRAY_W = 378;
const TRAY_H = 172;
const BASE_IMAGE_H = 150;
const EMPTY_BASE_W = 304;

const CRACK_LINES = [
  { left: '12%', top: '18%', width: '44%', rotate: 21 },
  { left: '39%', top: '31%', width: '30%', rotate: -34 },
  { left: '22%', top: '51%', width: '48%', rotate: 14 },
  { left: '50%', top: '61%', width: '24%', rotate: -46 },
  { left: '16%', top: '74%', width: '36%', rotate: -7 },
];

function getPolygonBox(points: Point[]): PolygonBox {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    minX, minY, maxX, maxY,
    width: Math.max(0.0001, maxX - minX),
    height: Math.max(0.0001, maxY - minY),
  };
}

function toLocalPolygon(points: Point[], box: PolygonBox) {
  return points
    .map((p) => `${(((p.x - box.minX) / box.width) * 100).toFixed(2)}% ${(((p.y - box.minY) / box.height) * 100).toFixed(2)}%`)
    .join(', ');
}

const PUZZLE_PIECES: PuzzlePieceDef[] = [
  { id: 1, polygon: [{x:0,y:0},{x:30,y:0},{x:34,y:8},{x:31,y:16},{x:36,y:22},{x:28,y:26},{x:20,y:34},{x:12,y:32},{x:8,y:27},{x:0,y:18}], tray: {x:18,y:18,rotation:-16} },
  { id: 2, polygon: [{x:30,y:0},{x:62,y:0},{x:66,y:9},{x:63,y:17},{x:68,y:24},{x:60,y:29},{x:48,y:33},{x:36,y:22},{x:31,y:16},{x:34,y:8}], tray: {x:134,y:8,rotation:11} },
  { id: 3, polygon: [{x:62,y:0},{x:100,y:0},{x:100,y:52},{x:93,y:55},{x:90,y:61},{x:80,y:64},{x:72,y:60},{x:66,y:50},{x:68,y:24},{x:63,y:17},{x:66,y:9}], tray: {x:252,y:20,rotation:-9} },
  { id: 4, polygon: [{x:0,y:18},{x:8,y:27},{x:12,y:32},{x:20,y:34},{x:23,y:45},{x:29,y:50},{x:27,y:61},{x:31,y:69},{x:25,y:78},{x:17,y:84},{x:10,y:92},{x:0,y:90},{x:0,y:100},{x:38,y:100},{x:42,y:86},{x:38,y:73},{x:40,y:63},{x:29,y:50},{x:28,y:26},{x:20,y:34}], tray: {x:88,y:94,rotation:8} },
  { id: 5, polygon: [{x:29,y:50},{x:40,y:63},{x:38,y:73},{x:42,y:86},{x:38,y:100},{x:100,y:100},{x:100,y:52},{x:93,y:55},{x:90,y:61},{x:80,y:64},{x:72,y:60},{x:66,y:50},{x:68,y:24},{x:60,y:29},{x:48,y:33},{x:36,y:22},{x:28,y:26},{x:20,y:34}], tray: {x:214,y:94,rotation:14} },
].map((piece) => {
  const box = getPolygonBox(piece.polygon);
  return { ...piece, box, localPolygon: toLocalPolygon(piece.polygon, box) };
});

// 각 파편별 튜닝 키 매핑
const PIECE_TUNE_KEYS: Record<PieceId, { xKey: string; yKey: string }> = {
  1: { xKey: 'piece1X', yKey: 'piece1Y' },
  2: { xKey: 'piece2X', yKey: 'piece2Y' },
  3: { xKey: 'piece3X', yKey: 'piece3Y' },
  4: { xKey: 'piece4X', yKey: 'piece4Y' },
  5: { xKey: 'piece5X', yKey: 'piece5Y' },
};

function PuzzlePiece({
  piece,
  home,
  target,
  targetSize,
  bodySize,
  homeScale,
  homeSize,
  dimmed,
  placed,
  disabled,
  scale,
  threshold,
  showGlow,
  onPlaced,
  editorMode,
  onEditorDragEnd,
  getTargetClientRect,
  snapOffset,
}: {
  piece: PuzzlePieceDef;
  home: Point;
  target: Point;
  targetSize: { w: number; h: number };
  bodySize: { w: number; h: number };
  homeScale: number;
  homeSize: { w: number; h: number };
  dimmed: boolean;
  placed: boolean;
  disabled: boolean;
  scale: number;
  threshold: number;
  showGlow: boolean;
  onPlaced: (id: PieceId) => void;
  editorMode: boolean;
  onEditorDragEnd?: (finalX: number, finalY: number) => void;
  getTargetClientRect?: () => AbsoluteRect | null;
  snapOffset?: Point;
}) {
  const pieceRef = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(piece.tray.rotation);

  // home 위치가 Inspector에 의해 변경될 때 motionValue를 보정하여 시각적 위치 유지
  const prevHomeRef = useRef(home);
  useEffect(() => {
    const dx = prevHomeRef.current.x - home.x;
    const dy = prevHomeRef.current.y - home.y;
    if (dx !== 0 || dy !== 0) {
      x.set(x.get() + dx);
      y.set(y.get() + dy);
    }
    prevHomeRef.current = home;
  }, [home.x, home.y, x, y]);

  const toSlotX = target.x - home.x;
  const toSlotY = target.y - home.y;
  const renderScale = placed ? 1 : homeScale;
  const renderW = placed ? targetSize.w : homeSize.w;
  const renderH = placed ? targetSize.h : homeSize.h;
  const fullImgW = bodySize.w * renderScale;
  const fullImgH = bodySize.h * renderScale;
  const offsetLeft = -((piece.box.minX / 100) * bodySize.w * renderScale);
  const offsetTop = -((piece.box.minY / 100) * bodySize.h * renderScale);

  useEffect(() => {
    if (placed) {
      animate(x, toSlotX, { type: 'spring', stiffness: 520, damping: 34 });
      animate(y, toSlotY, { type: 'spring', stiffness: 520, damping: 34 });
      animate(rotate, 0, { type: 'spring', stiffness: 420, damping: 32 });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 });
      animate(y, 0, { type: 'spring', stiffness: 520, damping: 34 });
      animate(rotate, piece.tray.rotation, { type: 'spring', stiffness: 380, damping: 30 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, piece.tray.rotation, rotate, toSlotX, toSlotY]);

  // 에디터 모드: 자체 drag로 위치 저장, 일반 모드: placed/disabled 확인
  const canDrag = editorMode ? (!placed && !disabled) : (!placed && !disabled);

  return (
    <motion.div
      ref={pieceRef}
      className={[
        'absolute',
        placed ? 'cursor-default' : editorMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-grab active:cursor-grabbing',
      ].join(' ')}
      style={{
        left: home.x,
        top: home.y,
        width: renderW,
        height: renderH,
        x,
        y,
        rotate,
        touchAction: 'none',
        opacity: dimmed ? 0 : 1,
        transition: 'opacity 220ms ease',
        zIndex: placed ? 120 + piece.id : 300 + piece.id,
        willChange: 'transform, opacity',
        transformOrigin: 'center center',
      }}
      drag={canDrag}
      dragMomentum={false}
      dragElastic={0.08}
      whileDrag={{ zIndex: 100 }}
      onDragEnd={() => {
        if (placed || disabled) return;
        // 에디터 모드: 위치 저장만
        if (editorMode) {
          if (onEditorDragEnd) {
            const finalX = home.x + x.get();
            const finalY = home.y + y.get();
            onEditorDragEnd(finalX, finalY);
          }
          return;
        }
        const px = home.x + x.get();
        const py = home.y + y.get();
        const pieceRect = pieceRef.current?.getBoundingClientRect();
        const targetRect = getTargetClientRect?.() ?? null;
        const dist = pieceRect && targetRect
          ? Math.hypot(
              pieceRect.left + pieceRect.width / 2 - (targetRect.left + targetRect.width / 2),
              pieceRect.top + pieceRect.height / 2 - (targetRect.top + targetRect.height / 2)
            )
          : Math.hypot(px - target.x, py - target.y);
        const snapThreshold = pieceRect
          ? threshold * Math.max(scale, 0.0001)
          : threshold;
        if (dist <= snapThreshold) {
          onPlaced(piece.id);
          const snapX = toSlotX + (snapOffset?.x ?? 0);
          const snapY = toSlotY + (snapOffset?.y ?? 0);
          animate(x, snapX, { type: 'spring', stiffness: 620, damping: 36 });
          animate(y, snapY, { type: 'spring', stiffness: 620, damping: 36 });
          animate(rotate, 0, { type: 'spring', stiffness: 420, damping: 32 });
        } else {
          audio.playSfx('wrong', 0.65);
          animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 });
          animate(y, 0, { type: 'spring', stiffness: 520, damping: 34 });
          animate(rotate, piece.tray.rotation, { type: 'spring', stiffness: 380, damping: 30 });
        }
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          clipPath: `polygon(${piece.localPolygon})`,
          WebkitClipPath: `polygon(${piece.localPolygon})`,
          filter: showGlow
            ? 'drop-shadow(0 0 12px rgba(251, 191, 36, 0.42)) drop-shadow(0 9px 10px rgba(33, 25, 18, 0.34))'
            : 'drop-shadow(0 7px 8px rgba(33, 25, 18, 0.34)) drop-shadow(0 1px 0 rgba(255,255,255,0.15))',
          willChange: 'transform, filter',
        }}
      >
        <img
          src={STELE_BODY}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none pointer-events-none"
          style={{
            left: offsetLeft,
            top: offsetTop,
            width: fullImgW,
            height: fullImgH,
            objectFit: 'fill',
            userSelect: 'none',
          }}
        />
      </div>
    </motion.div>
  );
}

export default function AnyangsaGame({ stageId, onComplete, regionData }: MinigameProps) {
  const isDevMode = useGameStore((s) => s.isDevMode);
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = stageTitle;

  const [phase, setPhase] = useState<Phase>('PUZZLE');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => { if (!startedAt) setStartedAt(Date.now()); };

  const [introStatus, setIntroStatus] = useState<'SHOW' | 'FADE' | 'DONE'>('SHOW');
  const introTimerRef = useRef<number | null>(null);
  useEffect(() => { return () => { if (introTimerRef.current) window.clearTimeout(introTimerRef.current); }; }, []);

  const { toast, showToast } = useToast(1400);
  const [coachOpen, setCoachOpen] = useState(true);
  const coachText = useMemo(() => {
    if (phase === 'PUZZLE') return '한: 바닥에 흩어진 파편 5개를 맞춰 깨진 비석을 복원해보자!\n양: 실루엣 가까이 가져가면 묵직하게 착 붙을 거야.';
    return '한: 마지막으로 비문을 새겨 넣어 소원을 완성하자.\n양: 글자를 다 새기면 성공이야!';
  }, [phase]);

  const [placedPieces, setPlacedPieces] = useState<PieceId[]>([]);
  const [puzzleCompleted, setPuzzleCompleted] = useState(false);
  const [puzzleCompleteOverlay, setPuzzleCompleteOverlay] = useState(false);
  const [slotGlow, setSlotGlow] = useState<Record<number, boolean>>({});
  const artifactFxRef = useRef<HTMLDivElement | null>(null);

  const tuning = useGameTuning();
  const visualEditorOn = !!tuning?.masterEditorOpen;
  const puzzleLayout = useMemo(() => {
    const get = (k: string, fallback: number) => tuning?.getNumber(k, fallback) ?? fallback;
    return {
      headerX: get('headerX', 24),
      headerY: get('headerY', 12),
      headerScale: get('headerScale', 1),
      boardX: get('boardX', 246),
      boardY: get('boardY', 34),
      boardScale: get('boardScale', 1),
      invX: get('invX', 26),
      invY: get('invY', 236),
      inventoryScale: get('inventoryScale', 1),
      slotW: get('slotW', SLOT_W),
      slotH: get('slotH', SLOT_H),
      pieceScale: get('pieceScale', 1),
      invW: get('invW', TRAY_W),
      invH: get('invH', TRAY_H),
      snapOffsetDx: get('snapOffsetDx', 0),
      snapOffsetDy: get('snapOffsetDy', 0),
      // 개별 파편 오프셋
      piece1X: get('piece1X', 0),
      piece1Y: get('piece1Y', 0),
      piece2X: get('piece2X', 0),
      piece2Y: get('piece2Y', 0),
      piece3X: get('piece3X', 0),
      piece3Y: get('piece3Y', 0),
      piece4X: get('piece4X', 0),
      piece4Y: get('piece4Y', 0),
      piece5X: get('piece5X', 0),
      piece5Y: get('piece5Y', 0),
    };
  }, [tuning]);

  const puzzleViewportRef = useRef<HTMLDivElement | null>(null);
  const puzzleCanvasRef = useRef<HTMLDivElement | null>(null);
  const targetSlotRefs = useRef<Partial<Record<PieceId, HTMLDivElement | null>>>({});
  const [puzzleScale, setPuzzleScale] = useState(1);
  useLayoutEffect(() => {
    const el = puzzleViewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const s = Math.min(r.width / PUZZLE_BASE_W, r.height / PUZZLE_BASE_H);
      setPuzzleScale(Number.isFinite(s) && s > 0 ? s : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const completeImgDx = tuning?.getNumber('completeImgDx', 0) ?? 0;
  const completeImgDy = tuning?.getNumber('completeImgDy', 0) ?? 0;
  const completeImgScale = tuning?.getNumber('completeImgScale', 1) ?? 1;
  const completePopupDx = tuning?.getNumber('completePopupDx', 0) ?? 0;
  const completePopupDy = tuning?.getNumber('completePopupDy', 0) ?? 0;
  const completePopupScale = tuning?.getNumber('completePopupScale', 1) ?? 1;
  const [completeAdjustOpen, setCompleteAdjustOpen] = useState(false);

  useEffect(() => { if (!isDevMode) setCompleteAdjustOpen(false); }, [isDevMode]);

  const inventoryPieces = useMemo(() => PUZZLE_PIECES, []);

  const onPlacePiece = (id: PieceId) => {
    setPlacedPieces((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSlotGlow((prev) => ({ ...prev, [id]: true }));
    window.setTimeout(() => setSlotGlow((prev) => ({ ...prev, [id]: false })), 320);
    audio.playUrl('/assets/sounds/sfx_stone_hit.mp3', 0.86);
    artifactFxRef.current?.animate(
      [
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
        { transform: 'translate3d(-5px, 3px, 0) rotate(-0.55deg)' },
        { transform: 'translate3d(6px, -2px, 0) rotate(0.45deg)' },
        { transform: 'translate3d(-3px, 1px, 0) rotate(-0.2deg)' },
        { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
      ],
      { duration: 280, easing: 'ease-out' }
    );
  };

  useEffect(() => {
    if (phase !== 'PUZZLE') return;
    if (placedPieces.length !== 5) return;
    if (puzzleCompleted) return;
    setPuzzleCompleted(true);
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    showToast('비석 복원 완료!');
    window.setTimeout(() => setPuzzleCompleteOverlay(true), 680);
  }, [phase, placedPieces, puzzleCompleted, showToast]);

  const [input, setInput] = useState('');
  const [engraved, setEngraved] = useState<string | null>(null);
  const [engraving, setEngraving] = useState(false);
  const [resultModal, setResultModal] = useState(false);
  const INSCRIBE_BOX_SIZE = { widthPct: 30, heightPct: 40 };
  const INSCRIBE_BOX_POS = { topPct: 30, rightPct: 34 };
  const lineCount = useMemo(() => (engraved ?? input).split('\n').length, [engraved, input]);
  const fontScale = useMemo(() => (lineCount > 5 ? 5 / lineCount : 1), [lineCount]);
  const inscribeFontPx = useMemo(() => Math.max(12, Math.round(22 * fontScale)), [fontScale]);

  const finishEngrave = () => {
    startIfNeeded();
    if (phase !== 'ENGRAVE') return;
    const text = input.trim();
    if (!text) { setAttempts((a) => a + 1); audio.playSfx('wrong', 0.7); return; }
    setEngraving(true);
    audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.9);
    setTimeout(() => audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.8), 260);
    setTimeout(() => audio.playUrl('/assets/sounds/sfx_hit.mp3', 0.75), 520);
    setTimeout(() => {
      setEngraved(text); setEngraving(false);
      audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
      setTimeout(() => setResultModal(true), 520);
    }, 900);
  };

  return (
    <div className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes popIn { 0% { transform: translateY(6px) scale(0.98); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .popInFx { animation: popIn 280ms ease-out both; }
        @keyframes engraveIn { 0% { transform: translateY(6px) scale(0.98); opacity: 0; filter: blur(1px); } 100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); } }
        .engraveFx { animation: engraveIn 520ms ease-out both; }
        @keyframes crackGlow { 0% { opacity: 0; filter: blur(4px); } 22% { opacity: 1; filter: blur(0.4px); } 68% { opacity: 0.92; filter: blur(0); } 100% { opacity: 0; filter: blur(2px); } }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-80">{phase === 'PUZZLE' ? 'Phase 1' : 'Phase 2'}</div>
      </div>

      <div className="mt-2 flex-1 min-h-0 rounded-3xl border border-ink/30 bg-paper2/90 shadow-paper overflow-hidden relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(244,235,217,0.12), rgba(244,235,217,0.30)), url('${BG}')` }} />

        {introStatus === 'DONE' && coachOpen && (
          <div className="absolute left-3 top-3 z-[9000]">
            <HanYangCoach title="한·양 설명" text={coachText} onClose={() => setCoachOpen(false)} />
          </div>
        )}

        {introStatus !== 'DONE' && (
          <button type="button" className={['absolute inset-0 z-[12000] p-4 text-left', 'transition-opacity duration-700', introStatus === 'FADE' ? 'opacity-0 pointer-events-none' : 'opacity-100'].join(' ')}
            onClick={() => { if (introStatus !== 'SHOW') return; startIfNeeded(); audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75); setIntroStatus('FADE'); introTimerRef.current = window.setTimeout(() => setIntroStatus('DONE'), 720); }}
            onTouchStart={() => { if (introStatus !== 'SHOW') return; startIfNeeded(); audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75); setIntroStatus('FADE'); introTimerRef.current = window.setTimeout(() => setIntroStatus('DONE'), 720); }}
          >
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${BG}')` }} />
            <div className="absolute inset-0 bg-ink/35" />
            <div className="relative z-10 h-full grid place-items-center">
              <div className="note-panel max-w-[620px] px-5 py-4">
                <div className="text-lg font-black">비희(거북이)의 소원</div>
                <div className="mt-2 text-sm opacity-90 leading-relaxed">앗, 내 등에 있던 비석이 깨져버렸어!<br />흩어진 비석 파편 5개를 맞춰서 비석을 다시 복원해줘!</div>
                <div className="mt-3 text-sm font-black text-stamp">화면을 터치하면 시작해요.</div>
              </div>
            </div>
          </button>
        )}

        {phase === 'PUZZLE' ? (
          <div ref={puzzleViewportRef} className="absolute inset-0" style={{ touchAction: 'none' }}>
            <div ref={puzzleCanvasRef} className="absolute left-1/2 top-1/2" style={{ width: PUZZLE_BASE_W, height: PUZZLE_BASE_H, transformOrigin: 'top left', transform: `translate(-50%, -50%) scale(${puzzleScale})` }}>
              {(() => {
                const clampNum = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
                const boardScale = puzzleLayout.boardScale;
                const inventoryScale = puzzleLayout.inventoryScale;
                const boardWorldScale = boardScale * boardScale;
                const inventoryWorldScale = inventoryScale * inventoryScale;
                const artifactW = ARTIFACT_W * boardScale;
                const artifactH = ARTIFACT_H * boardScale;
                const bodyLocalX = BODY_TARGET.x * boardScale;
                const bodyLocalY = BODY_TARGET.y * boardScale;
                const bodyW = BODY_TARGET.w * boardScale;
                const bodyH = BODY_TARGET.h * boardScale;
                const bodyX = puzzleLayout.boardX + BODY_TARGET.x * boardWorldScale;
                const bodyY = puzzleLayout.boardY + BODY_TARGET.y * boardWorldScale;
                const bodyWorldW = BODY_TARGET.w * boardWorldScale;
                const bodyWorldH = BODY_TARGET.h * boardWorldScale;
                const trayW = puzzleLayout.invW * inventoryScale;
                const trayH = puzzleLayout.invH * inventoryScale;
                const trayScaleBase = ((puzzleLayout.slotW / SLOT_W + puzzleLayout.slotH / SLOT_H) / 2) * 0.58 * puzzleLayout.pieceScale;
                const trayPieceScale = clampNum(trayScaleBase, 0.46, 0.86);

                const getTargetRect = (piece: PuzzlePieceDef) => ({
                  localX: (piece.box.minX / 100) * bodyW,
                  localY: (piece.box.minY / 100) * bodyH,
                  width: (piece.box.width / 100) * bodyW,
                  height: (piece.box.height / 100) * bodyH,
                  globalX: bodyX + (piece.box.minX / 100) * bodyWorldW,
                  globalY: bodyY + (piece.box.minY / 100) * bodyWorldH,
                  globalWidth: (piece.box.width / 100) * bodyWorldW,
                  globalHeight: (piece.box.height / 100) * bodyWorldH,
                });

                return (
                  <>
                    <MasterDraggableWrapper
                      enabled={visualEditorOn}
                      x={puzzleLayout.headerX}
                      y={puzzleLayout.headerY}
                      dragScale={puzzleScale}
                      scale={puzzleLayout.headerScale}
                      scaleRange={{ min: 0.4, max: 2.5, step: 0.05 }}
                      onScaleChange={(next) => tuning?.setNumber('headerScale', next)}
                      onPositionChange={(nextX, nextY) => { tuning?.setNumber('headerX', Math.round(nextX)); tuning?.setNumber('headerY', Math.round(nextY)); }}
                      className="rounded-2xl"
                    >
                      <div className={['rounded-2xl border border-ink/20 bg-paper2/80 px-4 py-3 shadow-paper', visualEditorOn ? 'ring-2 ring-amber-300/70' : ''].join(' ')}
                        style={{ transform: `scale(${puzzleLayout.headerScale})`, transformOrigin: 'top left', touchAction: 'none', pointerEvents: 'auto' }}
                      >
                        <div className="text-sm font-black">5조각 파편 복원</div>
                        <div className="mt-1 text-[12px] font-bold opacity-80">깨진 돌 파편을 끌어와 귀부 위 실루엣에 맞춰보자. 가까워지면 묵직하게 들어맞아요.</div>
                      </div>
                    </MasterDraggableWrapper>

                    <MasterDraggableWrapper
                      enabled={visualEditorOn}
                      x={puzzleLayout.boardX}
                      y={puzzleLayout.boardY}
                      dragScale={puzzleScale}
                      scale={puzzleLayout.boardScale}
                      scaleRange={{ min: 0.5, max: 2.5, step: 0.05 }}
                      onScaleChange={(next) => tuning?.setNumber('boardScale', next)}
                      onPositionChange={(nextX, nextY) => { tuning?.setNumber('boardX', Math.round(nextX)); tuning?.setNumber('boardY', Math.round(nextY)); }}
                      className="rounded-[28px]"
                      style={{ width: artifactW, height: artifactH }}
                    >
                      <div className="relative" style={{ width: artifactW, height: artifactH, touchAction: 'none', pointerEvents: 'auto' }}>
                        {tuning?.innerTunerOpen && !tuning.locked && !visualEditorOn && (
                          <div className="absolute inset-0 rounded-2xl ring-2 ring-sky-300/60 bg-sky-100/10 pointer-events-none" />
                        )}
                        <div ref={artifactFxRef} className="absolute inset-0 pointer-events-none">
                          <img src={GUIBU_FULL} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain opacity-20" style={{ filter: 'grayscale(0.32) saturate(0.7) brightness(0.72)' }} />
                          <img src={GUIBU_EMPTY} alt="" draggable={false} className="absolute left-1/2 object-contain" style={{ bottom: 0, width: EMPTY_BASE_W * boardScale, height: BASE_IMAGE_H * boardScale, transform: 'translateX(-50%)', filter: 'drop-shadow(0 14px 24px rgba(40, 28, 20, 0.26))' }} />
                          <div className="absolute rounded-[28px]" style={{ left: bodyLocalX, top: bodyLocalY, width: bodyW, height: bodyH, background: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.12), rgba(46,34,24,0.12) 60%, rgba(21,16,12,0.22))', boxShadow: 'inset 0 0 0 1px rgba(73,53,36,0.18), inset 0 18px 32px rgba(255,255,255,0.06)' }} />
                          {PUZZLE_PIECES.map((piece) => {
                            const target = getTargetRect(piece);
                            const placed = placedPieces.includes(piece.id);
                            return (
                              <div
                                key={`shadow-${piece.id}`}
                                ref={(el) => { targetSlotRefs.current[piece.id] = el; }}
                                className="absolute"
                                style={{ left: target.localX + bodyLocalX, top: target.localY + bodyLocalY, width: target.width, height: target.height }}
                              >
                                <div className="relative w-full h-full"
                                  style={{
                                    clipPath: `polygon(${piece.localPolygon})`, WebkitClipPath: `polygon(${piece.localPolygon})`,
                                    background: placed ? 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(29,20,12,0.12))' : 'linear-gradient(160deg, rgba(34,26,20,0.44), rgba(95,74,57,0.16))',
                                    boxShadow: placed ? 'inset 0 0 0 1px rgba(255,255,255,0.05)' : 'inset 0 0 0 1px rgba(203,163,108,0.22)',
                                    filter: slotGlow[piece.id] ? 'drop-shadow(0 0 14px rgba(251,191,36,0.54)) drop-shadow(0 0 4px rgba(255,243,191,0.28))' : 'drop-shadow(0 3px 4px rgba(26,18,11,0.24))',
                                    opacity: placed ? 0.18 : 0.9,
                                  }}
                                >
                                  <img src={STELE_BODY} alt="" draggable={false} className="absolute max-w-none pointer-events-none"
                                    style={{ left: -target.localX, top: -target.localY, width: bodyW, height: bodyH, opacity: placed ? 0.08 : 0.18, filter: 'grayscale(1) saturate(0.4) brightness(0.8)' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {puzzleCompleted && (
                            <div className="absolute pointer-events-none" style={{ left: bodyLocalX, top: bodyLocalY, width: bodyW, height: bodyH, zIndex: 34 }}>
                              {CRACK_LINES.map((line, idx) => (
                                <div key={idx} className="absolute"
                                  style={{
                                    left: line.left, top: line.top, width: line.width, height: Math.max(2, 2.4 * boardScale),
                                    transform: `rotate(${line.rotate}deg)`, transformOrigin: 'left center',
                                    background: 'linear-gradient(90deg, rgba(255,244,214,0), rgba(255,230,150,0.95) 25%, rgba(255,248,214,0.9) 52%, rgba(255,224,126,0.85) 78%, rgba(255,244,214,0))',
                                    boxShadow: '0 0 10px rgba(255,216,110,0.75), 0 0 20px rgba(255,233,164,0.55), 0 0 30px rgba(255,243,196,0.25)',
                                    opacity: 0, animation: `crackGlow 780ms ease-out ${idx * 70}ms forwards`,
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </MasterDraggableWrapper>

                    <MasterDraggableWrapper
                      enabled={visualEditorOn}
                      x={puzzleLayout.invX}
                      y={puzzleLayout.invY}
                      dragScale={puzzleScale}
                      scale={puzzleLayout.inventoryScale}
                      scaleRange={{ min: 0.5, max: 2.5, step: 0.05 }}
                      onScaleChange={(next) => tuning?.setNumber('inventoryScale', next)}
                      onPositionChange={(nextX, nextY) => { tuning?.setNumber('invX', Math.round(nextX)); tuning?.setNumber('invY', Math.round(nextY)); }}
                      className="rounded-[28px]"
                      style={{ width: trayW, height: trayH }}
                    >
                      <div className={['rounded-[28px] border border-ink/20 bg-paper2/82 shadow-paper px-4 py-3', visualEditorOn ? 'ring-2 ring-amber-300/70' : ''].join(' ')}
                        style={{ width: trayW, height: trayH, touchAction: 'none', pointerEvents: 'auto', background: 'linear-gradient(180deg, rgba(250,243,226,0.92), rgba(214,196,170,0.84) 58%, rgba(176,152,124,0.88))' }}
                      >
                        <div className="text-sm font-black">깨진 비석 파편</div>
                        <div className="mt-1 text-[11px] font-bold opacity-75">바닥에 떨어진 조각처럼 흩어져 있어요. 실루엣 위로 끌어 올려 복원해보자!</div>
                      </div>
                    </MasterDraggableWrapper>

                    {/* 개별 파편 - 항상 절대 좌표계 사용 (래퍼 중첩 없음) */}
                    {inventoryPieces.map((p) => {
                      const target = getTargetRect(p);
                      const placed = placedPieces.includes(p.id);
                      const homeScale = trayPieceScale;
                      const homeSize = { w: target.globalWidth * homeScale, h: target.globalHeight * homeScale };
                      const keys = PIECE_TUNE_KEYS[p.id];
                      const pieceOffX = puzzleLayout[keys.xKey as keyof typeof puzzleLayout] as number ?? 0;
                      const pieceOffY = puzzleLayout[keys.yKey as keyof typeof puzzleLayout] as number ?? 0;
                      const home: Point = {
                        x: puzzleLayout.invX + p.tray.x * inventoryWorldScale + pieceOffX,
                        y: puzzleLayout.invY + p.tray.y * inventoryWorldScale + pieceOffY,
                      };
                      // 에디터 모드에서는 개별 파편에 임시 drag 추가 (절대 좌표 유지)
                      const editorPieceDrag = visualEditorOn && !placed;
                      return (
                        <PuzzlePiece
                          key={p.id}
                          piece={p}
                          home={home}
                          target={{ x: target.globalX, y: target.globalY }}
                          targetSize={{ w: target.globalWidth, h: target.globalHeight }}
                          bodySize={{ w: bodyWorldW, h: bodyWorldH }}
                          homeScale={homeScale}
                          homeSize={homeSize}
                          dimmed={false}
                          placed={placed}
                          disabled={introStatus !== 'DONE' || puzzleCompleteOverlay}
                          scale={puzzleScale}
                          threshold={Math.max(SNAP_THRESHOLD, Math.min(target.globalWidth, target.globalHeight) * 0.34)}
                          showGlow={!!slotGlow[p.id]}
                          onPlaced={onPlacePiece}
                          editorMode={visualEditorOn}
                          snapOffset={{ x: puzzleLayout.snapOffsetDx, y: puzzleLayout.snapOffsetDy }}
                          getTargetClientRect={() => {
                            const rect = targetSlotRefs.current[p.id]?.getBoundingClientRect();
                            if (rect) {
                              return {
                                left: rect.left,
                                top: rect.top,
                                width: rect.width,
                                height: rect.height,
                              };
                            }
                            const canvasRect = puzzleCanvasRef.current?.getBoundingClientRect();
                            if (!canvasRect) return null;
                            return {
                              left: canvasRect.left + target.globalX * puzzleScale,
                              top: canvasRect.top + target.globalY * puzzleScale,
                              width: target.globalWidth * puzzleScale,
                              height: target.globalHeight * puzzleScale,
                            };
                          }}
                          onEditorDragEnd={(finalX, finalY) => {
                            // 새 위치에서 기본 tray 위치를 뺀 오프셋 저장
                            const baseX = puzzleLayout.invX + p.tray.x * inventoryWorldScale;
                            const baseY = puzzleLayout.invY + p.tray.y * inventoryWorldScale;
                            if (tuning) {
                              tuning.setNumber(keys.xKey, Math.round(finalX - baseX));
                              tuning.setNumber(keys.yKey, Math.round(finalY - baseY));
                            }
                          }}
                        />
                      );
                    })}

                    <MasterDraggableWrapper
                      enabled={visualEditorOn && puzzleCompleted}
                      x={bodyX + completeImgDx}
                      y={bodyY + completeImgDy}
                      dragScale={puzzleScale}
                      scale={completeImgScale}
                      scaleRange={{ min: 0.6, max: 1.8, step: 0.05 }}
                      onScaleChange={(next) => tuning?.setNumber('completeImgScale', next)}
                      onPositionChange={(nextX, nextY) => { tuning?.setNumber('completeImgDx', Math.round(nextX - bodyX)); tuning?.setNumber('completeImgDy', Math.round(nextY - bodyY)); }}
                      style={{ width: bodyW, height: bodyH, zIndex: 36 }}
                    >
                      <motion.img src={STELE_BODY} alt="완성된 비석" draggable={false}
                        className={['absolute', visualEditorOn || completeAdjustOpen ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}
                        style={{ left: 0, top: 0, width: bodyW, height: bodyH, objectFit: 'contain', zIndex: 36,
                          filter: puzzleCompleted ? 'drop-shadow(0 0 18px rgba(245, 158, 11, 0.55)) drop-shadow(0 10px 12px rgba(32,22,14,0.2))' : 'none',
                          transformOrigin: 'top left', transform: `scale(${completeImgScale})` }}
                        initial={{ opacity: 0 }} animate={{ opacity: puzzleCompleted ? 1 : 0 }} transition={{ duration: 0.46, ease: 'easeOut' }}
                      />
                    </MasterDraggableWrapper>

                    {puzzleCompleteOverlay && (
                      <div className="absolute inset-0"
                        onClick={() => { if (completeAdjustOpen) return; setPhase('ENGRAVE'); }}
                        onTouchStart={() => { if (completeAdjustOpen) return; setPhase('ENGRAVE'); }}
                      >
                        <div className="absolute inset-0 bg-ink/8" />

                        {isDevMode && (
                          <div className="absolute right-3 top-3 z-[14000] flex flex-col gap-2">
                            <button type="button" className="rounded-xl px-3 py-2 text-xs font-black bg-paper2/90 border border-ink/25 shadow-paper"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCompleteAdjustOpen((v) => !v); }}
                            >
                              {completeAdjustOpen ? '조절 끝' : '완성 조절'}
                            </button>
                            {completeAdjustOpen && (
                              <div className="note-panel px-3 py-2 max-w-[220px]">
                                <div className="text-[11px] font-black opacity-85">위치/크기 조절</div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-black bg-paper/70 border border-ink/20"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!tuning || tuning.locked) return; tuning.setNumber('completeImgScale', Math.max(0.6, Number((completeImgScale - 0.05).toFixed(2)))); }}
                                  >이미지 -</button>
                                  <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-black bg-paper/70 border border-ink/20"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!tuning || tuning.locked) return; tuning.setNumber('completeImgScale', Math.min(1.6, Number((completeImgScale + 0.05).toFixed(2)))); }}
                                  >이미지 +</button>
                                  <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-black bg-paper/70 border border-ink/20"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!tuning || tuning.locked) return; tuning.setNumber('completePopupScale', Math.max(0.6, Number((completePopupScale - 0.05).toFixed(2)))); }}
                                  >팝업 -</button>
                                  <button type="button" className="rounded-lg px-2 py-1 text-[11px] font-black bg-paper/70 border border-ink/20"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!tuning || tuning.locked) return; tuning.setNumber('completePopupScale', Math.min(1.6, Number((completePopupScale + 0.05).toFixed(2)))); }}
                                  >팝업 +</button>
                                </div>
                                <button type="button" className="mt-2 w-full rounded-lg px-2 py-1 text-[11px] font-black bg-paper/70 border border-ink/20"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!tuning || tuning.locked) return; tuning.setNumber('completeImgDx',0); tuning.setNumber('completeImgDy',0); tuning.setNumber('completeImgScale',1); tuning.setNumber('completePopupDx',0); tuning.setNumber('completePopupDy',0); tuning.setNumber('completePopupScale',1); }}
                                >초기화</button>
                              </div>
                            )}
                          </div>
                        )}

                        <MasterDraggableWrapper
                          enabled={visualEditorOn}
                          x={PUZZLE_BASE_W / 2 + completePopupDx}
                          y={PUZZLE_BASE_H / 2 + completePopupDy}
                          dragScale={puzzleScale}
                          scale={completePopupScale}
                          scaleRange={{ min: 0.6, max: 1.8, step: 0.05 }}
                          onScaleChange={(next) => tuning?.setNumber('completePopupScale', next)}
                          onPositionChange={(nextX, nextY) => { tuning?.setNumber('completePopupDx', Math.round(nextX - PUZZLE_BASE_W / 2)); tuning?.setNumber('completePopupDy', Math.round(nextY - PUZZLE_BASE_H / 2)); }}
                          style={{ zIndex: 13000 }}
                        >
                          <div className="absolute left-1/2 top-1/2"
                            style={{ transform: `translate(-50%, -50%) scale(${completePopupScale})`, transformOrigin: 'center', zIndex: 13000, pointerEvents: 'auto' }}
                          >
                            <div className="note-panel px-4 py-3 max-w-[360px] popInFx">
                              <div className="text-base font-black">비석 복원 완료!</div>
                              <div className="mt-1 text-xs opacity-90 leading-relaxed">잘했어! 이제 비석에 글씨를 새겨보자.</div>
                              <div className="mt-2 text-xs font-black text-stamp">화면을 탭하면 다음 단계로 넘어가요.</div>
                            </div>
                          </div>
                        </MasterDraggableWrapper>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 p-3 grid place-items-center">
            <div className="w-full h-full grid grid-cols-2 gap-3">
              <div className="min-h-0 rounded-3xl border border-ink/20 bg-paper/55 overflow-hidden relative">
                <div className="relative w-full h-full p-2 md:p-3">
                  <img src={STELE_BODY} alt="비석 몸통" className="absolute inset-1 md:inset-2 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] md:w-[calc(100%-1rem)] md:h-[calc(100%-1rem)] object-contain drop-shadow-[0_18px_40px_rgba(74,55,40,0.18)]" draggable={false} />
                  <div className="absolute" style={{ right: `${INSCRIBE_BOX_POS.rightPct}%`, top: `${INSCRIBE_BOX_POS.topPct}%`, width: `${INSCRIBE_BOX_SIZE.widthPct}%`, height: `${INSCRIBE_BOX_SIZE.heightPct}%` }}>
                    <div className="h-full w-full font-black" style={{ color: 'rgba(35, 25, 18, 0.86)', textShadow: '0.6px 0.6px 0 rgba(255,255,255,0.18), -0.8px -0.8px 0 rgba(20,14,10,0.28), 0 1px 2px rgba(20,14,10,0.20), 0 4px 10px rgba(20,14,10,0.12)', filter: 'contrast(1.12) saturate(0.88)', fontSize: `${inscribeFontPx}px`, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.72, letterSpacing: '0.08em', writingMode: 'vertical-rl', textOrientation: 'mixed', direction: 'ltr', textAlign: 'left', WebkitTextStroke: '0.55px rgba(18, 12, 9, 0.22)' }}>
                      {engraved ?? input}
                    </div>
                  </div>
                </div>
              </div>
              <div className="min-h-0 rounded-3xl border border-ink/20 bg-paper/70 p-3 flex flex-col gap-3">
                <div className="note-panel px-4 py-3">
                  <div className="text-sm font-black">비석 글씨 새기기</div>
                  <div className="mt-1 text-sm opacity-90 leading-relaxed">남기고 싶은 말을 적어보자. 적은 글은 왼쪽 비석에 오른쪽 위부터 세로로 새겨져요.</div>
                </div>
                <div className="text-sm font-black">글씨 쓰는 칸</div>
                <div className="text-xs opacity-80 leading-relaxed">엔터로 줄을 바꿀 수 있어요. 4줄을 넘기면 더 이상 입력되지 않아요.</div>
                <textarea value={input} onChange={(e) => { let next = e.target.value; const lines = next.split('\n'); if (lines.length > 4) return; if (next.length > MAX_INSCRIBE_CHARS) next = next.slice(0, MAX_INSCRIBE_CHARS); setInput(next); }}
                  placeholder={'예:\n안양의 문화유산을\n오래오래 지켜요\n우리 모두 함께해요'} className="flex-1 min-h-[240px] rounded-2xl border-2 border-ink/25 bg-paper2 px-3 py-3 text-sm font-bold outline-none resize-none"
                  maxLength={MAX_INSCRIBE_CHARS} disabled={engraving || !!engraved} />
                <button type="button" onClick={finishEngrave} disabled={engraving || !!engraved}
                  className={['rounded-2xl px-4 py-3 font-black border shadow-md', engraving || !!engraved ? 'bg-paper/50 text-ink/40 cursor-not-allowed border-ink/20' : 'bg-stamp text-white border-ink/25 hover:opacity-95'].join(' ')}
                >{engraving ? '새기는 중…' : '완료'}</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="absolute left-1/2 top-14 -translate-x-1/2 z-[14000]">
            <div className="rounded-2xl border border-ink/20 bg-paper2/92 px-4 py-2 text-sm font-black shadow-paper">{toast}</div>
          </div>
        )}
      </div>

      {resultModal && (
        <div className="fixed inset-0 z-[99999] bg-ink/45 p-4">
          <div className="w-full h-full max-w-[820px] mx-auto rounded-3xl overflow-hidden bg-paper2 text-ink shadow-paper border border-ink/25 flex flex-col">
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <img src={REAL} alt="" className="w-full h-full object-cover" draggable={false} />
              <div className="absolute left-3 top-3 note-panel px-4 py-3">
                <div className="text-xs font-black opacity-85">복원 완료</div>
                <div className="mt-0.5 text-sm font-black">안양사 귀부</div>
              </div>
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/75">
              <div className="text-lg font-black">성공! 복원 완료</div>
              <div className="mt-1 text-sm opacity-90 leading-relaxed">여러분의 멋진 다짐이 안양사 귀부에 새겨졌어요!</div>
              {engraved && (
                <div className="mt-3 rounded-2xl border border-ink/20 bg-paper2/85 px-3 py-2">
                  <div className="text-xs font-black opacity-80">내가 새긴 글</div>
                  <div className="mt-1 text-sm font-bold opacity-95">{engraved.replace(/\s*\n\s*/g, ' ')}</div>
                </div>
              )}
              <button type="button" className="mt-3 w-full rounded-2xl bg-olive text-white border border-ink/25 font-black py-3 shadow-md hover:opacity-95"
                onClick={() => { const now = Date.now(); const started = startedAt ?? now; const clearTime = Math.max(0, Math.round(((now - started) / 1000) * 10) / 10); onComplete({ attempts, clearTime }); }}
              >지도로 돌아가기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
