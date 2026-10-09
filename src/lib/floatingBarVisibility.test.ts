import { describe, expect, it } from 'vitest';
import { getFloatingBarVisibility } from './floatingBarVisibility';
import { isPracticeSessionInProgress } from './practiceNavigation';

describe('central Floating Bar visibility policy', () => {
  it('shows and reserves the bar on the Learning Mode landing screen', () => {
    expect(getFloatingBarVisibility({
      tab: 'learn',
      activeTopic: null,
      settingsOpen: false,
      quizInProgress: false,
    })).toEqual({ show: true, mount: true });
  });

  it.each([
    'tables',
    'squares',
    'square-roots',
    'cubes',
    'cube-roots',
    'powers',
    'percentage',
    'formulas',
    'periodic-table',
    'algebra',
    'geometry',
    'trigonometry',
  ])('unmounts the bar for the %s topic and its nested screens', (activeTopic) => {
    expect(getFloatingBarVisibility({
      tab: 'learn',
      activeTopic,
      settingsOpen: false,
      quizInProgress: false,
    })).toEqual({ show: false, mount: false });
  });

  it('restores the bar when Back returns to the Learning landing state', () => {
    const topicOpen = getFloatingBarVisibility({
      tab: 'learn',
      activeTopic: 'formulas',
      settingsOpen: false,
      quizInProgress: false,
    });
    const landing = getFloatingBarVisibility({
      tab: 'learn',
      activeTopic: null,
      settingsOpen: false,
      quizInProgress: false,
    });

    expect(topicOpen).toEqual({ show: false, mount: false });
    expect(landing).toEqual({ show: true, mount: true });
  });

  it('keeps Settings hidden without changing its existing mount behavior', () => {
    expect(getFloatingBarVisibility({
      tab: 'progress',
      activeTopic: null,
      settingsOpen: true,
      quizInProgress: false,
    })).toEqual({ show: false, mount: true });
  });

  it('unmounts the bar during the Learning-origin Quiz startup handoff before questions mount', () => {
    expect(getFloatingBarVisibility({
      tab: 'practice',
      activeTopic: null,
      settingsOpen: false,
      quizInProgress: isPracticeSessionInProgress('starting'),
    })).toEqual({ show: false, mount: false });
  });

  it('unmounts the bar during an active or finished Quiz session', () => {
    expect(getFloatingBarVisibility({
      tab: 'practice',
      activeTopic: null,
      settingsOpen: false,
      quizInProgress: true,
    })).toEqual({ show: false, mount: false });
  });

  it('keeps the bar available on Quiz setup and other normal screens', () => {
    expect(getFloatingBarVisibility({
      tab: 'practice',
      activeTopic: null,
      settingsOpen: false,
      quizInProgress: false,
    })).toEqual({ show: true, mount: true });

    expect(getFloatingBarVisibility({
      tab: 'progress',
      activeTopic: null,
      settingsOpen: false,
      quizInProgress: false,
    })).toEqual({ show: true, mount: true });
  });
});
