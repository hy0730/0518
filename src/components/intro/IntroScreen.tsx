import React, { useMemo, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './IntroScreen.module.css';

export default function IntroScreen() {
  const regionName = useGameStore((s) => s.regionData?.region.name);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setPlayerOrg = useGameStore((s) => s.setPlayerOrg);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const isMuted = useGameStore((s) => s.isMuted);

  const [org, setOrg] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => (regionName ? `${regionName} 문화유산 수호대` : '문화유산 수호대'), [regionName]);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.title}>{title}</div>
        <div className={styles.desc}>
          문화유산의 기록이 사라지고 있습니다.
          <br />
          문화유산연구원은 당신에게 “수호대원증” 발급을 요청했습니다.
        </div>

        <div className={styles.form}>
          <label className={styles.label}>
            기관(학교)
            <input
              className={styles.input}
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="예) 안양초등학교"
              autoComplete="organization"
            />
          </label>

          <label className={styles.label}>
            이름
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 홍길동"
              autoComplete="name"
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={async () => {
              const trimmedOrg = org.trim();
              const trimmedName = name.trim();
              if (!trimmedOrg || !trimmedName) {
                setError('기관(학교)과 이름을 모두 입력해 주세요.');
                return;
              }

              setError(null);
              setPlayerOrg(trimmedOrg);
              setPlayerName(trimmedName);

              // 사용자 제스처 내에서 오디오 제한 해제 + BGM 재생 시도
              try {
                const { audio } = await import('../../utils/audio');
                await audio.unlock();
                audio.setMuted(isMuted);
                if (!isMuted) {
                  await audio.playBgm();
                }
              } catch {
                // 오디오 실패는 진행에 영향 없도록 무시
              }

              setAppPhase('MAP');
            }}
          >
            수호대원증 발급하고 시작
          </button>
        </div>
      </div>
    </div>
  );
}

