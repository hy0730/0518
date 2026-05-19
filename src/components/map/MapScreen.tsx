import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './MapScreen.module.css';

function PinFallbackSvg() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 22s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
        fill="rgba(255,255,255,0.92)"
      />
      <circle cx="12" cy="10" r="3" fill="#ff3b30" />
    </svg>
  );
}

export default function MapScreen() {
  const regionData = useGameStore((s) => s.regionData);
  const visitedNodes = useGameStore((s) => s.visitedNodes);
  const unlockedStageId = useGameStore((s) => s.unlockedStageId);
  const [iconError, setIconError] = useState<Record<string, boolean>>({});

  if (!regionData) return null;

  const mapBg = regionData.assets.mapBackground;

  return (
    <div
      className={styles.map}
      style={mapBg ? ({ backgroundImage: `url(${mapBg})` } as React.CSSProperties) : undefined}
    >
      {regionData.map.nodes.map((node, index) => {
        const stageId = index + 1;
        const locked = stageId > unlockedStageId;
        const visited = visitedNodes.includes(node.id);

        return (
          <button
            key={node.id}
            type="button"
            className={`${styles.pin} ${visited ? styles.visited : ''} ${locked ? styles.locked : ''}`}
            style={{
              left: `${node.position.x}%`,
              top: `${node.position.y}%`,
            }}
            disabled={locked}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // 상위 레이어(맵 등)로의 버블링 방지
              if (locked) return;
              // 스테이지 진입 → STORY로 이동
              useGameStore.getState().playStage(stageId);
            }}
            aria-label={node.title}
            title={node.title}
          >
            <span className={`${styles.pinInner} ${!visited ? styles.floating : ''}`}>
              {node.icon && !iconError[node.id] ? (
                <img
                  className={styles.pinIcon}
                  src={node.icon}
                  alt=""
                  draggable={false}
                  onError={() => setIconError((prev) => ({ ...prev, [node.id]: true }))}
                />
              ) : (
                <span className={styles.pinSvg} aria-hidden="true">
                  <PinFallbackSvg />
                </span>
              )}
              {visited && <span className={styles.checkMark}>✓</span>}
            </span>
            <span className={styles.pinLabel}>{node.title}</span>
          </button>
        );
      })}
    </div>
  );
}
