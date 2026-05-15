type OscillatorKind = OscillatorType;

const SFX_SOURCES = {
  playerAttackSwish: [['/assets/sfx/player-attack-swish.ogg', '/assets/sfx/player-attack-swish.mp3']],
  zombieHitImpact: [
    ['/assets/sfx/zombie-hit-impact-1.ogg', '/assets/sfx/zombie-hit-impact-1.mp3'],
    ['/assets/sfx/zombie-hit-impact-2.ogg', '/assets/sfx/zombie-hit-impact-2.mp3'],
    ['/assets/sfx/zombie-hit-impact-3.ogg', '/assets/sfx/zombie-hit-impact-3.mp3'],
    ['/assets/sfx/zombie-hit-impact-4.ogg', '/assets/sfx/zombie-hit-impact-4.mp3'],
  ],
  playerHurtImpact: [
    ['/assets/sfx/player-hurt-impact-1.ogg', '/assets/sfx/player-hurt-impact-1.mp3'],
    ['/assets/sfx/player-hurt-impact-2.ogg', '/assets/sfx/player-hurt-impact-2.mp3'],
  ],
  playerUltimateSwoosh: [['/assets/sfx/player-ultimate-swoosh.ogg', '/assets/sfx/player-ultimate-swoosh.mp3']],
} as const;

const MUSIC_URLS = ['/assets/music/asianoriental1.ogg', '/assets/music/asianoriental1.mp3'] as const;
const MUSIC_GAIN_MULTIPLIER = 0.32;

type SfxName = keyof typeof SFX_SOURCES;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class AudioSystem {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private musicGain: GainNode | undefined;
  private musicSource: AudioBufferSourceNode | undefined;
  private musicBuffer: AudioBuffer | undefined;
  private musicLoad: Promise<void> | undefined;
  private musicVolumeValue = 0.45;
  private unlocked = false;
  private musicEnabled = true;
  private readonly sfxBuffers = new Map<SfxName, AudioBuffer[]>();
  private readonly sfxLoads = new Map<SfxName, Promise<void>>();
  private lastZombieHitSfxTime = -Infinity;
  private hasPrimedOutput = false;

  get enabled(): boolean {
    return this.musicEnabled;
  }

  get musicVolume(): number {
    return this.musicVolumeValue;
  }

  get contextState(): string {
    return this.context?.state ?? 'unavailable';
  }

  get musicPlaying(): boolean {
    return Boolean(this.musicSource);
  }

  get musicLoaded(): boolean {
    return Boolean(this.musicBuffer);
  }

  unlock(): void {
    void this.ensureContext().then(() => {
      void this.preloadSfx();
      void this.loadMusic().then(() => {
        if (this.musicEnabled) {
          this.startMusic();
        }
      });
    }).catch((error: unknown) => {
      console.warn('Failed to unlock audio.', error);
    });
  }

  async toggleMusic(): Promise<void> {
    await this.ensureContext();
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      await this.loadMusic();
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  setMusicVolume(volume: number): void {
    this.musicVolumeValue = clamp01(volume);
    this.applyMusicVolume();
  }

  playSlash(combo: number): void {
    if (
      this.playBufferedSfx('playerAttackSwish', {
        volume: 0.46 + combo * 0.035,
        playbackRate: 0.98 + combo * 0.055,
        randomPlaybackRate: 0.055,
      })
    ) {
      return;
    }

    void this.loadSfx('playerAttackSwish');
    this.playTone(210 + combo * 80, 0.045, 'sawtooth', 0.055);
    this.playTone(620 + combo * 120, 0.035, 'triangle', 0.04);
  }

  playHit(): void {
    const now = this.context?.currentTime ?? 0;
    if (now - this.lastZombieHitSfxTime < 0.045) {
      return;
    }
    if (
      this.playBufferedSfx('zombieHitImpact', {
        volume: 0.5,
        playbackRate: 0.98,
        randomPlaybackRate: 0.09,
        randomVolume: 0.08,
      })
    ) {
      this.lastZombieHitSfxTime = this.context?.currentTime ?? now;
      return;
    }

    void this.loadSfx('zombieHitImpact');
    this.playTone(92, 0.07, 'square', 0.075);
    this.playTone(44, 0.12, 'sawtooth', 0.045);
  }

  playPlayerHurt(): void {
    if (
      this.playBufferedSfx('playerHurtImpact', {
        volume: 0.58,
        playbackRate: 0.98,
        randomPlaybackRate: 0.08,
        randomVolume: 0.08,
      })
    ) {
      return;
    }

    void this.loadSfx('playerHurtImpact');
    this.playTone(130, 0.11, 'sawtooth', 0.08);
  }

  playUltimate(): void {
    if (
      this.playBufferedSfx('playerUltimateSwoosh', {
        volume: 0.82,
        playbackRate: 1,
        randomPlaybackRate: 0.02,
      })
    ) {
      this.playTone(72, 0.22, 'sawtooth', 0.055);
      return;
    }

    void this.loadSfx('playerUltimateSwoosh');
    this.playTone(72, 0.36, 'sawtooth', 0.12);
    this.playTone(880, 0.2, 'triangle', 0.09);
    this.playTone(1320, 0.12, 'sine', 0.06);
  }

  private async ensureContext(): Promise<AudioContext | undefined> {
    if (this.context) {
      await this.resumeContext();
      return this.context;
    }

    const ContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!ContextCtor) {
      return undefined;
    }

    this.context = new ContextCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.context.destination);
    this.unlocked = true;
    this.primeOutput();
    await this.resumeContext();
    return this.context;
  }

  private async resumeContext(): Promise<void> {
    if (!this.context || this.context.state !== 'suspended') {
      return;
    }

    try {
      await this.context.resume();
      this.unlocked = true;
    } catch (error: unknown) {
      console.warn('Failed to resume audio context.', error);
    }
  }

  private primeOutput(): void {
    if (!this.context || !this.master || this.hasPrimedOutput) {
      return;
    }

    this.hasPrimedOutput = true;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.context.createBuffer(1, 1, 22050);
    gain.gain.value = 0.0001;
    source.connect(gain);
    gain.connect(this.master);
    source.start(0);
    source.stop(this.context.currentTime + 0.01);
  }

  private async preloadSfx(): Promise<void> {
    await Promise.all((Object.keys(SFX_SOURCES) as SfxName[]).map((name) => this.loadSfx(name)));
  }

  private loadMusic(): Promise<void> {
    if (this.musicBuffer) {
      return Promise.resolve();
    }
    if (this.musicLoad) {
      return this.musicLoad;
    }

    this.musicLoad = this.loadFirstSupportedAudio(MUSIC_URLS)
      .then((buffer) => {
        this.musicBuffer = buffer;
      })
      .catch((error: unknown) => {
        console.warn('Failed to load background music.', error);
      });

    return this.musicLoad;
  }

  private loadSfx(name: SfxName): Promise<void> {
    if ((this.sfxBuffers.get(name)?.length ?? 0) > 0) {
      return Promise.resolve();
    }

    const existingLoad = this.sfxLoads.get(name);
    if (existingLoad) {
      return existingLoad;
    }

    const load = Promise.all(
      SFX_SOURCES[name].map((urls) =>
        this.loadFirstSupportedAudio(urls).catch((error: unknown) => {
          console.warn(`Failed to load ${name} SFX source.`, error);
          return undefined;
        }),
      ),
    ).then((buffers) => {
      const loaded = buffers.filter((buffer): buffer is AudioBuffer => Boolean(buffer));
      if (loaded.length > 0) {
        this.sfxBuffers.set(name, loaded);
      }
    });

    this.sfxLoads.set(name, load);
    return load;
  }

  private async loadFirstSupportedAudio(urls: readonly string[]): Promise<AudioBuffer> {
    const context = await this.ensureContext();
    if (!context) {
      throw new Error('AudioContext is unavailable.');
    }

    let lastError: unknown;
    for (const url of this.preferredAudioUrls(urls)) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while loading ${url}`);
        }
        const data = await response.arrayBuffer();
        return await context.decodeAudioData(data);
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No supported audio source loaded.');
  }

  private preferredAudioUrls(urls: readonly string[]): readonly string[] {
    const audio = document.createElement('audio');
    const scoredUrls = urls.map((url, index) => {
      const support = audio.canPlayType(mimeTypeForAudioUrl(url));
      const score = support === 'probably' ? 2 : support === 'maybe' ? 1 : 0;
      return { index, score, url };
    });

    return scoredUrls
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ url }) => url);
  }

  private playBufferedSfx(
    name: SfxName,
    options: {
      volume: number;
      playbackRate: number;
      randomPlaybackRate?: number;
      randomVolume?: number;
    },
  ): boolean {
    const buffers = this.sfxBuffers.get(name);
    if (!this.unlocked || !this.context || !this.master || !buffers || buffers.length === 0) {
      return false;
    }

    void this.resumeContext();
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const buffer = buffers[Math.floor(Math.random() * buffers.length)];
    const playbackVariation = options.randomPlaybackRate
      ? Math.random() * options.randomPlaybackRate - options.randomPlaybackRate * 0.5
      : 0;
    const volumeVariation = options.randomVolume
      ? Math.random() * options.randomVolume - options.randomVolume * 0.5
      : 0;
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.25, options.playbackRate + playbackVariation);
    gain.gain.value = Math.max(0, options.volume + volumeVariation);
    source.connect(gain);
    gain.connect(this.master);
    source.start();
    return true;
  }

  private startMusic(): void {
    if (!this.context || !this.master || !this.musicBuffer || this.musicSource) {
      return;
    }

    void this.resumeContext();
    const musicGain = this.context.createGain();
    musicGain.gain.value = this.musicGainValue();
    musicGain.connect(this.master);
    this.musicGain = musicGain;

    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(musicGain);
    source.start();
    source.onended = () => {
      if (this.musicSource === source) {
        this.musicSource = undefined;
      }
    };
    this.musicSource = source;
  }

  private stopMusic(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // Already stopped.
      }
      this.musicSource.disconnect();
      this.musicSource = undefined;
    }
    this.musicGain?.disconnect();
    this.musicGain = undefined;
  }

  private applyMusicVolume(): void {
    if (!this.musicGain) {
      return;
    }
    this.musicGain.gain.value = this.musicGainValue();
  }

  private musicGainValue(): number {
    return this.musicVolumeValue * MUSIC_GAIN_MULTIPLIER;
  }

  private playTone(frequency: number, duration: number, type: OscillatorKind, volume: number): void {
    if (!this.unlocked || !this.context || !this.master) {
      return;
    }

    void this.resumeContext();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.42), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function mimeTypeForAudioUrl(url: string): string {
  if (url.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (url.endsWith('.ogg')) {
    return 'audio/ogg; codecs="vorbis"';
  }
  return '';
}
