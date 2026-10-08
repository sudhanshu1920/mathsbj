import type { LucideIcon } from 'lucide-react';
import { Atom, Box, Grid3X3, Percent, Radical, Sigma, Square, Superscript, Triangle } from 'lucide-react';

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

export type AppTopicId =
  | LearningTopicId
  | 'roots'
  | 'addition-subtraction-digits'
  | 'trig';

export interface TopicIconConfig {
  icon?: LucideIcon;
  toneClass: string;
  label: string;
  symbol?: string;
  badge?: string;
}

const SQUARE_ROOTS_ICON: TopicIconConfig = {
  icon: Radical,
  toneClass: 'text-primary',
  label: 'Square Roots',
};

const CUBE_ROOTS_ICON: TopicIconConfig = {
  icon: Radical,
  toneClass: 'text-primary',
  label: 'Cube Roots',
  badge: '3',
};

const ADDITION_SUBTRACTION_ICON: TopicIconConfig = {
  toneClass: 'text-primary',
  label: '+/-',
  symbol: '±',
};

/**
 * Single source of truth for app topic icon + visible name assignments.
 *
 * Important: keys are existing internal topic IDs/keys. Never rename them here.
 * Update the icon definition once and every consuming screen stays aligned.
 */
export const TOPIC_ICON_MAP: Record<AppTopicId, TopicIconConfig> = {
  tables: {
    icon: Grid3X3,
    toneClass: 'text-primary',
    label: 'Tables',
  },
  squares: {
    icon: Square,
    toneClass: 'text-success',
    label: 'Squares',
  },
  'square-roots': SQUARE_ROOTS_ICON,
  roots: SQUARE_ROOTS_ICON,
  cubes: {
    icon: Box,
    toneClass: 'text-warning',
    label: 'Cubes',
  },
  'cube-roots': CUBE_ROOTS_ICON,
  powers: {
    icon: Superscript,
    toneClass: 'text-success',
    label: 'Powers',
  },
  percentage: {
    icon: Percent,
    toneClass: 'text-warning',
    label: 'Percentage',
  },
  formulas: {
    icon: Sigma,
    toneClass: 'text-primary',
    label: 'Formulas',
  },
  trig: {
    icon: Triangle,
    toneClass: 'text-primary',
    label: 'Trigonometry',
  },
  'addition-subtraction-digits': ADDITION_SUBTRACTION_ICON,
  'periodic-table': {
    icon: Atom,
    toneClass: 'text-success',
    label: 'Periodic Table',
  },
};
