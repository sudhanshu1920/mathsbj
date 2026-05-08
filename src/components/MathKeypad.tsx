import { motion } from 'framer-motion';
import { Delete, Check } from 'lucide-react';
import { playClick } from '@/lib/sound';

interface MathKeypadProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** Which special keys to enable. */
  variant?: 'numeric' | 'fraction' | 'mixed' | 'decimal' | 'full';
  disabled?: boolean;
}

/**
 * Custom on-screen math keypad supporting digits, /, %, ., space, backspace and OK.
 * Designed for percentage / fraction practice typing.
 */
const MathKeypad = ({ value, onChange, onSubmit, variant = 'full', disabled }: MathKeypadProps) => {
  const press = (k: string) => {
    if (disabled) return;
    try { playClick(); } catch {}
    if (k === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === 'ok') {
      onSubmit();
      return;
    }
    onChange(value + k);
  };

  // Layout rows; some keys can be hidden depending on variant
  const showSlash = variant !== 'numeric' && variant !== 'decimal';
  const showPct = variant !== 'numeric' && variant !== 'fraction';
  const showDot = variant !== 'fraction';
  const showSpace = variant === 'mixed' || variant === 'full';

  type Key = { label: React.ReactNode; key: string; tone?: 'num' | 'op' | 'ok' | 'back' | 'mute' };
  const rows: Key[][] = [
    [
      { label: '1', key: '1', tone: 'num' },
      { label: '2', key: '2', tone: 'num' },
      { label: '3', key: '3', tone: 'num' },
    ],
    [
      { label: '4', key: '4', tone: 'num' },
      { label: '5', key: '5', tone: 'num' },
      { label: '6', key: '6', tone: 'num' },
    ],
    [
      { label: '7', key: '7', tone: 'num' },
      { label: '8', key: '8', tone: 'num' },
      { label: '9', key: '9', tone: 'num' },
    ],
    [
      showPct
        ? { label: '%', key: '%', tone: 'op' }
        : showSpace
          ? { label: '␣', key: ' ', tone: 'op' }
          : { label: '·', key: '.', tone: 'op' },
      { label: '0', key: '0', tone: 'num' },
      showSlash
        ? { label: '/', key: '/', tone: 'op' }
        : showDot
          ? { label: '.', key: '.', tone: 'op' }
          : { label: '·', key: '.', tone: 'mute' },
    ],
    [
      showDot && showPct && showSlash
        ? { label: '.', key: '.', tone: 'op' }
        : showSpace
          ? { label: '␣', key: ' ', tone: 'op' }
          : { label: '·', key: '.', tone: 'op' },
      { label: <Delete size={20} />, key: 'back', tone: 'back' },
      { label: <Check size={20} />, key: 'ok', tone: 'ok' },
    ],
  ];

  const toneClass = (t?: Key['tone']) => {
    switch (t) {
      case 'op':
        return 'glass text-primary border-primary/40 hover:border-primary';
      case 'back':
        return 'glass text-destructive border-destructive/40 hover:border-destructive';
      case 'ok':
        return 'gradient-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.5)]';
      case 'mute':
        return 'opacity-30 pointer-events-none bg-card border border-border text-muted-foreground';
      default:
        return 'glass text-foreground hover:border-primary/60';
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto select-none">
      {rows.flat().map((k, i) => (
        <motion.button
          key={`${i}-${k.key}`}
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => press(k.key)}
          className={`h-12 rounded-2xl font-display font-bold text-xl flex items-center justify-center transition-all border ${toneClass(k.tone)}`}
        >
          {k.label}
        </motion.button>
      ))}
    </div>
  );
};

export default MathKeypad;