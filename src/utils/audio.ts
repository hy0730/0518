type SfxKey = 'correct' | 'wrong';

type AudioConfig = {
  bgmUrl: string;
  sfx: Record<SfxKey, string>;
};

const DEFAULT_CONFIG: AudioConfig = {
  bgmUrl: '/assets/audio/bgm.mp3',
  sfx: {
    correct: '/assets/audio/correct.mp3',
    wrong: '/assets/audio/wrong.mp3',
  },
};

/**
 * 매우 가벼운 HTML5 Audio 래퍼.
 * - 모바일 자동재생 제한 대응: 사용자 제스처(TitleScreen 버튼 클릭)에서 unlock() 호출 권장
 * - BGM은 loop, SFX는 cloneNode로 동시 재생 대응
 */
class AudioManager {
  private config: AudioConfig = DEFAULT_CONFIG;
  private bgm: HTMLAudioElement | null = null;
  private unlocked = false;
  private muted = false;
  private lastBgmVolume = 0.35;

  setConfig(partial: Partial<AudioConfig>) {
    this.config = {
      ...this.config,
      ...partial,
      sfx: { ...this.config.sfx, ...(partial.sfx ?? {}) },
    };
  }

  /** 사용자 제스처 내에서 호출: 오디오 사용 가능 상태 확보 */
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    // iOS/Safari 계열에서 "제스처 후 첫 play"를 보장하기 위해, 아주 짧게 play/pause 시도
    try {
      const a = new Audio();
      a.muted = true;
      a.src = this.config.sfx.correct;
      await a.play();
      a.pause();
    } catch {
      // 무시: 브라우저 정책/리소스 로드 상황에 따라 실패할 수 있음
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;

    if (muted) {
      this.pauseBgm();
      return;
    }

    // 백그라운드 상태면 재생 시도하지 않음(포그라운드 복귀 시 App.tsx가 재개)
    if (typeof document !== 'undefined' && document.hidden) return;

    void this.playBgm(this.lastBgmVolume);
  }

  getMuted() {
    return this.muted;
  }

  async playBgm(volume = 0.35) {
    this.lastBgmVolume = volume;
    if (this.muted) return;

    if (!this.bgm) {
      this.bgm = new Audio(this.config.bgmUrl);
      this.bgm.loop = true;
      this.bgm.preload = 'auto';
    }

    this.bgm.volume = volume;

    try {
      await this.bgm.play();
    } catch {
      // 자동재생 제한 등으로 실패할 수 있음 (TitleScreen에서 unlock 후 다시 시도 권장)
    }
  }

  pauseBgm() {
    try {
      this.bgm?.pause();
    } catch {
      // ignore
    }
  }

  playSfx(key: SfxKey, volume = 0.7) {
    if (!this.unlocked) return;
    if (this.muted) return;

    try {
      const base = new Audio(this.config.sfx[key]);
      base.preload = 'auto';
      base.volume = volume;
      // 동시에 여러번 눌러도 재생되도록 매번 새 인스턴스 사용
      void base.play();
    } catch {
      // ignore
    }
  }
}

export const audio = new AudioManager();
