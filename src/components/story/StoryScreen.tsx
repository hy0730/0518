import React, { useMemo, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { storyDataByStageId, type StoryDialogueLine, type StageStory } from '../../data/storyData';
import styles from './StoryScreen.module.css';

export default function StoryScreen() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const unlockedStageId = useGameStore((s) => s.unlockedStageId);
  const playerName = useGameStore((s) => s.playerName);
  const setAppPhase = useGameStore((s) => s.setAppPhase);

  const stage = useMemo<StageStory | null>(() => {
    if (!currentStageId) return null;
    return storyDataByStageId[currentStageId] ?? null;
  }, [currentStageId]);

  const lines = useMemo<StoryDialogueLine[]>(() => {
    if (!stage) return [];
    const who = playerName ? `${playerName} 대원` : '수호대원';
    // 일부 문구에 플레이어 이름이 들어가도록 가볍게 치환
    return stage.dialogues.map((d) => ({ ...d, text: d.text.replaceAll('{PLAYER}', who) }));
  }, [stage, playerName]);

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

  if (!stage) {
    return (
      <div className={styles.fallback}>
        <div style={{ marginBottom: 10 }}>스토리 데이터를 찾을 수 없습니다. (stageId: {currentStageId})</div>
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
          {stage.stageId}. {stage.title}
        </div>
        <button type="button" className={styles.skipBtn} onClick={() => setAppPhase('MINIGAME')}>
          건너뛰기
        </button>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>시대</span>
          <span className={styles.metaVal}>{stage.era}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>위치</span>
          <span className={styles.metaVal}>{stage.location}</span>
        </div>
        <div className={styles.metaDesc}>{stage.description}</div>
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
