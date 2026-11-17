import type { MCQGameVariant } from '@/components/GameModeSelector';

const GAME_LOADERS: Record<MCQGameVariant, () => Promise<unknown>> = {
  car: () => import('@/components/MCQWithGame'),
  jump: () => import('@/components/MCQJumpAdventure'),
  shooter: () => import('@/components/MCQSpaceShooter'),
  slice: () => import('@/components/MCQSliceNinja'),
};

/** Warm only the game the user is choosing; do not download every game bundle. */
export const preloadPracticeGame = (game: MCQGameVariant): Promise<unknown> =>
  GAME_LOADERS[game]();
