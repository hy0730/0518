import React from 'react';
import styles from './OrientationOverlay.module.css';

type Props = {
  /** true면 세로모드에서만 오버레이 표시 */
  enabled?: boolean;
};

export default function OrientationOverlay({ enabled = true }: Props) {
  if (!enabled) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="가로 모드 안내">
      <div className={styles.card}>
        <div className={styles.iconWrap} aria-hidden="true">
          <div className={styles.phoneIcon} />
        </div>
        <div className={styles.title}>화면을 가로로 돌려주세요</div>
        <div className={styles.desc}>
          미니게임은 <b>가로 화면</b>에 최적화되어 있습니다.
          <br />
          회전 잠금을 해제하고 기기를 돌려주세요.
        </div>
      </div>
    </div>
  );
}

