import React, { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './CollectionModal.module.css';

function PinFallbackSvg() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 22s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
        fill="rgba(255,255,255,0.92)"
      />
      <circle cx="12" cy="10" r="3" fill="#ff3b30" />
    </svg>
  );
}

export default function CollectionModal() {
  const isOpen = useGameStore((s) => s.isCollectionOpen);
  const toggleCollection = useGameStore((s) => s.toggleCollection);
  const regionData = useGameStore((s) => s.regionData);
  const visitedNodes = useGameStore((s) => s.visitedNodes);

  const [iconError, setIconError] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;
  if (!regionData) return null;

  const nodes = regionData.map.nodes;
  const visitedSet = new Set(visitedNodes);

  return (
    <>
      <div
        className={styles.overlay}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleCollection();
        }}
      />

      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="도감"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <div className={styles.title}>도감</div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCollection();
            }}
            aria-label="도감 닫기"
            title="닫기"
          >
            ×
          </button>
        </div>

        <div className={styles.grid}>
          {nodes.map((node) => {
            const obtained = visitedSet.has(node.id);

            return (
              <div key={node.id} className={`${styles.card} ${obtained ? '' : styles.locked}`}>
                <div className={styles.iconWrap}>
                  {node.icon && !iconError[node.id] ? (
                    <img
                      className={styles.icon}
                      src={node.icon}
                      alt=""
                      draggable={false}
                      onError={() => setIconError((prev) => ({ ...prev, [node.id]: true }))}
                    />
                  ) : (
                    <span className={styles.fallback} aria-hidden="true">
                      <PinFallbackSvg />
                    </span>
                  )}
                </div>
                <div className={styles.name}>{obtained ? node.title : '???'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

