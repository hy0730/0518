import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-XXXXXXXXXX';

const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

let initialized = false;

export function initGA() {
  if (isDev) {
    initialized = true;
    return;
  }

  if (initialized) return;

  try {
    ReactGA.initialize(MEASUREMENT_ID);
    initialized = true;
  } catch (e) {
    // GA 초기화 실패가 앱 동작을 막지 않도록 방어
    // noop
  }
}

export function trackEvent(action: string, params?: Record<string, any>) {
  if (isDev) {
    return;
  }

  if (!initialized) {
    // 초기화 누락 방어 (앱 동작은 지속)
    initGA();
  }

  try {
    ReactGA.event(action, params ?? {});
  } catch (e) {
    // noop
  }
}
