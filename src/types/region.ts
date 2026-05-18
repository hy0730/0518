import { z } from 'zod';

/**
 * 좌표는 맵 배경 기준 퍼센트(0~100).
 * 예: x=50, y=30 => 가로 중앙, 세로 상단 30% 지점
 */
export const PercentSchema = z.number().min(0).max(100);

export const MapNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** MapScreen에서 사용할 노드 아이콘(선택) */
  icon: z.string().min(1).optional(),
  position: z.object({
    x: PercentSchema,
    y: PercentSchema,
  }),
  /** 이 노드를 클릭했을 때 열릴 다이얼로그 ID */
  dialogId: z.string().min(1),
  /** 추후 잠금/해금 조건 확장 포인트(이번 MVP에서는 미사용) */
  unlock: z
    .object({
      requiresVisitedNodeIds: z.array(z.string().min(1)).min(1),
    })
    .optional(),
});

export const QuizOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const MultipleChoiceQuizSchema = z.object({
  type: z.literal('multipleChoice'),
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(QuizOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  /** 정답/오답 안내 문구(선택) */
  feedbackCorrect: z.string().min(1).optional(),
  feedbackWrong: z.string().min(1).optional(),
});

export const QuizSchema = MultipleChoiceQuizSchema;
export type Quiz = z.infer<typeof QuizSchema>;

export const TextStepSchema = z.object({
  type: z.literal('text'),
  speaker: z.string().min(1).optional(),
  text: z.string().min(1),
});

export const QuizStepSchema = z.object({
  type: z.literal('quiz'),
  quiz: QuizSchema,
});

export const EndStepSchema = z.object({
  type: z.literal('end'),
});

export const DialogStepSchema = z.discriminatedUnion('type', [
  TextStepSchema,
  QuizStepSchema,
  EndStepSchema,
]);
export type DialogStep = z.infer<typeof DialogStepSchema>;

export const DialogSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(DialogStepSchema).min(1),
});

export const RegionAssetsSchema = z.object({
  /** GameWrapper의 블러 배경에 깔릴 메인 배경 */
  mainBackground: z.string().min(1),
  /** MapScreen의 맵 배경(선택) */
  mapBackground: z.string().min(1).optional(),
});

export const RegionMapSchema = z.object({
  nodes: z.array(MapNodeSchema).min(1),
});

export const RegionMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const RegionDataSchema = z.object({
  region: RegionMetaSchema,
  assets: RegionAssetsSchema,
  map: RegionMapSchema,
  /** dialogId -> Dialog */
  dialogs: z.record(z.string().min(1), DialogSchema),
});

export type RegionData = z.infer<typeof RegionDataSchema>;
export type MapNode = z.infer<typeof MapNodeSchema>;
export type Dialog = z.infer<typeof DialogSchema>;
