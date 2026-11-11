/**
 * A fully synthesized airhorn (no audio files). BWAAP BWAP BWAAAAAAP.
 */

const CHORD_HZ = Object.freeze([311.13, 392.0, 466.16, 622.25]);
const PATTERN = Object.freeze([
  { at: 0, dur: 0.17 },
  { at: 0.24, dur: 0.12 },
  { at: 0.42, dur: 0.85 },
]);
const MASTER_VOLUME = 0.32;
const SCOOP = 0.93;

function distortionCurve(amount, samples = 1024) {
  return Float32Array.from({ length: samples }, (_, i) => {
    const x = (i * 2) / samples - 1;
    return ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  });
}

function honk(ac, destination, start, dur) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(1, start + 0.02);
  gain.gain.setValueAtTime(1, start + dur - 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  gain.connect(destination);

  CHORD_HZ.forEach((hz) => {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz * SCOOP, start);
    osc.frequency.exponentialRampToValueAtTime(hz, start + 0.07);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  });
}

export function createAirhorn() {
  let ac = null;

  const context = () => {
    if (!ac) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ac = new AudioCtx();
    }
    if (ac.state === 'suspended') ac.resume().catch(reportError);
    return ac;
  };

  return {
    /** Returns the total length in seconds, or 0 if audio is unavailable. */
    blast() {
      const audio = context();
      if (!audio) return 0;

      const shaper = audio.createWaveShaper();
      shaper.curve = distortionCurve(40);
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3200;
      const master = audio.createGain();
      master.gain.value = MASTER_VOLUME;
      shaper.connect(filter).connect(master).connect(audio.destination);

      const t0 = audio.currentTime + 0.02;
      PATTERN.forEach(({ at, dur }) => honk(audio, shaper, t0 + at, dur));
      const last = PATTERN[PATTERN.length - 1];
      return last.at + last.dur;
    },
  };
}
