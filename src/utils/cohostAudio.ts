/**
 * Web Audio API procedural sound engine for Cohost.
 * Generates all music moods, countdown ticks, and game SFX procedurally.
 * No external audio files, zero copyright, 100% royalty-free.
 */

class CohostAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.7;
  private currentMusicMood: string | null = null;
  private musicInterval: any = null;
  private activeMusicNodes: AudioNode[] = [];

  constructor() {
    try {
      const savedMute = localStorage.getItem('cohost_audio_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
      const savedVol = localStorage.getItem('cohost_audio_volume');
      if (savedVol !== null) {
        const v = parseFloat(savedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          this.volume = v;
        }
      }
    } catch {}
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAudio() {
    this.initContext();
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('cohost_audio_muted', String(muted));
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    try {
      localStorage.setItem('cohost_audio_volume', String(clamped));
    } catch {}
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  // ==========================================
  // SOUND EFFECTS
  // ==========================================

  /**
   * Sound when a player joins lobby
   */
  public playJoin() {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.exponentialRampToValueAtTime(783.99, t + 0.12); // G5

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Sound when student locks in answer
   */
  public playLockAnswer() {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Countdown tick blip
   */
  public playTick(isUrgent = false) {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isUrgent ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 880 : 440, t);

    gain.gain.setValueAtTime(isUrgent ? 0.25 : 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Correct Answer Chime (Major triad arpeggio)
   */
  public playCorrect() {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.25, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });
  }

  /**
   * Wrong Answer Sound (Gentle two-tone low bounce)
   */
  public playWrong() {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const notes = [293.66, 220.0]; // D4, A3

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
    });
  }

  /**
   * Answer Reveal Gong / Fanfare
   */
  public playReveal() {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(261.63, t); // C4
    osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.2); // C5

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.7);
  }

  /**
   * Podium fanfare
   */
  public playPodiumFanfare() {
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain || this.isMuted) return;

    const t = ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.15 },
      { f: 659.25, d: 0.15 },
      { f: 783.99, d: 0.15 },
      { f: 1046.5, d: 0.5 },
    ];

    let offset = 0;
    melody.forEach(note => {
      const noteTime = t + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, noteTime);

      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.d);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(noteTime);
      osc.stop(noteTime + note.d);

      offset += note.d * 0.8;
    });
  }

  // ==========================================
  // PROCEDURAL MUSIC MOODS
  // ==========================================

  public stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.activeMusicNodes.forEach(node => {
      try {
        (node as any).stop?.();
        node.disconnect();
      } catch {}
    });
    this.activeMusicNodes = [];
    this.currentMusicMood = null;
  }

  public playMoodMusic(mood: string) {
    if (mood === 'Silent' || this.isMuted) {
      this.stopMusic();
      this.currentMusicMood = mood;
      return;
    }

    if (this.currentMusicMood === mood && this.musicInterval) {
      return; // Already playing this mood
    }

    this.stopMusic();
    this.currentMusicMood = mood;
    const ctx = this.initContext();
    if (!ctx || !this.musicGain) return;

    let step = 0;

    // Mood note definitions
    const getMoodNotes = (m: string) => {
      switch (m) {
        case 'Hype':
          return [130.81, 164.81, 196.0, 261.63, 196.0, 329.63, 261.63, 392.0]; // Energetic synth loop
        case 'Mystery':
          return [220.0, 261.63, 329.63, 440.0, 392.0, 329.63, 293.66, 261.63]; // Minor ethereal
        case 'Party':
          return [261.63, 329.63, 392.0, 523.25, 440.0, 349.23, 392.0, 440.0]; // Upbeat bouncy
        case 'Epic':
          return [146.83, 220.0, 293.66, 370.0, 440.0, 370.0, 293.66, 220.0]; // Dramatic brassy saw
        case 'Chill':
        default:
          return [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 261.63, 196.0]; // Soft pleasant loop
      }
    };

    const notes = getMoodNotes(mood);
    const intervalMs = mood === 'Hype' ? 240 : mood === 'Party' ? 280 : mood === 'Epic' ? 360 : 420;

    this.musicInterval = setInterval(() => {
      if (this.isMuted || !this.ctx || !this.musicGain) return;

      const t = this.ctx.currentTime;
      const freq = notes[step % notes.length];
      step++;

      // Synth note
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = mood === 'Hype' ? 'sawtooth' : mood === 'Chill' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const noteDuration = (intervalMs / 1000) * 0.9;
      gain.gain.setValueAtTime(mood === 'Hype' ? 0.08 : 0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      osc.stop(t + noteDuration);

      // Low bass accompaniment on beat 0 and 4
      if (step % 4 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(freq / 2, t);

        bassGain.gain.setValueAtTime(0.15, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration * 1.5);

        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(t);
        bassOsc.stop(t + noteDuration * 1.5);
      }
    }, intervalMs);
  }
}

export const cohostAudio = new CohostAudioEngine();
