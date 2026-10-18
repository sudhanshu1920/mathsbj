import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playRightAnswer, playWrong, playSubmit } from './sound';

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
