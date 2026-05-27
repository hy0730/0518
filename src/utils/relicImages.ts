export function getRelicSlug(stageId: number) {
  const map: Record<number, string> = {
    1: 'gwanyang',
    2: 'pyeongchon',
    3: 'seoksu',
    4: 'jungcho',
    // NOTE: 기획 변경(스테이지 5↔6 스왑)
    // - 5: 석수동 마애종 = bell
    // - 6: 안양사 귀부(거북 받침돌) = turtle
    5: 'bell',
    6: 'turtle',
    7: 'bisan',
    8: 'bridge',
    9: 'seoimyeon',
  };
  return map[stageId] ?? '';
}

export function getRelicMainImage(stageId: number) {
  const slug = getRelicSlug(stageId);
  return slug ? `/assets/images/relic_${slug}_main.png` : '';
}

export function getRelicRealImage(stageId: number) {
  const slug = getRelicSlug(stageId);
  return slug ? `/assets/images/relic_${slug}_real.png` : '';
}
