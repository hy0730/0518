import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { RegionDataSchema, type RegionData, type DialogStep } from '../types/region';
import { audio } from '../utils/audio';
import { trackEvent } from '../utils/analytics';
import { supabase } from '../utils/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannel: RealtimeChannel | null = null;
let realtimeRegionId: string | null = null;

/**
 * 개발 편의를 위한 기본 지역 데이터(폴백).
 * - Supabase regions 테이블이 비어 있어도 앱이 멈추지 않고 MAP/스토리/미니게임 흐름을 볼 수 있게 함
 * - RegionDataSchema를 만족하는 "최소 구조" + 9개 스테이지 노드(visitedNodes 처리 안전)
 */
const DEFAULT_ANYANG_DATA: RegionData = {
  region: { id: 'anyang', name: '안양' },
  assets: {
    mainBackground: '/assets/images/map_real.png',
    mapBackground: '/assets/images/map_real.png',
  },
  map: {
    nodes: [
      { id: 'stage-1', title: '관양동 선사유적지', position: { x: 20, y: 28 }, dialogId: 'd-stage-1' },
      { id: 'stage-2', title: '평촌동 지석묘', position: { x: 35, y: 42 }, dialogId: 'd-stage-2' },
      { id: 'stage-3', title: '석수동 석실분', position: { x: 52, y: 30 }, dialogId: 'd-stage-3' },
      { id: 'stage-4', title: '중초사지 당간지주', position: { x: 64, y: 44 }, dialogId: 'd-stage-4' },
      { id: 'stage-5', title: '석수동 마애종', position: { x: 76, y: 30 }, dialogId: 'd-stage-5' },
      { id: 'stage-6', title: '안양사 귀부', position: { x: 18, y: 58 }, dialogId: 'd-stage-6' },
      { id: 'stage-7', title: '비산동 도요지', position: { x: 40, y: 66 }, dialogId: 'd-stage-7' },
      { id: 'stage-8', title: '만안교', position: { x: 62, y: 68 }, dialogId: 'd-stage-8' },
      { id: 'stage-9', title: '구서이면사무소', position: { x: 82, y: 58 }, dialogId: 'd-stage-9' },
    ],
  },
  dialogs: {
    'd-stage-1': { id: 'd-stage-1', title: '관양동 선사유적지', steps: [{ type: 'end' }] },
    'd-stage-2': { id: 'd-stage-2', title: '평촌동 지석묘', steps: [{ type: 'end' }] },
    'd-stage-3': { id: 'd-stage-3', title: '석수동 석실분', steps: [{ type: 'end' }] },
    'd-stage-4': { id: 'd-stage-4', title: '중초사지 당간지주', steps: [{ type: 'end' }] },
    'd-stage-5': { id: 'd-stage-5', title: '석수동 마애종', steps: [{ type: 'end' }] },
    'd-stage-6': { id: 'd-stage-6', title: '안양사 귀부', steps: [{ type: 'end' }] },
    'd-stage-7': { id: 'd-stage-7', title: '비산동 도요지', steps: [{ type: 'end' }] },
    'd-stage-8': { id: 'd-stage-8', title: '만안교', steps: [{ type: 'end' }] },
    'd-stage-9': { id: 'd-stage-9', title: '구서이면사무소', steps: [{ type: 'end' }] },
  },
};

function applyRegionDataSafely(set: (fn: any) => void, nextRaw: unknown) {
  const parsed = RegionDataSchema.safeParse(nextRaw);
  if (!parsed.success) return false;

  const validNodeIds = new Set(parsed.data.map.nodes.map((n) => n.id));
  set((state: { visitedNodes: string[] }) => ({
    regionData: parsed.data,
    status: 'ready',
    error: null,
    // 기존 진행도 유지하되, 데이터 변경으로 사라진 노드 id는 제거
    visitedNodes: Array.from(new Set(state.visitedNodes)).filter((id) => validNodeIds.has(id)),
  }));

  return true;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AppPhase = 'INTRO' | 'MAP' | 'STORY' | 'MINIGAME' | 'ENDING';

type CurrentDialog = {
  dialogId: string;
  stepIndex: number;
};

type QuizRuntimeState = {
  submitted: boolean;
  correct: boolean;
  selectedOptionId: string;
  message?: string;
};

type GameState = {
  // app flow (기획 흐름: 인트로 → 지도 → 대화 → 미니게임)
  appPhase: AppPhase;
  unlockedStageId: number;
  currentStageId: number | null;
  playerName: string;
  playerOrg: string;

  // data
  regionData: RegionData | null;

  // loading/error
  status: LoadStatus;
  error: string | null;

  // progress
  currentNodeId: string | null;
  visitedNodes: string[];

  // collection UI
  isCollectionOpen: boolean;
  isMuted: boolean;
  isDevMode: boolean;

  // dialog
  currentDialog: CurrentDialog | null;
  quizState: QuizRuntimeState | null;

  // Story UI 진행도(미니게임 뒤로가기 등에서 직전 대사 복원)
  storyIndexByStage: Record<number, number>;

  // selectors (store 내부 편의용: UI는 원하면 이 값들을 사용)
  getCurrentStep: () => DialogStep | null;

  // actions
  fetchRegionData: (regionKey?: string) => Promise<void>;
  cleanupRealtime: () => void;

  // flow actions
  setAppPhase: (phase: AppPhase) => void;
  setPlayerName: (name: string) => void;
  setPlayerOrg: (org: string) => void;
  playStage: (stageId: number) => void;
  completeStage: (stageId: number) => void;

  selectNode: (nodeId: string) => void;
  closeDialog: () => void;
  nextDialogStep: () => void;
  submitQuiz: (selectedOptionId: string) => void;
  toggleCollection: () => void;
  toggleMute: () => void;
  toggleDevMode: () => void;
  setDevMode: (next: boolean) => void;

  setStoryIndex: (stageId: number, idx: number) => void;
  resetGameData: () => void;

  // utils
  markVisited: (nodeId: string) => void;
  resetError: () => void;
};

function zodErrorToString(err: unknown): string {
  // ZodError일 경우 message/format을 최대한 보기 좋게 출력
  if (typeof err === 'object' && err && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

function normalizeVisitedNodes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const onlyStrings = input.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return Array.from(new Set(onlyStrings));
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      appPhase: 'INTRO',
      unlockedStageId: 1,
      currentStageId: null,
      playerName: '',
      playerOrg: '',

      regionData: null,
      status: 'idle',
      error: null,

      currentNodeId: null,
      visitedNodes: [],

      isCollectionOpen: false,
      isMuted: false,
      isDevMode: false,

      currentDialog: null,
      quizState: null,

      storyIndexByStage: {},

      getCurrentStep: () => {
        const { regionData, currentDialog } = get();
        if (!regionData || !currentDialog) return null;

        const dialog = regionData.dialogs[currentDialog.dialogId];
        if (!dialog) return null;

        return dialog.steps[currentDialog.stepIndex] ?? null;
      },

      setAppPhase: (phase) => set({ appPhase: phase }),
      setPlayerName: (name) => set({ playerName: name }),
      setPlayerOrg: (org) => set({ playerOrg: org }),
      playStage: (stageId) =>
        set((state) => ({
          appPhase: 'STORY',
          currentStageId: stageId,
          storyIndexByStage: state.storyIndexByStage[stageId] === undefined ? { ...state.storyIndexByStage, [stageId]: 0 } : state.storyIndexByStage,
        })),
      completeStage: (stageId) =>
        set((state) => {
          const nodeId = get().regionData?.map.nodes[stageId - 1]?.id;
          const nextVisited = nodeId && !state.visitedNodes.includes(nodeId) ? [...state.visitedNodes, nodeId] : state.visitedNodes;

          return {
            appPhase: 'MAP',
            currentStageId: null,
            unlockedStageId: Math.max(state.unlockedStageId, stageId + 1),
            visitedNodes: nextVisited,
          };
        }),

      fetchRegionData: async (regionKey = 'anyang') => {
        set({ status: 'loading', error: null, regionData: null, currentNodeId: null, currentDialog: null, quizState: null });

        try {
          // NOTE:
          // - `.single()`은 결과가 0개 또는 2개 이상이면 에러가 발생함
          // - 운영 중 regions에 중복 row가 생기거나(또는 RLS/뷰 영향) 결과가 배열로 판단되면
          //   "Cannot coerce the result to a single JSON object"가 발생할 수 있음
          // => 여기서는 "없으면 null"로 안전하게 처리하고, 혹시 중복이 있더라도 1개만 가져오도록 limit(1) 적용
          const { data, error } = await supabase.from('regions').select('data').eq('id', regionKey).limit(1).maybeSingle();

          if (error) {
            set({
              status: 'error',
              error: `Supabase regions 조회 실패: ${error.message}`,
            });
            return;
          }

          const raw = data?.data ?? (regionKey === 'anyang' ? DEFAULT_ANYANG_DATA : DEFAULT_ANYANG_DATA);
          if (!data?.data) {
            // 개발 편의: DB가 비어 있어도 앱이 멈추지 않도록 기본값 사용
          }

          const ok = applyRegionDataSafely(set, raw);
          if (!ok) {
            set({
              status: 'error',
              error: '지역 데이터 스키마 검증 실패: Supabase에서 받은 JSON이 RegionDataSchema와 일치하지 않습니다.',
            });
            return;
          }

          // Realtime subscribe (DB UPDATE → 즉시 화면 반영)
          if (realtimeChannel && realtimeRegionId === regionKey) return;

          if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
            realtimeRegionId = null;
          }

          realtimeRegionId = regionKey;
          realtimeChannel = supabase
            .channel('custom-all-channel')
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'regions',
                filter: `id=eq.${regionKey}`,
              },
              (payload: any) => {
                // payload.new.data 에 최신 JSON이 들어온다고 가정
                applyRegionDataSafely(set, payload?.new?.data);
              }
            )
            .subscribe();
        } catch (e) {
          set({
            status: 'error',
            error: `지역 데이터 로드 실패: ${zodErrorToString(e)}`,
          });
        }
      },

      cleanupRealtime: () => {
        if (!realtimeChannel) return;
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
        realtimeRegionId = null;
      },

      selectNode: (nodeId: string) => {
        const { regionData } = get();
        if (!regionData) return;

        const node = regionData.map.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // unlock 조건(이번 MVP에서는 미사용이지만, 기본 뼈대는 유지)
        if (node.unlock?.requiresVisitedNodeIds?.length) {
          const { visitedNodes } = get();
          const ok = node.unlock.requiresVisitedNodeIds.every((id) => visitedNodes.includes(id));
          if (!ok) return;
        }

        set({
          currentNodeId: nodeId,
          currentDialog: { dialogId: node.dialogId, stepIndex: 0 },
          quizState: null,
        });

        // analytics (비즈니스 로직/에러 핸들링에 영향 없도록 마지막에 호출)
        trackEvent('node_click', { node_id: nodeId });
      },

      closeDialog: () => {
        set({ currentDialog: null, quizState: null });
      },

      nextDialogStep: () => {
        const { regionData, currentDialog } = get();
        if (!regionData || !currentDialog) return;

        const dialog = regionData.dialogs[currentDialog.dialogId];
        if (!dialog) return;

        const nextIndex = currentDialog.stepIndex + 1;

        // 다이얼로그 끝에 도달했거나, end 스텝을 지나치려는 경우
        if (nextIndex >= dialog.steps.length) {
          set({ currentDialog: null, quizState: null });
          return;
        }

        const nextStep = dialog.steps[nextIndex];
        // end 스텝이면 닫기(엔진 정책)
        if (nextStep?.type === 'end') {
          set({ currentDialog: null, quizState: null });
          return;
        }

        set({
          currentDialog: { ...currentDialog, stepIndex: nextIndex },
          quizState: null, // 다음 스텝으로 가면 퀴즈 상태 초기화
        });
      },

      submitQuiz: (selectedOptionId: string) => {
        const { regionData, currentDialog, currentNodeId } = get();
        if (!regionData || !currentDialog) return;

        const dialog = regionData.dialogs[currentDialog.dialogId];
        if (!dialog) return;

        const step = dialog.steps[currentDialog.stepIndex];
        if (!step || step.type !== 'quiz') return;

        // MVP: multipleChoice 단일 타입
        const quiz = step.quiz;
        const correct = selectedOptionId === quiz.correctOptionId;

        // analytics (정답 판별 직후)
        trackEvent('quiz_submit', { node_id: currentNodeId ?? null, correct });

        // SFX: 자동재생 제한 해제 이후(TitleScreen에서 unlock) 재생됨
        audio.playSfx(correct ? 'correct' : 'wrong');

        set({
          quizState: {
            submitted: true,
            correct,
            selectedOptionId,
            message: correct ? quiz.feedbackCorrect : quiz.feedbackWrong,
          },
        });

        // 정책: 정답이면 방문 처리. 다음 진행은 UI의 '다음' 버튼(nextDialogStep)에서 처리.
        if (correct) {
          if (currentNodeId) get().markVisited(currentNodeId);
        }
      },

      toggleCollection: () => {
        const willOpen = !get().isCollectionOpen;
        set({ isCollectionOpen: willOpen });
        if (willOpen) trackEvent('collection_open');
      },

      toggleMute: () => {
        const next = !get().isMuted;
        set({ isMuted: next });
        audio.setMuted(next);
      },

      toggleDevMode: () => set((state) => ({ isDevMode: !state.isDevMode })),
      setDevMode: (next) => set({ isDevMode: next }),

      setStoryIndex: (stageId, idx) =>
        set((state) => ({
          storyIndexByStage: { ...state.storyIndexByStage, [stageId]: Math.max(0, idx) },
        })),

      resetGameData: () =>
        set(() => ({
          appPhase: 'INTRO',
          unlockedStageId: 1,
          currentStageId: null,
          playerName: '',
          playerOrg: '',
          currentNodeId: null,
          visitedNodes: [],
          currentDialog: null,
          quizState: null,
          storyIndexByStage: {},
          isCollectionOpen: false,
          isDevMode: false,
        })),

      markVisited: (nodeId: string) => {
        set((state) => {
          if (state.visitedNodes.includes(nodeId)) return state;
          return { visitedNodes: [...state.visitedNodes, nodeId] };
        });
      },

      resetError: () => set({ error: null, status: 'idle' }),
    }),
    {
      name: 'local-heritage-save',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      partialize: (state) => ({
        appPhase: state.appPhase,
        unlockedStageId: state.unlockedStageId,
        currentStageId: state.currentStageId,
        playerName: state.playerName,
        playerOrg: state.playerOrg,
        visitedNodes: state.visitedNodes,
        isMuted: state.isMuted,
        isDevMode: state.isDevMode,
      }),
      migrate: (persistedState) => {
        // persistedState는 partialize 결과 형태만 들어옴
        const obj = (persistedState ?? {}) as {
          visitedNodes?: unknown;
          isMuted?: unknown;
          isDevMode?: unknown;
          appPhase?: unknown;
          unlockedStageId?: unknown;
          currentStageId?: unknown;
          playerName?: unknown;
          playerOrg?: unknown;
        };

        const appPhase =
          obj.appPhase === 'INTRO' || obj.appPhase === 'MAP' || obj.appPhase === 'STORY' || obj.appPhase === 'MINIGAME' || obj.appPhase === 'ENDING'
            ? (obj.appPhase as AppPhase)
            : 'INTRO';

        const unlockedStageId = typeof obj.unlockedStageId === 'number' && obj.unlockedStageId >= 1 ? obj.unlockedStageId : 1;
        const currentStageId = typeof obj.currentStageId === 'number' && obj.currentStageId >= 1 ? obj.currentStageId : null;
        const playerName = typeof obj.playerName === 'string' ? obj.playerName : '';
        const playerOrg = typeof obj.playerOrg === 'string' ? obj.playerOrg : '';

        return {
          appPhase,
          unlockedStageId,
          currentStageId,
          playerName,
          playerOrg,
          visitedNodes: normalizeVisitedNodes(obj.visitedNodes),
          isMuted: typeof obj.isMuted === 'boolean' ? obj.isMuted : false,
          isDevMode: typeof obj.isDevMode === 'boolean' ? obj.isDevMode : false,
        } as any;
      },
    }
  )
);
