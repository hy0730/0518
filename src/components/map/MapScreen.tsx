import React, { useMemo, useRef, useState } from 'react';
import { storyDataByStageId } from '../../data/storyData';
import { useGameStore } from '../../store/useGameStore';
import styles from './MapScreen.module.css';

type MapNode = {
  stageId: number;
  left: number; // %
  top: number; // %
  icon: string;
};

// 9개 문화유산 노드 위치 (원하는대로 숫자만 미세 조정하면 됨)
const NODES: MapNode[] = [
  { stageId: 1, left: 20, top: 28, icon: '/assets/images/relic_gwanyang_main.png' },
  { stageId: 2, left: 35, top: 42, icon: '/assets/images/relic_pyeongchon_main.png' },
  { stageId: 3, left: 52, top: 30, icon: '/assets/images/relic_seoksu_main.png' },
  { stageId: 4, left: 64, top: 44, icon: '/assets/images/relic_jungcho_main.png' },
  { stageId: 5, left: 76, top: 30, icon: '/assets/images/relic_bell_main.png' },
  { stageId: 6, left: 18, top: 58, icon: '/assets/images/relic_turtle_main.png' },
  { stageId: 7, left: 40, top: 66, icon: '/assets/images/relic_bisan_main.png' },
  { stageId: 8, left: 62, top: 68, icon: '/assets/images/relic_bridge_main.png' },
  { stageId: 9, left: 82, top: 58, icon: '/assets/images/relic_seoimyeon_main.png' },
];

export default function MapScreen() {
  const regionData = useGameStore((s) => s.regionData);
  const unlockedStageId = useGameStore((s) => s.unlockedStageId);
  const resetGameData = useGameStore((s) => s.resetGameData);

  if (!regionData) return null;

  // 지도 배경(안양 지도)
  const mapBg = '/assets/images/map_real.png';

  // Zoom/Pan
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // px
  const [panning, setPanning] = useState<null | { x: number; y: number; ox: number; oy: number }>(null);

  const clampScale = (v: number) => Math.min(2.4, Math.max(1, v));

  const progress = useMemo(() => {
    const total = NODES.length;
    const completed = Math.max(0, Math.min(total, unlockedStageId - 1));
    return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0 };
  }, [unlockedStageId]);

  const completedCount = useMemo(() => Math.max(0, Math.min(NODES.length, unlockedStageId - 1)), [unlockedStageId]);

  return (
    <div ref={viewportRef} className={styles.map}>
      {/* 확대/이동이 적용되는 실제 지도 레이어 */}
      <div
        className={styles.mapContent}
        style={{
          backgroundImage: `url(${mapBg})`,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement | null;
          const isInteractive = !!t?.closest?.('button,[data-interactive="true"]');
          if (isInteractive) return;
          (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
          setPanning({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y });
        }}
        onPointerMove={(e) => {
          if (!panning) return;
          const dx = e.clientX - panning.x;
          const dy = e.clientY - panning.y;
          setOffset({ x: panning.ox + dx, y: panning.oy + dy });
        }}
        onPointerUp={() => setPanning(null)}
        onPointerCancel={() => setPanning(null)}
        onWheel={(e) => {
          // 마우스 휠로 확대/축소(데스크톱)
          e.preventDefault();
          const next = clampScale(scale + (e.deltaY > 0 ? -0.08 : 0.08));
          setScale(next);
        }}
      >
        {NODES.map((node) => {
          const stageId = node.stageId;
          const locked = stageId > unlockedStageId;
          const completed = stageId < unlockedStageId;
          const active = stageId === unlockedStageId;
          const title = storyDataByStageId[stageId]?.title ?? `스테이지 ${stageId}`;

          return (
            <button
              key={stageId}
              type="button"
              data-interactive="true"
              className={`${styles.pin} ${completed ? styles.completed : ''} ${locked ? styles.locked : ''}`}
              style={{
                left: `${node.left}%`,
                top: `${node.top}%`,
              }}
              disabled={locked}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation(); // 상위 레이어(맵 등)로의 버블링 방지
                if (locked) return;
                // 스테이지 진입 → STORY로 이동
                useGameStore.getState().playStage(stageId);
              }}
              aria-label={locked ? '미지의 유산' : title}
              title={locked ? '미지의 유산' : title}
            >
              <span
                className={[
                  styles.pinInner,
                  completed ? styles.pinInnerCompleted : locked ? styles.pinInnerLocked : styles.pinInnerAvailable,
                  active ? styles.pinInnerActive : '',
                  !completed && !locked ? styles.floating : '',
                ].join(' ')}
              >
                {locked ? (
                  <img className={`${styles.pinIcon} ${styles.question}`} src="/assets/images/question_mark.png" alt="" draggable={false} />
                ) : (
                  <img className={styles.pinIcon} src={node.icon} alt="" draggable={false} />
                )}
                {completed && <span className={styles.checkMark}>✓</span>}
              </span>
              <span className={styles.pinLabel}>{locked ? '???' : title}</span>
            </button>
          );
        })}
      </div>

      {/* 진행도 표시(간단 버전) */}
      <div className={styles.progress} data-interactive="true">
        <div className={styles.progressTitle}>진행도 {progress.completed}/{progress.total}</div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress.pct}%` }} />
        </div>
      </div>

      <button
        type="button"
        className={styles.resetBtn}
        data-interactive="true"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const ok = window.confirm('정말로 게임 데이터를 초기화할까요?\n(진행도/방문 기록/이름·학교가 초기화됩니다)');
          if (!ok) return;
          resetGameData();
        }}
      >
        게임 데이터 초기화
      </button>

      {/* 줌 컨트롤 */}
      <div className={styles.zoomControls} data-interactive="true">
        <button type="button" className={styles.zoomBtn} onClick={() => setScale((s) => clampScale(s + 0.15))}>
          ＋
        </button>
        <button type="button" className={styles.zoomBtn} onClick={() => setScale((s) => clampScale(s - 0.15))}>
          －
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}
