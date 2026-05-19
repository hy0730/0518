import React, { useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import styles from './InstallBanner.module.css';

export default function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt();
  const [closed, setClosed] = useState(false);

  if (!canInstall || closed) return null;

  return (
    <div
      className={styles.banner}
      onClick={(e) => {
        // 배너 클릭이 맵으로 전달되지 않도록
        e.stopPropagation();
      }}
    >
      <div className={styles.text}>
        <div className={styles.title}>앱으로 설치하면 더 편해요</div>
        <div className={styles.desc}>홈 화면에 추가(Standalone)로 실행할 수 있습니다.</div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.installBtn}
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await promptInstall();
            setClosed(true);
          }}
        >
          설치
        </button>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
            setClosed(true);
          }}
          aria-label="닫기"
          title="닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
}

