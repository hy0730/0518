import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-XXXXXXXXXX';

const isDev =
  // Vite
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
  // fallback
  (typeof process !== 'undefined' && (process as any).env?.NODE_ENV === 'development');

let initialized = false;

export function initGA() {
  if (isDev) {
    console.log('[GA] initGA (dev) - skip initialize', MEASUREMENT_ID);
    initialized = true;
    return;
  }

  if (initialized) return;

  try {
    ReactGA.initialize(MEASUREMENT_ID);
    initialized = true;
  } catch (e) {
    // GA 초기화 실패가 앱 동작을 막지 않도록 방어
    console.warn('[GA] initialize failed', e);
  }
}

export function trackEvent(action: string, params?: Record<string, any>) {
  if (isDev) {
    console.log('[GA] event (dev)', action, params ?? {});
    return;
  }

  if (!initialized) {
    // 초기화 누락 방어 (앱 동작은 지속)
    initGA();
  }

  try {
    ReactGA.event(action, params ?? {});
  } catch (e) {
    console.warn('[GA] event failed', action, e);
  }
}

