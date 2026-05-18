import { useEffect, useMemo, useState } from 'react';
import GameWrapper from './components/GameWrapper';
import CollectionModal from './components/CollectionModal';
import DialogBox from './components/DialogBox';
import GameHUD from './components/GameHUD';
import InstallBanner from './components/InstallBanner';
import MapScreen from './components/MapScreen';
import TitleScreen from './components/TitleScreen';
import { useGameStore } from './store/useGameStore';
import { audio } from './utils/audio';
import { initGA, trackEvent } from './utils/analytics';
import { preloadImages } from './utils/preload';

export default function App() {
  const status = useGameStore((s) => s.status);
  const error = useGameStore((s) => s.error);
  const regionData = useGameStore((s) => s.regionData);
  const resetError = useGameStore((s) => s.resetError);
  const isMuted = useGameStore((s) => s.isMuted);

  const [assetsReady, setAssetsReady] = useState(false);
  const [preloading, setPreloading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const assetUrls = useMemo(() => {
    if (!regionData) return [];
    const urls = [regionData.assets.mainBackground];
    if (regionData.assets.mapBackground) urls.push(regionData.assets.mapBackground);
    return urls;
  }, [regionData]);

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    useGameStore.getState().fetchRegionData();
    return () => {
      useGameStore.getState().cleanupRealtime();
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        audio.pauseBgm();
        return;
      }

      // 포그라운드 복귀 시: 시작 상태 + 음소거 아님 => BGM 재생
      if (hasStarted && !isMuted) {
        void audio.playBgm();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hasStarted, isMuted]);

  useEffect(() => {
    // 로딩/에러/초기 상태로 바뀌면 프리로드 플래그 초기화
    if (status !== 'ready') {
      setAssetsReady(false);
      setPreloading(false);
      return;
    }

    if (!regionData) return;
    if (assetsReady || preloading) return;

    setPreloading(true);
    (async () => {
      try {
        await preloadImages(assetUrls);
      } finally {
        setAssetsReady(true);
        setPreloading(false);
      }
    })();
  }, [status, regionData, assetUrls, assetsReady, preloading]);

  const centerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100dvh',
    display: 'grid',
    placeItems: 'center',
    background: '#0b0b0b',
    color: '#fff',
    fontSize: 16,
  };

  if (status === 'loading' || preloading || (status === 'ready' && !assetsReady)) {
    return <div style={centerStyle}>문화재 탐험 준비 중...</div>;
  }

  if (status === 'error') {
    return (
      <div style={centerStyle}>
        <div style={{ width: 'min(520px, 92vw)' }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>에러가 발생했습니다.</div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'rgba(255,255,255,0.08)',
              padding: 12,
              borderRadius: 10,
              margin: 0,
            }}
          >
            {error ?? '알 수 없는 오류'}
          </pre>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                resetError();
                useGameStore.getState().fetchRegionData();
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              재시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ready & assetsReady
  return (
    <GameWrapper>
      <InstallBanner />
      {!hasStarted ? (
        <TitleScreen
          title={regionData?.region.name ? `${regionData.region.name} 문화재 탐험` : '문화재 탐험'}
          onStart={async () => {
            // 사용자 제스처 내에서 오디오 제한 해제 + BGM 재생 시도
            await audio.unlock();
            audio.setMuted(useGameStore.getState().isMuted);
            if (!useGameStore.getState().isMuted) {
              await audio.playBgm();
            }
            trackEvent('game_start');
            setHasStarted(true);
          }}
        />
      ) : (
        <>
          <MapScreen />
          <GameHUD />
          <DialogBox />
          <CollectionModal />
        </>
      )}
    </GameWrapper>
  );
}
