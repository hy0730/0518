import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MinigameProps } from '../../../types/game';
import { audio } from '../../../utils/audio';
import { storyDataByStageId } from '../../../data/storyData';
import { getRelicMainImage, getRelicRealImage } from '../../../utils/relicImages';
import { useToast } from '../common/useToast';
import { useGameTuning } from '../../common/GameTuningContext';

type Phase = 'QUARRY' | 'BIND' | 'PREPARE' | 'MOVE';
type TutorialMode = 'DIALOGUE' | 'WEDGE' | 'LOG' | 'PULL' | 'DONE';

const TARGET_PROGRESS = 85; // 기준(기본) 목표 진행도
const MAX_MOVE_PERCENT = 55; // 기준(기본) 이동 연출 최대치(%)
const QUARRY_SWELL_MS = 1500;
const QUARRY_SHAKE_MS = 650;
// 덮개돌(밧줄 돌) 위치 미세 조정: 값이 작을수록(음수) mountain 쪽으로 이동
const CAPSTONE_X_OFFSET_PX = -28;

const WEDGE_POS = [
  { left: '58%', top: '38%' },
  { left: '44%', top: '54%' },
  { left: '62%', top: '64%' },
] as const;

export default function DolmenGame({ stageId, onComplete, regionData }: MinigameProps) {
  const stageTitle = useMemo(
    () => storyDataByStageId[stageId]?.title ?? regionData?.map?.nodes?.[stageId - 1]?.title ?? `스테이지 ${stageId}`,
    [regionData, stageId]
  );
  const title = `${stageTitle} · 고인돌 옮기기`;
  const realImg = useMemo(() => getRelicRealImage(stageId), [stageId]);
  const mainImg = useMemo(() => getRelicMainImage(stageId), [stageId]);

  const [phase, setPhase] = useState<Phase>('QUARRY');
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const startIfNeeded = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  // QUARRY
  const [wedgeSlots, setWedgeSlots] = useState<(null | 'wedge')[]>([null, null, null]);
  const [mountainShake, setMountainShake] = useState(false);
  const [wedgeSwelling, setWedgeSwelling] = useState(false);
  const [rockFallen, setRockFallen] = useState(false);

  // BIND/PREPARE/MOVE
  const [ropeBound, setRopeBound] = useState(false);
  const [logSlots, setLogSlots] = useState<(null | 'log')[]>([null, null, null]);
  const [logsCount, setLogsCount] = useState(3);
  const [progress, setProgress] = useState(10);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState(false);

  // 튜토리얼(첫 진입): 쐐기+물 → 굴림대 → 당기기
  const [tutorialMode, setTutorialMode] = useState<TutorialMode>('DIALOGUE');
  const [tutorialIdx, setTutorialIdx] = useState(0);
  const [tText, setTText] = useState('');
  const [tTyping, setTTyping] = useState(false);
  const tTimer = useRef<number | null>(null);
  const { toast, showToast } = useToast(1200);
  const tuning = useGameTuning();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const workAreaRef = useRef<HTMLDivElement | null>(null);
  const [workWidth, setWorkWidth] = useState(0);
  const ui = useMemo(() => {
    const get = (k: string, fallback: number) => tuning?.getNumber(k, fallback) ?? fallback;
    return {
      mountainX: get('mountainX', 0),
      mountainY: get('mountainY', 0),
      mountainScale: get('mountainScale', 1),
      workX: get('workX', 0),
      workY: get('workY', 0),
      workScale: get('workScale', 1),
      capstoneX: get('capstoneX', 0),
      capstoneY: get('capstoneY', 0),
      capstoneScale: get('capstoneScale', 1),
      logsX: get('logsX', 0),
      logsY: get('logsY', 0),
      logsScale: get('logsScale', 1),
      goalX: get('goalX', 0),
      goalY: get('goalY', 0),
      goalScale: get('goalScale', 1),
      actionBarY: get('actionBarY', 0),
    };
  }, [tuning]);

  // 목표(굴) X 위치와 "완료 판정" 연동: 작업공간 너비(스케일까지 포함)를 기준으로 px→progress 변환
  useLayoutEffect(() => {
    const el = workAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setWorkWidth(r.width);
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setWorkWidth(r.width);
    return () => ro.disconnect();
  }, []);

  const targetProgress = useMemo(() => {
    if (!workWidth) return TARGET_PROGRESS;
    const pxPerProgress = (workWidth * (MAX_MOVE_PERCENT / 100)) / TARGET_PROGRESS;
    if (!pxPerProgress || !Number.isFinite(pxPerProgress)) return TARGET_PROGRESS;
    const shifted = TARGET_PROGRESS + ui.goalX / pxPerProgress;
    return Math.max(10, Math.min(100, Math.round(shifted)));
  }, [workWidth, ui.goalX]);

  const targetProgressRef = useRef(targetProgress);
  useEffect(() => {
    targetProgressRef.current = targetProgress;
  }, [targetProgress]);

  const dragRef = useRef<null | {
    target: 'mountain' | 'work' | 'capstone' | 'logs' | 'goal' | 'action';
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !tuning || tuning.locked || !tuning.innerTunerOpen) return;
      const el = rootRef.current;
      const scale = el ? Math.max(el.getBoundingClientRect().width / Math.max(el.offsetWidth, 1), 0.0001) : 1;
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      if (drag.target === 'mountain') {
        tuning.setNumber('mountainX', drag.baseX + dx);
        tuning.setNumber('mountainY', drag.baseY + dy);
      } else if (drag.target === 'work') {
        tuning.setNumber('workX', drag.baseX + dx);
        tuning.setNumber('workY', drag.baseY + dy);
      } else if (drag.target === 'capstone') {
        tuning.setNumber('capstoneX', drag.baseX + dx);
        tuning.setNumber('capstoneY', drag.baseY + dy);
      } else if (drag.target === 'logs') {
        tuning.setNumber('logsX', drag.baseX + dx);
        tuning.setNumber('logsY', drag.baseY + dy);
      } else if (drag.target === 'goal') {
        tuning.setNumber('goalX', drag.baseX + dx);
        tuning.setNumber('goalY', drag.baseY + dy);
      } else {
        tuning.setNumber('actionBarY', drag.baseY + dy);
      }
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [tuning]);

  // 통나무 배치 이후(당기기 안내) 대사 모달
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postIdx, setPostIdx] = useState(0);
  const [postText, setPostText] = useState('');
  const [postTyping, setPostTyping] = useState(false);
  const postTimer = useRef<number | null>(null);

  const allWedgesPlaced = wedgeSlots.every((s) => s === 'wedge');
  const allLogsPlaced = logSlots.every((s) => s === 'log');

  const canUseHand =
    !postModalOpen &&
    ((phase === 'BIND' && rockFallen && !ropeBound) || (phase === 'MOVE' && allLogsPlaced)) &&
    (tutorialMode === 'DONE' || tutorialMode === 'PULL');

  const guideText = useMemo(() => {
    if (feedback) return feedback;
    if (phase === 'QUARRY') return '나무쐐기 3개를 바위 틈에 꽂고, 물을 뿌려 바위를 쪼개보자!';
    if (phase === 'BIND') return '협동(손) 버튼을 눌러 밧줄로 묶어보자!';
    if (phase === 'PREPARE') return '통나무 3개를 돌 아래에 깔아주세요.';
    if (phase === 'MOVE') {
      return tutorialMode === 'PULL'
        ? '튜토리얼: 협동(손) 버튼을 한 번 눌러 “밧줄을 당기는 느낌”을 체험해보자!'
        : `협동(손) 버튼을 연타해서 돌을 옮기자! 목표: ${targetProgress}%`;
    }
    return '';
  }, [feedback, phase, tutorialMode, targetProgress]);

  const tutorialLines = useMemo(
    () => [
      {
        speaker: 'han' as const,
        text: '여기는 평촌동 지석묘야! 청동기 시대의 무덤인 커다란 고인돌이 있는 곳이지.',
      },
      {
        speaker: 'yang' as const,
        text: '앗, 덮개돌이 아직 제자리에 올라가지 못했어. 무거운 돌을 목적지까지 옮기려면 당시 사람들의 지혜가 필요해!',
      },
      {
        speaker: 'han' as const,
        text: '먼저 덮개돌을 분리해야 해. 나무쐐기를 돌 틈에 끼우고 물을 뿌려보자!',
      },
      {
        speaker: 'yang' as const,
        text: '아래에 반짝이는 나무쐐기를 클릭해 줘!',
      },
    ],
    []
  );

  // 튜토리얼 타입라이터
  useEffect(() => {
    if (tutorialMode !== 'DIALOGUE') return;
    if (tTimer.current) window.clearInterval(tTimer.current);
    const full = tutorialLines[tutorialIdx]?.text ?? '';
    setTText('');
    setTTyping(true);
    let i = 0;
    tTimer.current = window.setInterval(() => {
      i += 1;
      setTText(full.slice(0, i));
      if (i >= full.length) {
        if (tTimer.current) window.clearInterval(tTimer.current);
        tTimer.current = null;
        setTTyping(false);
      }
    }, 55);
    return () => {
      if (tTimer.current) window.clearInterval(tTimer.current);
      tTimer.current = null;
    };
  }, [tutorialMode, tutorialIdx, tutorialLines]);

  useEffect(() => {
    return () => {
      if (tTimer.current) window.clearInterval(tTimer.current);
      if (postTimer.current) window.clearInterval(postTimer.current);
    };
  }, []);

  const postLines = useMemo(
    () => [
      {
        speaker: 'han' as const,
        text: '완벽해! 통나무 위로 돌이 굴러가면 훨씬 적은 힘으로도 무거운 돌을 옮길 수 있어.',
      },
      {
        speaker: 'yang' as const,
        text: '이제 화면의 협동(손) 버튼을 눌러서 밧줄을 당겨보자. 목적지까지 다 같이 영차! 영차!',
      },
    ],
    []
  );

  // 통나무 배치 완료 후 "당기기" 안내 모달 타입라이터
  useEffect(() => {
    if (!postModalOpen) return;
    if (postTimer.current) window.clearInterval(postTimer.current);
    const full = postLines[postIdx]?.text ?? '';
    setPostText('');
    setPostTyping(true);
    let i = 0;
    postTimer.current = window.setInterval(() => {
      i += 1;
      setPostText(full.slice(0, i));
      if (i >= full.length) {
        if (postTimer.current) window.clearInterval(postTimer.current);
        postTimer.current = null;
        setPostTyping(false);
      }
    }, 55);
    return () => {
      if (postTimer.current) window.clearInterval(postTimer.current);
      postTimer.current = null;
    };
  }, [postModalOpen, postIdx, postLines]);

  const placeWedgeToFirstEmpty = () => {
    setWedgeSlots((prev) => {
      const i = prev.findIndex((x) => !x);
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = 'wedge';
      return next;
    });
  };

  const placeLogToFirstEmpty = () => {
    if (logsCount <= 0) return;
    setLogSlots((prev) => {
      const i = prev.findIndex((x) => !x);
      if (i < 0) return prev;
      const next = prev.slice();
      next[i] = 'log';
      return next;
    });
    setLogsCount((c) => Math.max(0, c - 1));
    audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.75);
  };

  // PREPARE 완료 → MOVE로
  useEffect(() => {
    if (phase !== 'PREPARE') return;
    if (!allLogsPlaced) return;
    setFeedback('통나무를 모두 깔았어요! 이제 손 아이콘을 눌러 돌을 옮겨볼까요?');
    const t = window.setTimeout(() => setFeedback(null), 1200);
    setPhase('MOVE');
    return () => window.clearTimeout(t);
  }, [phase, allLogsPlaced]);

  // 튜토리얼: 쐐기+물 성공(떼돌 낙하) 후, 밧줄 묶기는 자동 처리하고 통나무 안내로 전환
  useEffect(() => {
    if (tutorialMode !== 'WEDGE') return;
    if (phase !== 'BIND') return;
    if (!rockFallen) return;
    if (ropeBound) return;
    startIfNeeded();
    setRopeBound(true);
    setPhase('PREPARE');
    setTutorialMode('LOG');
    showToast('좋아요! 이제 통나무(굴림대)를 깔아보자!');
  }, [tutorialMode, phase, rockFallen, ropeBound]);

  // 튜토리얼: 통나무 배치 완료 후 당기기 안내 모달
  useEffect(() => {
    if (tutorialMode !== 'LOG') return;
    if (phase !== 'MOVE') return;
    setTutorialMode('PULL');
    setPostIdx(0);
    setPostModalOpen(true);
  }, [tutorialMode, phase]);

  const water = () => {
    if (phase !== 'QUARRY') return;
    if (tutorialMode !== 'DONE' && tutorialMode !== 'WEDGE') return;
    if (!allWedgesPlaced) return;
    if (wedgeSwelling || mountainShake || rockFallen) return;

    startIfNeeded();
    setAttempts((a) => a + 1);
    audio.playUrl('/assets/sounds/sfx_scan.mp3', 0.6);

    // Step 1: 흡수/팽창 (1.5초)
    setFeedback('물을 머금은 쐐기가 천천히 팽창하고 있어요…');
    setWedgeSwelling(true);

    window.setTimeout(() => {
      setWedgeSwelling(false);

      // Step 2: 균열(강한 흔들림)
      setFeedback('바위에 균열이 생기고 있어요!');
      setMountainShake(true);
      audio.playUrl('/assets/sounds/sfx_rock_impact.mp3', 0.9);

      window.setTimeout(() => {
        setMountainShake(false);

        // Step 3: 채석 (떼돌 낙하)
        setRockFallen(true);
        audio.playUrl('/assets/sounds/sfx_stone_hit.mp3', 0.95);
        setFeedback('쿵! 덮개돌이 떨어졌어요!');
        window.setTimeout(() => setFeedback(null), 1000);
        setPhase('BIND');
      }, QUARRY_SHAKE_MS);
    }, QUARRY_SWELL_MS);
  };

  const bindRope = () => {
    if (phase !== 'BIND') return;
    if (tutorialMode === 'LOG' || tutorialMode === 'PULL') return;
    if (!rockFallen || ropeBound) return;
    startIfNeeded();
    setAttempts((a) => a + 1);
    setRopeBound(true);
    audio.playUrl('/assets/sounds/sfx_fix.mp3', 0.85);
    setFeedback('좋아요! 밧줄로 단단히 묶었어요.');
    window.setTimeout(() => setFeedback(null), 900);
    setPhase('PREPARE');
  };

  const moveOnce = () => {
    if (phase !== 'MOVE') return;
    if (postModalOpen) return;
    if (tutorialMode !== 'DONE' && tutorialMode !== 'PULL') return;
    if (!allLogsPlaced) return;
    if (resultModal) return;

    if (tutorialMode === 'PULL') {
      setTutorialMode('DONE');
      showToast('이제 계속 눌러서 목적지까지 옮겨보자!');
    }

    startIfNeeded();
    setAttempts((a) => a + 1);
    audio.playUrl('/assets/sounds/sfx_stone_move_1.mp3', 0.85);

    setProgress((p) => {
      const delta = 5 + Math.floor(Math.random() * 4); // 5~8
      const next = Math.min(100, p + delta);
      if (next >= targetProgressRef.current) {
        window.setTimeout(() => {
          setResultModal(true);
          audio.playUrl('/assets/sounds/sfx_completed.mp3', 0.9);
        }, 450);
      }
      return next;
    });
  };

  return (
    <div ref={rootRef} className="w-full h-full p-2 text-ink flex flex-col relative">
      <style>{`
        @keyframes shake {
          0% { transform: translate(0,0) rotate(0); }
          20% { transform: translate(-10px, 2px) rotate(-1deg); }
          40% { transform: translate(10px, -2px) rotate(1deg); }
          60% { transform: translate(-8px, -2px) rotate(-0.7deg); }
          80% { transform: translate(8px, 2px) rotate(0.7deg); }
          100% { transform: translate(0,0) rotate(0); }
        }
        .shakeFx { animation: shake 520ms ease-in-out; }

        @keyframes shakeStrong {
          0% { transform: translate(0,0) rotate(0); }
          18% { transform: translate(-18px, 4px) rotate(-1.8deg); }
          36% { transform: translate(18px, -4px) rotate(1.8deg); }
          54% { transform: translate(-14px, -3px) rotate(-1.2deg); }
          72% { transform: translate(14px, 3px) rotate(1.2deg); }
          100% { transform: translate(0,0) rotate(0); }
        }
        .shakeStrongFx { animation: shakeStrong ${QUARRY_SHAKE_MS}ms ease-in-out; }

        /* 팽창은 Tailwind transition+scale로 처리 */

        @keyframes fall {
          0% { transform: translate(0, -120px) rotate(-8deg); opacity: 0; }
          35% { opacity: 1; }
          100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
        }
        .fallFx { animation: fall 620ms ease-out; }
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black tracking-tight">스테이지 {stageId} · {title}</div>
        <div className="text-xs font-bold opacity-90">
          {phase} · 진행 {Math.min(progress, targetProgress)}% · 시도 {attempts}
        </div>
      </div>

      {/* 스크롤 없이 화면 내에 맞추기: 보드(가변) + 하단 고정바(고정 높이) */}
      <div className="mt-2 flex-1 min-h-0">
        <div className="h-full rounded-3xl border border-ink/30 bg-paper2/90 flex flex-col min-h-0 shadow-paper overflow-hidden">
          <div className="px-3 py-2 text-sm font-extrabold border-b border-ink/15">
            {phase === 'QUARRY' && '채석 (나무쐐기 + 물의 팽창)'}
            {phase === 'BIND' && '밧줄 묶기'}
            {phase === 'PREPARE' && '통나무(굴림대) 깔기'}
            {phase === 'MOVE' && '이동'}
          </div>

          {/* 실제 플레이 영역(게임 보드) */}
          <div
            className="relative flex-1 min-h-0 border-b border-ink/15 overflow-hidden bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage:
                "linear-gradient(rgba(244,235,217,0.10),rgba(244,235,217,0.30)), url('/assets/images/capstone_map.png')",
            }}
          >
            {/* 좌측 바위산 */}
            <div
              className={[
                // mountain 이미지를 더 왼쪽에 딱 붙게
                'absolute left-0 top-0 bottom-0 w-[34%] max-w-[240px]',
                mountainShake ? 'shakeStrongFx' : '',
                tutorialMode === 'WEDGE' ? 'ring-4 ring-amber-300/25' : '',
              ].join(' ')}
              style={{
                transform: `translate(${ui.mountainX}px, ${ui.mountainY}px) scale(${ui.mountainScale})`,
                transformOrigin: 'left top',
                touchAction: tuning?.innerTunerOpen ? 'none' : undefined,
              }}
              onPointerDown={(e) => {
                if (!tuning?.innerTunerOpen || tuning.locked) return;
                e.stopPropagation();
                dragRef.current = {
                  target: 'mountain',
                  startX: e.clientX,
                  startY: e.clientY,
                  baseX: ui.mountainX,
                  baseY: ui.mountainY,
                };
              }}
            >
              {tuning?.innerTunerOpen && !tuning.locked && (
                <div className="absolute inset-0 z-20 rounded-2xl ring-2 ring-sky-300/60 bg-sky-100/10 pointer-events-none" />
              )}
              <img
                src="/assets/images/capstone_mountain.png"
                alt="바위산"
                className="w-full h-full object-contain object-left select-none"
                draggable={false}
              />

              {/* 쐐기 슬롯 3개 */}
              <div className="absolute inset-0">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute w-12 h-12 rounded-xl border-2 border-dashed border-ink/30 bg-paper/55 grid place-items-center"
                    style={{
                      left: WEDGE_POS[i].left,
                      top: WEDGE_POS[i].top,
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (phase !== 'QUARRY') return;
                      if (tutorialMode !== 'DONE' && tutorialMode !== 'WEDGE') return;
                      const raw = e.dataTransfer.getData('text/plain');
                      if (raw !== 'wedge') return;
                      setWedgeSlots((prev) => {
                        if (prev[i]) return prev;
                        const next = prev.slice();
                        next[i] = 'wedge';
                        return next;
                      });
                      audio.playUrl('/assets/sounds/sfx_wood_door.mp3', 0.6);
                    }}
                    onClick={() => {
                      if (phase !== 'QUARRY') return;
                      if (tutorialMode !== 'DONE' && tutorialMode !== 'WEDGE') return;
                      if (wedgeSlots[i]) return;
                      startIfNeeded();
                      setWedgeSlots((prev) => {
                        const next = prev.slice();
                        next[i] = 'wedge';
                        return next;
                      });
                      audio.playUrl('/assets/sounds/sfx_wood_door.mp3', 0.6);
                    }}
                    title="쐐기를 꽂아보자"
                  >
                    {wedgeSlots[i] ? (
                      <img
                        src="/assets/images/wood_wedge.png"
                        alt="쐐기"
                        className={[
                          'w-9 h-9 object-contain transition-transform transition-[filter] duration-[1500ms] origin-center',
                          wedgeSwelling ? 'scale-150 brightness-75' : 'scale-100 brightness-100',
                        ].join(' ')}
                        draggable={false}
                      />
                    ) : (
                      <span className="text-xs opacity-70">틈</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 우측 작업 공간 */}
            <div
              ref={workAreaRef}
              className="absolute left-[36%] right-2 top-2 bottom-2"
              style={{
                transform: `translate(${ui.workX}px, ${ui.workY}px) scale(${ui.workScale})`,
                transformOrigin: 'left top',
                touchAction: tuning?.innerTunerOpen ? 'none' : undefined,
              }}
              onPointerDown={(e) => {
                if (!tuning?.innerTunerOpen || tuning.locked) return;
                // 버튼/슬롯 클릭은 그대로, 빈 영역만 드래그 허용
                if ((e.target as HTMLElement).closest('button, [role="button"], [data-interactive="true"]')) return;
                e.stopPropagation();
                dragRef.current = { target: 'work', startX: e.clientX, startY: e.clientY, baseX: ui.workX, baseY: ui.workY };
              }}
            >
              {tuning?.innerTunerOpen && !tuning.locked && (
                <div className="absolute inset-0 z-10 rounded-3xl ring-2 ring-sky-300/60 bg-sky-100/10 pointer-events-none" />
              )}
              {/* 떼돌(밧줄 묶기 전): 바위산 바로 옆에 고정 배치 */}
              {phase === 'BIND' && rockFallen && !ropeBound && (
                <img
                  src="/assets/images/capstone_raw.png"
                  alt="떼돌"
                  className="absolute left-0 top-[18%] w-[clamp(170px,32vw,280px)] select-none object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)] fallFx"
                  style={{
                    left: `${CAPSTONE_X_OFFSET_PX}px`,
                    transform: `translate(${ui.capstoneX}px, ${ui.capstoneY}px) scale(${ui.capstoneScale})`,
                    transformOrigin: 'left top',
                    touchAction: tuning?.innerTunerOpen ? 'none' : undefined,
                  }}
                  onPointerDown={(e) => {
                    if (!tuning?.innerTunerOpen || tuning.locked) return;
                    e.stopPropagation();
                    dragRef.current = { target: 'capstone', startX: e.clientX, startY: e.clientY, baseX: ui.capstoneX, baseY: ui.capstoneY };
                  }}
                  draggable={false}
                />
              )}

              {/* 떨어진 돌/밧줄 돌/통나무/이동 그룹 */}
              <div className="absolute left-[6%] right-[6%] top-[12%]">
                <div
                  className="relative transition-transform duration-500 ease-out"
                  style={{
                    transform:
                      phase === 'MOVE'
                        ? `translateX(${(progress / Math.max(1, targetProgress)) * MAX_MOVE_PERCENT}%)`
                        : 'translateX(0%)',
                  }}
                >
                  {/* 돌 이미지(밧줄 묶인 이후: 이동 그룹에 포함) */}
                  {ropeBound && (
                    <img
                      src="/assets/images/capstone_rope.png"
                      alt="떼돌"
                      className="w-[clamp(170px,32vw,280px)] select-none object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                      style={{
                        marginLeft: `${CAPSTONE_X_OFFSET_PX}px`,
                        transform: `translate(${ui.capstoneX}px, ${ui.capstoneY}px) scale(${ui.capstoneScale})`,
                        transformOrigin: 'left top',
                        touchAction: tuning?.innerTunerOpen ? 'none' : undefined,
                      }}
                      onPointerDown={(e) => {
                        if (!tuning?.innerTunerOpen || tuning.locked) return;
                        e.stopPropagation();
                        dragRef.current = { target: 'capstone', startX: e.clientX, startY: e.clientY, baseX: ui.capstoneX, baseY: ui.capstoneY };
                      }}
                      draggable={false}
                    />
                  )}

                  {/* 통나무(돌 아래) */}
                  {(phase === 'PREPARE' || phase === 'MOVE') && ropeBound && (
                    <div
                      className={[
                        'mt-2 grid grid-cols-3 gap-2 w-[min(300px,46vw)] md:w-[300px]',
                        tuning?.innerTunerOpen && !tuning.locked ? 'cursor-move ring-2 ring-sky-300/60 bg-sky-100/10 rounded-2xl p-1' : '',
                      ].join(' ')}
                      style={{
                        transform: `translate(${ui.logsX}px, ${ui.logsY}px) scale(${ui.logsScale})`,
                        transformOrigin: 'left top',
                        touchAction: tuning?.innerTunerOpen ? 'none' : undefined,
                      }}
                      onPointerDown={(e) => {
                        if (!tuning?.innerTunerOpen || tuning.locked) return;
                        e.stopPropagation();
                        dragRef.current = { target: 'logs', startX: e.clientX, startY: e.clientY, baseX: ui.logsX, baseY: ui.logsY };
                      }}
                    >
                      {logSlots.map((s, i) => (
                        <div
                          key={i}
                          className={[
                            'rounded-xl border-2 border-dashed border-ink/25 bg-paper/55 h-12 md:h-14 grid place-items-center',
                            // 튜토리얼(LOG)에서는 "비어있는 슬롯"만 더 강하게 하이라이트
                            tutorialMode === 'LOG' && !s
                              ? 'ring-4 ring-amber-300/80 bg-amber-300/10 shadow-[0_0_22px_rgba(251,191,36,0.35)] animate-pulse'
                              : '',
                          ].join(' ')}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (phase !== 'PREPARE') return;
                            if (tutorialMode !== 'DONE' && tutorialMode !== 'LOG') return;
                            const raw = e.dataTransfer.getData('text/plain');
                            if (raw !== 'log') return;
                            if (logSlots[i]) return;
                            if (logsCount <= 0) return;
                            setLogSlots((prev) => {
                              const next = prev.slice();
                              next[i] = 'log';
                              return next;
                            });
                            setLogsCount((c) => Math.max(0, c - 1));
                            audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.75);
                          }}
                          onClick={() => {
                            if (phase !== 'PREPARE') return;
                            if (tutorialMode !== 'DONE' && tutorialMode !== 'LOG') return;
                            if (logSlots[i]) return;
                            if (logsCount <= 0) return;
                            startIfNeeded();
                            setLogSlots((prev) => {
                              const next = prev.slice();
                              next[i] = 'log';
                              return next;
                            });
                            setLogsCount((c) => Math.max(0, c - 1));
                            audio.playUrl('/assets/sounds/sfw_log_roll.mp3', 0.75);
                          }}
                        >
                          {s ? (
                            <img src="/assets/images/log.png" alt="통나무" className="w-12 h-12 object-contain" />
                          ) : (
                            <span
                              className={[
                                'text-xs opacity-70',
                                tutorialMode === 'LOG' ? 'text-amber-200 font-black animate-pulse' : '',
                              ].join(' ')}
                            >
                              빈 칸
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 목표 지점 (85%) */}
                <div
                  className={[
                    'absolute right-2 top-[28%]',
                    tuning?.innerTunerOpen && !tuning.locked ? 'cursor-move ring-2 ring-sky-300/60 bg-sky-100/10 rounded-xl p-1' : '',
                  ].join(' ')}
                  style={{
                    transform: `translate(${ui.goalX}px, ${ui.goalY}px) scale(${ui.goalScale})`,
                    transformOrigin: 'right top',
                    touchAction: tuning?.innerTunerOpen ? 'none' : undefined,
                  }}
                  onPointerDown={(e) => {
                    if (!tuning?.innerTunerOpen || tuning.locked) return;
                    e.stopPropagation();
                    dragRef.current = { target: 'goal', startX: e.clientX, startY: e.clientY, baseX: ui.goalX, baseY: ui.goalY };
                  }}
                >
                  <div className="w-20 h-12 rounded-xl border border-olive/35 bg-olive/10 grid place-items-center text-[11px] font-black">
                    굴({targetProgress}%)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 하단 고정 버튼바: 4개 버튼(쐐기/물/통나무/협동) */}
          <div
            className={[
              'px-3 py-2 bg-paper/70',
              tuning?.innerTunerOpen && !tuning.locked ? 'cursor-move ring-2 ring-sky-300/60' : '',
            ].join(' ')}
            style={{ transform: `translateY(${ui.actionBarY}px)`, touchAction: tuning?.innerTunerOpen ? 'none' : undefined }}
            onPointerDown={(e) => {
              if (!tuning?.innerTunerOpen || tuning.locked) return;
              e.stopPropagation();
              dragRef.current = { target: 'action', startX: e.clientX, startY: e.clientY, baseX: 0, baseY: ui.actionBarY };
            }}
          >
            <div className="text-[12px] font-bold leading-relaxed min-h-[34px]">{guideText}</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {/* 1) 나무쐐기 */}
              <button
                type="button"
                draggable={phase === 'QUARRY'}
                onDragStart={(e) => {
                  if (phase !== 'QUARRY') return;
                  e.dataTransfer.setData('text/plain', 'wedge');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => {
                  if (phase !== 'QUARRY') return;
                  if (tutorialMode !== 'DONE' && tutorialMode !== 'WEDGE') return;
                  startIfNeeded();
                  placeWedgeToFirstEmpty();
                }}
                className={[
                  'h-[64px] rounded-2xl border border-ink/25 bg-paper2/90 shadow-md flex flex-col items-center justify-center gap-1 touch-none',
                  phase === 'QUARRY' ? 'cursor-grab active:cursor-grabbing hover:bg-paper2' : 'opacity-45 cursor-not-allowed',
                  tutorialMode === 'WEDGE' ? 'ring-2 ring-amber-300/80 animate-pulse' : '',
                ].join(' ')}
                title="나무쐐기"
              >
                <img src="/assets/images/wood_wedge.png" alt="" className="w-7 h-7 object-contain" draggable={false} />
                <div className="text-[11px] font-black">쐐기 {wedgeSlots.filter(Boolean).length}/3</div>
              </button>

              {/* 2) 물 */}
              <button
                type="button"
                disabled={!allWedgesPlaced || phase !== 'QUARRY' || wedgeSwelling || mountainShake}
                onClick={water}
                className={[
                  'h-[64px] rounded-2xl border shadow-md flex flex-col items-center justify-center gap-1 touch-none',
                  allWedgesPlaced && phase === 'QUARRY' && !wedgeSwelling && !mountainShake
                    ? 'bg-olive text-white border-ink/25 hover:opacity-95 active:translate-y-[1px]'
                    : 'bg-paper/50 text-ink/40 cursor-not-allowed border-ink/20',
                  tutorialMode === 'WEDGE' ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                ].join(' ')}
                title="물"
              >
                <img src="/assets/images/icon_water.png" alt="" className="w-6 h-6 object-contain" draggable={false} />
                <div className="text-[11px] font-black">물</div>
              </button>

              {/* 3) 통나무 */}
              <button
                type="button"
                draggable={phase === 'PREPARE' && logsCount > 0}
                onDragStart={(e) => {
                  if (phase !== 'PREPARE') return;
                  e.dataTransfer.setData('text/plain', 'log');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => {
                  if (phase !== 'PREPARE') return;
                  if (tutorialMode !== 'DONE' && tutorialMode !== 'LOG') return;
                  startIfNeeded();
                  placeLogToFirstEmpty();
                }}
                className={[
                  'h-[64px] rounded-2xl border border-ink/25 bg-paper2/90 shadow-md flex flex-col items-center justify-center gap-1 touch-none',
                  phase === 'PREPARE' && logsCount > 0 ? 'cursor-grab active:cursor-grabbing hover:bg-paper2' : 'opacity-45 cursor-not-allowed',
                  tutorialMode === 'LOG' ? 'ring-2 ring-amber-300/80 animate-pulse' : '',
                ].join(' ')}
                title="통나무"
              >
                <img src="/assets/images/log.png" alt="" className="w-7 h-7 object-contain" draggable={false} />
                <div className="text-[11px] font-black">통나무 {logsCount}개</div>
              </button>

              {/* 4) 협동(손) */}
              <button
                type="button"
                disabled={!canUseHand}
                onClick={() => {
                  if (!canUseHand) return;
                  if (phase === 'BIND') bindRope();
                  if (phase === 'MOVE') moveOnce();
                }}
                className={[
                  'h-[64px] rounded-2xl border shadow-md flex flex-col items-center justify-center gap-1 touch-none',
                  canUseHand ? 'bg-stamp text-white border-ink/25 hover:opacity-95 active:translate-y-[1px]' : 'bg-paper/50 text-ink/40 cursor-not-allowed border-ink/20',
                  tutorialMode === 'PULL' ? 'ring-2 ring-amber-300/70 animate-pulse' : '',
                ].join(' ')}
                title={phase === 'MOVE' ? '협동해서 당기기' : '밧줄 묶기'}
              >
                <img src="/assets/images/hand.png" alt="" className="w-7 h-7 object-contain" draggable={false} />
                <div className="text-[11px] font-black">협동</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 튜토리얼: 시작 대사(첫 진입) */}
      {tutorialMode === 'DIALOGUE' && (
        <div className="absolute inset-0 z-[11000] bg-ink/35 grid place-items-center p-4">
          <div className="w-full max-w-[560px] rounded-3xl border-2 border-ink/35 bg-paper2 text-ink shadow-paper">
            <div className="p-5">
              <div className="text-xs font-black opacity-85">튜토리얼 · 고인돌 옮기기</div>
              <div className="mt-3 flex items-start gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-ink/25 bg-paper/60 flex-shrink-0">
                  <img
                    src={tutorialLines[tutorialIdx]?.speaker === 'han' ? '/assets/images/han_2.png' : '/assets/images/yang_2.png'}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black">{tutorialLines[tutorialIdx]?.speaker === 'han' ? '한' : '양'}</div>
                  <div className="mt-2 text-sm leading-relaxed opacity-95">{tText}</div>
                  <div className="mt-2 text-[11px] opacity-70">{tTyping ? '탭하면 전체 표시' : '다음으로 진행'}</div>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2 justify-end">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-xs font-black bg-stamp text-white border border-ink/25 shadow-md hover:opacity-95"
                onClick={() => {
                  if (tTyping) {
                    if (tTimer.current) window.clearInterval(tTimer.current);
                    tTimer.current = null;
                    setTText(tutorialLines[tutorialIdx]?.text ?? '');
                    setTTyping(false);
                    return;
                  }
                  if (tutorialIdx < tutorialLines.length - 1) setTutorialIdx((v) => v + 1);
                  else {
                    setTutorialMode('WEDGE');
                    showToast('튜토리얼: 나무쐐기 3개를 꽂고 물을 뿌려보자!');
                  }
                }}
              >
                {tutorialIdx < tutorialLines.length - 1 ? '다음' : '연습 시작'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 튜토리얼: 통나무 배치 후 당기기 안내 */}
      {postModalOpen && (
        <div className="absolute inset-0 z-[11000] bg-ink/35 grid place-items-center p-4">
          <div className="w-full max-w-[560px] rounded-3xl border-2 border-ink/35 bg-paper2 text-ink shadow-paper">
            <div className="p-5">
              <div className="text-xs font-black opacity-85">튜토리얼 · 협동으로 당기기</div>
              <div className="mt-3 flex items-start gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-ink/25 bg-paper/60 flex-shrink-0">
                  <img
                    src={postLines[postIdx]?.speaker === 'han' ? '/assets/images/han_2.png' : '/assets/images/yang_2.png'}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black">{postLines[postIdx]?.speaker === 'han' ? '한' : '양'}</div>
                  <div className="mt-2 text-sm leading-relaxed opacity-95">{postText}</div>
                  <div className="mt-2 text-[11px] opacity-70">{postTyping ? '탭하면 전체 표시' : '다음으로 진행'}</div>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2 justify-end">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-xs font-black bg-stamp text-white border border-ink/25 shadow-md hover:opacity-95"
                onClick={() => {
                  if (postTyping) {
                    if (postTimer.current) window.clearInterval(postTimer.current);
                    postTimer.current = null;
                    setPostText(postLines[postIdx]?.text ?? '');
                    setPostTyping(false);
                    return;
                  }
                  if (postIdx < postLines.length - 1) setPostIdx((v) => v + 1);
                  else {
                    setPostModalOpen(false);
                    showToast('손 버튼을 눌러서 밧줄을 당겨보자!');
                  }
                }}
              >
                {postIdx < postLines.length - 1 ? '다음' : '시작'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 z-[9000] pointer-events-none">
          <div className="rounded-xl border border-ink/25 bg-paper2 px-3 py-2 text-xs font-black shadow-paper">{toast}</div>
        </div>
      )}

      {/* 결과창(수동 복귀) */}
      {resultModal && (
        <div className="fixed inset-0 z-[10010] bg-ink/35 p-0">
          <div className="w-full h-full bg-paper2 text-ink shadow-paper flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <img
                src={realImg}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (mainImg && img.src !== mainImg) img.src = mainImg;
                }}
              />
            </div>
            <div className="p-4 border-t border-ink/20 bg-paper/70">
              <div className="text-lg font-black">성공! 고인돌 완성</div>
              <div className="mt-1 text-sm opacity-85 leading-relaxed">
                성공! 나무의 팽창하는 힘으로 바위를 쪼개고, 굴림대로 무거운 지석묘를 옮겨 무덤을 완성했어요!
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-olive text-white border border-ink/25 font-black py-3 shadow-md hover:opacity-95"
                onClick={() => {
                  const now = Date.now();
                  const started = startedAt ?? now;
                  const clearTime = Math.max(0, Math.round(((now - started) / 1000) * 10) / 10);
                  onComplete({ attempts, clearTime });
                }}
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
