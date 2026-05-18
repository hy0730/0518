import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { RegionDataSchema, type RegionData, type DialogStep } from '../types/region';
import { audio } from '../utils/audio';
import { trackEvent } from '../utils/analytics';
import { supabase } from '../utils/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

let realtimeChannel: RealtimeChannel | null = null;
let realtimeRegionId: string | null = null;

function applyRegionDataSafely(set: (fn: any) => void, nextRaw: unknown) {
  const parsed = RegionDataSchema.safeParse(nextRaw);
  if (!parsed.success) return false;

  const validNodeIds = new Set(parsed.data.map.nodes.map((n) => n.id));
  set((state: any) => ({
    regionData: parsed.data,
    status: 'ready',
    error: null,
    // 기존 진행도 유지하되, 데이터 변경으로 사라진 노드 id는 제거
    visitedNodes: Array.from(new Set(state.visitedNodes)).filter((id: string) => validNodeIds.has(id)),
  }));

  return true;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

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

  // dialog
  currentDialog: CurrentDialog | null;
  quizState: QuizRuntimeState | null;

  // selectors (store 내부 편의용: UI는 원하면 이 값들을 사용)
  getCurrentStep: () => DialogStep | null;

  // actions
  fetchRegionData: (regionKey?: string) => Promise<void>;
  cleanupRealtime: () => void;
  selectNode: (nodeId: string) => void;
  closeDialog: () => void;
  nextDialogStep: () => void;
  submitQuiz: (selectedOptionId: string) => void;
  toggleCollection: () => void;
  toggleMute: () => void;

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
      regionData: null,
      status: 'idle',
      error: null,

      currentNodeId: null,
      visitedNodes: [],

      isCollectionOpen: false,
      isMuted: false,

      currentDialog: null,
      quizState: null,

      getCurrentStep: () => {
        const { regionData, currentDialog } = get();
        if (!regionData || !currentDialog) return null;

        const dialog = regionData.dialogs[currentDialog.dialogId];
        if (!dialog) return null;

        return dialog.steps[currentDialog.stepIndex] ?? null;
      },

      fetchRegionData: async (regionKey = 'anyang') => {
        set({ status: 'loading', error: null, regionData: null, currentNodeId: null, currentDialog: null, quizState: null });

        try {
          const { data, error } = await supabase.from('regions').select('data').eq('id', regionKey).single();

          if (error) {
            set({
              status: 'error',
              error: `Supabase regions 조회 실패: ${error.message}`,
            });
            return;
          }

          const ok = applyRegionDataSafely(set, data?.data);
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
      version: 1,
      partialize: (state) => ({
        visitedNodes: state.visitedNodes,
        isMuted: state.isMuted,
      }),
      migrate: (persistedState) => {
        // persistedState는 partialize 결과 형태({ visitedNodes, isMuted })만 들어옴
        const obj = (persistedState ?? {}) as { visitedNodes?: unknown; isMuted?: unknown };
        return {
          visitedNodes: normalizeVisitedNodes(obj.visitedNodes),
          isMuted: typeof obj.isMuted === 'boolean' ? obj.isMuted : false,
        } as any;
      },
    }
  )
);
