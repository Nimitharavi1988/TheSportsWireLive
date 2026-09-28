// Original, procedurally generated music beds for reels. Made entirely
// here, so there's no licence to track and nothing for Instagram's or
// Facebook's rights matching to flag. Four styles (REEL_MUSIC_STYLES), each
// a one-bar drum/bass/arp pattern over a four-bar chord loop with a
// filtered one-bar intro; deterministic (seeded noise), so a given style
// always sounds the same. Returns a 16-bit stereo WAV.

const SR = 44100;

// 16 steps per bar. Drum steps: 1 = hit (a number < 1 is a softer hit).
// Bass steps: note length in steps, 0 = rest.
interface MusicStyle {
  bpm: number;
  chords: number[][]; // MIDI notes, one chord per bar
  bassRoots: number[]; // MIDI, one per bar
  kick: number[];
  clap: number[];
  hat: number[];
  openHat: number[];
  bass: number[];
  bassKind: "pluck" | "808";
  arp: number[]; // 1 = play the next chord tone
  arpOctave: number;
  arpDecay: number; // higher = shorter, pluckier
  arpLevel: number;
  padLevel: number;
  padBrightness: number; // 0.02 dark .. 0.15 bright
  swing: number; // 0 = straight, delays off-beat 16ths by this fraction of a step
}

export const REEL_MUSIC_STYLES = {
  // Driving four-on-the-floor, A minor, 124 BPM. The first sample reel's track.
  drive: {
    bpm: 124,
    chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
    bassRoots: [33, 29, 36, 31],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    openHat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    bass: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0],
    bassKind: "pluck",
    arp: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    arpOctave: 12,
    arpDecay: 18,
    arpLevel: 0.09,
    padLevel: 0.05,
    padBrightness: 0.08,
    swing: 0,
  },
  // Big, bright stadium anthem: C major, 100 BPM, stomp-clap half-time.
  anthem: {
    bpm: 100,
    chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    bassRoots: [36, 31, 33, 29],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0.7, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((_, i) => (i === 4 || i === 12 ? 1 : 0)),
    hat: [1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0, 1, 0, 0.6, 0],
    openHat: new Array(16).fill(0),
    bass: [4, 0, 0, 0, 0, 0, 2, 0, 4, 0, 0, 0, 0, 0, 2, 0],
    bassKind: "pluck",
    arp: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    arpOctave: 12,
    arpDecay: 7,
    arpLevel: 0.1,
    padLevel: 0.07,
    padBrightness: 0.14,
    swing: 0,
  },
  // Hard trap: D minor, 140 BPM, 808 bass, rolling hats.
  trap: {
    bpm: 140,
    chords: [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]],
    bassRoots: [38, 34, 31, 33],
    kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1],
    openHat: new Array(16).fill(0),
    bass: [6, 0, 0, 0, 0, 0, 0, 3, 0, 0, 5, 0, 0, 0, 0, 0],
    bassKind: "808",
    arp: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    arpOctave: 12,
    arpDecay: 10,
    arpLevel: 0.08,
    padLevel: 0.04,
    padBrightness: 0.05,
    swing: 0,
  },
  // Laid-back, jazzy chords with swing: F major 7ths, 92 BPM.
  chill: {
    bpm: 92,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bassRoots: [29, 28, 26, 24],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    clap: [0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0],
    hat: [0.7, 0, 0.5, 0, 0.7, 0, 0.5, 0, 0.7, 0, 0.5, 0, 0.7, 0, 0.5, 0],
    openHat: new Array(16).fill(0),
    bass: [3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 0],
    bassKind: "pluck",
    arp: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    arpOctave: 12,
    arpDecay: 5,
    arpLevel: 0.08,
    padLevel: 0.06,
    padBrightness: 0.05,
    swing: 0.35,
  },
} satisfies Record<string, MusicStyle>;

export type ReelMusicStyle = keyof typeof REEL_MUSIC_STYLES;
export const REEL_MUSIC_STYLE_NAMES = Object.keys(REEL_MUSIC_STYLES) as ReelMusicStyle[];

// Stable pick per story, so reruns of the same story keep the same track
// while the feed as a whole rotates through all of them.
export function musicStyleFor(id: string): ReelMusicStyle {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return REEL_MUSIC_STYLE_NAMES[h % REEL_MUSIC_STYLE_NAMES.length];
}

// Seeded PRNG so the noise (hats, clap) is identical on every render.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
}

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export function generateReelMusic(seconds: number, styleName: ReelMusicStyle = "drive"): Buffer {
  const st: MusicStyle = REEL_MUSIC_STYLES[styleName];
  const n = Math.ceil(seconds * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const noise = rng(20260927);
  const beat = 60 / st.bpm;
  const step = beat / 4;
  const barLen = beat * 4;

  const add = (i: number, v: number, pan = 0) => {
    if (i < 0 || i >= n) return;
    L[i] += v * (1 - Math.max(0, pan));
    R[i] += v * (1 + Math.min(0, pan));
  };

  const kick = (start: number, vel: number) => {
    const len = Math.floor(0.35 * SR);
    let phase = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      phase += (2 * Math.PI * (45 + 105 * Math.exp(-t * 28))) / SR;
      add(start + k, Math.sin(phase) * Math.exp(-t * 9) * 0.9 * vel);
    }
  };
  const clap = (start: number, vel: number) => {
    const len = Math.floor(0.22 * SR);
    let lp = 0, prev = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const env = (t < 0.03 ? (Math.floor(t / 0.01) % 2 === 0 ? 1 : 0.4) : 1) * Math.exp(-t * 22);
      lp += 0.35 * (noise() - lp);
      add(start + k, (lp - prev) * env * 0.9 * vel);
      prev = lp;
    }
  };
  const hat = (start: number, vel: number, open: boolean) => {
    const len = Math.floor((open ? 0.12 : 0.04) * SR);
    let prev = 0;
    for (let k = 0; k < len; k++) {
      const x = noise();
      add(start + k, (x - prev) * Math.exp(-(k / SR) * (open ? 30 : 70)) * (open ? 0.13 : 0.09) * vel, open ? 0.25 : -0.25);
      prev = x;
    }
  };
  const bassNote = (start: number, midi: number, steps: number) => {
    const f = midiHz(midi);
    const len = Math.floor(steps * step * 0.95 * SR);
    let lp = 0, phase = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const rel = Math.min(1, (len - k) / (0.01 * SR));
      if (st.bassKind === "808") {
        // Sine with a short pitch dip at the attack, long sustain.
        phase += (2 * Math.PI * f * (1 + 0.5 * Math.exp(-t * 40))) / SR;
        add(start + k, Math.tanh(Math.sin(phase) * 1.6) * Math.min(1, t / 0.003) * Math.exp(-t * 1.2) * rel * 0.55);
      } else {
        const x = Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.3 * Math.sin(6 * Math.PI * f * t);
        lp += 0.2 * (x - lp);
        add(start + k, lp * Math.min(1, t / 0.005) * Math.exp(-t * 4) * rel * 0.4);
      }
    }
  };
  const pluck = (start: number, midi: number, pan: number) => {
    const f = midiHz(midi);
    const len = Math.floor(Math.min(0.6, 4 / st.arpDecay) * SR);
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t * st.arpDecay);
      add(start + k, v * st.arpLevel, pan);
    }
  };

  // Drums, bass and arp, step by step. The first bar is the intro: pad and
  // hats only, then everything drops in.
  const totalSteps = Math.ceil(seconds / step);
  let arpIndex = 0;
  for (let s = 0; s < totalSteps; s++) {
    const i16 = s % 16;
    const bar = Math.floor(s / 16) % st.chords.length;
    const full = s >= 16;
    const start = Math.floor((s * step + (i16 % 2 === 1 ? st.swing * step : 0)) * SR);
    if (st.hat[i16]) hat(start, st.hat[i16], false);
    if (st.openHat[i16]) hat(start, st.openHat[i16], true);
    if (!full) continue;
    if (st.kick[i16]) kick(start, st.kick[i16]);
    if (st.clap[i16]) clap(start, st.clap[i16]);
    if (st.bass[i16]) bassNote(start, st.bassRoots[bar], st.bass[i16]);
    if (st.arp[i16]) {
      const notes = st.chords[bar];
      pluck(start, notes[arpIndex % notes.length] + st.arpOctave, arpIndex % 2 === 0 ? 0.35 : -0.35);
      arpIndex++;
    }
  }

  // Pad: detuned chords per bar, low-passed, ducked on the beat. Its
  // filter opens up over the intro bar.
  let lpL = 0, lpR = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const bar = Math.floor(t / barLen) % st.chords.length;
    let vL = 0, vR = 0;
    for (const note of st.chords[bar]) {
      const f = midiHz(note);
      for (let h = 1; h <= 5; h++) {
        vL += Math.sin(2 * Math.PI * f * 1.003 * h * t) / h;
        vR += Math.sin(2 * Math.PI * f * 0.997 * h * t) / h;
      }
    }
    const cutoff = t < barLen ? st.padBrightness * (0.25 + 0.75 * (t / barLen)) : st.padBrightness;
    lpL += cutoff * (vL - lpL);
    lpR += cutoff * (vR - lpR);
    const duck = t < barLen ? 1 : 0.35 + 0.65 * Math.min(1, ((t % beat) / beat) * 3);
    L[i] += lpL * st.padLevel * duck;
    R[i] += lpR * st.padLevel * duck;
  }

  // Normalise, soft-clip, and fade the last 1.5s out.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = 0.9 / (peak || 1);
  const fadeStart = n - Math.floor(1.5 * SR);
  const out = Buffer.alloc(44 + n * 4);
  for (let i = 0; i < n; i++) {
    const fade = i > fadeStart ? 1 - (i - fadeStart) / (n - fadeStart) : 1;
    out.writeInt16LE(Math.round(Math.tanh(L[i] * gain * 1.2) * fade * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.tanh(R[i] * gain * 1.2) * fade * 32767), 46 + i * 4);
  }
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + n * 4, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(n * 4, 40);
  return out;
}
