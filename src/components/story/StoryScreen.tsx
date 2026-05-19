import React, { useMemo, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import styles from './StoryScreen.module.css';

type Line = {
  speaker: 'han' | 'yang';
  text: string;
};

export default function StoryScreen() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const unlockedStageId = useGameStore((s) => s.unlockedStageId);
  const playerName = useGameStore((s) => s.playerName);
  const regionData = useGameStore((s) => s.regionData);
  const setAppPhase = useGameStore((s) => s.setAppPhase);

  const stageTitle = useMemo(() => {
    if (!currentStageId || !regionData) return '';
    return regionData.map.nodes[currentStageId - 1]?.title ?? '';
  }, [currentStageId, regionData]);

  const lines = useMemo<Line[]>(() => {
    if (!currentStageId) return [];
    const who = playerName ? `${playerName} 대원` : '수호대원';
    return [
      { speaker: 'han', text: `${who}, 긴급 상황이야. 문화유산 기록이 빠르게 사라지고 있어.` },
      { speaker: 'yang', text: `우리가 지금 바로 조사해야 해. 목표 지점: ${stageTitle || `스테이지 ${currentStageId}`}.` },
      { speaker: 'han', text: `준비됐으면 미니게임으로 들어가서 단서를 확보하자.` },
    ];
  }, [currentStageId, playerName, stageTitle]);

  const [idx, setIdx] = useState(0);

  if (!currentStageId) {
    return (
      <div className={styles.fallback}>
        <div style={{ marginBottom: 10 }}>진행 중인 스테이지가 없습니다.</div>
        <button type="button" onClick={() => setAppPhase('MAP')}>
          지도로 돌아가기
        </button>
      </div>
    );
  }

  // 새로고침 등으로 스토리 화면이 남았는데, 진행도가 맞지 않으면 MAP으로
  if (currentStageId > unlockedStageId) {
    return (
      <div className={styles.fallback}>
        <div style={{ marginBottom: 10 }}>아직 잠긴 스테이지입니다.</div>
        <button type="button" onClick={() => setAppPhase('MAP')}>
          지도로 돌아가기
        </button>
      </div>
    );
  }

  const line = lines[idx] ?? lines[lines.length - 1];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.stage}>
          {currentStageId}. {stageTitle || '스토리'}
        </div>
        <button type="button" className={styles.skipBtn} onClick={() => setAppPhase('MINIGAME')}>
          건너뛰기
        </button>
      </div>

      <div className={styles.scene}>
        <div className={`${styles.character} ${styles.left}`}>
          <img src="/assets/images/han_1.png" alt="한" />
        </div>
        <div className={`${styles.character} ${styles.right}`}>
          <img src="/assets/images/yang_1.png" alt="양" />
        </div>

        <div className={`${styles.bubble} ${line.speaker === 'han' ? styles.bubbleLeft : styles.bubbleRight}`}>
          {line.text}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={() => {
            if (idx < lines.length - 1) {
              setIdx((v) => v + 1);
              return;
            }
            setAppPhase('MINIGAME');
          }}
        >
          {idx < lines.length - 1 ? '다음' : '미니게임 시작'}
        </button>
      </div>
    </div>
  );
}

