export const MOTION = {
  duration: {
    instant: 0.01,
    fast: 0.14,
    standard: 0.22,
    slow: 0.32,
    page: 0.28,
    data: 0.5,
    feedbackShine: 0.55,
  },
  stagger: {
    micro: 0.03,
    standard: 0.04,
  },
  distance: {
    micro: 4,
    small: 8,
    page: '100%',
  },
  scale: {
    press: 0.985,
    tap: 0.97,
    subtle: 0.99,
  },
  ease: {
    standard: [0.22, 1, 0.36, 1] as const,
    enter: [0.16, 1, 0.3, 1] as const,
    exit: [0.7, 0, 0.84, 1] as const,
    easeOut: 'easeOut' as const,
    easeInOut: 'easeInOut' as const,
    linear: 'linear' as const,
  },
  springGentle: {
    type: 'spring' as const,
    stiffness: 340,
    damping: 30,
    mass: 0.72,
  },
} as const;
