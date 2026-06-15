import type { PropsWithChildren } from 'react';
import React, { useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './GameWrapper.module.css';

export default function GameWrapper({ children }: PropsWithChildren) {
  const regionData = useGameStore((s) => s.regionData);
  const appPhase = useGameStore((s) => s.appPhase);
  const isDevMode = useGameStore((s) => s.isDevMode);
  const toggleDevMode = useGameStore((s) => s.toggleDevMode);
  const bg = regionData?.assets.mainBackground;
  const tapTimesRef = useRef<number[]>([]);
  const [devToast, setDevToast] = useState('');

  const handleLogoTap = () => {
    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.filter((t) => now - t < 1800), now];
    if (tapTimesRef.current.length < 5) return;
    tapTimesRef.current = [];
    const nextLabel = !isDevMode ? '개발자 모드 ON' : '개발자 모드 OFF';
    toggleDevMode();
    setDevToast(nextLabel);
    window.setTimeout(() => setDevToast(''), 1400);
  };

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

      <button
        type="button"
        className={styles.devLogoButton}
        onPointerUp={handleLogoTap}
        aria-label="개발자 모드 로고"
      >
        <img src="/assets/images/logo_1.png" alt="" aria-hidden="true" className={styles.devLogoImage} draggable={false} />
      </button>

      {devToast ? <div className={styles.devToast}>{devToast}</div> : null}
    </div>
  );
}
