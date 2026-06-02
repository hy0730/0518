import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { nudgeHideBrowserUI, tryEnterFullscreen } from '../../utils/fullscreen';
import styles from './IntroScreen.module.css';

type IntroStep = 1 | 2 | 3;

export default function IntroScreen() {
  const regionName = useGameStore((s) => s.regionData?.region.name);
  const setPlayerName = useGameStore((s) => s.setPlayerName);
  const setPlayerOrg = useGameStore((s) => s.setPlayerOrg);
  const setAppPhase = useGameStore((s) => s.setAppPhase);
  const isMuted = useGameStore((s) => s.isMuted);

  const [step, setStep] = useState<IntroStep>(1);
  const [glitch, setGlitch] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [org, setOrg] = useState('');
  const [name, setName] = useState('');
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

  const bgImage =
    step === 1 ? '/assets/images/thumnail_1.png' : step === 2 ? '/assets/images/map_real.png' : '/assets/images/map_main.png';

  const typingSource = useMemo(() => {
    if (step === 2) return '우리는 문화유산연구원이야.\n문화유산을 발굴하고 보존하는 일을 하지!';
    if (step === 3) return '앗! 안양 문화유산의 기록이 사라지고 있어!';
    return '';
  }, [step]);

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
            {/* 장식 레이어(극비 서류철 / 다꾸 느낌) */}
            <div className={styles.decor} aria-hidden="true">
              <div className={styles.tapeTL} />
              <div className={styles.tapeTR} />
              <div className={styles.clip} />
              <div className={styles.polaroid}>
                <img src="/assets/images/relic_bridge_3d.png" alt="" draggable={false} />
                <div className={styles.polaroidCap}>현장 사진</div>
              </div>
              <div className={styles.topSecret}>TOP SECRET</div>
            </div>

            <div className={styles.header}>
              <div className={styles.emblem} aria-hidden="true">
                {/* 나침반/방패 느낌 간단 SVG */}
                <svg width="44" height="44" viewBox="0 0 64 64">
                  <path
                    d="M32 4l20 8v18c0 14-9 26-20 30C21 56 12 44 12 30V12l20-8Z"
                    fill="rgba(244,235,217,0.9)"
                    stroke="rgba(74,55,40,0.65)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <circle cx="32" cy="28" r="12" fill="rgba(74,55,40,0.10)" stroke="rgba(74,55,40,0.55)" strokeWidth="3" />
                  <path d="M32 18l6 12-6 8-6-8 6-12Z" fill="rgba(217,83,79,0.85)" stroke="rgba(74,55,40,0.55)" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <div className={styles.secretTitle}>극비 역사 일기장</div>
                <div className={styles.secretSub}>{title}</div>
              </div>
            </div>
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
                  <span className={styles.startIcon} aria-hidden="true">
                    {/* 돋보기 아이콘 */}
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path
                        d="M10.5 3a7.5 7.5 0 105.02 13.06l3.2 3.2a1 1 0 001.41-1.42l-3.2-3.2A7.5 7.5 0 0010.5 3zm0 2a5.5 5.5 0 110 11 5.5 5.5 0 010-11z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  시작하기
                </button>
                <div className={styles.startHint}>펼치는 순간 모험이 시작돼요!</div>
              </div>
            ) : (
              <>
                <div className={styles.desc}>
                  안양의 문화유산 기록이 사라지고 있어요. 수호대원 정보를 등록하고 복원 노트를 열어주세요.
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

        {step === 2 && (
          <>
            <div className={styles.title}>문화유산연구원</div>
            <div className={styles.desc}>
              {typedText.split('\n').map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>

            <div className={styles.characters3d}>
              <img src="/assets/images/han_3.png" alt="한 연구원" />
              <img src="/assets/images/yang_3.png" alt="양 연구원" />
            </div>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                // 타이핑 중이면 먼저 전체 표시
                if (isTyping) {
                  if (typingTimer.current) window.clearInterval(typingTimer.current);
                  typingTimer.current = null;
                  setTypedText(typingSource);
                  setIsTyping(false);
                  return;
                }

                // 연타 방지(중복 진행 방지)
                const now = Date.now();
                if (now - lastClickAt.current < 450) return;
                lastClickAt.current = now;

                // Step3: 글리치 → 2D 전환
                setGlitch(true);
                if (stepTimer.current) window.clearTimeout(stepTimer.current);
                stepTimer.current = window.setTimeout(() => {
                  setGlitch(false);
                  setStep(3);
                }, 800);
              }}
            >
              다음
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className={styles.warning}>{typedText}</div>

            <div className={styles.characters2d}>
              <img src="/assets/images/han_1.png" alt="한" />
              <img src="/assets/images/yang_1.png" alt="양" />
            </div>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
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
                setAppPhase('MAP');
              }}
            >
              지도 화면으로 이동
            </button>
          </>
        )}
      </div>
    </div>
  );
}
