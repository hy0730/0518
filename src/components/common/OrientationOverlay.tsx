import React, { useEffect, useState } from 'react';
import styles from './OrientationOverlay.module.css';

type Props = {
  /** 오리엔테이션 권장 안내 사용 여부 */
  enabled?: boolean;
  /** 어떤 방향이 권장인지 */
  recommended?: 'portrait' | 'landscape';
  /** 화면/스테이지 전환 시 오버레이 상태를 리셋하기 위한 키 */
  contextKey?: string;
};

export default function OrientationOverlay({ enabled = true, recommended = 'landscape', contextKey }: Props) {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  // 화면/스테이지가 바뀌면 다시 안내가 뜰 수 있게 리셋
  useEffect(() => {
    setDismissed(false);
  }, [contextKey, recommended]);

  if (!enabled) return null;

  const mismatch = recommended === 'landscape' ? isPortrait : !isPortrait;
  if (!mismatch) return null;
  if (dismissed) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-label="화면 방향 안내"
      onClick={() => setDismissed(true)}
      onTouchStart={() => setDismissed(true)}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <div className={styles.iconWrap} aria-hidden="true">
          <div className={[styles.phoneIcon, recommended === 'portrait' ? styles.phonePortrait : styles.phoneLandscape].join(' ')} />
        </div>
        <div className={styles.title}>
          {recommended === 'portrait' ? '세로 모드가 더 편해요' : '가로 모드가 더 편해요'}
        </div>
        <div className={styles.desc}>
          {recommended === 'portrait' ? (
            <>
              이 미니게임은 <b>세로 화면</b>에서 더 시원하게 보이도록 설계되어 있어요.
              <br />
              가능하면 기기를 세로로 돌려주세요.
            </>
          ) : (
            <>
              이 화면은 <b>가로 화면</b>에서 더 시원하게 보이도록 설계되어 있어요.
              <br />
              가능하면 기기를 가로로 돌려주세요.
            </>
          )}
        </div>
        <div className={styles.hint}>화면을 한 번 터치하면 계속 진행할 수 있어요.</div>
      </div>
    </div>
  );
}
