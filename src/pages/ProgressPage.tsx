import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, XCircle, Flame, RotateCcw } from 'lucide-react';
import { getProgress, resetProgress, ProgressData } from '@/lib/progress';

const ProgressPage = () => {
  const [data, setData] = useState<ProgressData>(getProgress());

  useEffect(() => {
    setData(getProgress());
  }, []);

  const accuracy = data.totalAttempts > 0 ? Math.round((data.correct / data.totalAttempts) * 100) : 0;

  const stats = [
    { label: 'Total', value: data.totalAttempts, icon: Target, color: 'text-primary' },
    { label: 'Correct', value: data.correct, icon: Trophy, color: 'text-success' },
    { label: 'Wrong', value: data.wrong, icon: XCircle, color: 'text-destructive' },
    { label: 'Streak', value: data.bestStreak, icon: Flame, color: 'text-warning' },
  ];

  const topicNames: Record<string, string> = {
    tables: 'Tables',
    squares: 'Squares',
    roots: 'Roots',
    cubes: 'Cubes',
    powers: 'Powers',
    percentage: 'Percentage',
  };

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-6 text-glow">Progress</h1>

      {/* Accuracy ring */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex justify-center mb-8"
      >
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-secondary" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className="stroke-primary"
              strokeDasharray={`${accuracy * 2.64} 264`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display font-bold text-3xl text-foreground">{accuracy}%</span>
            <span className="text-xs text-muted-foreground">Accuracy</span>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card border border-border rounded-2xl p-4 text-center"
          >
            <s.icon size={20} className={`mx-auto mb-2 ${s.color}`} />
            <p className="font-display font-bold text-2xl text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* By topic */}
      {Object.keys(data.byTopic).length > 0 && (
        <div className="mb-8">
          <h3 className="font-display font-semibold text-lg mb-3 text-foreground">By Topic</h3>
          <div className="space-y-2">
            {Object.entries(data.byTopic).map(([key, val]) => {
              const topicAcc = val.attempts > 0 ? Math.round((val.correct / val.attempts) * 100) : 0;
              return (
                <div key={key} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <span className="font-medium text-foreground">{topicNames[key] || key}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{val.attempts} Q</span>
                    <span className={`font-bold text-sm ${topicAcc >= 70 ? 'text-success' : 'text-warning'}`}>
                      {topicAcc}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={() => {
          resetProgress();
          setData(getProgress());
        }}
        className="flex items-center gap-2 mx-auto text-muted-foreground hover:text-destructive transition-colors text-sm"
      >
        <RotateCcw size={14} />
        Reset Progress
      </button>
    </div>
  );
};

export default ProgressPage;
