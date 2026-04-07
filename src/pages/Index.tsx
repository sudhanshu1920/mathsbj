import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
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
}

const INITIAL_LEARNING_STATE: LearningState = {
  activeTopic: null,
  selectedNumber: null,
  selectedRange: null,
  percentageGroup: null,
  expandedDenominator: null,
};

const Index = () => {
  const [tab, setTab] = useState<Tab>('learn');
  const [practiceTopic, setPracticeTopic] = useState<string | undefined>();
  const [practiceContext, setPracticeContext] = useState<{ from?: number; to?: number; number?: number } | undefined>();
  const [practiceMode, setPracticeMode] = useState<'mcq' | 'input' | undefined>();
  const [returnToLearn, setReturnToLearn] = useState(false);
  const [learningState, setLearningState] = useState<LearningState>(INITIAL_LEARNING_STATE);

  const handleStartPractice = useCallback((topic: string, context?: { from?: number; to?: number; number?: number }, mode?: 'mcq' | 'input') => {
    setPracticeTopic(topic);
    setPracticeContext(context);
    setPracticeMode(mode);
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
      // learningState is preserved - user returns to same screen
    } else {
      setPracticeTopic(undefined);
      setPracticeContext(undefined);
      setPracticeMode(undefined);
    }
  }, [returnToLearn]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex justify-end mb-2">
          <ThemeToggle />
        </div>
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
                onExit={handlePracticeExit}
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
