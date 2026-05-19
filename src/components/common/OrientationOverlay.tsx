import React, { useEffect, useState } from 'react';
import styles from './OrientationOverlay.module.css';

type Props = {
  /** true면 세로모드에서만 오버레이 표시 */
  enabled?: boolean;
};

export default function OrientationOverlay({ enabled = true }: Props) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(orientation: portrait)');

    const update = () => {
      // matchMedia가 안 되거나 일부 브라우저에서 부정확할 수 있어 보조 판정도 함께 사용
      const bySize = window.innerHeight > window.innerWidth;
      const byMedia = mq ? mq.matches : false;
      setIsPortrait(byMedia || bySize);
    };

    update();

    // Safari 호환: addEventListener 미지원일 수 있음
    const onChange = () => update();
    try {
      mq?.addEventListener?.('change', onChange);
    } catch {
      mq?.addListener?.(onChange);
    }
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);

    return () => {
      try {
        mq?.removeEventListener?.('change', onChange);
      } catch {
        mq?.removeListener?.(onChange);
      }
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
    };
  }, []);

  if (!enabled) return null;
  if (!isPortrait) return null;

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
