export async function tryEnterFullscreen(): Promise<boolean> {
  try {
    if (document.fullscreenElement) return true;

    const el: any = document.documentElement;
    if (!el) return false;

    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      return true;
    }
    // iOS Safari / 구형 브라우저
    if (typeof el.webkitRequestFullscreen === 'function') {
      el.webkitRequestFullscreen();
      return true;
    }
    if (typeof el.msRequestFullscreen === 'function') {
      el.msRequestFullscreen();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 모바일 브라우저(탭)에서 주소창/하단바가 접히도록 "스크롤 유도"를 시도합니다.
 * 브라우저 정책에 따라 동작하지 않을 수 있습니다.
 */
export function nudgeHideBrowserUI() {
  // 0,0은 안 먹는 경우가 많아 1px 스크롤을 사용
  try {
    window.scrollTo(0, 1);
    window.setTimeout(() => window.scrollTo(0, 1), 50);
    window.setTimeout(() => window.scrollTo(0, 1), 250);
  } catch {
    // ignore
  }
}

