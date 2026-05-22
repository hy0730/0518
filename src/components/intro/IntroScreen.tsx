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
      <div className={styles.card}>
        {step === 1 && (
          <>
            <div className={styles.title}>{title}</div>
            <div className={styles.desc}>
              대원증을 발급하고, 안양 문화유산의 기록을 지켜주세요.
              <br />
              정보를 입력하면 연구원 소개로 넘어갑니다.
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

                  setStep(2);
                }}
              >
                대원증 발급 완료
              </button>
            </div>
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
