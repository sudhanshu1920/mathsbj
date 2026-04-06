import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import LearningPage from '@/pages/LearningPage';
import PracticePage from '@/pages/PracticePage';
import ProgressPage from '@/pages/ProgressPage';

type Tab = 'learn' | 'practice' | 'progress';

const Index = () => {
  const [tab, setTab] = useState<Tab>('learn');
  const [practiceTopic, setPracticeTopic] = useState<string | undefined>();
  const [practiceContext, setPracticeContext] = useState<{ from?: number; to?: number; number?: number } | undefined>();

  const handleStartPractice = (topic: string, context?: { from?: number; to?: number; number?: number }) => {
    setPracticeTopic(topic);
    setPracticeContext(context);
    setTab('practice');
  };

  const handleTabChange = (newTab: Tab) => {
    if (newTab !== 'practice') {
      setPracticeTopic(undefined);
      setPracticeContext(undefined);
    }
    setTab(newTab);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (practiceTopic || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'learn' && <LearningPage onStartPractice={handleStartPractice} />}
            {tab === 'practice' && <PracticePage initialTopic={practiceTopic} initialContext={practiceContext} />}
            {tab === 'progress' && <ProgressPage />}
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav active={tab} onChange={handleTabChange} />
    </div>
  );
};

export default Index;
