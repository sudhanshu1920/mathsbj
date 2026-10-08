import type { LucideIcon } from 'lucide-react';
import { Atom, BookOpen, Box, Grid3x3, Percent, Radical, Square, Superscript, Zap } from 'lucide-react';

export type LearningTopicId =
  | 'tables'
  | 'squares'
  | 'square-roots'
  | 'cubes'
  | 'cube-roots'
  | 'powers'
  | 'percentage'
  | 'formulas'
  | 'periodic-table';

export interface TopicIconConfig {
  icon: LucideIcon;
  toneClass: string;
  label: string;
}

/**
 * Single source of truth for Learning Mode topic icon assignments.
 * Change an icon here instead of editing individual topic cards.
 */
export const TOPIC_ICON_MAP: Record<LearningTopicId, TopicIconConfig> = {
  tables: {
    icon: Grid3x3,
    toneClass: 'text-primary',
    label: 'Tables',
  },
  squares: {
    icon: Square,
    toneClass: 'text-success',
    label: 'Squares',
  },
  'square-roots': {
    icon: Radical,
    toneClass: 'text-primary',
    label: 'Square Roots',
  },
  cubes: {
    icon: Box,
    toneClass: 'text-warning',
    label: 'Cubes',
  },
  'cube-roots': {
    icon: Superscript,
    toneClass: 'text-primary',
    label: 'Cube Roots',
  },
  powers: {
    icon: Zap,
    toneClass: 'text-success',
    label: 'Powers',
  },
  percentage: {
    icon: Percent,
    toneClass: 'text-warning',
    label: 'Percentage',
  },
  formulas: {
    icon: BookOpen,
    toneClass: 'text-primary',
    label: 'Formulas',
  },
  'periodic-table': {
    icon: Atom,
    toneClass: 'text-success',
    label: 'Periodic Table',
  },
};
