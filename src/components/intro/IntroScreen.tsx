import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { nudgeHideBrowserUI, tryEnterFullscreen } from '../../utils/fullscreen';
import styles from './IntroScreen.module.css';

type IntroStep = 1 | 2 | 3 | 4 | 5;

type SceneConfig = {
  bgImage: string;
  title: string;
  text: string;
  buttonLabel: string;
  characterMode: '3d' | '2d' | 'mixed';
  tone?: 'normal' | 'warning';
  missionPoints?: string[];
};

const SCENE_CONFIG: Record<Exclude<IntroStep, 1>, SceneConfig> = {
  2: {
    bgImage: '/assets/images/lab.png',
    title: '문화유산연구원',
    text: "안녕? 나는 안양의 역사를 기록하는 '한'이야.\n문화유산은 옛사람들의 삶과 지혜가 담긴 아주 소중한 보물이지.\n그런데 방금, 심상치 않은 일이 생겼어.",
    buttonLabel: '무슨 일인데?',
    characterMode: '3d',
  },
  3: {
    bgImage: '/assets/images/map_1.png',
    title: '긴급 상황',
    text: "나는 '양'이야! 앗, 큰일 났어!\n안양 지도에서 문화유산들이 빛을 잃고 사라지고 있어!\n이대로면 이름도, 모습도, 천 년의 이야기도 모두 지워질지 몰라!",
    buttonLabel: '어떻게 하면 돼?',
    characterMode: '2d',
    tone: 'warning',
  },
  4: {
    bgImage: '/assets/images/map_2.png',
    title: '수호대 임무',
    text: "그래서 널 '문화유산 수호대'로 부른 거야.\n직접 현장으로 가서 흩어진 조각을 맞추고, 숨겨진 이야기를 해독해 줘!\n이번 복원 작전은 네 활약에 달렸어!",
    buttonLabel: '임무 수락하기',
    characterMode: 'mixed',
    missionPoints: ['문화유산 위치 찾기', '흔적 복원하기', '이야기 되찾기'],
  },
  5: {
    bgImage: '/assets/images/map_real.png',
    title: '출동 준비 완료',
    text: '좋아, 이제 안양 지도를 펼치자!\n빛을 잃은 9개의 문화유산을 찾아내는 거야!\n문화유산 수호대, 지금 바로 출동!',
    buttonLabel: '지도 펼치기',
    characterMode: '2d',
  },
};

export default function IntroScreen() {
  const regionName = useGameStore((s) => s.regionData?.region.name);
  const storedPlayerName = useGameStore((s) => s.playerName);
  const storedPlayerOrg = useGameStore((s) => s.playerOrg);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setPlayerOrg = useGameStore((s) => s.setPlayerOrg);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const isMuted = useGameStore((s) => s.isMuted);

  const [step, setStep] = useState<IntroStep>(1);
  const [glitch, setGlitch] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [org, setOrg] = useState(storedPlayerOrg);
  const [name, setName] = useState(storedPlayerName);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState(false);
  const [enterAnim, setEnterAnim] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pageTurning, setPageTurning] = useState(false);
  const [pageEnter, setPageEnter] = useState(false);
  const stepTimer = useRef<number | null>(null);
  const typingTimer = useRef<number | null>(null);
  const lastClickAt = useRef(0);

  const title = useMemo(() => (regionName ? `${regionName} 문화유산 수호대` : '문화유산 수호대'), [regionName]);

  const bgImage = step === 1 ? '/assets/images/thumnail_1.png' : SCENE_CONFIG[step].bgImage;

  const typingSource = useMemo(() => {
    if (step === 1) return '';
    return SCENE_CONFIG[step].text;
  }, [step]);

  const currentScene = step === 1 ? null : SCENE_CONFIG[step];

  const playSceneSound = async (targetStep: IntroStep) => {
    try {
      const { audio } = await import('../../utils/audio');
      if (targetStep === 2) {
        audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.72);
      } else if (targetStep === 3) {
        audio.playUrl('/assets/sounds/sfx_negative_beep.mp3', 0.72);
      } else if (targetStep === 4) {
        audio.playUrl('/assets/sounds/sfx_interface_click.mp3', 0.68);
      } else if (targetStep === 5) {
        audio.playUrl('/assets/sounds/sfx_unlock.mp3', 0.72);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    setOrg(storedPlayerOrg);
    setName(storedPlayerName);
  }, [storedPlayerOrg, storedPlayerName]);

  const goToNextScene = () => {
    if (isTyping) {
      if (typingTimer.current) window.clearInterval(typingTimer.current);
      typingTimer.current = null;
      setTypedText(typingSource);
      setIsTyping(false);
      return;
    }

    const now = Date.now();
    if (now - lastClickAt.current < 450) return;
    lastClickAt.current = now;

    if (step === 2) {
      setGlitch(true);
      if (stepTimer.current) window.clearTimeout(stepTimer.current);
      stepTimer.current = window.setTimeout(() => {
        setGlitch(false);
        setStep(3);
        void playSceneSound(3);
      }, 800);
      return;
    }

    if (step === 5) {
      void playSceneSound(5);
      setAppPhase('MAP');
      return;
    }

    const nextStep = (step + 1) as IntroStep;
    setStep(nextStep);
    void playSceneSound(nextStep);
  };

  const characterBlock = () => {
    if (!currentScene) return null;
    if (currentScene.characterMode === '3d') {
      return (
        <div className={styles.characters3d}>
          <img src="/assets/images/han_3.png" alt="한 연구원" />
          <img src="/assets/images/yang_3.png" alt="양 연구원" />
        </div>
      );
    }
    if (currentScene.characterMode === 'mixed') {
      return (
        <div className={styles.characters2d}>
          <img src="/assets/images/han_2.png" alt="한" />
          <img src="/assets/images/yang_2.png" alt="양" />
        </div>
      );
    }
    return (
      <div className={styles.characters2d}>
        <img src="/assets/images/han_1.png" alt="한" />
        <img src="/assets/images/yang_1.png" alt="양" />
      </div>
    );
  };

  // 진입 연출 + 페이지 넘김 사운드
  useEffect(() => {
    if (step !== 1) return;
    setEnterAnim(true);
    const t = window.setTimeout(() => setEnterAnim(false), 860);
    // 배경 페이드인과 함께 조용히 등장(사운드는 '시작하기'에서 재생)
    return () => window.clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    if (!typingSource) {
      setIsTyping(false);
      setTypedText('');
      return;
    }

    setIsTyping(true);
    setTypedText('');
    let i = 0;
    typingTimer.current = window.setInterval(() => {
      i += 1;
      setTypedText(typingSource.slice(0, i));
      if (i >= typingSource.length) {
        if (typingTimer.current) window.clearInterval(typingTimer.current);
        typingTimer.current = null;
        setIsTyping(false);
      }
    }, 22);

    return () => {
      if (typingTimer.current) window.clearInterval(typingTimer.current);
      typingTimer.current = null;
    };
  }, [typingSource]);

  return (
    <div className={`${styles.root} ${glitch ? styles.glitch : ''}`} style={{ backgroundImage: `url(${bgImage})` }}>
      {/* 연필 스케치 지도 라인 오버레이(스크랩북 느낌) */}
      <img className={styles.mapOverlay} src="/assets/images/map_main.png" alt="" aria-hidden="true" />

      <div
        className={[
          styles.card,
          enterAnim && step === 1 ? styles.noteOpen : '',
          pageTurning ? styles.pageTurn : '',
          pageEnter ? styles.pageEnter : '',
          exiting ? styles.pageExit : '',
        ].join(' ')}
      >
        {step === 1 && (
          <>
            <div className={styles.title}>{title}</div>
            {!showForm ? (
              <div className={styles.startStage}>
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={async () => {
                    if (pageTurning || exiting) return;

                    // 책장 넘김 + 사운드 (첫 제스처에서 오디오 unlock)
                    try {
                      const { audio } = await import('../../utils/audio');
                      await audio.unlock();
                      // muted 상태일 때만 반영(비뮤트 상태에서 setMuted(false)로 BGM이 켜지는 것을 방지)
                      if (isMuted) audio.setMuted(true);
                      audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75);
                    } catch {
                      // ignore
                    }

                    setPageTurning(true);
                    window.setTimeout(() => {
                      setPageTurning(false);
                      setShowForm(true);
                      setPageEnter(true);
                      window.setTimeout(() => setPageEnter(false), 460);
                    }, 620);
                  }}
                >
                  시작하기
                </button>
              </div>
            ) : (
              <>
                <div className={styles.desc}>
                  안양의 지도가 빛을 잃어버렸어요! 지금 바로 수호대원 정보를 등록하고, 당신만의 '문화유산 복원 노트'를 펼쳐주세요!
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
                      disabled={issued || exiting}
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
                      disabled={issued || exiting}
                    />
                  </label>

                  {error && <div className={styles.error}>{error}</div>}

                  <button
                    type="button"
                    className={`${styles.primaryBtn} ${issued ? styles.primaryBtnPulse : ''}`}
                    onClick={async () => {
                      // 2단 버튼:
                      // 1) 발급 → 2) 복원 노트 펼치기(다음 화면)
                      if (issued) {
                        if (exiting) return;
                        setExiting(true);
                        try {
                          const { audio } = await import('../../utils/audio');
                          audio.playUrl('/assets/sounds/sfx_paper_slide.mp3', 0.75);
                        } catch {
                          // ignore
                        }
                        window.setTimeout(() => {
                          setExiting(false);
                          setStep(2);
                          void playSceneSound(2);
                        }, 520);
                        return;
                      }

                      // A+B+C 조합:
                      // C) 가능한 브라우저에서는 "진짜" 풀스크린 시도 (반드시 사용자 제스처 내에서!)
                      void tryEnterFullscreen();
                      // B) 탭 브라우저에서는 주소창/하단바가 접히도록 스크롤 유도
                      nudgeHideBrowserUI();

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
                        // ignore
                      }
                      setIssued(true);
                    }}
                    disabled={exiting}
                  >
                    {issued ? '복원 노트 펼치기' : '수호대증 발급'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step >= 2 && (
          <>
            <div className={styles.stepBadge}>인트로 {step}/5</div>
            <div className={styles.title}>{currentScene?.title}</div>
            <div className={currentScene?.tone === 'warning' ? styles.warning : styles.desc}>
              {typedText.split('\n').map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>

            {currentScene?.missionPoints?.length ? (
              <div className={styles.missionCard}>
                <div className={styles.missionTitle}>이번 임무</div>
                <div className={styles.missionList}>
                  {currentScene.missionPoints.map((point) => (
                    <div key={point} className={styles.missionItem}>
                      • {point}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {characterBlock()}

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={goToNextScene}
            >
              {currentScene?.buttonLabel ?? '다음'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
