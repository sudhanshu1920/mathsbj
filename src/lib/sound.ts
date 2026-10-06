// Lightweight WebAudio UI sound system. No external assets.
import { getSettings } from './settings';

let ctx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const win = window as Window & {
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

export const playClick = () => { if (!enabled()) return; playTones([{ f: 880, d: 0.04, t: 'triangle', v: 0.6 }], 0.04); };
export const playSwipe = () => { if (!enabled()) return; playTones([{ f: 520, d: 0.06, t: 'sine', v: 0.5 }, { f: 760, d: 0.05, t: 'sine', v: 0.4 }], 0.04); };
export const playSuccess = () => { if (!enabled()) return; playTones([{ f: 660, d: 0.09, t: 'triangle' }, { f: 880, d: 0.10, t: 'triangle' }, { f: 1175, d: 0.14, t: 'triangle' }], 0.06); };
export const playWrong = () => { if (!enabled()) return; playTones([{ f: 220, d: 0.10, t: 'sawtooth', v: 0.5 }, { f: 165, d: 0.16, t: 'sawtooth', v: 0.5 }], 0.05); };
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
