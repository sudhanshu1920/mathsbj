import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import LearningPage from '@/pages/LearningPage';
import type { LearningState } from '@/pages/Index';

vi.mock('@/components/ThemeToggle', () => ({ default: () => null }));
vi.mock('@/components/DesktopModeToggle', () => ({ default: () => null }));
vi.mock('@/components/SwipeBack', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/SwipeContainer', () => ({
  default: ({
    items,
    renderItem,
    currentIndex = 0,
  }: {
    items?: ReactNode[];
    renderItem?: (index: number) => ReactNode;
    currentIndex?: number;
  }) => <>{renderItem ? renderItem(currentIndex) : items?.[currentIndex] ?? null}</>,
}));
vi.mock('@/components/ui/switch', () => ({
  Switch: () => <input type="checkbox" aria-label="Pro Mode" />,
}));

const makeLearningState = (overrides: Partial<LearningState> = {}): LearningState => ({
  activeTopic: 'tables',
  selectedNumber: null,
  selectedRange: null,
  percentageGroup: null,
  expandedDenominator: null,
  formulaSectionIndex: null,
  formulaCategoryIndex: null,
  periodicSelectedElement: null,
  periodicSelectedRangeIndex: null,
  ...overrides,
});

describe('Learning Mode practice entry placement', () => {
  it('hides Practice on the Tables number grid and shows it on an individual table detail', () => {
    const onLearningStateChange = vi.fn();
    const { rerender } = render(
      <LearningPage
        learningState={makeLearningState()}
        onLearningStateChange={onLearningStateChange}
      />,
    );

    expect(screen.queryByTestId('learning-practice-entry')).not.toBeInTheDocument();

    rerender(
      <LearningPage
        learningState={makeLearningState({ selectedNumber: 2 })}
        onLearningStateChange={onLearningStateChange}
      />,
    );

    expect(screen.getByTestId('learning-practice-entry')).toBeInTheDocument();
  });

  it('hides Practice on the Squares range chooser and shows it on selected range content', () => {
    const onLearningStateChange = vi.fn();
    const { rerender } = render(
      <LearningPage
        learningState={makeLearningState({ activeTopic: 'squares' })}
        onLearningStateChange={onLearningStateChange}
      />,
    );

    expect(screen.queryByTestId('learning-practice-entry')).not.toBeInTheDocument();

    rerender(
      <LearningPage
        learningState={makeLearningState({
          activeTopic: 'squares',
          selectedRange: { from: 1, to: 10 },
        })}
        onLearningStateChange={onLearningStateChange}
      />,
    );

    expect(screen.getByTestId('learning-practice-entry')).toBeInTheDocument();
  });
});
