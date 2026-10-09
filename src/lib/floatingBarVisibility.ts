export type FloatingBarTab = 'learn' | 'practice' | 'progress';

export interface FloatingBarVisibilityInput {
  tab: FloatingBarTab;
  activeTopic: string | null;
  settingsOpen: boolean;
  quizInProgress: boolean;
}

export interface FloatingBarVisibility {
  show: boolean;
  mount: boolean;
}

/**
 * One policy for the shared Floating Bar:
 * - Learning landing screen: visible.
 * - Any active Learning topic (including its nested detail states): unmounted.
 * - Settings: hidden, preserving the existing mounted-but-hidden behavior.
 * - Active/finished Quiz session: unmounted.
 * - Normal sections and Quiz setup: visible unless Settings is open.
 */
export function getFloatingBarVisibility({
  tab,
  activeTopic,
  settingsOpen,
  quizInProgress,
}: FloatingBarVisibilityInput): FloatingBarVisibility {
  const learningTopicOpen = tab === 'learn' && activeTopic !== null;
  const quizSessionOpen = tab === 'practice' && quizInProgress;
  const mount = !learningTopicOpen && !quizSessionOpen;

  return {
    show: mount && !settingsOpen,
    mount,
  };
}
