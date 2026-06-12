export type GuseoTile = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 벽/건물, 1 길, 2 START, 3 GOAL, 4 쌀(서이면사무소: 3개), 5 배달지점(3곳), 6 은신처(숨기)

export type Pos = { r: number; c: number };

export type Quiz = {
  question: string;
  options: string[];
  answerIndex: number;
};

export const GUSEO_ASSETS = {
  mazeBg: '/assets/images/relic_seoimyeon_maze.png',
  activist: '/assets/images/relic_seoimyeon_activist.png',
  policeman: '/assets/images/relic_seoimyeon_policeman.png',
  ricesack: '/assets/images/relic_seoimyeon_ricesack.png',
  // TODO(디자인): 사용자가 제공할 "수탈당한 백성" 아이콘(1개)로 교체할 예정
  citizen: '/assets/images/relic_seoimyeon_citizen.png',
} as const;

// 20x20 맵 데이터(직각 격자) - "샘플 설계" 버전
// 4(쌀) 3개: 서이면사무소 내부, 5(배달지점) 3곳: 마을 3군데
export const ANYANG_GRID_MAP: GuseoTile[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 2, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0],
  [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  [0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0],
  [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
  // r=5: 은신처(숨기) 추가(샘플)
  [0, 1, 1, 0, 1, 1, 6, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0],
  // r=8: 서이면사무소 주변 순찰 가능한 통로(중앙부)
  [0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0],
  // r=9: 서이면사무소 내부(쌀 3개)
  [0, 1, 1, 1, 1, 0, 1, 1, 1, 4, 4, 4, 0, 1, 1, 1, 1, 0, 1, 0],
  // r=10: 서이면사무소 주변 통로(중앙부) + 은신처(숨기) 추가
  [0, 1, 0, 0, 1, 0, 0, 0, 6, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0],
  // r=11: 배달지점(우측) 2칸
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 5, 5, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0],
  // r=17: 은신처(숨기) 샘플
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 6, 1, 1, 1, 1, 0],
  // r=18: 배달지점(좌/우) 각각 2칸
  [0, 5, 5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 5, 5, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
];

// 서이면사무소(쌀 3개) 위치: 4 타일을 3개로 배치(샘플 맵 기준)
// NOTE: 실제 그림/연출에 맞춰 좌표는 추후 조정 가능
export const RICE_SOURCE_TILES: Pos[] = [
  { r: 9, c: 9 },
  { r: 9, c: 10 },
  { r: 9, c: 11 },
];

// 배달 지점 3곳(샘플 맵 기준)
export const DELIVERY_TILES: Pos[] = [
  { r: 18, c: 1 },
  { r: 18, c: 2 },
  { r: 18, c: 17 },
  { r: 18, c: 18 },
  { r: 11, c: 17 },
  { r: 11, c: 18 },
];

// 3개의 "배달 스팟" (각 스팟이 2칸씩 차지)
export const DELIVERY_SPOTS: Array<{ id: string; tiles: Pos[] }> = [
  { id: 'A', tiles: [{ r: 18, c: 1 }, { r: 18, c: 2 }] },
  { id: 'B', tiles: [{ r: 18, c: 17 }, { r: 18, c: 18 }] },
  { id: 'C', tiles: [{ r: 11, c: 17 }, { r: 11, c: 18 }] },
];

export const DELIVERY_SPOT_BY_KEY: Record<string, string> = Object.fromEntries(
  DELIVERY_SPOTS.flatMap((s) => s.tiles.map((t) => [keyOf(t.r, t.c), s.id]))
);

export function keyOf(r: number, c: number) {
  return `${r},${c}`;
}

export function findFirst(m: GuseoTile[][], target: GuseoTile): Pos {
  for (let r = 0; r < m.length; r += 1) {
    for (let c = 0; c < (m[r]?.length ?? 0); c += 1) {
      if (m[r][c] === target) return { r, c };
    }
  }
  return { r: 1, c: 1 };
}

export const START_POS: Pos = findFirst(ANYANG_GRID_MAP, 2);

// 함정(불심검문) 좌표: 길(1) 중 일부 좌표에만 배치
export const DEFAULT_TRAPS: Pos[] = [
  { r: 1, c: 6 },
  { r: 7, c: 10 },
  { r: 13, c: 10 },
  { r: 17, c: 6 },
];

// 불심검문 질문 풀(1회 인카운터 = 1문항)
export const QUIZ_POOL: Quiz[] = [
  {
    question: '구서이면사무소는 일제강점기 때 어떤 곳이었을까요?',
    options: ['안양 지역 관청', '영화관'],
    answerIndex: 0,
  },
  {
    question: '수탈당하는 쌀과 나라를 구하기 위해 애쓴 안양의 독립운동가는?',
    options: ['원태우 지사', '홍길동'],
    answerIndex: 0,
  },
  {
    question: '일제강점기에는 농민들이 수탈당한 쌀이 어디로 많이 옮겨져 갔을까요?',
    options: ['일본으로', '독립군들에게'],
    answerIndex: 0,
  },
  {
    question: '독립운동가들은 은밀하게 어떤 일을 했을까요?',
    options: ['나라를 되찾기 위한 활동', '보물찾기 게임만 하기'],
    answerIndex: 0,
  },
  {
    question: '“잠입 작전”에서 가장 중요한 것은 무엇일까요?',
    options: ['들키지 않기', '크게 소리치기'],
    answerIndex: 0,
  },
  {
    question: '일제강점기 ‘수탈’의 뜻에 가장 가까운 것은?',
    options: ['빼앗아 가기', '선물 주기'],
    answerIndex: 0,
  },
  {
    question: '쌀가마니를 되찾은 뒤에는 어디로 가야 할까요?',
    options: ['수탈당한 사람들에게 돌려주기', '일본으로 가져가기'],
    answerIndex: 0,
  },
  {
    question: '만세운동에서 사람들이 외친 말은 무엇일까요?',
    options: ['대한 독립 만세', '안양 독립 만세'],
    answerIndex: 0,
  },
];
