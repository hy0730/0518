import React from 'react';
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

  return (
    <div
      className={styles.map}
      style={mapBg ? ({ backgroundImage: `url(${mapBg})` } as React.CSSProperties) : undefined}
    >
      <button
        type="button"
        className={styles.resetBtn}
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

      {NODES.map((node) => {
        const stageId = node.stageId;
        const locked = stageId > unlockedStageId;
        const completed = stageId < unlockedStageId;
        const title = storyDataByStageId[stageId]?.title ?? `스테이지 ${stageId}`;

        return (
          <button
            key={stageId}
            type="button"
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
            <span className={`${styles.pinInner} ${!completed && !locked ? styles.floating : ''}`}>
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
  );
}
