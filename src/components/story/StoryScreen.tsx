import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { storyDataByStageId, type StoryDialogueLine, type StageStory } from '../../data/storyData';
import styles from './StoryScreen.module.css';

export default function StoryScreen() {
  const currentStageId = useGameStore((s) => s.currentStageId);
  const unlockedStageId = useGameStore((s) => s.unlockedStageId);
  const playerName = useGameStore((s) => s.playerName);
  const playerOrg = useGameStore((s) => s.playerOrg);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const setStoryIndex = useGameStore((s) => s.setStoryIndex);
  const storedIdx = useGameStore((s) => (currentStageId ? s.storyIndexByStage[currentStageId] ?? 0 : 0));

  const stage = useMemo<StageStory | null>(() => {
    if (!currentStageId) return null;
    return storyDataByStageId[currentStageId] ?? null;
  }, [currentStageId]);

  const lines = useMemo<StoryDialogueLine[]>(() => {
    if (!stage) return [];
    const who = playerName?.trim() ? `${playerName.trim()} 대원` : '수호대원';
    const org = playerOrg?.trim() ? playerOrg.trim() : '수호대';

    const interpolate = (text: string) =>
      text
        .replaceAll('{PLAYER}', who)
        .replaceAll('{ORG}', org)
        // 치환 후 공백이 어색하게 남는 경우 정리
        .replace(/\s{2,}/g, ' ')
        .trim();

    return stage.dialogues.map((d) => ({ ...d, text: interpolate(d.text) }));
  }, [stage, playerName, playerOrg]);

  const [idx, setIdx] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const lastAdvanceAt = useRef(0);

  // 스테이지가 바뀌면 대사 인덱스 초기화
  useEffect(() => {
    setIdx(storedIdx);
  }, [currentStageId]);

  // idx 변화를 store에 저장 (미니게임 뒤로가기에서 복원하기 위함)
  useEffect(() => {
    if (!currentStageId) return;
    setStoryIndex(currentStageId, idx);
  }, [idx, currentStageId]);

  const advance = () => {
    if (!lines.length) return;
    if (idx < lines.length - 1) {
      setIdx((v) => v + 1);
      return;
    }
    setAppPhase('MINIGAME');
  };

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

  const relicMainImage = useMemo(() => {
    const map: Record<number, string> = {
      1: '/assets/images/relic_gwanyang_main.png',
      2: '/assets/images/relic_pyeongchon_main.png',
      3: '/assets/images/relic_seoksu_main.png',
      4: '/assets/images/relic_jungcho_main.png',
      5: '/assets/images/relic_bell_main.png',
      6: '/assets/images/relic_turtle_main.png',
      7: '/assets/images/relic_bisan_main.png',
      8: '/assets/images/relic_bridge_main.png',
      9: '/assets/images/relic_seoimyeon_main.png',
    };
    return map[currentStageId] ?? '';
  }, [currentStageId]);

  // 타입라이터(읽는 시간 확보) - 탭하면 즉시 전체 출력, 다음 탭에 넘어감
  useEffect(() => {
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    setDisplayText('');
    setIsTyping(true);

    const full = line.text;
    let i = 0;
    // 타이핑 속도(천천히, 읽기 쉬운 속도)
    typingTimer.current = window.setInterval(() => {
      i += 1;
      setDisplayText(full.slice(0, i));
      if (i >= full.length) {
        if (typingTimer.current) window.clearInterval(typingTimer.current);
        typingTimer.current = null;
        setIsTyping(false);
      }
    }, 70);

    return () => {
      if (typingTimer.current) window.clearInterval(typingTimer.current);
      typingTimer.current = null;
    };
  }, [line.text]);

  const handleTapToAdvance = () => {
    // 1) 타이핑 중이면 전체 표시
    if (isTyping) {
      if (typingTimer.current) window.clearInterval(typingTimer.current);
      typingTimer.current = null;
      setDisplayText(line.text);
      setIsTyping(false);
      return;
    }

    // 2) 연속 탭 방지(중복 진행)
    const now = Date.now();
    if (now - lastAdvanceAt.current < 450) return;
    lastAdvanceAt.current = now;

    advance();
  };

  return (
    <div
      className={styles.root}
      onPointerDown={(e) => {
        // 모바일에서 click 이벤트가 지연/누락되는 경우가 있어 pointer 기반으로 처리
        const t = e.target as HTMLElement | null;
        const isInteractive = !!t?.closest?.('button, a, input, textarea, select, [role="button"]');
        if (isInteractive) return;
        handleTapToAdvance();
      }}
      onClick={(e) => {
        // 일부 환경에서 pointer 이벤트가 없을 수 있어 click도 보조로 유지
        const t = e.target as HTMLElement | null;
        const isInteractive = !!t?.closest?.('button, a, input, textarea, select, [role="button"]');
        if (isInteractive) return;
        handleTapToAdvance();
      }}
    >
      <div className={styles.header}>
        <div className={styles.stage}>
          {stage.stageId}. {stage.title}
        </div>
        <div className={styles.headerBtns}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={(e) => {
              e.stopPropagation();
              // 타이핑 중이면 먼저 전체 표시
              if (isTyping) {
                if (typingTimer.current) window.clearInterval(typingTimer.current);
                typingTimer.current = null;
                setDisplayText(line.text);
                setIsTyping(false);
                return;
              }
              // 직전 대사로
              if (idx > 0) {
                setIdx((v) => Math.max(0, v - 1));
                return;
              }
              // 첫 대사면 지도(이전 상태)로
              setAppPhase('MAP');
            }}
          >
            ← 뒤로
          </button>
          <button
            type="button"
            className={styles.skipBtn}
            onClick={(e) => {
              e.stopPropagation();
              setAppPhase('MINIGAME');
            }}
          >
            건너뛰기
          </button>
        </div>
      </div>

      {/* 본문: 좌(문화유산 이미지) / 우(설명) 50:50 */}
      <div className={styles.content}>
        <div className={styles.leftPane}>
          {relicMainImage ? <img src={relicMainImage} alt="" draggable={false} /> : <div className={styles.thumbFallback} />}
        </div>
        <div className={styles.rightPane}>
          <div className={styles.meta} data-interactive="true">
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
        </div>
      </div>

      {/* 하단 고정 대사창(얼굴 + 대사) */}
      <div className={styles.dialogueBar} data-interactive="true">
        <div className={styles.dialoguePortrait}>
          <img
            src={line.speaker === 'han' ? '/assets/images/han_2.png' : '/assets/images/yang_2.png'}
            alt={line.speaker === 'han' ? '한' : '양'}
          />
        </div>
        <div className={styles.dialogueContent}>
          <div className={styles.dialogueName}>{line.speaker === 'han' ? '한' : '양'}</div>
          <div className={styles.dialogueText}>{displayText}</div>
          <div className={styles.dialogueHint}>{isTyping ? '탭하면 전체 표시' : '탭하여 계속'}</div>
        </div>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={(e) => {
            e.stopPropagation();
            handleTapToAdvance();
          }}
        >
          {idx < lines.length - 1 ? '다음' : '미니게임'}
        </button>
      </div>
    </div>
  );
}
