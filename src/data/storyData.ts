export type StorySpeaker = 'han' | 'yang';

export type StoryDialogueLine = {
  speaker: StorySpeaker;
  text: string;
};

export type StageStory = {
  stageId: number; // 1~9
  id: string;
  title: string;
  era: string;
  location: string;
  description: string;
  dialogues: StoryDialogueLine[]; // 3~4줄 권장
};

export const storyData: StageStory[] = [
  {
    stageId: 1,
    id: 'gwanyang-prehistoric-site',
    title: '관양동 선사유적지',
    era: '청동기시대',
    location: '안양시 관양동',
    description:
      '관악산 기슭의 구릉지에 위치한 청동기 시대의 마을 유적입니다. 직사각형 형태의 움집 흔적과 화덕 자리, 기둥 구멍 등이 확인되었고, 민무늬 토기와 반달돌칼 등 농경·정착생활을 보여주는 유물이 다수 출토되었습니다.',
    dialogues: [
      { speaker: 'han', text: '{ORG}의 {PLAYER}, 여기는 관악산 기슭에 있던 청동기시대 마을이야. 사람들이 오래 살았다는 흔적이 남아 있지.' },
      { speaker: 'yang', text: '발굴해보니 직사각형 움집 자리랑 화덕, 기둥 구멍까지 나왔대. 집 구조를 상상할 수 있겠지?' },
      { speaker: 'han', text: '민무늬 토기랑 반달돌칼도 많이 나왔어. 농사짓고 정착해서 살았다는 증거야.' },
      { speaker: 'yang', text: '그럼 이제, 사라지는 기록을 되찾으러! 미니게임으로 단서를 모아보자.' },
    ],
  },
  {
    stageId: 2,
    id: 'pyeongchon-dolmen',
    title: '평촌동 지석묘',
    era: '청동기시대',
    location: '안양시 평촌동 자유공원',
    description:
      '평촌 신도시 조성 당시 발굴된 청동기시대의 무덤(고인돌)입니다. 지하에 무덤방을 만들고 덮개돌을 올린 기반식 고인돌로, 청동기시대 장례 문화를 잘 보여줍니다.',
    dialogues: [
      { speaker: 'yang', text: '{PLAYER}, 여긴 청동기시대 무덤, 고인돌이야. 평촌 신도시 만들 때 발견됐대!' },
      { speaker: 'han', text: '땅속에 무덤방을 만들고, 위에 커다란 덮개돌을 올린 “기반식” 고인돌이지.' },
      { speaker: 'yang', text: '사람들이 어떻게 장례를 치르고, 어떤 믿음을 가졌는지 힌트가 되는 유산이야.' },
      { speaker: 'han', text: '{ORG} 수호대원답게, 고인돌의 비밀을 지켜낼 준비됐지? 다음 단계로 가보자!' },
    ],
  },
  {
    stageId: 3,
    id: 'seoksu-stone-chamber-tomb',
    title: '석수동 석실분',
    era: '삼국시대',
    location: '안양 석수동(관악산)',
    description:
      '관악산(삼성산) 남쪽 기슭에 있는 돌방무덤입니다. 도굴되어 주인을 정확히 알 수는 없으나, 돌방무덤이 삼국시대 귀족들의 무덤으로 많이 쓰였다는 점을 통해 당시 귀족의 무덤으로 추정하고 있습니다.',
    dialogues: [
      { speaker: 'han', text: '{PLAYER}, 여기는 관악산 남쪽 기슭의 돌방무덤 “석실분”이야. 돌로 방처럼 무덤을 만들었지.' },
      { speaker: 'yang', text: '아쉽게도 도굴돼서 주인이 누구인지는 확실히 모르지만…' },
      { speaker: 'han', text: '삼국시대엔 이런 돌방무덤을 귀족들이 많이 사용했대. 그래서 귀족 무덤으로 추정하는 거야.' },
      { speaker: 'yang', text: '남은 단서가 더 사라지기 전에, 우리 손으로 기록을 지켜보자!' },
    ],
  },
  {
    stageId: 4,
    id: 'jungchosa-danggan-jiju',
    title: '중초사지 당간지주',
    era: '남북국시대(통일신라)',
    location: '안양 석수동 안양박물관 부지 내',
    description:
      '글자가 새겨져 있어 만들어진 연도(826년)와 절의 이름(중초사)을 정확히 알 수 있는 국내 유일의 당간지주로, 그 가치를 인정받아 보물로 지정되었습니다.',
    dialogues: [
      { speaker: 'yang', text: '이건 “당간지주”야. 절 행사 때 깃발을 걸던 긴 장대를 받치던 기둥이지.' },
      { speaker: 'han', text: '{PLAYER}, 특별한 건 글자가 새겨져 있어서 826년에 만들었고, 절 이름이 “중초사”였다는 걸 정확히 알 수 있다는 점이야.' },
      { speaker: 'yang', text: '국내 유일이라서 보물로 지정됐대. 글자는 시간이 지나도 정보를 남겨주거든!' },
      { speaker: 'han', text: '좋아, {ORG} 수호대! 이제 기록을 지키는 미션을 시작해볼까?' },
    ],
  },
  {
    stageId: 5,
    id: 'seoksu-rock-carved-bell',
    title: '석수동 마애종',
    era: '고려시대',
    location: '안양 석수동',
    description:
      "거대한 바위에 새겨진 마애 조각 중 국내 유일하게 '종'을 새긴 조각입니다. 스님이 당목으로 종을 치는 모습이 정교하게 표현되어 있어 당시의 모습을 알 수 있는 귀중한 유산입니다.",
    dialogues: [
      { speaker: 'han', text: '{PLAYER}, 와! 바위에 조각된 그림이 보이지? 이건 “마애종”이야.' },
      { speaker: 'yang', text: '국내에서 유일하게 바위에 “종”을 새긴 마애조각이래. 진짜 희귀하지!' },
      { speaker: 'han', text: '스님이 당목으로 종을 치는 모습이 아주 정교해서, 고려시대 풍경을 그대로 상상할 수 있어.' },
      { speaker: 'yang', text: '그럼 우리도 잃어버린 기록을 다시 울려보자! 미니게임 출발!' },
    ],
  },
  {
    stageId: 6,
    id: 'anyangsa-gwibu',
    title: '안양사 귀부',
    era: '고려시대',
    location: '안양사 대웅전 앞',
    description:
      '고려시대 비석의 받침돌(거북이 모양)입니다. 머리는 용과 닮은 모습이고, 등에는 육각형의 껍질 무늬가 촘촘히 새겨져 있습니다.',
    dialogues: [
      { speaker: 'yang', text: '대웅전 앞에 있는 이 받침돌, 거북이 모양이지? “귀부”라고 불러.' },
      { speaker: 'han', text: '{ORG}의 {PLAYER}, 고려시대 비석을 올려두던 받침이야. 머리는 용처럼 생기고, 등에는 육각형 무늬가 촘촘해.' },
      { speaker: 'yang', text: '거북이는 오래 사는 상징이라서, 기록이 오래 남으라는 뜻도 담겼다고 해.' },
      { speaker: 'han', text: '우리도 기록을 오래 남기자. 다음 미션으로!' },
    ],
  },
  {
    stageId: 7,
    id: 'bisan-kiln-site',
    title: '비산동 도요지',
    era: '고려시대',
    location: '안양 비산동(관악산) 서울대학교 농과대학 수목원 내',
    description:
      '서울대학교 농과대학 수목원 내에 위치한 고려시대의 도자기 가마터입니다. 전국적으로도 굉장히 희귀한 고려시대 백자가 발견되어 아주 중요한 가마터였음을 알 수 있습니다.',
    dialogues: [
      { speaker: 'han', text: '{PLAYER}, 여긴 고려시대 도자기를 굽던 가마터, “도요지”야. 불로 도자기를 만들던 작업장이었지.' },
      { speaker: 'yang', text: '특히 고려시대 “백자”가 발견됐대! 전국에서도 희귀해서 아주 중요한 장소로 봐.' },
      { speaker: 'han', text: '가마에서 나온 흔적은 당시 기술과 생활을 알려주는 타임캡슐 같은 거야.' },
      { speaker: 'yang', text: '자, {ORG} 수호대원! 장인의 기술을 되찾는 미니게임으로 가보자!' },
    ],
  },
  {
    stageId: 8,
    id: 'manangyo-bridge',
    title: '만안교',
    era: '조선시대',
    location: '안양 석수동',
    description:
      "정조대왕이 아버지 사도세자가 묻힌 현륭원에 가기 위해 그 길목에 만든 돌다리입니다. 무지개 모양(아치)으로 만들어진 홍예교이며, 만 년 동안 편하게 쓰라는 뜻에서 '만안교'라 이름 지었습니다. 지금의 '만안구' 지명의 기원입니다.",
    dialogues: [
      { speaker: 'yang', text: '이 다리는 조선시대 정조대왕이 현륭원에 가는 길목에 만든 돌다리야.' },
      { speaker: 'han', text: '{PLAYER}, 무지개처럼 둥근 아치 구조라서 “홍예교”라고도 해. 돌을 잘 맞춰야 튼튼하지!' },
      { speaker: 'yang', text: '“만 년 동안 편하게 쓰라”는 뜻으로 만안교라고 이름 지었고, 만안구 지명도 여기서 왔대.' },
      { speaker: 'han', text: '좋아! {ORG} 수호대원답게, 아치 조립 미션으로 다리의 기록을 지켜보자.' },
    ],
  },
  {
    stageId: 9,
    id: 'guseo-office',
    title: '구서이면사무소',
    era: '일제강점기',
    location: '안양시 안양동',
    description:
      '안양에 남아있는 유일한 일제강점기 옛 관청 건물로, 드물게 전통 한옥 건축물로 만들어졌습니다. 수탈의 현장이자 이에 맞선 안양 지역 독립운동의 배경이 된 공간입니다.',
    dialogues: [
      { speaker: 'han', text: '{ORG}의 {PLAYER}, 여긴 일제강점기 때 쓰이던 옛 관청 건물이야. 안양에 남은 유일한 건물이라 더 소중해.' },
      { speaker: 'yang', text: '특이하게도 전통 한옥 형태로 지어졌대. 겉모습만 봐도 시대의 흔적이 느껴지지?' },
      { speaker: 'han', text: '하지만 이곳은 수탈의 현장이기도 했고, 안양 지역 독립운동의 배경이 된 공간이기도 해.' },
      { speaker: 'yang', text: '기억해야 할 이야기를 지키는 게 중요해. 마지막 미션, 함께 해내자!' },
    ],
  },
];

export const storyDataByStageId: Record<number, StageStory> = Object.fromEntries(storyData.map((s) => [s.stageId, s])) as any;
