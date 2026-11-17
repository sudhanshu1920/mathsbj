import { lazyWithRetry } from '@/lib/lazyWithRetry';

export const LazyMCQWithGame = lazyWithRetry(() => import('@/components/MCQWithGame'));
export const LazyMCQJumpAdventure = lazyWithRetry(() => import('@/components/MCQJumpAdventure'));
export const LazyMCQSpaceShooter = lazyWithRetry(() => import('@/components/MCQSpaceShooter'));
export const LazyMCQSliceNinja = lazyWithRetry(() => import('@/components/MCQSliceNinja'));
