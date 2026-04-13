import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import Watermark from '@/components/Watermark';
import LearningPage from '@/pages/LearningPage';
import PracticePage from '@/pages/PracticePage';
import ProgressPage from '@/pages/ProgressPage';

type Tab = 'learn' | 'practice' | 'progress';

export interface LearningState {
  activeTopic: string | null;
  selectedNumber: number | null;
  selectedRange: { from: number; to: number } | null;
  percentageGroup: { from: number; to: number } | null;
  expandedDenominator: number | null;
  formulaSectionIndex: number | null;
  formulaCategoryIndex: number | null;
}

const INITIAL_LEARNING_STATE: LearningState = {
  activeTopic: null,
  selectedNumber: null,
  selectedRange: null,
  percentageGroup: null,
  expandedDenominator: null,
  formulaSectionIndex: null,
  formulaCategoryIndex: null,
};

// Compute a depth key representing how deep we are in navigation
function getNavDepth(tab: Tab, learningState: LearningState, practiceTopic?: string, practiceActive?: boolean): string {
  if (tab === 'progress') return 'progress';
  if (tab === 'practice') {
    if (practiceActive) return 'practice-active';
    return 'practice-setup';
  }
  // learn tab
  const { activeTopic, selectedNumber, selectedRange, percentageGroup, expandedDenominator, formulaSectionIndex, formulaCategoryIndex } = learningState;
  if (!activeTopic) return 'learn-home';
  if (activeTopic === 'percentage') {
    if (expandedDenominator) return `learn-percentage-expanded-${expandedDenominator}`;
    if (percentageGroup) return `learn-percentage-group`;
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
  const [practiceExtras, setPracticeExtras] = useState<{ timerEnabled?: boolean; timerSeconds?: number; infinite?: boolean } | undefined>();
  const [returnToLearn, setReturnToLearn] = useState(false);
  const [learningState, setLearningState] = useState<LearningState>(INITIAL_LEARNING_STATE);
  const lastBackPress = useRef(0);
  const isHandlingPopstate = useRef(false);
  const lastDepth = useRef('learn-home');

  // Push history state when navigation depth changes
  useEffect(() => {
    const depth = getNavDepth(tab, learningState, practiceTopic, !!practiceMode);
    if (depth !== lastDepth.current && !isHandlingPopstate.current) {
      window.history.pushState({ depth }, '');
      lastDepth.current = depth;
    }
    isHandlingPopstate.current = false;
  }, [tab, learningState, practiceTopic, practiceMode]);

  // Handle browser back button / gesture
  useEffect(() => {
    const handlePopstate = () => {
      isHandlingPopstate.current = true;

      // Determine what to go back to
      if (tab === 'practice') {
        // If in active practice, exit practice
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
      const { activeTopic, selectedNumber, selectedRange, percentageGroup, expandedDenominator, formulaSectionIndex, formulaCategoryIndex } = learningState;

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
        lastDepth.current = 'learn-percentage-group';
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

      // At root - double back to exit
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        // Actually exit - allow default behavior
        window.history.back();
        return;
      }
      lastBackPress.current = now;
      toast('Press back again to exit', { duration: 2000 });
      // Push a state so next back press comes to us again
      window.history.pushState({ depth: 'learn-home' }, '');
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [tab, learningState, returnToLearn]);

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

  return (
    <div className="min-h-screen bg-background pb-20 relative">
      <Watermark />
      <div className="max-w-lg mx-auto px-4 pt-4 relative z-10">
        {tab !== 'learn' && (
          <div className="flex justify-end mb-2">
            <ThemeToggle />
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (practiceTopic || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'learn' && (
              <LearningPage
                onStartPractice={handleStartPractice}
                learningState={learningState}
                onLearningStateChange={setLearningState}
              />
            )}
            {tab === 'practice' && (
              <PracticePage
                initialTopic={practiceTopic}
                initialContext={practiceContext}
                initialMode={practiceMode}
                initialExtras={practiceExtras}
                onExit={handlePracticeExit}
                fromLearning={returnToLearn}
              />
            )}
            {tab === 'progress' && <ProgressPage />}
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav active={tab} onChange={handleTabChange} />
    </div>
  );
};

export default Index;
