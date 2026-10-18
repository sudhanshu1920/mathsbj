export interface LearningStudyTimeContext {
  activeTopic: string | null;
  practiceSelectorOpen: boolean;
  visibilityState: DocumentVisibilityState;
}

/** Only count real foreground time spent reading an opened Learning topic. */
export function shouldCountLearningStudySecond({
  activeTopic,
  practiceSelectorOpen,
  visibilityState,
}: LearningStudyTimeContext): boolean {
  return activeTopic !== null && !practiceSelectorOpen && visibilityState === "visible";
}
