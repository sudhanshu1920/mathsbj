import type { MCQGameVariant } from '@/components/GameModeSelector';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const loadCarRacing = () => import('@/components/MCQWithGame');
const loadJumpAdventure = () => import('@/components/MCQJumpAdventure');
const loadSpaceShooter = () => import('@/components/MCQSpaceShooter');
const loadSliceNinja = () => import('@/components/MCQSliceNinja');

export const LazyMCQWithGame = lazyWithRetry(loadCarRacing);
export const LazyMCQJumpAdventure = lazyWithRetry(loadJumpAdventure);
export const LazyMCQSpaceShooter = lazyWithRetry(loadSpaceShooter);
export const LazyMCQSliceNinja = lazyWithRetry(loadSliceNinja);

const GAME_LOADERS: Record<MCQGameVariant, () => Promise<unknown>> = {
  car: loadCarRacing,
  jump: loadJumpAdventure,
  shooter: loadSpaceShooter,
  slice: loadSliceNinja,
};

/** Warm only the game the user is choosing; do not download every game bundle. */
export const preloadPracticeGame = (game: MCQGameVariant): void => {
  void GAME_LOADERS[game]().catch(() => undefined);
};
