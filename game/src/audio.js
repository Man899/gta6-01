// Synthesized sound effects for Port Solano, built with the Web Audio API only:
// no audio files, no network, every sound is an oscillator or filtered noise
// shaped in code. Created lazily on the first user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    blip() {
      tone(660, 0.09, 'sine', 0.25, 990);
    },
    pickup() {
      tone(523, 0.12, 'triangle', 0.3);
      setTimeout(() => tone(784, 0.16, 'triangle', 0.3), 90);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.3), i * 110));
    },
    punch() {
      noise(0.12, 0.5, 900);
    },
    shoot() {
      noise(0.16, 0.6, 2400);
      tone(180, 0.1, 'square', 0.2, 60);
    },
    crash() {
      noise(0.35, 0.7, 500);
      tone(90, 0.3, 'sawtooth', 0.3, 40);
    },
    siren() {
      if (!ensure()) return;
      const now = performance.now();
      if (now - sirenTimer < 900) return;
      sirenTimer = now;
      tone(700, 0.42, 'sine', 0.12, 950);
      setTimeout(() => tone(950, 0.42, 'sine', 0.12, 700), 450);
    },
    busted() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.25), i * 180));
    },
    /** Continuous engine hum while driving; speed 0..1 sets pitch and loudness. */
    engine(speed) {
      if (!ensure()) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(55 + speed * 130, t, 0.08);
      engineGain.gain.setTargetAtTime(speed > 0.02 ? 0.05 + speed * 0.06 : 0, t, 0.1);
    },
  };
}
