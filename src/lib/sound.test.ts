import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRacingAudioController, playRightAnswer, playWrong, playSubmit } from './sound';

const settingsState = vi.hoisted(() => ({ sound: true }));

vi.mock('./settings', () => ({
  getSettings: () => ({ sound: settingsState.sound }),
}));

class MockAudio {
  static instances: MockAudio[] = [];
  currentTime = 0;
  duration = 1.5;
  paused = true;
  ended = false;
  preload = '';
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  src: string;

  constructor(src: string) {
    this.src = new URL(src, window.location.href).toString();
    MockAudio.instances.push(this);
  }
}

describe('correct-answer sound', () => {
  beforeEach(() => {
    settingsState.sound = true;
    MockAudio.instances = [];
    vi.stubGlobal('Audio', MockAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays the supplied asset, avoids clipping an active cue, and respects the Sound setting', () => {
    playRightAnswer();

    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.src).toMatch(/\/sounds\/right-answer\.mp3$/);
    expect(audio.preload).toBe('auto');
    expect(audio.play).toHaveBeenCalledTimes(1);

    // A rapid next answer should not restart/cut off the sound already playing.
    playRightAnswer();
    expect(audio.play).toHaveBeenCalledTimes(1);

    settingsState.sound = false;
    audio.paused = true;
    audio.ended = true;
    playRightAnswer();
    expect(audio.play).toHaveBeenCalledTimes(1);

    settingsState.sound = true;
    audio.currentTime = 0.8;
    playRightAnswer();
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });
  
  it('plays the supplied wrong-answer asset and respects the Sound setting', () => {
    playWrong();

    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.src).toMatch(/\/sounds\/wrong-answer\.mp3$/);
    expect(audio.preload).toBe('auto');
    expect(audio.play).toHaveBeenCalledTimes(1);

    settingsState.sound = false;
    playWrong();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it('plays the supplied submit asset and respects the Sound setting', () => {
    playSubmit();

    expect(MockAudio.instances).toHaveLength(1);
    const audio = MockAudio.instances[0];
    expect(audio.src).toMatch(/\/sounds\/submit\.mp3$/);
    expect(audio.preload).toBe('auto');
    expect(audio.play).toHaveBeenCalledTimes(1);

    settingsState.sound = false;
    playSubmit();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });
});

class MockAudioParam {
  value = 0;
  targets: number[] = [];
  setValueAtTime(value: number) { this.value = value; }
  setTargetAtTime(value: number) { this.value = value; this.targets.push(value); }
}
class MockAudioNode {
  connections: unknown[] = [];
  disconnect = vi.fn();
  connect(target: unknown) { this.connections.push(target); return target; }
}
class MockOscillator extends MockAudioNode {
  type: OscillatorType = "sine";
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}
class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}
class MockFilterNode extends MockAudioNode {
  type: BiquadFilterType = "lowpass";
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
}
class MockBufferSource extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();
}
class MockNoiseBuffer {
  private readonly data: Float32Array;
  constructor(length: number) { this.data = new Float32Array(length); }
  getChannelData() { return this.data; }
}
class MockRacingAudioContext {
  static instances: MockRacingAudioContext[] = [];
  currentTime = 0;
  sampleRate = 8_000;
  state: AudioContextState = "running";
  destination = new MockAudioNode();
  resume = vi.fn(async () => { this.state = "running"; });
  oscillators: MockOscillator[] = [];
  gains: MockGainNode[] = [];
  filters: MockFilterNode[] = [];
  bufferSources: MockBufferSource[] = [];
  createOscillator() {
    const node = new MockOscillator(); this.oscillators.push(node); return node as unknown as OscillatorNode;
  }
  createGain() {
    const node = new MockGainNode(); this.gains.push(node); return node as unknown as GainNode;
  }
  createBiquadFilter() {
    const node = new MockFilterNode(); this.filters.push(node); return node as unknown as BiquadFilterNode;
  }
  createBufferSource() {
    const node = new MockBufferSource(); this.bufferSources.push(node); return node as unknown as AudioBufferSourceNode;
  }
  createBuffer(_channels: number, length: number) { return new MockNoiseBuffer(length) as unknown as AudioBuffer; }
  constructor() { MockRacingAudioContext.instances.push(this); }
}

it('creates one speed-responsive engine/wind loop, respects Sound OFF, pauses, and disposes it', () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(window, "AudioContext");
  MockRacingAudioContext.instances = [];
  settingsState.sound = true;
  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    writable: true,
    value: MockRacingAudioContext,
  });

  const controller = createRacingAudioController();
  try {
    controller.update(1, false);
    expect(MockRacingAudioContext.instances).toHaveLength(0);

    controller.unlock();
    controller.unlock();
    const context = MockRacingAudioContext.instances[0];
    expect(MockRacingAudioContext.instances).toHaveLength(1);
    expect(context.oscillators).toHaveLength(2);
    expect(context.bufferSources).toHaveLength(1);
    context.oscillators.forEach((oscillator) => expect(oscillator.start).toHaveBeenCalledTimes(1));
    expect(context.bufferSources[0].start).toHaveBeenCalledTimes(1);

    context.currentTime = 0.06;
    controller.update(1.7, true);
    const midSpeedFrequency = context.oscillators[0].frequency.value;
    context.currentTime = 0.12;
    controller.update(3.25, true);
    expect(context.oscillators[0].frequency.value).toBeGreaterThan(midSpeedFrequency);
    expect(context.gains[0].gain.value).toBeGreaterThan(0);

    controller.pause();
    expect(context.gains[0].gain.value).toBe(0);
    controller.resume();
    expect(context.gains[0].gain.value).toBeGreaterThan(0);

    settingsState.sound = false;
    context.currentTime = 0.25;
    controller.update(2.4, true);
    expect(context.gains[0].gain.value).toBe(0);

    controller.dispose();
    expect(context.oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true);
    expect(context.bufferSources[0].stop).toHaveBeenCalledTimes(1);
    expect(context.gains[0].disconnect).toHaveBeenCalled();
  } finally {
    controller.dispose();
    settingsState.sound = true;
    if (originalAudioContext) Object.defineProperty(window, "AudioContext", originalAudioContext);
    else Reflect.deleteProperty(window, "AudioContext");
  }
});
