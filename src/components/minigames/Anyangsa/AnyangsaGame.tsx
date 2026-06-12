import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue } from 'framer-motion';
import type { MinigameProps } from '../../../types/game';
import { storyDataByStageId } from '../../../data/storyData';
import { audio } from '../../../utils/audio';
import { useToast } from '../common/useToast';
import { useGameTuning } from '../../common/GameTuningContext';

type Phase = 'PUZZLE' | 'ENGRAVE';
type PieceId = 1 | 2 | 3 | 4 | 5 | 6;

type PuzzlePieceDef = {
  id: PieceId;
  img: string;
  slotIndex: number; // 0..5 (위 3개, 아래 3개)
};

function shuffle<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const BG = '/assets/images/relic_turtle_main.png'; // 안양사 야외(픽셀) 배경
const REAL = '/assets/images/relic_turtle_real.png'; // 실제 문화유산 사진

const GUIBU_EMPTY = '/assets/images/relic_gwibu_base_front.png';
const GUIBU_FULL = '/assets/images/relic_gwibu_complete.png';
const STELE_BODY = '/assets/images/relic_gwibu_body.png';
const MAX_INSCRIBE_CHARS = 32;

const PUZZLE_PIECES: PuzzlePieceDef[] = [
  { id: 1, img: '/assets/images/relic_gwibu_body_puzzle_1.png', slotIndex: 0 },
  { id: 2, img: '/assets/images/relic_gwibu_body_puzzle_2.png', slotIndex: 1 },
  { id: 3, img: '/assets/images/relic_gwibu_body_puzzle_3.png', slotIndex: 2 },
  { id: 4, img: '/assets/images/relic_gwibu_body_puzzle_4.png', slotIndex: 3 },
  { id: 5, img: '/assets/images/relic_gwibu_body_puzzle_5.png', slotIndex: 4 },
  { id: 6, img: '/assets/images/relic_gwibu_body_puzzle_6.png', slotIndex: 5 },
];

const PUZZLE_BASE_W = 800;
const PUZZLE_BASE_H = 450;
const SLOT_W = 120;
const SLOT_H = 100;
const SLOT_GAP = 6;
const SLOT_GAP_MERGED = 0;
const SNAP_THRESHOLD = 78;

type Point = { x: number; y: number };

function PuzzlePiece({
  piece,
  home,
  slot,
  homeSize,
  slotSize,
  dimmed,
  placed,
  disabled,
  scale,
  threshold,
  showGlow,
  onPlaced,
}: {
  piece: PuzzlePieceDef;
  home: Point;
  slot: Point;
  homeSize: { w: number; h: number };
  slotSize: { w: number; h: number };
  dimmed: boolean;
  placed: boolean;
  disabled: boolean;
  scale: number;
  threshold: number;
  showGlow: boolean;
  onPlaced: (id: PieceId, slotIndex: number) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const toSlotX = slot.x - home.x;
  const toSlotY = slot.y - home.y;

  useEffect(() => {
    if (placed) {
      animate(x, toSlotX, { type: 'spring', stiffness: 520, damping: 34 });
      animate(y, toSlotY, { type: 'spring', stiffness: 520, damping: 34 });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 });
      animate(y, 0, { type: 'spring', stiffness: 520, damping: 34 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, toSlotX, toSlotY]);

  return (
    <motion.div
      className={[
        'absolute rounded-2xl border border-ink/20 bg-paper2/85 shadow-md',
        placed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        showGlow ? 'ring-2 ring-amber-300/70' : '',
      ].join(' ')}
      style={{
        left: home.x,
        top: home.y,
        width: placed ? slotSize.w : homeSize.w,
        height: placed ? slotSize.h : homeSize.h,
        x,
        y,
        touchAction: 'none',
        opacity: dimmed ? 0 : 1,
        transition: 'opacity 220ms ease',
      }}
      drag={!placed && !disabled}
      dragMomentum={false}
      dragElastic={0.12}
      onDrag={(_, info) => {
        if (scale === 1) return;
        // parent가 scale 되어있으면 커서 이동량을 scale로 보정(요구 조건)
        const adj = 1 / scale - 1;
        x.set(x.get() + info.delta.x * adj);
        y.set(y.get() + info.delta.y * adj);
      }}
      onDragEnd={() => {
        if (placed || disabled) return;
        // 현재 조각의 중심점과 정답 슬롯 중심점 거리로 스냅 판정
        const px = home.x + x.get();
        const py = home.y + y.get();
        const cx = px + homeSize.w / 2;
        const cy = py + homeSize.h / 2;
        const tx = slot.x + slotSize.w / 2;
        const ty = slot.y + slotSize.h / 2;
        const dist = Math.hypot(cx - tx, cy - ty);
        if (dist <= threshold) {
          onPlaced(piece.id, piece.slotIndex);
          audio.playSfx('correct', 0.75);
          animate(x, toSlotX, { type: 'spring', stiffness: 620, damping: 36 });
          animate(y, toSlotY, { type: 'spring', stiffness: 620, damping: 36 });
        } else {
          audio.playSfx('wrong', 0.65);
          animate(x, 0, { type: 'spring', stiffness: 520, damping: 34 });
          animate(y, 0, { type: 'spring', stiffness: 520, damping: 34 });
        }
      }}
    >
      <img src={piece.img} alt="" className="w-full h-full object-contain" draggable={false} />
    </motion.div>
  );
}

export default function AnyangsaGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = stageTitle;

  const [phase, setPhase] = useState<Phase>('PUZZLE');
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

  // Toast
  const { toast, showToast } = useToast(1400);

  // Phase1: 6조각 드래그 앤 드롭 퍼즐
  const [placedPieces, setPlacedPieces] = useState<PieceId[]>([]);
  const [puzzleCompleted, setPuzzleCompleted] = useState(false);
  const [puzzleCompleteOverlay, setPuzzleCompleteOverlay] = useState(false);
  const [slotGlow, setSlotGlow] = useState<Record<number, boolean>>({});

  // 퍼즐 레이아웃 튜닝은 MiniGameManager의 공통 HUD에서 제어(스테이지별 저장/확정 포함)
  const tuning = useGameTuning();
  const puzzleLayout = useMemo(() => {
    const get = (k: string, fallback: number) => tuning?.getNumber(k, fallback) ?? fallback;
    return {
      headerX: get('headerX', 16),
      headerY: get('headerY', 12),
      headerScale: get('headerScale', 1),
      boardX: get('boardX', 26),
      boardY: get('boardY', Math.round((PUZZLE_BASE_H - (SLOT_H * 2 + SLOT_GAP)) / 2)),
      boardScale: get('boardScale', 1),
      invX: get('invX', 402),
      invY: get('invY', 84),
      inventoryScale: get('inventoryScale', 1),
      slotW: get('slotW', SLOT_W),
      slotH: get('slotH', SLOT_H),
      pieceScale: get('pieceScale', 1),
    };
  }, [tuning]);

  // 내부 캔버스 스케일링(기준 해상도 -> transform: scale로 contain)
  const puzzleViewportRef = useRef<HTMLDivElement | null>(null);
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

  const inventoryPieces = useMemo(() => shuffle(PUZZLE_PIECES), []);

  const onPlacePiece = (id: PieceId, slotIndex: number) => {
    setPlacedPieces((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSlotGlow((prev) => ({ ...prev, [slotIndex]: true }));
    window.setTimeout(() => setSlotGlow((prev) => ({ ...prev, [slotIndex]: false })), 220);
  };

  useEffect(() => {
    if (phase !== 'PUZZLE') return;
    if (placedPieces.length !== 6) return;
    if (puzzleCompleted) return;
    setPuzzleCompleted(true);
    audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
    showToast('비석 복원 완료!');
    window.setTimeout(() => setPuzzleCompleteOverlay(true), 380);
  }, [phase, placedPieces, puzzleCompleted, showToast]);

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
        <div className="text-xs font-bold opacity-80">{phase === 'PUZZLE' ? 'Phase 1' : 'Phase 2'}</div>
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
                  흩어진 비석 조각 6개를 맞춰서 비석을 다시 복원해줘!
                </div>
                <div className="mt-3 text-sm font-black text-stamp">화면을 터치하면 시작해요.</div>
              </div>
            </div>
          </button>
        )}

        {phase === 'PUZZLE' ? (
          <div ref={puzzleViewportRef} className="absolute inset-0" style={{ touchAction: 'none' }}>
            {/* 기준 해상도 캔버스(800x450) → transform: scale()로 contain */}
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: PUZZLE_BASE_W,
                height: PUZZLE_BASE_H,
                transformOrigin: 'top left',
                transform: `translate(-50%, -50%) scale(${puzzleScale})`,
              }}
            >
              {(() => {
                const slotGap = puzzleCompleted ? SLOT_GAP_MERGED : SLOT_GAP;
                const boardSlotW = Math.round(puzzleLayout.slotW * puzzleLayout.boardScale);
                const boardSlotH = Math.round(puzzleLayout.slotH * puzzleLayout.boardScale);
                const pieceW = Math.round(puzzleLayout.slotW * puzzleLayout.pieceScale);
                const pieceH = Math.round(puzzleLayout.slotH * puzzleLayout.pieceScale);
                const invGap = 12;
                const invTitleH = Math.round(60 * puzzleLayout.inventoryScale);
                const invPad = Math.round(12 * puzzleLayout.inventoryScale);
                const invW = pieceW * 3 + invGap * 2 + invPad * 2;
                const invH = pieceH * 2 + invGap + invTitleH + invPad * 2;
                const boardW = boardSlotW * 3 + slotGap * 2;
                const boardH = boardSlotH * 2 + slotGap;

                const slotPos = (slotIndex: number) => {
                  const r = Math.floor(slotIndex / 3);
                  const c = slotIndex % 3;
                  return {
                    x: puzzleLayout.boardX + c * (boardSlotW + slotGap),
                    y: puzzleLayout.boardY + r * (boardSlotH + slotGap),
                  };
                };

                return (
                  <>
                    <div
                      className="absolute rounded-2xl border border-ink/20 bg-paper2/80 px-4 py-3 shadow-paper"
                      style={{
                        left: puzzleLayout.headerX,
                        top: puzzleLayout.headerY,
                        transform: `scale(${puzzleLayout.headerScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      <div className="text-sm font-black">6조각 퍼즐</div>
                      <div className="mt-1 text-[12px] font-bold opacity-80">
                        조각을 드래그해서 점선 도안 위에 놓아보자! (가까이 가면 ‘착!’ 하고 붙어요)
                      </div>
                    </div>

                    {/* 정답 슬롯(도안) */}
                    <div
                      className="absolute"
                      style={{ left: puzzleLayout.boardX, top: puzzleLayout.boardY, width: boardW, height: boardH }}
                    >
                      {Array.from({ length: 6 }).map((_, i) => {
                        const { x, y } = slotPos(i);
                        return (
                          <div
                            key={i}
                            className={[
                              'absolute rounded-2xl border-2 border-dashed bg-paper/30',
                              slotGlow[i] ? 'border-amber-400/80 bg-amber-200/15' : 'border-ink/25',
                            ].join(' ')}
                            style={{
                              left: x - puzzleLayout.boardX,
                              top: y - puzzleLayout.boardY,
                              width: boardSlotW,
                              height: boardSlotH,
                            }}
                          />
                        );
                      })}
                    </div>

                    {/* 인벤토리 */}
                    <div
                      className="absolute rounded-3xl border border-ink/20 bg-paper2/80 shadow-paper px-3 py-3"
                      style={{
                        left: puzzleLayout.invX,
                        top: puzzleLayout.invY,
                        width: invW,
                        height: invH,
                      }}
                    >
                      <div className="text-sm font-black">조각 대기열</div>
                      <div className="mt-1 text-[11px] font-bold opacity-75">무작위로 섞여 있어요. 맞는 칸에 놓아보자!</div>
                    </div>

                    {/* 조각들(모두 absolute) */}
                    {inventoryPieces.map((p, idx) => {
                      const row = Math.floor(idx / 3);
                      const col = idx % 3;
                      const home: Point = {
                        x: puzzleLayout.invX + invPad + col * (pieceW + invGap),
                        y: puzzleLayout.invY + invPad + Math.round(invTitleH * 0.75) + row * (pieceH + invGap),
                      };
                      const slot = slotPos(p.slotIndex);
                      const placed = placedPieces.includes(p.id);
                      return (
                        <PuzzlePiece
                          key={p.id}
                          piece={p}
                          home={home}
                          slot={slot}
                          homeSize={{ w: pieceW, h: pieceH }}
                          slotSize={{ w: boardSlotW, h: boardSlotH }}
                          dimmed={puzzleCompleted}
                          placed={placed}
                          disabled={introStatus !== 'DONE' || puzzleCompleteOverlay}
                          scale={puzzleScale}
                          threshold={Math.max(52, Math.round((SNAP_THRESHOLD * boardSlotW) / SLOT_W))}
                          showGlow={!!slotGlow[p.slotIndex]}
                          onPlaced={onPlacePiece}
                        />
                      );
                    })}

                    {/* 퍼즐 완성 시: 틈새를 가리는 완성 이미지 오버레이(조각 위에 덮기) */}
                    <motion.img
                      src={STELE_BODY}
                      alt="완성된 비석"
                      draggable={false}
                      className="absolute pointer-events-none"
                      style={{
                        left: puzzleLayout.boardX,
                        top: puzzleLayout.boardY,
                        width: boardW,
                        height: boardH,
                        objectFit: 'contain',
                        zIndex: 30,
                        filter: puzzleCompleted ? 'drop-shadow(0 0 18px rgba(245, 158, 11, 0.55))' : 'none',
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: puzzleCompleted ? 1 : 0 }}
                      transition={{ duration: 0.35 }}
                    />

                    {/* 퍼즐 완료 오버레이(탭해서 다음 단계) */}
                    {puzzleCompleteOverlay && (
                      <button
                        type="button"
                        className="absolute inset-0 grid place-items-center bg-ink/18"
                        onClick={() => setPhase('ENGRAVE')}
                        onTouchStart={() => setPhase('ENGRAVE')}
                      >
                        <div className="note-panel px-6 py-5 max-w-[480px] popInFx">
                          <div className="text-lg font-black">비석 복원 완료!</div>
                          <div className="mt-2 text-sm opacity-90 leading-relaxed">
                            잘했어! 이제 비석에 글씨를 새겨보자.
                          </div>
                          <div className="mt-3 text-sm font-black text-stamp">화면을 탭하면 다음 단계로 넘어가요.</div>
                        </div>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
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
                  value={input}
                  onChange={(e) => {
                    let next = e.target.value;
                    const lines = next.split('\n');
                    // 4줄 초과 입력은 차단(요청)
                    if (lines.length > 4) return;
                    // 글자수 제한(요청): 'ㅇ' 32개 길이만큼만 입력 가능
                    if (next.length > MAX_INSCRIBE_CHARS) next = next.slice(0, MAX_INSCRIBE_CHARS);
                    setInput(next);
                  }}
                  placeholder={'예:\n안양의 문화유산을\n오래오래 지켜요\n우리 모두 함께해요'}
                  className="flex-1 min-h-[240px] rounded-2xl border-2 border-ink/25 bg-paper2 px-3 py-3 text-sm font-bold outline-none resize-none"
                  maxLength={MAX_INSCRIBE_CHARS}
                  disabled={engraving || !!engraved}
                />
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

        {/* 토스트 */}
        {toast && (
          <div className="absolute left-1/2 top-14 -translate-x-1/2 z-[14000]">
            <div className="rounded-2xl border border-ink/20 bg-paper2/92 px-4 py-2 text-sm font-black shadow-paper">
              {toast}
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
