import React from 'react';
import { useGameStore } from '../store/useGameStore';
import styles from './GameHUD.module.css';

export default function GameHUD() {
  const toggleCollection = useGameStore((s) => s.toggleCollection);
  const isCollectionOpen = useGameStore((s) => s.isCollectionOpen);
  const isMuted = useGameStore((s) => s.isMuted);

  return (
    <div
      className={styles.hud}
      onClick={(e) => {
        // HUD 클릭이 맵으로 버블링되지 않도록
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        className={styles.btn}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          useGameStore.getState().toggleMute();
        }}
        aria-label={isMuted ? '사운드 켜기' : '사운드 끄기'}
        title={isMuted ? '사운드 켜기' : '사운드 끄기'}
      >
        {isMuted ? '🔇' : '🔈'}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${isCollectionOpen ? styles.active : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleCollection();
        }}
      >
        🏆 도감
      </button>
    </div>
  );
}
