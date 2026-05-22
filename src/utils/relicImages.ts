export function getRelicSlug(stageId: number) {
  const map: Record<number, string> = {
    1: 'gwanyang',
    2: 'pyeongchon',
    3: 'seoksu',
    4: 'jungcho',
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

