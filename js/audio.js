/**
 * RPA PIT STOP - High Performance Web Audio Synthesizer Engine
 * Generates all authentic F1 & pneumatic pit stop sounds procedurally
 * No external audio files or network requests required!
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.volume = 0.7;
    this.masterGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // Helper to create noise buffer
  createNoiseBuffer(duration = 0.5) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // 1. CAR ENTERING PIT LANE
  playPitEntry() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Engine downshift whine
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.9);

    // Filter to simulate engine exhaust
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.9);

    oscGain.gain.setValueAtTime(0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.95);

    // Tire squeal on braking
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.7);
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(2200, t + 0.2);
    nFilter.Q.setValueAtTime(6, t + 0.2);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.0, t);
    nGain.gain.setValueAtTime(0.2, t + 0.2);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.7);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.masterGain);

    noise.start(t + 0.2);
    noise.stop(t + 0.75);
  }

  // 2. JACK LIFTING (Pneumatic hiss + mechanical thud)
  playJackLift() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Pneumatic hiss
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.35);
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'highpass';
    nFilter.frequency.setValueAtTime(1200, t);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.25, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.35);

    // Heavy mechanical clunk
    const clunk = this.ctx.createOscillator();
    const clunkGain = this.ctx.createGain();
    clunk.type = 'triangle';
    clunk.frequency.setValueAtTime(140, t + 0.05);
    clunk.frequency.exponentialRampToValueAtTime(45, t + 0.25);

    clunkGain.gain.setValueAtTime(0.4, t + 0.05);
    clunkGain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    clunk.connect(clunkGain);
    clunkGain.connect(this.masterGain);
    clunk.start(t + 0.05);
    clunk.stop(t + 0.3);
  }

  // 3. WHEEL GUN OPERATION (Brushless motor whirr + rapid impact hammer)
  playWheelGun() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    // High RPM electric motor whine
    const motor = this.ctx.createOscillator();
    const motorGain = this.ctx.createGain();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(600, t);
    motor.frequency.linearRampToValueAtTime(1400, t + 0.12);
    motor.frequency.exponentialRampToValueAtTime(500, t + 0.35);

    motorGain.gain.setValueAtTime(0.18, t);
    motorGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    motor.connect(motorGain);
    motorGain.connect(this.masterGain);
    motor.start(t);
    motor.stop(t + 0.38);

    // Rapid impact ratchet clicks
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      const clickTime = t + 0.05 + i * 0.045;
      const snap = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      snap.type = 'square';
      snap.frequency.setValueAtTime(950 - i * 60, clickTime);

      snapGain.gain.setValueAtTime(0.25, clickTime);
      snapGain.gain.exponentialRampToValueAtTime(0.01, clickTime + 0.03);

      snap.connect(snapGain);
      snapGain.connect(this.masterGain);
      snap.start(clickTime);
      snap.stop(clickTime + 0.035);
    }
  }

  // 4. PERFECT TIMING HIT (Crisp dual-tone sci-fi harmonic chime)
  playPerfect() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    const freqs = [880, 1318.5, 1760]; // A5, E6, A6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18 / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  // 5. GOOD TIMING HIT (Solid mechanical confirmation)
  playGood() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    const freqs = [587.33, 880]; // D5, A5
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.15 / (idx + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  // 6. MECHANICAL FAILURE (Warning buzzer + dropped wrench clatter)
  playFailure() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Dual detuned dissonant buzzer
    [180, 192].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      // Tremolo pulse
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.1);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.52);
    });

    // Metallic drop clatter
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.25);
    const nFilter = this.ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(1400, t + 0.1);
    nFilter.Q.setValueAtTime(4, t + 0.1);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.25, t + 0.1);
    nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(t + 0.1);
    noise.stop(t + 0.38);
  }

  // 7. CAR RELEASE / DEPARTURE (Jack drop + V6 hybrid burnout roar!)
  playReleaseAndBurnout() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;

    // Jack drop clunk
    const drop = this.ctx.createOscillator();
    const dropGain = this.ctx.createGain();
    drop.type = 'triangle';
    drop.frequency.setValueAtTime(90, t);
    drop.frequency.exponentialRampToValueAtTime(35, t + 0.2);
    dropGain.gain.setValueAtTime(0.5, t);
    dropGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    drop.connect(dropGain);
    dropGain.connect(this.masterGain);
    drop.start(t);
    drop.stop(t + 0.28);

    // Tire spin burnout screech
    const tireNoise = this.ctx.createBufferSource();
    tireNoise.buffer = this.createNoiseBuffer(1.4);
    const tireFilter = this.ctx.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.setValueAtTime(1800, t + 0.15);
    tireFilter.frequency.linearRampToValueAtTime(3200, t + 0.8);
    tireFilter.Q.setValueAtTime(8, t + 0.15);

    const tireGain = this.ctx.createGain();
    tireGain.gain.setValueAtTime(0.0, t);
    tireGain.gain.linearRampToValueAtTime(0.35, t + 0.2);
    tireGain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

    tireNoise.connect(tireFilter);
    tireFilter.connect(tireGain);
    tireGain.connect(this.masterGain);
    tireNoise.start(t + 0.15);
    tireNoise.stop(t + 1.4);

    // Screaming F1 V6 turbo engine acceleration!
    const engine = this.ctx.createOscillator();
    const engineGain = this.ctx.createGain();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(120, t + 0.1);
    engine.frequency.exponentialRampToValueAtTime(680, t + 1.2);
    engine.frequency.exponentialRampToValueAtTime(1200, t + 1.8);

    const eFilter = this.ctx.createBiquadFilter();
    eFilter.type = 'lowpass';
    eFilter.frequency.setValueAtTime(1500, t + 0.1);
    eFilter.frequency.exponentialRampToValueAtTime(4500, t + 1.5);

    engineGain.gain.setValueAtTime(0.0, t);
    engineGain.gain.linearRampToValueAtTime(0.4, t + 0.2);
    engineGain.gain.exponentialRampToValueAtTime(0.01, t + 1.9);

    engine.connect(eFilter);
    eFilter.connect(engineGain);
    engineGain.connect(this.masterGain);
    engine.start(t + 0.1);
    engine.stop(t + 1.95);
  }

  // 8. RPA TELEMETRY BLIP
  playTelemetryBlip() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.setValueAtTime(1800, t + 0.04);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 9. VICTORY FANFARE
  playFanfare() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const t = this.ctx.currentTime;
    const notes = [
      { f: 523.25, time: 0.0, dur: 0.15 }, // C5
      { f: 659.25, time: 0.15, dur: 0.15 }, // E5
      { f: 783.99, time: 0.3, dur: 0.18 },  // G5
      { f: 1046.50, time: 0.48, dur: 0.45 } // C6
    ];

    notes.forEach((n) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t + n.time);

      gain.gain.setValueAtTime(0.2, t + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.time + n.dur);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + n.time);
      osc.stop(t + n.time + n.dur + 0.02);
    });
  }
}

// Global singleton instance
window.soundEngine = new SoundEngine();
