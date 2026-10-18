import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PracticePage from '@/pages/PracticePage';

const soundMocks = vi.hoisted(() => ({
  playClick: vi.fn(),
  playRightAnswer: vi.fn(),
  playWrong: vi.fn(),
  playLevelUp: vi.fn(),
}));

vi.mock('@/lib/sound', () => ({
  ...soundMocks,
  playSwipe: vi.fn(),
  playSuccess: vi.fn(),
  playStreak: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function openTableQuiz() {
  render(
    <PracticePage
      initialTopic="tables"
      initialMode="mcq"
      initialExtras={{ timerEnabled: false, count: 10 }}
    />,
  );
  const prompt = screen.getByText(/^\d+ × \d+ = \?$/);
  const match = prompt.textContent?.match(/^(\d+) × (\d+) = \?$/);
  if (!match) throw new Error('Could not read the generated multiplication question.');

  const grid = document.querySelector('.mcq-options-grid');
  if (!grid) throw new Error('Multiple-choice answers did not render.');
  return {
    grid: within(grid),
    answer: Number(match[1]) * Number(match[2]),
  };
}

describe('PracticePage answer sound', () => {
  it('plays the supplied sound when a correct answer is selected', () => {
    const { grid, answer } = openTableQuiz();

    fireEvent.click(grid.getByRole('button', { name: String(answer), exact: true }));

    expect(soundMocks.playRightAnswer).toHaveBeenCalledTimes(1);
    expect(soundMocks.playWrong).not.toHaveBeenCalled();
  });

  it('keeps wrong-answer sound separate from the correct-answer sound', () => {
    const { grid, answer } = openTableQuiz();
    const wrongOption = grid.getAllByRole('button').find(
      (button) => button.textContent?.trim() !== String(answer),
    );
    if (!wrongOption) throw new Error('Could not find a wrong answer option.');

    fireEvent.click(wrongOption);

    expect(soundMocks.playWrong).toHaveBeenCalledTimes(1);
    expect(soundMocks.playRightAnswer).not.toHaveBeenCalled();
  });
});
