import React, { useMemo, useState } from 'react';
import { storyDataByStageId } from '../../data/storyData';
import { useGameStore } from '../../store/useGameStore';
import styles from './EndingScreen.module.css';

type EndingStep = 1 | 2 | 3;

export default function EndingScreen() {
  const playerName = useGameStore((s) => s.playerName);
  const playerOrg = useGameStore((s) => s.playerOrg);
  const unlockedStageId = useGameStore((s) => s.unlockedStageId);
  const regionName = useGameStore((s) => s.regionData?.region.name ?? '안양');
  const setAppPhase = useGameStore((s) => s.setAppPhase);

  const [step, setStep] = useState<EndingStep>(1);
  const completedCount = Math.max(0, Math.min(9, unlockedStageId - 1));

  const recoveredTitles = useMemo(() => {
    return Array.from({ length: completedCount }, (_, idx) => storyDataByStageId[idx + 1]?.title ?? `스테이지 ${idx + 1}`);
  }, [completedCount]);

  const headline = useMemo(() => {
    if (step === 1) return `${regionName} 문화유산 복원 완료`;
    if (step === 2) return '되찾은 문화유산 기록';
    return '문화유산 수호대 임무 완료';
  }, [regionName, step]);

  const description = useMemo(() => {
    const who = playerName ? `${playerName} 대원` : '수호대원';
    const org = playerOrg ? `${playerOrg}의 ` : '';
    if (step === 1) {
      return `${org}${who}, 수고했어!\n흩어졌던 ${regionName}의 문화유산 기록이 다시 제자리를 찾기 시작했어.\n한이와 양이 덕분에 안양의 시간이 다시 이어졌어.`;
    }
    if (step === 2) {
      return `이번 탐험으로 되찾은 문화유산은 모두 ${completedCount}개야.\n선사 시대의 흔적부터 조선 시대의 도자기와 다리까지,\n${regionName}의 이야기가 한 장의 지도로 다시 이어졌어.`;
    }
    return `${who}, 이제 너는 ${regionName} 문화유산 수호대의 정식 대원이야.\n언제든 다시 지도로 돌아가 인트로와 아웃트로를 재생하며 장면을 다듬을 수 있어.`;
  }, [completedCount, playerName, playerOrg, regionName, step]);

  return (
    <div className={styles.root} style={{ backgroundImage: `url(/assets/images/map_real.png)` }}>
      <img className={styles.overlay} src="/assets/images/map_main.png" alt="" aria-hidden="true" />

      <div className={styles.card}>
        <div className={styles.eyebrow}>아웃트로</div>
        <div className={styles.title}>{headline}</div>
        <div className={styles.desc}>{description}</div>

        {step === 1 && (
          <div className={styles.characters}>
            <img src="/assets/images/han_1.png" alt="한" />
            <img src="/assets/images/yang_1.png" alt="양" />
          </div>
        )}

        {step === 2 && (
          <div className={styles.listCard}>
            <div className={styles.listTitle}>이번에 되찾은 문화유산</div>
            <div className={styles.list}>
              {recoveredTitles.length > 0 ? (
                recoveredTitles.map((title) => (
                  <div key={title} className={styles.item}>
                    • {title}
                  </div>
                ))
              ) : (
                <div className={styles.item}>• 아직 복원된 문화유산이 없어. 개발 중엔 버튼으로 장면만 먼저 확인할 수 있어.</div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stamp}>
            <div className={styles.stampTitle}>수호대 인증 완료</div>
            <div className={styles.stampDesc}>
              안양의 문화유산을 지키는 임무를 성공적으로 마쳤어요.
              <br />
              필요하면 메인 지도에서 인트로와 아웃트로를 다시 재생해 연출을 계속 다듬어보자.
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => {
              if (step === 1) {
                setAppPhase('MAP');
                return;
              }
              setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as EndingStep)));
            }}
          >
            {step === 1 ? '지도로 돌아가기' : '이전'}
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              if (step === 3) {
                setAppPhase('MAP');
                return;
              }
              setStep((prev) => ((prev + 1) as EndingStep));
            }}
          >
            {step === 3 ? '지도로 돌아가기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
