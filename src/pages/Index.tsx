import { useState, useCallback, useEffect, useLayoutEffect, useRef, Suspense, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, useReducedMotion, m as motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import AppUpdateManager from '@/components/AppUpdateManager';
import Watermark from '@/components/Watermark';
import LearningPage from '@/pages/LearningPage';
const PracticePage = lazyWithRetry(() => import('@/pages/PracticePage'));
const ProgressPage = lazyWithRetry(() => import('@/pages/ProgressPage'));
import { useWideDesktop } from '@/hooks/use-desktop-mode';
import CommandPalette from '@/components/CommandPalette';
import ShortcutsHelp from '@/components/ShortcutsHelp';
import OfflinePrep from '@/components/OfflinePrep';
import { getSettings } from '@/lib/settings';
import { getPracticeNavDepth, isPracticeSessionInProgress, isUnsavedPracticePhase, type PracticePhase } from '@/lib/practiceNavigation';
import { getHorizontalSwipeDirection } from '@/lib/swipeDirection';
import { MOTION } from '@/lib/motion';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TrigFunction } from '@/lib/trigData';
import { getFloatingBarVisibility } from '@/lib/floatingBarVisibility';

type Tab = 'learn' | 'practice' | 'progress';

export interface LearningState {
  activeTopic: string | null;
  selectedNumber: number | null;
  selectedRange: { from: number; to: number } | null;
  percentageGroup: { from: number; to: number } | null;
  expandedDenominator: number | null;
  formulaSectionIndex: number | null;
  formulaCategoryIndex: number | null;
  periodicSelectedElement: number | null;
}

const INITIAL_LEARNING_STATE: LearningState = {
  activeTopic: null,
  selectedNumber: null,
  selectedRange: null,
  percentageGroup: null,
  expandedDenominator: null,
  formulaSectionIndex: null,
  formulaCategoryIndex: null,
  periodicSelectedElement: null,
};

const MAIN_SECTION_ORDER: readonly Tab[] = ['learn', 'practice', 'progress'];

function getAdjacentMainSection(
  current: Tab,
  direction: 'left' | 'right',
): Tab | null {
  const index = MAIN_SECTION_ORDER.indexOf(current);
  if (index < 0) return null;

  const offset = direction === 'left' ? 1 : -1;
  return MAIN_SECTION_ORDER[index + offset] ?? null;
}

type SectionTransitionDirection = 'left' | 'right';

const sectionPageVariants = {
  enter: (direction: SectionTransitionDirection) => ({
    x: direction === 'left' ? MOTION.distance.page : '-100%',
  }),
  center: {
    x: '0%',
  },
  exit: (direction: SectionTransitionDirection) => ({
    x: direction === 'left' ? '-100%' : MOTION.distance.page,
  }),
};

// Compute a depth key representing how deep we are in navigation
function getNavDepth(tab: Tab, learningState: LearningState, practiceTopic?: string, practicePhase: PracticePhase = 'setup'): string {
  if (tab === 'progress') return 'progress';
  if (tab === 'practice') return getPracticeNavDepth(practicePhase);
  // learn tab
  const { activeTopic, selectedNumber, selectedRange, percentageGroup, expandedDenominator, formulaSectionIndex, formulaCategoryIndex, periodicSelectedElement } = learningState;
  if (!activeTopic) return 'learn-home';
  if (activeTopic === 'periodic-table') {
    if (periodicSelectedElement) return `learn-periodic-table-element-${periodicSelectedElement}`;
    return 'learn-periodic-table';
  }
  if (activeTopic === 'percentage') {
    if (expandedDenominator) return `learn-percentage-expanded-${expandedDenominator}`;
    if (percentageGroup) return `learn-percentage-group-${percentageGroup.from}`;
    return 'learn-percentage';
  }
  if (activeTopic === 'formulas') {
    if (formulaCategoryIndex !== null) return `learn-formulas-${formulaSectionIndex}-${formulaCategoryIndex}`;
    if (formulaSectionIndex !== null) return `learn-formulas-section-${formulaSectionIndex}`;
    return 'learn-formulas';
  }
  if (selectedNumber) return `learn-${activeTopic}-${selectedNumber}`;
  if (selectedRange) return `learn-${activeTopic}-range`;
  return `learn-${activeTopic}`;
}

const Index = () => {
  const [tab, setTab] = useState<Tab>('learn');
  const [practiceTopic, setPracticeTopic] = useState<string | undefined>();
  const [practiceContext, setPracticeContext] = useState<{ from?: number; to?: number; number?: number } | undefined>();
  const [practiceMode, setPracticeMode] = useState<'mcq' | 'input' | undefined>();
  const [practiceExtras, setPracticeExtras] = useState<{ timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean; trigFunctions?: TrigFunction[]; trigProMode?: boolean; count?: number } | undefined>();
  const [returnToLearn, setReturnToLearn] = useState(false);
  const [learningState, setLearningState] = useState<LearningState>(INITIAL_LEARNING_STATE);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [practiceBackRequest, setPracticeBackRequest] = useState(0);
  const [practicePhase, setPracticePhase] = useState<PracticePhase>('setup');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sectionTransitionDirection, setSectionTransitionDirection] = useState<SectionTransitionDirection | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const appFrameScrollRef = useRef<HTMLDivElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);
  const sectionSwipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    axis: 'x' | 'y' | null;
    active: boolean;
    triggered: boolean;
  } | null>(null);
  const lastSectionSwipeAt = useRef(0);
  const pendingPracticeNavigation = useRef<{
    tab: Tab;
    resetLearn?: boolean;
    replacementPracticeTopic?: string;
  } | null>(null);
  const wideDesktop = useWideDesktop();

  // A single shared policy handles Learning topic depth, Settings, and Quiz phase.
  // activeTopic remains set throughout selections and nested detail screens.
  // Topic detail/nested states unmount the nav; the existing measured reserve then
  // clears to 0px. Returning to the landing state restores it without stale state.
  const { show: showBottomNav, mount: mountBottomNav } = getFloatingBarVisibility({
    tab,
    activeTopic: learningState.activeTopic,
    settingsOpen,
    quizInProgress: isPracticeSessionInProgress(practicePhase),
  });

  // Keep the content reserve synchronized with the floating bar's actual
  // rendered border-box height. This is layout-only state: it writes a CSS
  // variable directly, so resize/orientation changes do not trigger React
  // render loops.
  useLayoutEffect(() => {
    const scrollElement = appFrameScrollRef.current;
    if (!scrollElement) return;

    let frame = 0;
    let lastHeight = -1;

    const clearBottomReserve = () => {
      if (lastHeight !== 0 || scrollElement.style.getPropertyValue('--floating-bar-height') !== '0px') {
        scrollElement.style.setProperty('--floating-bar-height', '0px');
      }
      lastHeight = 0;
    };

    const measureBottomReserve = () => {
      if (!showBottomNav) {
        clearBottomReserve();
        return;
      }

      const nav = bottomNavRef.current;
      if (!nav) {
        clearBottomReserve();
        return;
      }

      const rect = nav.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      // Measure in viewport coordinates, including the floating gap/safe-area
      // offset so content never scrolls behind the rendered navigation surface.
      const viewportBottom = visualViewport
        ? visualViewport.offsetTop + visualViewport.height
        : window.innerHeight;
      const occupiedBottomSpace = Math.max(0, viewportBottom - rect.top);
      if (Math.abs(occupiedBottomSpace - lastHeight) < 0.01) return;

      lastHeight = occupiedBottomSpace;
      scrollElement.style.setProperty(
        '--floating-bar-height',
        occupiedBottomSpace > 0 ? occupiedBottomSpace + 'px' : '0px',
      );
    };

    const syncBottomReserve = () => {
      if (!showBottomNav) {
        cancelAnimationFrame(frame);
        frame = 0;
        clearBottomReserve();
        return;
      }

      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measureBottomReserve();
      });
    };

    // Measure in this layout pass when the bar appears/disappears. Only later
    // viewport/resize notifications are coalesced to the next animation frame.
    measureBottomReserve();

    const observer = bottomNavRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncBottomReserve)
      : null;

    if (observer && bottomNavRef.current) {
      observer.observe(bottomNavRef.current);
    }

    window.addEventListener('resize', syncBottomReserve, { passive: true });
    window.visualViewport?.addEventListener('resize', syncBottomReserve);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', syncBottomReserve);
      window.visualViewport?.removeEventListener('resize', syncBottomReserve);
      if (!showBottomNav) clearBottomReserve();
    };
  }, [showBottomNav]);
  const lastBackPress = useRef(0);
  const isHandlingPopstate = useRef(false);
  const lastDepth = useRef('learn-home');
  const historyInitialized = useRef(false);
  const lastNavigationBack = useRef(0);
  const navigationStateRef = useRef({
    tab,
    learningState,
    practiceTopic,
    practiceMode,
    practicePhase,
  });
  navigationStateRef.current = {
    tab,
    learningState,
    practiceTopic,
    practiceMode,
    practicePhase,
  };

  // One shared back action for header arrows, in-app edge swipe, and native
  // Android back. A short lock prevents a native gesture + web gesture from
  // navigating twice for the same physical action.
  const goBack = useCallback(() => {
    const now = Date.now();
    if (now - lastNavigationBack.current < 350) return;
    lastNavigationBack.current = now;
    if (window.history.length > 1) window.history.back();
  }, []);

  // Seed one in-app history entry so Android system back/edge-back can be
  // intercepted instead of immediately finishing the Capacitor Activity.
  useEffect(() => {
    if (historyInitialized.current) return;
    const currentState = window.history.state;
    const isAppEntry = currentState?.__mathsbj === true;
    if (!isAppEntry) {
      window.history.pushState({ __mathsbj: true, depth: 'learn-home', root: true }, '');
    } else if (currentState?.root !== true) {
      window.history.replaceState({ ...currentState, __mathsbj: true, depth: 'learn-home', root: true }, '');
    }
    historyInitialized.current = true;
    lastDepth.current = 'learn-home';
  }, []);

  // Push history state when navigation depth changes
  useEffect(() => {
    const depth = getNavDepth(tab, learningState, practiceTopic, practicePhase);
    if (depth !== lastDepth.current && !isHandlingPopstate.current) {
      window.history.pushState({ __mathsbj: true, depth }, '');
      lastDepth.current = depth;
    }
    isHandlingPopstate.current = false;
  }, [tab, learningState, practiceTopic, practicePhase]);

  // Handle native Android back button / system edge-back.
  // Capacitor owns the native event before Android finishes the Activity, so
  // nested screens can use the same history stack as the web back gesture.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    void App.addListener('backButton', () => {
      const { tab, learningState, practiceTopic, practicePhase } = navigationStateRef.current;
      const depth = getNavDepth(tab, learningState, practiceTopic, practicePhase);

      if (depth === 'learn-home') {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          void App.exitApp().catch(() => undefined);
          return;
        }

        lastBackPress.current = now;
        toast('Press back again to exit', { duration: 2000 });
        return;
      }

      goBack();
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listenerHandle = handle;
      }
    });

    return () => {
      disposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
        listenerHandle = null;
      }
    };
  }, [goBack]);

  // Handle browser back button / gesture
  useEffect(() => {
    const handlePopstate = () => {
      isHandlingPopstate.current = true;

      // PracticePage owns the confirmation UI, but this router owns history.
      // Re-seed the active depth and signal PracticePage to open its dialog.
      if (tab === 'practice' && isUnsavedPracticePhase(practicePhase)) {
        pendingPracticeNavigation.current = null;
        window.history.pushState({ __mathsbj: true, depth: 'practice-active' }, '');
        lastDepth.current = 'practice-active';
        setPracticeBackRequest((value) => value + 1);
        return;
      }

      // Determine what to go back to
      if (tab === 'practice') {
        // Practice setup screen — leave to learn (or wherever we came from)
        if (returnToLearn) {
          pendingPracticeNavigation.current = null;
          setReturnToLearn(false);
          setPracticeTopic(undefined);
          setPracticeContext(undefined);
          setPracticeMode(undefined);
          setPracticeExtras(undefined);
          setPracticePhase('setup');
          setTab('learn');
        } else {
          pendingPracticeNavigation.current = null;
          setPracticeTopic(undefined);
          setPracticeContext(undefined);
          setPracticeMode(undefined);
          setPracticeExtras(undefined);
          setPracticePhase('setup');
        }
        lastDepth.current = getNavDepth('learn', learningState);
        return;
      }

      if (tab === 'progress') {
        setTab('learn');
        lastDepth.current = 'learn-home';
        return;
      }

      // Learn tab - go back step by step
      const { activeTopic, selectedNumber, selectedRange, percentageGroup, expandedDenominator, formulaSectionIndex, formulaCategoryIndex, periodicSelectedElement } = learningState;

      if (activeTopic === 'periodic-table' && periodicSelectedElement) {
        setLearningState(prev => ({ ...prev, periodicSelectedElement: null }));
        lastDepth.current = 'learn-periodic-table';
        return;
      }

      if (activeTopic === 'formulas') {
        if (formulaCategoryIndex !== null) {
          setLearningState(prev => ({ ...prev, formulaCategoryIndex: null }));
          lastDepth.current = `learn-formulas-section-${formulaSectionIndex}`;
          return;
        }
        if (formulaSectionIndex !== null) {
          setLearningState(prev => ({ ...prev, formulaSectionIndex: null }));
          lastDepth.current = 'learn-formulas';
          return;
        }
        setLearningState(prev => ({ ...prev, activeTopic: null }));
        lastDepth.current = 'learn-home';
        return;
      }

      if (activeTopic === 'percentage' && expandedDenominator) {
        setLearningState(prev => ({ ...prev, expandedDenominator: null }));
        lastDepth.current = `learn-percentage-group-${percentageGroup?.from}`;
        return;
      }
      if (activeTopic === 'percentage' && percentageGroup) {
        setLearningState(prev => ({ ...prev, percentageGroup: null }));
        lastDepth.current = 'learn-percentage';
        return;
      }
      if (selectedNumber) {
        setLearningState(prev => ({ ...prev, selectedNumber: null }));
        lastDepth.current = `learn-${activeTopic}`;
        return;
      }
      if (selectedRange) {
        setLearningState(prev => ({ ...prev, selectedRange: null }));
        lastDepth.current = `learn-${activeTopic}`;
        return;
      }
      if (activeTopic) {
        setLearningState(prev => ({ ...prev, activeTopic: null }));
        lastDepth.current = 'learn-home';
        return;
      }

      // At root - double back to exit.
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        // Leave the in-app sentinel and let Android/WebView finish the Activity.
        window.history.back();
        return;
      }
      lastBackPress.current = now;
      toast('Press back again to exit', { duration: 2000 });
      // Re-seed the root sentinel after the first back.
      window.history.pushState({ __mathsbj: true, depth: 'learn-home', root: true }, '');
      lastDepth.current = 'learn-home';
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [tab, learningState, returnToLearn, practicePhase]);

  const handleStartPractice = useCallback((topic: string, context?: { from?: number; to?: number; number?: number }, mode?: 'mcq' | 'input', extras?: { timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean; trigFunctions?: TrigFunction[]; trigProMode?: boolean; count?: number }) => {
    setPracticeTopic(topic);
    setPracticeContext(context);
    setPracticeMode(mode);
    setPracticeExtras(extras);
    setPracticePhase('setup');
    setReturnToLearn(true);
    setTab('practice');
  }, []);

  const clearPracticeState = useCallback(() => {
    pendingPracticeNavigation.current = null;
    setPracticeTopic(undefined);
    setPracticeContext(undefined);
    setPracticeMode(undefined);
    setPracticeExtras(undefined);
    setPracticePhase('setup');
    setReturnToLearn(false);
  }, []);

  const requestPracticeNavigation = useCallback((
    targetTab: Tab,
    resetLearn = false,
    replacementPracticeTopic?: string,
  ) => {
    pendingPracticeNavigation.current = {
      tab: targetTab,
      resetLearn,
      replacementPracticeTopic,
    };
    setPracticeBackRequest((value) => value + 1);
  }, []);

  const handleSettingsVisibilityChange = useCallback((visible: boolean) => {
    setSettingsOpen(visible);
  }, []);

  const handleTabChange = useCallback((newTab: Tab, transitionDirection?: SectionTransitionDirection) => {
    // A Floating Bar tap is an explicit navigation action and must be able to
    // supersede a swipe animation immediately instead of waiting for its exit.
    if (newTab === tab) {
      if (!transitionDirection && sectionTransitionDirection) {
        setSectionTransitionDirection(null);
      }
      return;
    }

    if (!transitionDirection && sectionTransitionDirection) {
      setSectionTransitionDirection(null);
    }

    if (newTab !== 'practice' && tab === 'practice' && isUnsavedPracticePhase(practicePhase)) {
      requestPracticeNavigation(newTab);
      return;
    }

    if (transitionDirection) {
      setSectionTransitionDirection(transitionDirection);
    }

    const applyNavigation = () => {
      if (newTab !== 'practice') {
        clearPracticeState();
      }
      setTab(newTab);
    };

    if (transitionDirection) {
      // Swipe transitions stay concurrent so a lazy destination cannot blank the
      // current screen while its chunk resolves.
      startTransition(applyNavigation);
    } else {
      // Primary navigation taps are discrete UI actions: commit immediately so
      // the Floating Bar never waits on a low-priority render.
      applyNavigation();
    }
  }, [tab, practicePhase, sectionTransitionDirection, requestPracticeNavigation, clearPracticeState]);

  const handleDoubleTap = useCallback((targetTab: Tab) => {
    if (sectionTransitionDirection) setSectionTransitionDirection(null);

    if (tab === 'practice' && isUnsavedPracticePhase(practicePhase)) {
      requestPracticeNavigation(targetTab, targetTab === 'learn');
      return;
    }

    if (targetTab === 'learn') {
      clearPracticeState();
      setLearningState(INITIAL_LEARNING_STATE);
      setTab('learn');
    } else if (targetTab === 'practice') {
      clearPracticeState();
      setTab('practice');
    } else if (targetTab === 'progress') {
      clearPracticeState();
      setTab('progress');
    }
  }, [tab, practicePhase, sectionTransitionDirection, requestPracticeNavigation, clearPracticeState]);

  const handlePracticeExit = useCallback(() => {
    const pending = pendingPracticeNavigation.current;
    pendingPracticeNavigation.current = null;

    if (pending) {
      const targetLearningState = pending.tab === 'learn' && pending.resetLearn
        ? INITIAL_LEARNING_STATE
        : learningState;

      const targetDepth = getNavDepth(pending.tab, targetLearningState, undefined, 'setup');
      window.history.replaceState({ __mathsbj: true, depth: targetDepth }, '');
      lastDepth.current = targetDepth;

      clearPracticeState();
      if (pending.tab === 'learn' && pending.resetLearn) {
        setLearningState(INITIAL_LEARNING_STATE);
      }
      if (pending.tab === 'practice') {
        setPracticeTopic(pending.replacementPracticeTopic);
        setPracticeContext(undefined);
        setPracticeMode(undefined);
        setPracticeExtras(undefined);
        setPracticePhase('setup');
        setReturnToLearn(false);
      }
      setTab(pending.tab);
      return;
    }

    if (returnToLearn) {
      const targetDepth = getNavDepth('learn', learningState);
      window.history.replaceState({ __mathsbj: true, depth: targetDepth }, '');
      lastDepth.current = targetDepth;
      clearPracticeState();
      setTab('learn');
    } else {
      const targetDepth = 'practice-setup';
      window.history.replaceState({ __mathsbj: true, depth: targetDepth }, '');
      lastDepth.current = targetDepth;
      clearPracticeState();
    }
  }, [clearPracticeState, learningState, returnToLearn]);

  const handlePracticeExitCancelled = useCallback(() => {
    pendingPracticeNavigation.current = null;
  }, []);

  const handlePracticeStarted = useCallback((mode: 'mcq' | 'input') => {
    setPracticeMode(mode);
    setPracticePhase('active');
  }, []);

  const handlePracticeFinished = useCallback(() => {
    setPracticePhase('finished');
  }, []);

  const handlePracticeReset = useCallback(() => {
    setPracticePhase('setup');
  }, []);

  const quickPractice = useCallback((topic: string) => {
    if (tab === 'practice' && isUnsavedPracticePhase(practicePhase)) {
      requestPracticeNavigation('practice', false, topic);
      return;
    }

    setPracticeTopic(topic);
    setPracticeContext(undefined);
    setPracticeMode(undefined);
    setPracticeExtras(undefined);
    setPracticePhase('setup');
    setReturnToLearn(false);
    setTab('practice');
  }, [tab, practicePhase, requestPracticeNavigation]);

  const appSectionSwipeEnabled =
    !paletteOpen &&
    !shortcutsOpen &&
    !settingsOpen &&
    !sectionTransitionDirection &&
    ((tab === 'learn' && learningState.activeTopic === null) ||
      (tab === 'practice' && practicePhase === 'setup') ||
      tab === 'progress');

  const isExcludedAppSwipeTarget = useCallback((target: EventTarget | null, root: HTMLElement) => {
    let element = target instanceof HTMLElement ? target : null;

    while (element && element !== root) {
      if (element.dataset.swipeIgnoreAppSection === 'true') return true;

      // Most ancestors are not horizontally overflowing. Avoid forcing a
      // computed-style read for each one on every touch/pointer down.
      if (element.scrollWidth > element.clientWidth + 1) {
        const overflowX = window.getComputedStyle(element).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }

      element = element.parentElement;
    }

    return false;
  }, []);

  const resetSectionSwipe = useCallback((eventTarget?: HTMLElement, pointerId?: number) => {
    if (eventTarget && pointerId !== undefined) {
      try {
        eventTarget.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }
    sectionSwipeRef.current = null;
  }, []);

  const handleSectionPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!appSectionSwipeEnabled || e.pointerType === 'mouse' || !e.isPrimary) {
      resetSectionSwipe();
      return;
    }

    if (isExcludedAppSwipeTarget(e.target, e.currentTarget)) {
      resetSectionSwipe();
      return;
    }

    sectionSwipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      active: false,
      triggered: false,
    };
  }, [appSectionSwipeEnabled, isExcludedAppSwipeTarget, resetSectionSwipe]);

  const handleSectionPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = sectionSwipeRef.current;
    if (
      !appSectionSwipeEnabled ||
      !gesture ||
      gesture.pointerId !== e.pointerId ||
      !e.isPrimary
    ) {
      return;
    }

    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;

    if (!gesture.axis && (Math.abs(dx) >= 10 || Math.abs(dy) >= 10)) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

      if (gesture.axis === 'y') {
        resetSectionSwipe();
        return;
      }

      gesture.active = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is optional; the gesture can still finish normally.
      }
    }

    if (!gesture.active || gesture.axis !== 'x') return;

    e.preventDefault();
  }, [appSectionSwipeEnabled, resetSectionSwipe]);

  const handleSectionPointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = sectionSwipeRef.current;
    if (!gesture || gesture.pointerId !== e.pointerId) return;

    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    const direction = getHorizontalSwipeDirection(dx, dy);

    const now = Date.now();
    const shouldNavigate =
      !cancelled &&
      !gesture.triggered &&
      gesture.active &&
      (direction === 'left' || direction === 'right') &&
      now - lastSectionSwipeAt.current >= 400;

    resetSectionSwipe(e.currentTarget, e.pointerId);

    if (!shouldNavigate) return;

    lastSectionSwipeAt.current = now;

    // Navigate only between the three existing main section roots:
    // Learning -> Quiz -> Progress.
    // The disabled edges resolve to null, so boundary swipes are no-ops.
    // Active Quiz sessions never reach this handler because
    // appSectionSwipeEnabled is limited to Quiz setup.
    if (
      (tab === 'learn' && learningState.activeTopic === null) ||
      (tab === 'practice' && practicePhase === 'setup') ||
      tab === 'progress'
    ) {
      const nextTab = getAdjacentMainSection(tab, direction);
      if (nextTab) handleTabChange(nextTab, direction);
    }
  }, [
    handleTabChange,
    learningState.activeTopic,
    practicePhase,
    resetSectionSwipe,
    tab,
  ]);

  const handleSectionPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => handleSectionPointerEnd(e),
    [handleSectionPointerEnd],
  );

  const handleSectionPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => handleSectionPointerEnd(e, true),
    [handleSectionPointerEnd],
  );

  // Keyboard shortcuts (desktop-style, ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!getSettings().keyboardShortcuts) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (paletteOpen || shortcutsOpen) return;
      if (tab === 'practice' && isUnsavedPracticePhase(practicePhase)) return; // don't hijack an active quiz

      if (e.key === '1') handleTabChange('learn');
      else if (e.key === '2') handleTabChange('practice');
      else if (e.key === '3') handleTabChange('progress');
      else if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, shortcutsOpen, tab, practicePhase]);

  return (
    <div className="app-shell">
      <div className="app-frame bg-background">
        <Watermark />
        <div
          ref={appFrameScrollRef}
          className="app-frame-scroll"
          onPointerDown={handleSectionPointerDown}
          onPointerMove={handleSectionPointerMove}
          onPointerUp={handleSectionPointerUp}
          onPointerCancel={handleSectionPointerCancel}
          style={{ touchAction: 'pan-y' }}
        >
          <div className={wideDesktop ? 'flex justify-center gap-4 relative z-10' : 'contents'}>
          <div className={learningState.activeTopic === 'periodic-table'
              ? 'w-full max-w-[1480px] mx-auto px-3 sm:px-4 pt-0 relative z-10 flex-1 grid grid-cols-1'
              : 'max-w-lg mx-auto px-4 pt-0 relative z-10 flex-1 grid grid-cols-1'}>
            <AnimatePresence
              initial={false}
              custom={sectionTransitionDirection ?? 'left'}
              mode="sync"
              onExitComplete={() => setSectionTransitionDirection(null)}
            >
              {tab === 'learn' && (
                <motion.div
                  key="learn"
                  custom={sectionTransitionDirection ?? 'left'}
                  variants={sectionPageVariants}
                  initial={sectionTransitionDirection ? 'enter' : false}
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: sectionTransitionDirection ? (prefersReducedMotion ? MOTION.duration.instant : MOTION.duration.page) : 0,
                    ease: MOTION.ease.standard,
                  }}
                  className="col-start-1 row-start-1 min-w-0 w-full"
                  style={{ willChange: sectionTransitionDirection ? 'transform' : 'auto' }}
                >
                  <LearningPage
                    onBack={goBack}
                    onStartPractice={handleStartPractice}
                    learningState={learningState}
                    onLearningStateChange={setLearningState}
                  />
                </motion.div>
              )}
              {tab === 'practice' && (
                <motion.div
                  key="practice"
                  custom={sectionTransitionDirection ?? 'left'}
                  variants={sectionPageVariants}
                  initial={sectionTransitionDirection ? 'enter' : false}
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: sectionTransitionDirection ? (prefersReducedMotion ? MOTION.duration.instant : MOTION.duration.page) : 0,
                    ease: MOTION.ease.standard,
                  }}
                  className="col-start-1 row-start-1 min-w-0 w-full"
                  style={{ willChange: sectionTransitionDirection ? 'transform' : 'auto' }}
                >
                  <Suspense fallback={null}>
                    <PracticePage
                      initialTopic={practiceTopic}
                      initialContext={practiceContext}
                      initialMode={practiceMode}
                      initialExtras={practiceExtras}
                      onExit={handlePracticeExit}
                      externalBackRequest={practiceBackRequest}
                      fromLearning={returnToLearn}
                      onQuizStart={handlePracticeStarted}
                      onQuizFinish={handlePracticeFinished}
                      onQuizReset={handlePracticeReset}
                      onExitCancelled={handlePracticeExitCancelled}
                    />
                  </Suspense>
                </motion.div>
              )}
              {tab === 'progress' && (
                <motion.div
                  key="progress"
                  custom={sectionTransitionDirection ?? 'left'}
                  variants={sectionPageVariants}
                  initial={sectionTransitionDirection ? 'enter' : false}
                  animate="center"
                  exit="exit"
                  transition={{
                    duration: sectionTransitionDirection ? (prefersReducedMotion ? MOTION.duration.instant : MOTION.duration.page) : 0,
                    ease: MOTION.ease.standard,
                  }}
                  className="col-start-1 row-start-1 min-w-0 w-full"
                  style={{ willChange: sectionTransitionDirection ? 'transform' : 'auto' }}
                >
                  <Suspense fallback={null}>
                    <ProgressPage onSettingsVisibilityChange={handleSettingsVisibilityChange} />
                  </Suspense>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          </div>
        </div>
        {typeof document !== 'undefined' && mountBottomNav
          ? createPortal(
              <BottomNav
                ref={bottomNavRef}
                active={tab}
                hidden={!showBottomNav}
                onChange={handleTabChange}
                onDoubleTap={handleDoubleTap}
              />,
              document.body,
            )
          : null}
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={handleTabChange}
        onStartPractice={quickPractice}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <OfflinePrep />
      <AppUpdateManager isQuizActive={tab === 'practice' && practicePhase === 'active'} />
    </div>
  );

};

export default Index;
