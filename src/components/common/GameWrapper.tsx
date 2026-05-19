import type { PropsWithChildren } from 'react';
import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './GameWrapper.module.css';

export default function GameWrapper({ children }: PropsWithChildren) {
  const regionData = useGameStore((s) => s.regionData);
  const appPhase = useGameStore((s) => s.appPhase);
  const bg = regionData?.assets.mainBackground;

  return (
    <div
      className={styles.wrapper}
      style={
        bg
          ? ({
              ['--bg-image' as any]: `url(${bg})`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className={`${styles.gameContainer} ${appPhase !== 'INTRO' ? styles.landscapeContainer : ''}`}>{children}</div>
    </div>
  );
}
