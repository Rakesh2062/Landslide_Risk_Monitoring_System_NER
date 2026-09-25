/**
 * Emergency Audio Warning Synthesizer
 *
 * Synthesizes warning signals and alert beeps via Web Audio API:
 * - Critical Alerts: Continuous emergency alarm pulses until manually stopped / disabled.
 * - High Alerts: Single emergency warning burst (~1.3s).
 * - Medium / Low Alerts: Single crisp dual-tone notification beep (~0.4s).
 */

class EmergencyAudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.activeOscillators = [];
    this.activeGainNodes = [];
    this.timeoutHandles = [];
    this.isPlaying = false;
    this.isLooping = false;
    this.currentSeverity = 'medium';
    this.onStateChange = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    return this.audioCtx;
  }

  /**
   * Resume audio context on user interaction to comply with browser autoplay policies.
   */
  async unlockAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        return true;
      } catch (e) {
        return false;
      }
    }
    return Boolean(ctx);
  }

  isUnlocked() {
    const ctx = this.getAudioContext();
    return Boolean(ctx && ctx.state === 'running');
  }

  /**
   * Plays an alert beep based on severity.
   * If severity is 'critical', it will loop continuously until stop() is called.
   * For other severities (high, medium, low), it plays exactly once.
   */
  playAlertBeep(severity = 'medium', forceLoop = null) {
    this.stop();

    this.currentSeverity = severity;
    const shouldLoop = forceLoop !== null ? forceLoop : (severity === 'critical');
    this.isLooping = shouldLoop;

    if (severity === 'critical' || severity === 'high') {
      this.playEmergencySignal(shouldLoop);
    } else {
      this.playNotificationBeep(shouldLoop);
    }

    if (this.onStateChange) {
      this.onStateChange(true);
    }
  }

  /**
   * Plays a single crisp dual-tone notification alert beep (for medium/low).
   */
  playNotificationBeep(loop = false) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.isPlaying = true;
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.connect(ctx.destination);
    this.activeGainNodes.push(masterGain);

    // Beep Tone 1 (880 Hz) & Harmonic (1320 Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1046.5, now + 0.22);
    osc1.connect(masterGain);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1320, now);
    osc2.frequency.setValueAtTime(1568, now + 0.22);
    osc2.connect(masterGain);

    // Beep 1: 0.0s -> 0.14s
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    masterGain.gain.setValueAtTime(0.24, now + 0.11);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    // Beep 2: 0.22s -> 0.38s
    const beep2Start = now + 0.22;
    const beep2End = beep2Start + 0.16;
    masterGain.gain.setValueAtTime(0.001, beep2Start);
    masterGain.gain.exponentialRampToValueAtTime(0.32, beep2Start + 0.02);
    masterGain.gain.setValueAtTime(0.28, beep2End - 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.001, beep2End);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(beep2End + 0.05);
    osc2.stop(beep2End + 0.05);

    this.activeOscillators.push(osc1, osc2);

    const totalMs = (beep2End - now + (loop ? 0.6 : 0.1)) * 1000;
    const timer = setTimeout(() => {
      if (loop && this.isPlaying && this.isLooping) {
        this.clearAudioNodes();
        this.playNotificationBeep(true);
      } else if (!loop) {
        this.isPlaying = false;
        if (this.onStateChange) this.onStateChange(false);
      }
    }, totalMs);
    this.timeoutHandles.push(timer);
  }

  /**
   * Plays emergency warning pulses (853 Hz + 960 Hz dual frequency).
   * If loop is true, continuously repeats until stop() is called.
   */
  playEmergencySignal(loop = false) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.isPlaying = true;
    const now = ctx.currentTime;

    // Master volume gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.connect(ctx.destination);
    this.activeGainNodes.push(masterGain);

    // Primary frequency (853 Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(853, now);
    osc1.connect(masterGain);

    // Secondary frequency (960 Hz)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(960, now);
    osc2.connect(masterGain);

    const burstDuration = 0.50;
    const pauseDuration = 0.15;

    // Burst 1: 0.0s to 0.50s
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.28, now + 0.04);
    masterGain.gain.setValueAtTime(0.26, now + burstDuration - 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + burstDuration);

    // Burst 2: 0.65s to 1.15s
    const burst2Start = now + burstDuration + pauseDuration;
    const burst2End = burst2Start + burstDuration;
    masterGain.gain.setValueAtTime(0.001, burst2Start);
    masterGain.gain.exponentialRampToValueAtTime(0.3, burst2Start + 0.04);
    masterGain.gain.setValueAtTime(0.28, burst2End - 0.04);
    masterGain.gain.exponentialRampToValueAtTime(0.001, burst2End);

    // Start oscillators
    osc1.start(now);
    osc2.start(now);
    osc1.stop(burst2End + 0.05);
    osc2.stop(burst2End + 0.05);

    this.activeOscillators.push(osc1, osc2);

    const cycleIntervalMs = (burst2End - now + (loop ? 0.35 : 0.1)) * 1000;
    const timer = setTimeout(() => {
      if (loop && this.isPlaying && this.isLooping) {
        this.clearAudioNodes();
        this.playEmergencySignal(true);
      } else if (!loop) {
        this.isPlaying = false;
        if (this.onStateChange) this.onStateChange(false);
      }
    }, cycleIntervalMs);
    this.timeoutHandles.push(timer);
  }

  clearAudioNodes() {
    const now = this.audioCtx ? this.audioCtx.currentTime : 0;
    this.activeGainNodes.forEach((gain) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        gain.disconnect();
      } catch (e) {}
    });
    this.activeGainNodes = [];

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.activeOscillators = [];
  }

  /**
   * Immediately stops any playing tone, halts loops, and clears scheduled audio.
   */
  stop() {
    this.isPlaying = false;
    this.isLooping = false;
    this.timeoutHandles.forEach(clearTimeout);
    this.timeoutHandles = [];
    this.clearAudioNodes();

    if (this.onStateChange) {
      this.onStateChange(false);
    }
  }
}

export const emergencyAudio = new EmergencyAudioSynthesizer();
