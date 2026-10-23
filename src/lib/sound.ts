// Lightweight UI sound system with a supplied success clip and WebAudio fallbacks.
import { getSettings } from './settings';

let ctx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const win = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AC = win.AudioContext ?? win.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch { return null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

interface Tone { f: number; d?: number; t?: OscillatorType; v?: number; }

const playTones = (tones: Tone[], baseGain = 0.06) => {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  let offset = 0;
  for (const tone of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tone.t || 'sine';
    osc.frequency.value = tone.f;
    const dur = tone.d ?? 0.08;
    const v = (tone.v ?? 1) * baseGain;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(v, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + offset);
    osc.stop(now + offset + dur + 0.02);
    offset += dur * 0.55;
  }
};

const enabled = () => {
  try { return getSettings().sound; } catch { return true; }
};

export interface RacingAudioController {
  /** Call directly from a trusted user gesture to satisfy mobile autoplay policy. */
  unlock: () => void;
  /** Follow the authoritative simulated speed; parameter scheduling is throttled internally. */
  update: (speedMultiplier: number, accelerating: boolean) => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

interface RacingAudioNodes {
  context: AudioContext;
  master: GainNode;
  engine: OscillatorNode;
  harmonic: OscillatorNode;
  engineFilter: BiquadFilterNode;
  engineGain: GainNode;
  harmonicGain: GainNode;
  wind: AudioBufferSourceNode;
  windFilter: BiquadFilterNode;
  windGain: GainNode;
  oscillators: OscillatorNode[];
  sources: AudioScheduledSourceNode[];
  allNodes: AudioNode[];
}

const setSmoothTarget = (param: AudioParam, value: number, context: AudioContext, seconds = 0.09) => {
  if (!Number.isFinite(value)) return;
  param.setTargetAtTime(value, context.currentTime, seconds);
};

/**
 * A compact synthesized engine + filtered road-wind loop. It reuses the app's
 * existing AudioContext, allocates sources only once per game session and
 * updates pitch/timbre at a throttled cadence rather than on every render frame.
 * The persisted Sound setting mutes audio only; it never affects game physics.
 */
export const createRacingAudioController = (baseSpeedMultiplier: number, maximumSpeedMultiplier: number): RacingAudioController => {
  const safeBaseSpeed = Number.isFinite(baseSpeedMultiplier) ? baseSpeedMultiplier : 1;
  const safeMaximumSpeed = Number.isFinite(maximumSpeedMultiplier) && maximumSpeedMultiplier > safeBaseSpeed
    ? maximumSpeedMultiplier
    : safeBaseSpeed + 1;
  let nodes: RacingAudioNodes | null = null;
  let gestureSeen = false;
  let paused = false;
  let disposed = false;
  let mutedBySetting = false;
  let lastUpdateAt = Number.NEGATIVE_INFINITY;
  let lastSpeed = Number.NaN;
  let lastAccelerating: boolean | null = null;
  let lastMasterGain = 0;

  const disconnectNodes = (allNodes: AudioNode[]) => {
    allNodes.forEach((node) => {
      try { node.disconnect(); } catch { /* Already disconnected. */ }
    });
  };

  const createNodes = (): RacingAudioNodes | null => {
    if (nodes) return nodes;
    if (!enabled()) return null;
    const context = getCtx();
    if (!context) return null;

    const allNodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const oscillators: OscillatorNode[] = [];
    try {
      const master = context.createGain();
      master.gain.setValueAtTime(0, context.currentTime);
      master.connect(context.destination);
      allNodes.push(master);

      const engineFilter = context.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.setValueAtTime(620, context.currentTime);
      engineFilter.Q.setValueAtTime(0.8, context.currentTime);
      const engineGain = context.createGain();
      engineGain.gain.setValueAtTime(0.032, context.currentTime);
      engineFilter.connect(engineGain).connect(master);
      allNodes.push(engineFilter, engineGain);

      const engine = context.createOscillator();
      engine.type = "sawtooth";
      engine.frequency.setValueAtTime(44, context.currentTime);
      engine.connect(engineFilter);
      oscillators.push(engine);
      sources.push(engine);
      allNodes.push(engine);

      const harmonicGain = context.createGain();
      harmonicGain.gain.setValueAtTime(0.20, context.currentTime);
      harmonicGain.connect(engineFilter);
      allNodes.push(harmonicGain);

      const harmonic = context.createOscillator();
      harmonic.type = "triangle";
      harmonic.frequency.setValueAtTime(88, context.currentTime);
      harmonic.connect(harmonicGain);
      oscillators.push(harmonic);
      sources.push(harmonic);
      allNodes.push(harmonic);

      const windFilter = context.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.setValueAtTime(780, context.currentTime);
      windFilter.Q.setValueAtTime(0.55, context.currentTime);
      const windGain = context.createGain();
      windGain.gain.setValueAtTime(0.002, context.currentTime);
      windFilter.connect(windGain).connect(master);
      allNodes.push(windFilter, windGain);

      // Small one-time noise buffer: looped and filtered for subdued wind/road ambience.
      const noiseLength = Math.max(1, Math.floor(context.sampleRate * 1.5));
      const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const noise = noiseBuffer.getChannelData(0);
      for (let index = 0; index < noise.length; index += 1) {
        noise[index] = Math.random() * 2 - 1;
      }
      const wind = context.createBufferSource();
      wind.buffer = noiseBuffer;
      wind.loop = true;
      wind.connect(windFilter);
      sources.push(wind);
      allNodes.push(wind);

      const nextNodes: RacingAudioNodes = {
        context, master, engine, harmonic, engineFilter, engineGain, harmonicGain,
        wind, windFilter, windGain, oscillators, sources, allNodes,
      };
      sources.forEach((source) => source.start(context.currentTime));
      nodes = nextNodes;
      lastUpdateAt = Number.NEGATIVE_INFINITY;
      return nodes;
    } catch {
      sources.forEach((source) => {
        try { source.stop(); } catch { /* Source did not start. */ }
      });
      disconnectNodes(allNodes);
      return null;
    }
  };

  const rampMaster = (value: number) => {
    if (!nodes || lastMasterGain === value) return;
    setSmoothTarget(nodes.master.gain, value, nodes.context, 0.12);
    lastMasterGain = value;
  };

  const update = (speedMultiplier: number, accelerating: boolean) => {
    if (disposed || !gestureSeen || paused) return;
    const soundOn = enabled();
    if (!soundOn) {
      if (!mutedBySetting || lastMasterGain !== 0) rampMaster(0);
      mutedBySetting = true;
      return;
    }

    const currentNodes = createNodes();
    if (!currentNodes) return;
    if (mutedBySetting || lastMasterGain === 0) {
      rampMaster(0.72);
      mutedBySetting = false;
    }

    const context = currentNodes.context;
    const now = context.currentTime;
    const safeSpeed = Number.isFinite(speedMultiplier)
      ? Math.min(safeMaximumSpeed, Math.max(safeBaseSpeed, speedMultiplier))
      : safeBaseSpeed;
    const normalizedSpeed = Math.min(1, Math.max(
      0,
      (safeSpeed - safeBaseSpeed) / (safeMaximumSpeed - safeBaseSpeed),
    ));
    const shouldUpdate = now - lastUpdateAt >= 0.05 ||
      accelerating !== lastAccelerating ||
      !Number.isFinite(lastSpeed) ||
      Math.abs(safeSpeed - lastSpeed) >= 0.08;
    if (!shouldUpdate) return;

    // Pitch, engine brightness and wind all follow the same speed used by road motion/collision.
    const pitch = 44 + normalizedSpeed * 76 + (accelerating ? 5 : 0);
    setSmoothTarget(currentNodes.engine.frequency, pitch, context, accelerating ? 0.065 : 0.16);
    setSmoothTarget(currentNodes.harmonic.frequency, pitch * 2.02, context, accelerating ? 0.065 : 0.16);
    setSmoothTarget(currentNodes.engineFilter.frequency, 620 + normalizedSpeed * 1120, context, 0.12);
    setSmoothTarget(currentNodes.engineGain.gain, 0.032 + normalizedSpeed * 0.034 + (accelerating ? 0.012 : 0), context, 0.12);
    setSmoothTarget(currentNodes.windFilter.frequency, 780 + normalizedSpeed * 700, context, 0.14);
    setSmoothTarget(currentNodes.windGain.gain, 0.002 + normalizedSpeed * 0.016, context, 0.18);

    lastUpdateAt = now;
    lastSpeed = safeSpeed;
    lastAccelerating = accelerating;
  };

  return {
    unlock: () => {
      if (disposed) return;
      gestureSeen = true;
      if (!enabled()) {
        mutedBySetting = true;
        return;
      }
      const context = getCtx();
      if (context?.state === "suspended") context.resume().catch(() => {});
      update(Number.isFinite(lastSpeed) ? lastSpeed : safeBaseSpeed, false);
    },
    update,
    pause: () => {
      if (disposed) return;
      paused = true;
      rampMaster(0);
    },
    resume: () => {
      if (disposed) return;
      paused = false;
      // Don't create an autonomous loop until a real interaction unlocks it.
      if (!gestureSeen) return;
      const currentNodes = createNodes();
      if (currentNodes && enabled()) {
        if (currentNodes.context.state === "suspended") currentNodes.context.resume().catch(() => {});
        lastUpdateAt = Number.NEGATIVE_INFINITY;
        rampMaster(0.72);
        update(Number.isFinite(lastSpeed) ? lastSpeed : safeBaseSpeed, false);
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const currentNodes = nodes;
      nodes = null;
      if (!currentNodes) return;
      currentNodes.sources.forEach((source) => {
        try { source.stop(); } catch { /* Already stopped. */ }
      });
      disconnectNodes(currentNodes.allNodes);
    },
  };
};

export const playClick = () => { if (!enabled()) return; playTones([{ f: 880, d: 0.04, t: 'triangle', v: 0.6 }], 0.04); };
export const playSwipe = () => { if (!enabled()) return; playTones([{ f: 520, d: 0.06, t: 'sine', v: 0.5 }, { f: 760, d: 0.05, t: 'sine', v: 0.4 }], 0.04);

// Short, quiet arcade cues share the app's audio context and respect Settings → Sound.
export const playJump = () => {
  if (!enabled()) return;
  playTones([
    { f: 350, d: 0.045, t: 'sine', v: 0.55 },
    { f: 520, d: 0.075, t: 'triangle', v: 0.42 },
    { f: 690, d: 0.08, t: 'sine', v: 0.28 },
  ], 0.035);
};
export const playLanding = () => {
  if (!enabled()) return;
  playTones([{ f: 205, d: 0.045, t: 'triangle', v: 0.35 }], 0.025);
};
export const playSuccess = () => { if (!enabled()) return; playTones([{ f: 660, d: 0.09, t: 'triangle' }, { f: 880, d: 0.10, t: 'triangle' }, { f: 1175, d: 0.14, t: 'triangle' }], 0.06); };
type AudioCueName = 'right-answer' | 'wrong-answer' | 'submit';

const audioCues: Record<AudioCueName, HTMLAudioElement | null> = {
  'right-answer': null,
  'wrong-answer': null,
  submit: null,
};

const playWrongFallback = () => {
  playTones([{ f: 220, d: 0.10, t: 'sawtooth', v: 0.5 }, { f: 165, d: 0.16, t: 'sawtooth', v: 0.5 }], 0.05);
};

/**
 * Reuse one media element per cue and avoid cutting off a sound that is still
 * playing. All clips are bundled locally so they work in the web app and APK.
 */
const playAudioCue = (name: AudioCueName, fallback: () => void) => {
  if (!enabled()) return;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    fallback();
    return;
  }

  try {
    let audio = audioCues[name];
    if (!audio) {
      audio = new Audio(`${import.meta.env.BASE_URL}sounds/${name}.mp3`);
      audio.preload = 'auto';
      audioCues[name] = audio;
    }
    if (!audio.paused && !audio.ended) return;

    audio.currentTime = 0;
    const playback = audio.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => fallback());
    }
  } catch {
    fallback();
  }
};

export const playRightAnswer = () => playAudioCue('right-answer', playSuccess);
export const playWrong = () => playAudioCue('wrong-answer', playWrongFallback);
export const playSubmit = () => playAudioCue('submit', playSuccess);

export const playLevelUp = () => { if (!enabled()) return; playTones([
  { f: 523, d: 0.10, t: 'triangle' },
  { f: 659, d: 0.10, t: 'triangle' },
  { f: 784, d: 0.12, t: 'triangle' },
  { f: 1047, d: 0.20, t: 'triangle' },
], 0.07); };
export const playStreak = () => { if (!enabled()) return; playTones([{ f: 740, d: 0.08, t: 'sine' }, { f: 988, d: 0.12, t: 'sine' }], 0.05); };

// One-time unlock on first user interaction (autoplay policies)
if (typeof window !== 'undefined') {
  const unlock = () => { getCtx(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}
