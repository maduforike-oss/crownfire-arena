export type MusicMood = 'menu' | 'battle' | 'results';
type SfxKey =
  | 'menu'
  | 'matchStart'
  | 'bomb'
  | 'tick'
  | 'explosion'
  | 'pickup'
  | 'shield'
  | 'shieldBreak'
  | 'ghost'
  | 'frost'
  | 'blink'
  | 'beast'
  | 'dragonBlast'
  | 'surge'
  | 'damage'
  | 'defeat'
  | 'victory'
  | 'loss';

interface AudioPrefs {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
  uiVolume: number;
}

const AUDIO_KEY = 'crownfire-audio';

const DEFAULT_PREFS: AudioPrefs = {
  muted: false,
  musicVolume: 0.24,
  sfxVolume: 0.36,
  uiVolume: 0.3
};

export class AudioSystem {
  private static instance?: AudioSystem;
  private ctx?: AudioContext;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private uiGain?: GainNode;
  private trackGain?: GainNode;
  private musicTimer?: number;
  private activeMood?: MusicMood;
  private activeMap = 'ashen';
  private prefs: AudioPrefs = this.loadPrefs();

  static get(): AudioSystem {
    AudioSystem.instance ??= new AudioSystem();
    return AudioSystem.instance;
  }

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.uiGain = this.ctx.createGain();
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    this.uiGain.connect(this.ctx.destination);
    this.applyPrefs();
  }

  isMuted(): boolean {
    return this.prefs.muted;
  }

  toggleMute(): boolean {
    this.prefs.muted = !this.prefs.muted;
    this.savePrefs();
    this.applyPrefs();
    return this.prefs.muted;
  }

  setMusicVolume(value: number): void {
    this.prefs.musicVolume = Math.max(0, Math.min(1, value));
    this.savePrefs();
    this.applyPrefs();
  }

  setSfxVolume(value: number): void {
    this.prefs.sfxVolume = Math.max(0, Math.min(1, value));
    this.savePrefs();
    this.applyPrefs();
  }

  startMusic(mood: MusicMood, mapId = 'ashen'): void {
    this.unlock();
    if (!this.ctx || !this.musicGain) return;
    if (this.activeMood === mood && this.activeMap === mapId && this.musicTimer !== undefined) return;
    this.stopMusic();
    this.activeMood = mood;
    this.activeMap = mapId;
    const track = this.ctx.createGain();
    track.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    track.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.7);
    track.connect(this.musicGain);
    this.trackGain = track;
    const loop = () => {
      if (!this.ctx || !this.musicGain || this.prefs.muted) return;
      const now = this.ctx.currentTime;
      if (mood === 'menu') this.playMenuPhrase(now);
      else if (mood === 'results') this.playResultsPhrase(now);
      else this.playBattlePhrase(now, mapId);
    };
    loop();
    this.musicTimer = window.setInterval(loop, mood === 'menu' ? 7600 : mood === 'results' ? 8200 : 6400);
  }

  stopMusic(): void {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    if (this.ctx && this.trackGain) {
      const previous = this.trackGain;
      previous.gain.cancelScheduledValues(this.ctx.currentTime);
      previous.gain.setValueAtTime(Math.max(0.0001, previous.gain.value), this.ctx.currentTime);
      previous.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.55);
      window.setTimeout(() => previous.disconnect(), 700);
    }
    this.trackGain = undefined;
    this.musicTimer = undefined;
    this.activeMood = undefined;
  }

  sfx(key: SfxKey): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.prefs.muted) return;
    const now = this.ctx.currentTime;
    if (key === 'menu') this.tone(now, 420, 0.05, 'triangle', 0.22, this.uiGain);
    if (key === 'matchStart') this.chime(now, [196, 294, 392], 0.11);
    if (key === 'bomb') this.tone(now, 92, 0.11, 'sine', 0.34);
    if (key === 'tick') this.tone(now, 580, 0.035, 'square', 0.08);
    if (key === 'explosion') this.noise(now, 0.34, 0.45, 620);
    if (key === 'pickup') this.chime(now, [523, 659, 784], 0.08);
    if (key === 'shield') this.chime(now, [330, 495, 660], 0.1);
    if (key === 'shieldBreak') this.noise(now, 0.18, 0.35, 950);
    if (key === 'ghost') this.chime(now, [392, 466, 587], 0.13);
    if (key === 'frost') this.chime(now, [740, 622, 554], 0.09);
    if (key === 'blink') this.chime(now, [880, 660, 990], 0.055);
    if (key === 'beast') this.tone(now, 138, 0.15, 'sawtooth', 0.22);
    if (key === 'dragonBlast') {
      this.tone(now, 96, 0.28, 'sawtooth', 0.32);
      this.tone(now + 0.035, 192, 0.24, 'square', 0.13);
      this.noise(now + 0.02, 0.24, 0.32, 1450);
    }
    if (key === 'surge') this.chime(now, [392, 523, 659, 880], 0.12);
    if (key === 'damage') this.tone(now, 128, 0.09, 'sawtooth', 0.28);
    if (key === 'defeat') this.chime(now, [220, 175, 130], 0.16);
    if (key === 'victory') this.chime(now, [330, 415, 523, 659], 0.16);
    if (key === 'loss') this.chime(now, [196, 164, 130], 0.18);
  }

  private playMenuPhrase(start: number): void {
    if (!this.ctx) return;
    this.drone(start, 82.4, 7.4, 0.12);
    [246.9, 293.7, 329.6, 392].forEach((freq, i) => this.tone(start + i * 1.25, freq, 1.15, 'sine', 0.055));
  }

  private playBattlePhrase(start: number, mapId: string): void {
    if (!this.ctx) return;
    const palettes: Record<string, { root: number; pulse: number[]; melody: number[]; wave: OscillatorType }> = {
      ashen: { root: 55, pulse: [82.4, 98], melody: [220, 261.6, 311.1, 392], wave: 'sawtooth' },
      moonfang: { root: 65.4, pulse: [98, 123.5], melody: [246.9, 293.7, 370, 440], wave: 'triangle' },
      frostkeep: { root: 73.4, pulse: [110, 146.8], melody: [293.7, 370, 440, 587.3], wave: 'sine' },
      hollowmoon: { root: 61.7, pulse: [92.5, 116.5], melody: [233.1, 277.2, 349.2, 466.2], wave: 'triangle' }
    };
    const palette = palettes[mapId] ?? palettes.ashen;
    this.drone(start, palette.root, 6.2, 0.14);
    for (let i = 0; i < 8; i += 1) this.tone(start + i * 0.75, palette.pulse[i % palette.pulse.length], 0.055, palette.wave, 0.11);
    palette.melody.forEach((freq, i) => this.tone(start + 0.35 + i * 1.5, freq, 0.42, 'sine', 0.052));
  }

  private playResultsPhrase(start: number): void {
    if (!this.ctx) return;
    this.drone(start, 65.4, 7.8, 0.11);
    [196, 246.9, 293.7, 392, 493.9].forEach((freq, i) => this.tone(start + i * 1.35, freq, 0.9, 'triangle', 0.06));
  }

  private chime(start: number, freqs: number[], duration: number): void {
    freqs.forEach((freq, i) => this.tone(start + i * duration * 0.7, freq, duration, 'triangle', 0.22));
  }

  private drone(start: number, freq: number, duration: number, volume: number): void {
    this.tone(start, freq, duration, 'sine', volume);
    this.tone(start, freq * 1.5, duration, 'triangle', volume * 0.45);
  }

  private tone(start: number, freq: number, duration: number, type: OscillatorType, volume: number, destination?: AudioNode): void {
    if (!this.ctx || !this.sfxGain || !this.musicGain) return;
    const gain = this.ctx.createGain();
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(destination ?? (duration > 0.4 ? this.trackGain ?? this.musicGain : this.sfxGain));
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, volume: number, filterFreq: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(start);
  }

  private applyPrefs(): void {
    if (!this.musicGain || !this.sfxGain || !this.uiGain) return;
    this.musicGain.gain.value = this.prefs.muted ? 0 : this.prefs.musicVolume;
    this.sfxGain.gain.value = this.prefs.muted ? 0 : this.prefs.sfxVolume;
    this.uiGain.gain.value = this.prefs.muted ? 0 : this.prefs.uiVolume;
  }

  private loadPrefs(): AudioPrefs {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}') };
    } catch {
      return { ...DEFAULT_PREFS };
    }
  }

  private savePrefs(): void {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(this.prefs));
  }
}
