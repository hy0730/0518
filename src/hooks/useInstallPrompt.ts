import { useEffect, useState } from 'react';

// TS 기본 lib에 없어서 최소 타입 선언
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // iOS Safari 등에서는 이벤트가 없으니 여기 자체가 호출되지 않음
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice;
  };

  const dismiss = () => setDeferredPrompt(null);

  return {
    deferredPrompt,
    canInstall: !!deferredPrompt,
    promptInstall,
    dismiss,
  };
}

