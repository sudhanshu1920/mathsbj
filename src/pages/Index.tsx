import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import DesktopModeToggle from '@/components/DesktopModeToggle';
import Watermark from '@/components/Watermark';
import LearningPage from '@/pages/LearningPage';
const PracticePage = lazyWithRetry(() => import('@/pages/PracticePage'));
const ProgressPage = lazyWithRetry(() => import('@/pages/ProgressPage'));
import { useTheme, useMode } from '@/lib/theme';
import { useWideDesktop } from '@/hooks/use-desktop-mode';
import CommandPalette from '@/components/CommandPalette';
import ShortcutsHelp from '@/components/ShortcutsHelp';
import OfflinePrep from '@/components/OfflinePrep';
import { getSettings } from '@/lib/settings';

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

// Compute a depth key representing how deep we are in navigation
function getNavDepth(tab: Tab, learningState: LearningState, practiceTopic?: string, practiceActive?: boolean): string {
  if (tab === 'progress') return 'progress';
  if (tab === 'practice') {
    if (practiceActive) return 'practice-active';
    return 'practice-setup';
  }
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
  const currentTheme = useTheme();
  const currentMode = useMode();
  const [tab, setTab] = useState<Tab>('learn');
  const [practiceTopic, setPracticeTopic] = useState<string | undefined>();
  const [practiceContext, setPracticeContext] = useState<{ from?: number; to?: number; number?: number } | undefined>();
  const [practiceMode, setPracticeMode] = useState<'mcq' | 'input' | undefined>();
  const [practiceExtras, setPracticeExtras] = useState<{ timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean } | undefined>();
  const [returnToLearn, setReturnToLearn] = useState(false);
  const [learningState, setLearningState] = useState<LearningState>(INITIAL_LEARNING_STATE);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const wideDesktop = useWideDesktop();
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
  });
  navigationStateRef.current = {
    tab,
    learningState,
    practiceTopic,
    practiceMode,
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
    const depth = getNavDepth(tab, learningState, practiceTopic, !!practiceMode);
    if (depth !== lastDepth.current && !isHandlingPopstate.current) {
      window.history.pushState({ __mathsbj: true, depth }, '');
      lastDepth.current = depth;
    }
    isHandlingPopstate.current = false;
  }, [tab, learningState, practiceTopic, practiceMode]);

  // Handle native Android back button / system edge-back.
  // Capacitor owns the native event before Android finishes the Activity, so
  // nested screens can use the same history stack as the web back gesture.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    void App.addListener('backButton', () => {
      const { tab, learningState, practiceTopic, practiceMode } = navigationStateRef.current;
      const depth = getNavDepth(tab, learningState, practiceTopic, !!practiceMode);

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

      // If a practice session is active, let PracticePage handle the back press
      // (it shows its own exit confirmation dialog and intercepts popstate).
      if (tab === 'practice' && practiceMode) {
        return;
      }

      // Determine what to go back to
      if (tab === 'practice') {
        // Practice setup screen — leave to learn (or wherever we came from)
        if (returnToLearn) {
          setReturnToLearn(false);
          setPracticeTopic(undefined);
          setPracticeContext(undefined);
          setPracticeMode(undefined);
          setTab('learn');
        } else {
          setPracticeTopic(undefined);
          setPracticeContext(undefined);
          setPracticeMode(undefined);
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
  }, [tab, learningState, returnToLearn, practiceMode]);

  const handleStartPractice = useCallback((topic: string, context?: { from?: number; to?: number; number?: number }, mode?: 'mcq' | 'input', extras?: { timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean }) => {
    setPracticeTopic(topic);
    setPracticeContext(context);
    setPracticeMode(mode);
    setPracticeExtras(extras);
    setReturnToLearn(true);
    setTab('practice');
  }, []);

  const handleTabChange = (newTab: Tab) => {
    if (newTab !== 'practice') {
      setPracticeTopic(undefined);
      setPracticeContext(undefined);
      setPracticeMode(undefined);
    }
    setTab(newTab);
  };

  const handleDoubleTap = useCallback((targetTab: Tab) => {
    if (targetTab === 'learn') {
      setLearningState(INITIAL_LEARNING_STATE);
      setTab('learn');
    } else if (targetTab === 'practice') {
      setPracticeTopic(undefined);
      setPracticeContext(undefined);
      setPracticeMode(undefined);
      setPracticeExtras(undefined);
      setReturnToLearn(false);
      setTab('practice');
    } else if (targetTab === 'progress') {
      setTab('progress');
    }
  }, []);

  const handlePracticeExit = useCallback(() => {
    if (returnToLearn) {
      setReturnToLearn(false);
      setPracticeTopic(undefined);
      setPracticeContext(undefined);
      setPracticeMode(undefined);
      setTab('learn');
    } else {
      setPracticeTopic(undefined);
      setPracticeContext(undefined);
      setPracticeMode(undefined);
    }
  }, [returnToLearn]);

  const quickPractice = useCallback((topic: string) => {
    setPracticeTopic(topic);
    setPracticeContext(undefined);
    setPracticeMode(undefined);
    setPracticeExtras(undefined);
    setReturnToLearn(false);
    setTab('practice');
  }, []);

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
      if (tab === 'practice' && practiceMode) return; // don't hijack an active quiz

      if (e.key === '1') handleTabChange('learn');
      else if (e.key === '2') handleTabChange('practice');
      else if (e.key === '3') handleTabChange('progress');
      else if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, shortcutsOpen, tab, practiceMode]);

  return (
    <div className="app-shell">
      <div data-current-theme={currentTheme} data-current-mode={currentMode} className="app-frame bg-background">
        <Watermark />
        <div className="app-frame-scroll">
          <div className={wideDesktop ? 'flex justify-center gap-4 relative z-10' : 'contents'}>
          <div className={learningState.activeTopic === 'periodic-table'
              ? 'w-full max-w-[1480px] mx-auto px-3 sm:px-4 pt-0 relative z-10 flex-1'
              : 'max-w-lg mx-auto px-4 pt-0 relative z-10 flex-1'}>
            <div className={tab === 'learn' ? 'animate-fade-in' : 'hidden'}>
              <LearningPage
                onBack={goBack}
                onStartPractice={handleStartPractice}
                learningState={learningState}
                onLearningStateChange={setLearningState}
              />
            </div>
            <Suspense fallback={null}>
              {tab === 'practice' && (
                <div className="animate-fade-in">
                  <PracticePage
                    initialTopic={practiceTopic}
                    initialContext={practiceContext}
                    initialMode={practiceMode}
                    initialExtras={practiceExtras}
                    onExit={handlePracticeExit}
                    fromLearning={returnToLearn}
                  />
                </div>
              )}
              {tab === 'progress' && (
                <div className="animate-fade-in">
                  <ProgressPage />
                </div>
              )}
            </Suspense>
          </div>

          </div>
        </div>
        <BottomNav active={tab} onChange={handleTabChange} onDoubleTap={handleDoubleTap} />
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
    </div>
  );

};

export default Index;
